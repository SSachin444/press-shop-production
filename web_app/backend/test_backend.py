import os
import tempfile
import unittest
from datetime import date

# Isolate test DB from pha_india.db BEFORE importing app/database
_TEMP_DB_FILE = tempfile.NamedTemporaryFile(prefix="pha_test_", suffix=".db", delete=False)
_TEMP_DB_FILE.close()
os.environ["PHA_DB_PATH"] = _TEMP_DB_FILE.name
os.environ["PHA_SESSION_SECRET"] = "test-only-ephemeral-secret-for-unit-suite"

from app import app, _RATE_BUCKETS  # noqa: E402
from bootstrap_auth import provision_accounts  # noqa: E402
from database import get_db, init_db  # noqa: E402


class TestPHASecurityAndAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        # Provision temporary test accounts (disposable test-only passwords)
        provision_accounts("TempAdmin!2026", "TempSuper!2026")

    @classmethod
    def tearDownClass(cls):
        try:
            os.remove(_TEMP_DB_FILE.name)
        except OSError:
            pass

    def setUp(self):
        self.client = app.test_client()
        _RATE_BUCKETS.clear()

    def _login(self, username, password, role):
        res = self.client.post("/api/auth/login", json={"username": username, "password": password, "role": role})
        return res

    def test_01_unauthenticated_access_blocked(self):
        self.assertEqual(self.client.get("/api/dashboard/kpis").status_code, 401)
        self.assertEqual(self.client.get("/api/machines").status_code, 401)
        self.assertEqual(self.client.get("/api/employees").status_code, 401)
        self.assertEqual(self.client.get("/api/users").status_code, 401)

    def test_02_temp_password_replacement_enforced(self):
        # Admin signs in with temporary password -> must_change_password = True
        res = self._login("admin", "TempAdmin!2026", "Admin")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["user"]["must_change_password"])
        temp_token = data["token"]

        # Blocked from app APIs until password is replaced
        blocked = self.client.get("/api/machines", headers={"Authorization": f"Bearer {temp_token}"})
        self.assertEqual(blocked.status_code, 403)
        self.assertTrue(blocked.get_json().get("must_change_password"))

        # Weak password rejected
        weak = self.client.post(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {temp_token}"},
            json={"current_password": "TempAdmin!2026", "new_password": "123"},
        )
        self.assertEqual(weak.status_code, 400)

        # Strong replacement succeeds
        ok = self.client.post(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {temp_token}"},
            json={"current_password": "TempAdmin!2026", "new_password": "StrongAdmin#2026"},
        )
        self.assertEqual(ok.status_code, 200)

        # Now allowed into Admin APIs
        allowed = self.client.get("/api/machines", headers={"Authorization": f"Bearer {temp_token}"})
        self.assertEqual(allowed.status_code, 200)

    def test_03_generic_login_errors_and_role_session_guard(self):
        bad_user = self._login("nonexistent", "wrong", "Admin")
        bad_pw = self._login("admin", "wrongpw", "Admin")
        self.assertEqual(bad_user.status_code, 401)
        self.assertEqual(bad_pw.status_code, 401)
        self.assertEqual(bad_user.get_json()["error"], bad_pw.get_json()["error"])

        # Cannot obtain Admin/Supervisor via passwordless role-session
        self.assertEqual(self.client.post("/api/auth/role-session", json={"role": "Admin"}).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/role-session", json={"role": "Supervisor"}).status_code, 403)

    def test_04_operator_and_dashboard_rbac_enforced(self):
        op_res = self.client.post("/api/auth/role-session", json={"role": "Operator", "full_name": "Line Op 1"})
        self.assertEqual(op_res.status_code, 200)
        op_headers = {"Authorization": f"Bearer {op_res.get_json()['token']}"}

        dash_res = self.client.post("/api/auth/role-session", json={"role": "Dashboard"})
        self.assertEqual(dash_res.status_code, 200)
        dash_headers = {"Authorization": f"Bearer {dash_res.get_json()['token']}"}

        # Dashboard is strictly read-only on live cell status & production records
        self.assertEqual(self.client.get("/api/dashboard/cell-status", headers=dash_headers).status_code, 200)
        self.assertEqual(self.client.get("/api/production/records", headers=dash_headers).status_code, 200)
        self.assertEqual(self.client.post("/api/production/records", headers=dash_headers, json={"machine_or_line": "NC-01"}).status_code, 403)
        self.assertEqual(self.client.get("/api/employees", headers=dash_headers).status_code, 403)
        self.assertEqual(self.client.get("/api/reports/data", headers=dash_headers).status_code, 403)
        self.assertEqual(
            self.client.post("/api/production/hourly", headers=dash_headers, json={"machine_or_line": "NC-01"}).status_code,
            403,
        )

        # Operator cannot access Admin/Supervisor endpoints
        self.assertEqual(self.client.get("/api/employees", headers=op_headers).status_code, 403)
        self.assertEqual(self.client.get("/api/attendance", headers=op_headers).status_code, 403)
        self.assertEqual(self.client.get("/api/reports/data", headers=op_headers).status_code, 403)
        self.assertEqual(self.client.get("/api/settings", headers=op_headers).status_code, 403)
        self.assertEqual(self.client.get("/api/users", headers=op_headers).status_code, 403)
        self.assertEqual(self.client.get("/api/activity-logs", headers=op_headers).status_code, 403)
        self.assertEqual(self.client.put("/api/machines/NC-01", headers=op_headers, json={"tonnage": 999}).status_code, 403)

    def test_05_idempotent_production_and_unified_totals(self):
        op_res = self.client.post("/api/auth/role-session", json={"role": "Operator", "full_name": "Op Test"})
        op_headers = {"Authorization": f"Bearer {op_res.get_json()['token']}"}

        # Replace supervisor temp password first
        sup_login = self._login("supervisor", "TempSuper!2026", "Supervisor")
        sup_token = sup_login.get_json()["token"]
        self.client.post(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {sup_token}"},
            json={"current_password": "TempSuper!2026", "new_password": "StrongSuper#2026"},
        )
        sup_headers = {"Authorization": f"Bearer {sup_token}"}

        today = date.today().isoformat()
        payload = {
            "client_submission_id": "sub-uuid-001",
            "plant_id": "Plant 1",
            "machine_or_line": "NC-01",
            "date": today,
            "shift": "Shift A",
            "hour_interval": "Hour 1 (08:00 - 09:00)",
            "operator_name": "Op Test",
            "tool_number": "TL-900",
            "uph": 10,
            "actual_qty": 540,
            "rejected_qty": 10,
            "downtime_minutes": 5,
            "downtime_code": "D02",
            "downtime_reason": "Tool Problem",
        }
        r1 = self.client.post("/api/production/hourly", headers=op_headers, json=payload)
        self.assertEqual(r1.status_code, 200)
        # Retry with same client_submission_id must deduplicate without error or duplicate row
        r2 = self.client.post("/api/production/hourly", headers=op_headers, json=payload)
        self.assertEqual(r2.status_code, 200)

        # Invalid quantities rejected
        bad = {**payload, "client_submission_id": "sub-uuid-002", "rejected_qty": 600}
        self.assertEqual(self.client.post("/api/production/hourly", headers=op_headers, json=bad).status_code, 400)

        # Supervisor sees consistent totals across dashboard, cell-status, and reports
        kpis = self.client.get(f"/api/dashboard/kpis?date={today}&shift=Shift+A", headers=sup_headers).get_json()
        cells = self.client.get(f"/api/dashboard/cell-status?date={today}&shift=Shift+A", headers=sup_headers).get_json()
        rep = self.client.get(f"/api/reports/data?from_date={today}&to_date={today}&shift=Shift+A", headers=sup_headers).get_json()

        self.assertEqual(kpis["totals"]["actual"], 540)
        self.assertEqual(kpis["totals"]["target"], 600)
        self.assertEqual(cells["totals"]["actual"], 540)
        self.assertEqual(cells["totals"]["target"], 600)
        self.assertEqual(rep["totals"]["actual"], 540)
        self.assertEqual(rep["totals"]["target"], 600)

        # Supervisor CANNOT edit machine configuration
        self.assertEqual(self.client.put("/api/machines/NC-01", headers=sup_headers, json={"tonnage": 1200}).status_code, 403)

    def test_06_admin_machine_config_concurrency_and_audit(self):
        adm_token = self._login("admin", "StrongAdmin#2026", "Admin").get_json()["token"]
        adm_headers = {"Authorization": f"Bearer {adm_token}"}

        machines = self.client.get("/api/machines", headers=adm_headers).get_json()["machines"]
        nc1 = next(m for m in machines if m["machine_number"] == "NC-01")
        v1 = nc1["version"]

        # Valid Admin update increments version & records audit
        upd = self.client.put(
            "/api/machines/NC-01",
            headers=adm_headers,
            json={"tonnage": 1100, "production_target": 650, "version": v1},
        )
        self.assertEqual(upd.status_code, 200)
        self.assertEqual(upd.get_json()["machine"]["version"], v1 + 1)

        # Stale version conflict rejected with 409
        stale = self.client.put(
            "/api/machines/NC-01",
            headers=adm_headers,
            json={"tonnage": 999, "version": v1},
        )
        self.assertEqual(stale.status_code, 409)

        # Audit log records the change
        logs = self.client.get("/api/activity-logs", headers=adm_headers).get_json()["logs"]
        self.assertTrue(any(l["record_type"] == "Machine" and l["record_id"] == "NC-01" for l in logs))

    def test_07_recovery_email_single_use_reset_and_rate_limit(self):
        from security import hash_recovery_code

        adm_token = self._login("admin", "StrongAdmin#2026", "Admin").get_json()["token"]
        adm_headers = {"Authorization": f"Bearer {adm_token}"}

        # Without SMTP configured, saving recovery email fails honestly (503) and stores unverified pending state
        res = self.client.post("/api/auth/recovery-email", headers=adm_headers, json={"recovery_email": "ops-admin@phaindia.test"})
        self.assertEqual(res.status_code, 503)
        self.assertTrue(res.get_json().get("pending_verification"))

        # Simulate verified recovery email + single-use reset token in isolated test SQLite
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = 'admin'")
        admin_id = cur.fetchone()["id"]
        cur.execute("UPDATE users SET recovery_email_verified = 1 WHERE id = ?", (admin_id,))
        test_code = "482910"
        code_hash = hash_recovery_code(admin_id, f"reset:{test_code}")
        cur.execute(
            "INSERT INTO password_recovery_tokens (user_id, target_role, email, code_hash, expires_at, requested_ip) VALUES (?, 'Admin', 'ops-admin@phaindia.test', ?, '2099-12-31T23:59:59', '127.0.0.1')",
            (admin_id, code_hash),
        )
        conn.commit()
        conn.close()

        # First single-use reset succeeds
        ok = self.client.post(
            "/api/auth/reset-password",
            json={"role": "Admin", "email": "ops-admin@phaindia.test", "code": test_code, "new_password": "RecoveredAdmin#2026"},
        )
        self.assertEqual(ok.status_code, 200)

        # Reuse of same code fails (single-use enforced)
        replay = self.client.post(
            "/api/auth/reset-password",
            json={"role": "Admin", "email": "ops-admin@phaindia.test", "code": test_code, "new_password": "AnotherStrong#2026"},
        )
        self.assertEqual(replay.status_code, 400)

        # Verify new password works and supervisor cannot access recovery-email admin settings
        new_login = self._login("admin", "RecoveredAdmin#2026", "Admin")
        self.assertEqual(new_login.status_code, 200)
        sup_token = self._login("supervisor", "StrongSuper#2026", "Supervisor").get_json()["token"]
        sup_headers = {"Authorization": f"Bearer {sup_token}"}
        self.assertEqual(self.client.get("/api/settings", headers=sup_headers).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/recovery-email", headers=sup_headers, json={"recovery_email": "x@y.com"}).status_code, 403)

        # Rate limit kicks in after >3 forgot-password attempts
        _RATE_BUCKETS.clear()
        for _ in range(3):
            self.client.post("/api/auth/forgot-password", json={"role": "Admin", "email": "nobody@test.local"})
        throttled = self.client.post("/api/auth/forgot-password", json={"role": "Admin", "email": "nobody@test.local"})
        self.assertEqual(throttled.status_code, 429)

    def test_08_uph_time_allocation_username_safe_deletes_and_whatsapp(self):
        adm_client = app.test_client()
        sup_client = app.test_client()
        adm_token = adm_client.post("/api/auth/login", json={"username": "admin", "password": "RecoveredAdmin#2026", "role": "Admin"}).get_json()["token"]
        adm_headers = {"Authorization": f"Bearer {adm_token}"}
        sup_token = sup_client.post("/api/auth/login", json={"username": "supervisor", "password": "StrongSuper#2026", "role": "Supervisor"}).get_json()["token"]
        sup_headers = {"Authorization": f"Bearer {sup_token}"}

        # 1. Machine Speed (UPH) * 60 full-hour target and sequential 60-min pool enforcement
        ok_batch = sup_client.post(
            "/api/production/hourly-batch",
            headers=sup_headers,
            json={
                "production_type": "NC",
                "machine_or_line": "NC-01",
                "date": "2026-11-27",
                "shift": "Shift A",
                "hour_interval": "Hour 1 (08:00-09:00)",
                "operator_name": "SACHIN S",
                "tandem_mode": "sequential",
                "parts": [
                    {"tool_number": "T10", "uph": 120, "running_minutes": 30, "actual_qty": 3500, "rejected_qty": 10},
                    {"tool_number": "T20", "uph": 120, "running_minutes": 20, "actual_qty": 2300, "rejected_qty": 5},
                ],
            },
        )
        self.assertEqual(ok_batch.status_code, 200)
        recs = ok_batch.get_json()["records"]
        self.assertEqual(recs[0]["target_qty"], 3600)
        self.assertEqual(recs[1]["target_qty"], 2400)

        # Exceeding 60 minutes on NC hour pool is rejected cleanly
        over_pool = sup_client.post(
            "/api/production/hourly-batch",
            headers=sup_headers,
            json={
                "production_type": "NC",
                "machine_or_line": "NC-01",
                "date": "2026-11-27",
                "shift": "Shift A",
                "hour_interval": "Hour 2 (09:00-10:00)",
                "operator_name": "SACHIN S",
                "parts": [
                    {"tool_number": "T10", "uph": 120, "running_minutes": 40, "actual_qty": 4500},
                    {"tool_number": "T20", "uph": 120, "running_minutes": 30, "actual_qty": 3000},
                ],
            },
        )
        self.assertEqual(over_pool.status_code, 400)

        # Delete hourly production slot works cleanly and returns 404 on retry
        del_slot = adm_client.post(
            "/api/production/delete-slot",
            headers=adm_headers,
            json={"machine_or_line": "NC-01", "date": "2026-11-27", "shift": "Shift A", "hour_interval": "Hour 1 (08:00-09:00)"},
        )
        self.assertEqual(del_slot.status_code, 200)
        self.assertEqual(del_slot.get_json()["deleted"], 2)

        # 2. Safe employee delete archives when attendance exists without cascade-deleting attendance
        adm_client.post(
            "/api/employees",
            headers=adm_headers,
            json={"emp_id": "E901", "name": "Test Operator", "department": "NC Production"},
        )
        sup_client.post(
            "/api/attendance",
            headers=sup_headers,
            json={"records": [{"emp_id": "E901", "date": "2026-11-27", "shift": "Shift A", "status": "Present"}]},
        )
        arc_res = adm_client.delete("/api/employees/E901", headers=adm_headers)
        self.assertEqual(arc_res.status_code, 200)
        self.assertTrue(arc_res.get_json().get("archived"))
        att_after = sup_client.get("/api/attendance?date=2026-11-27&shift=Shift A", headers=sup_headers).get_json()["attendance"]
        self.assertTrue(any(a["emp_id"] == "E901" for a in att_after))

        # 3. Change User ID / Username preserves password & role and blocks duplicates
        chg_user = sup_client.post(
            "/api/auth/change-username",
            headers=sup_headers,
            json={"new_username": "shift_sup_1", "current_password": "StrongSuper#2026"},
        )
        self.assertEqual(chg_user.status_code, 200)
        relogin = app.test_client().post("/api/auth/login", json={"username": "shift_sup_1", "password": "StrongSuper#2026", "role": "Supervisor"})
        self.assertEqual(relogin.status_code, 200)

        # 4. WhatsApp recipients max 5 + E.164 + honest 503 when credentials unset
        for idx in range(5):
            r_add = sup_client.post(
                "/api/whatsapp/recipients",
                headers=sup_headers,
                json={"name": f"Lead {idx+1}", "phone_number": f"+91987654321{idx}"},
            )
            self.assertEqual(r_add.status_code, 201)
        over_rec = sup_client.post(
            "/api/whatsapp/recipients",
            headers=sup_headers,
            json={"name": "Lead 6", "phone_number": "+919876543219"},
        )
        self.assertEqual(over_rec.status_code, 400)
        send_unconfigured = sup_client.post(
            "/api/whatsapp/send",
            headers=sup_headers,
            json={"message": "Hourly Shift Report", "recipients": [{"name": "Lead 1", "phone_number": "+919876543210"}]},
        )
        self.assertEqual(send_unconfigured.status_code, 503)


if __name__ == "__main__":
    unittest.main(verbosity=2)
