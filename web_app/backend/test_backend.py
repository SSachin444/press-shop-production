import json
import unittest
from datetime import date
from app import app
from database import init_db, get_db

class TestPHABackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        conn = get_db()
        conn.execute("""
        INSERT OR IGNORE INTO employees 
        (emp_id, name, department, designation, shift, assigned_machine, status, basic_salary, hra, da, conveyance, special_allowance, pf_deduction, esi_deduction, tds_deduction, ot_hourly_rate)
        VALUES ('PHA-001', 'Ajay Kumar', 'NC Production', 'CNC Machinist', 'Shift A', 'NC-01', 'Active', 25000, 5000, 2000, 1500, 1000, 1800, 350, 0, 160)
        """)
        conn.commit()
        conn.close()

    def setUp(self):
        self.client = app.test_client()

    def test_01_health(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        # Verify state endpoint
        res_state = self.client.get("/api/state")
        self.assertEqual(res_state.status_code, 200)
        data = res_state.get_json()
        self.assertEqual(data["status"], "success")

    def test_02_state_compatibility(self):
        res = self.client.get("/api/state")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("employees", data)
        self.assertIn("machines", data)
        self.assertIn("attendance", data)
        self.assertIn("production_records", data)
        nc_count = sum(1 for m in data["machines"] if m["machine_type"] == "NC")
        tandem_count = sum(1 for m in data["machines"] if m["machine_type"] == "Tandem")
        self.assertEqual(nc_count, 16)
        self.assertEqual(tandem_count, 6)

    def test_03_dashboard_kpis(self):
        res = self.client.get("/api/dashboard/kpis")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("total_employees", data)
        self.assertIn("shift_production", data)
        self.assertEqual(data["total_nc_machines"], 16)
        self.assertEqual(data["total_tandem_lines"], 6)

    def test_04_employee_workflow(self):
        import time
        uid = f"PHA-{int(time.time())}"
        new_emp = {
            "emp_id": uid,
            "name": "R. Kumar",
            "department": "NC Production",
            "designation": "CNC Operator",
            "shift": "Shift A",
            "assigned_machine": "NC-01",
            "basic_salary": 25000,
            "hra": 5000,
            "ot_hourly_rate": 150
        }
        post_res = self.client.post("/api/employees", json=new_emp)
        self.assertIn(post_res.status_code, [200, 201])

        # Duplicate detection
        dup_res = self.client.post("/api/employees", json=new_emp)
        self.assertEqual(dup_res.status_code, 400)

        # Retrieve
        get_res = self.client.get(f"/api/employees/{uid}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.get_json()["employee"]["name"], "R. Kumar")

        # Update
        put_res = self.client.put(f"/api/employees/{uid}", json={"phone": "9876543210"})
        self.assertEqual(put_res.status_code, 200)

        # Delete
        del_res = self.client.delete(f"/api/employees/{uid}")
        self.assertEqual(del_res.status_code, 200)
        # Verify employee is truly deleted
        verify_get = self.client.get(f"/api/employees/{uid}")
        self.assertEqual(verify_get.status_code, 404)

    def test_05_attendance_and_overtime(self):
        today = date.today().isoformat()
        # Mark attendance for existing employee PHA-001
        att_data = {
            "emp_id": "PHA-001",
            "date": today,
            "shift": "Shift A",
            "status": "Present",
            "check_in_time": "06:02"
        }
        res_att = self.client.post("/api/attendance", json=att_data)
        self.assertEqual(res_att.status_code, 200)

        # Submit overtime
        ot_data = {
            "emp_id": "PHA-001",
            "date": today,
            "shift": "Shift A",
            "ot_hours": 2.5,
            "reason": "Production rush"
        }
        res_ot = self.client.post("/api/overtime", json=ot_data)
        self.assertEqual(res_ot.status_code, 200)

    def test_06_nc_and_tandem_production(self):
        today = date.today().isoformat()
        # NC production for NC-01
        nc_payload = {
            "machine_or_line": "NC-01",
            "date": today,
            "shift": "Shift A",
            "hour_interval": "Hour 1 (06:00-07:00)",
            "operator_name": "Ajay Kumar",
            "tonnage": 1000,
            "target_qty": 75,
            "actual_qty": 72,
            "good_qty": 70,
            "rejected_qty": 2,
            "downtime_minutes": 5,
            "downtime_reason": "Tool adjustment"
        }
        res_nc = self.client.post("/api/production/nc", json=nc_payload)
        self.assertEqual(res_nc.status_code, 200)

        # Tandem production for LP-1
        tandem_payload = {
            "machine_or_line": "LP-1",
            "date": today,
            "shift": "Shift A",
            "hour_interval": "Hour 1 (06:00-07:00)",
            "operator_name": "M. Selvam",
            "tonnage": 1200,
            "target_qty": 100,
            "actual_qty": 98,
            "good_qty": 96,
            "rejected_qty": 2,
            "downtime_minutes": 3,
            "downtime_reason": "Die inspection"
        }
        res_tan = self.client.post("/api/production/tandem", json=tandem_payload)
        self.assertEqual(res_tan.status_code, 200)

    def test_07_hourly_production_and_shift_comparison(self):
        today = date.today().isoformat()
        # Test batch hourly saving
        batch_payload = {
            "records": [
                {
                    "production_type": "NC",
                    "machine_or_line": "NC-01",
                    "date": today,
                    "shift": "Shift A",
                    "hour_interval": "Hour 1 (06:00-07:00)",
                    "target_qty": 75,
                    "actual_qty": 72,
                    "good_qty": 70,
                    "rejected_qty": 2,
                    "downtime_minutes": 0
                },
                {
                    "production_type": "NC",
                    "machine_or_line": "NC-01",
                    "date": today,
                    "shift": "Shift A",
                    "hour_interval": "Hour 2 (07:00-08:00)",
                    "target_qty": 75,
                    "actual_qty": 75,
                    "good_qty": 74,
                    "rejected_qty": 1,
                    "downtime_minutes": 0
                }
            ]
        }
        res_batch = self.client.post("/api/production/hourly", json=batch_payload)
        self.assertEqual(res_batch.status_code, 200)

        res_hourly = self.client.get(f"/api/production/hourly?date={today}&shift=Shift A")
        self.assertEqual(res_hourly.status_code, 200)
        data_h = res_hourly.get_json()
        self.assertIn("records", data_h)
        self.assertIn("summary", data_h)

        res_comp = self.client.get(f"/api/production/shift-comparison?date={today}")
        self.assertEqual(res_comp.status_code, 200)
        data_c = res_comp.get_json()
        self.assertIn("Shift A", data_c["shifts"])
        self.assertIn("Shift B", data_c["shifts"])
        self.assertIn("Shift C", data_c["shifts"])

    def test_08_shift_handover(self):
        today = date.today().isoformat()
        payload = {
            "date": today,
            "outgoing_shift": "Shift A",
            "incoming_shift": "Shift B",
            "department_or_machine": "NC-01",
            "handover_notes": "Running smooth. Die set for next batch ready on table.",
            "production_status": "72 pcs done",
            "responsible_person": "Supervisor A"
        }
        res = self.client.post("/api/handovers", json=payload)
        self.assertEqual(res.status_code, 201)

    def test_09_salary_calculation(self):
        # Salary endpoint requires Admin or Management role
        headers = {"Authorization": "Bearer admin:Admin"}
        res = self.client.get("/api/salary", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("salary_sheets", data)
        self.assertGreater(len(data["salary_sheets"]), 0)
        # Verify calculation logic
        sheet = data["salary_sheets"][0]
        self.assertEqual(sheet["gross_salary"], sheet["basic_salary"] + sheet["hra"] + sheet["da"] + sheet["conveyance"] + sheet["special_allowance"] + sheet["ot_pay"])
        self.assertEqual(sheet["net_salary"], sheet["gross_salary"] - sheet["total_deductions"])

    def test_10_spa_state_persistence_and_employee_delete(self):
        # 1. Post a full SPA state
        spa_state = {
            "manpower": [
                {"id": "EMP-001", "empId": "EMP-001", "name": "John Doe", "machineId": "NC-01", "role": "Senior Operator", "status": "Present", "remarks": ""},
                {"id": "EMP-002", "empId": "EMP-002", "name": "Jane Smith", "machineId": "NC-02", "role": "Operator", "status": "Present", "remarks": ""}
            ],
            "machines": [
                {"id": "NC-01", "no": "NC-01", "tonnage": 200, "operation": "Press", "plan": 500, "status": "Active", "remarks": ""}
            ],
            "production": [
                {"id": "prod-1", "date": "2026-10-26", "machineId": "NC-01", "toolNo": "ABC12", "hour": 1, "qty": 65, "operatorId": "EMP-001", "remarks": "Normal run"}
            ],
            "attendance": {
                "2026-10-26": {"EMP-001": {"status": "Present", "remarks": "On time"}}
            },
            "settings": {"supervisor": "Kumar", "shift": "Shift A"},
            "quick": {}
        }
        res = self.client.post("/api/state", json=spa_state)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["status"], "success")

        # 2. Get state back
        res_get = self.client.get("/api/state")
        self.assertEqual(res_get.status_code, 200)
        data = res_get.get_json()
        self.assertEqual(len(data["manpower"]), 2)
        self.assertEqual(data["production"][0]["toolNo"], "ABC12")
        self.assertEqual(data["settings"]["supervisor"], "Kumar")

        # 3. Delete an employee in SPA by removing EMP-002 from manpower
        spa_state["manpower"] = [
            {"id": "EMP-001", "empId": "EMP-001", "name": "John Doe", "machineId": "NC-01", "role": "Senior Operator", "status": "Present", "remarks": ""}
        ]
        res_del = self.client.post("/api/state", json=spa_state)
        self.assertEqual(res_del.status_code, 200)

        # 4. Verify EMP-002 is deleted from state and database
        res_after = self.client.get("/api/state")
        data_after = res_after.get_json()
        emp_ids = [m["empId"] for m in data_after["manpower"]]
        self.assertIn("EMP-001", emp_ids)
        self.assertNotIn("EMP-002", emp_ids)

if __name__ == "__main__":
    unittest.main()
