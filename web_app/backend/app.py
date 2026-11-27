import csv
import io
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, date, timedelta, timezone
from flask import Flask, request, jsonify, Response, send_from_directory, g, make_response
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import get_db, init_db, get_full_state, get_current_shift, save_app_state, get_app_state
from metrics import compute_shift_metrics
from security import (
    VALID_ROLES,
    SESSION_TTL_SECONDS,
    hash_password,
    verify_password,
    validate_strong_password,
    sign_session_token,
    extract_session_from_request,
    hash_recovery_code,
    generate_six_digit_code,
    require_roles,
    send_smtp_email,
)

app = Flask(__name__)
_cors_origins = [
    o.strip()
    for o in os.environ.get(
        "PHA_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    ).split(",")
    if o.strip()
]
CORS(app, resources={r"/api/*": {"origins": _cors_origins}}, supports_credentials=True)

with app.app_context():
    init_db()

REVOKED_TOKENS: set[str] = set()
_RATE_BUCKETS: dict[str, list[float]] = defaultdict(list)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.dirname(BACKEND_DIR)
ROOT_DIR = os.path.dirname(WEB_APP_DIR)
DIST_DIR = os.path.join(WEB_APP_DIR, "dist") if os.path.exists(os.path.join(WEB_APP_DIR, "dist")) else os.path.join(ROOT_DIR, "dist")
APK_DIR = os.path.join(WEB_APP_DIR, "apk") if os.path.exists(os.path.join(WEB_APP_DIR, "apk")) else os.path.join(ROOT_DIR, "apk")


def _auth(*roles, allow_pending_pw=False):
    return require_roles(
        *roles,
        get_db_fn=get_db,
        revoked_tokens=REVOKED_TOKENS,
        allow_pending_password_change=allow_pending_pw,
    )


def _check_rate_limit(key: str, max_hits: int, window_seconds: int) -> bool:
    import time
    now = time.time()
    recent = [t for t in _RATE_BUCKETS[key] if now - t < window_seconds]
    _RATE_BUCKETS[key] = recent
    if len(recent) >= max_hits:
        return False
    recent.append(now)
    return True


def _log_audit(conn, user_name: str, actor_role: str, action: str, record_type: str, record_id: str, details: str, old_val=None, new_val=None):
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO activity_logs (user_name, actor_role, action, record_type, record_id, details, old_value, new_value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_name,
            actor_role,
            action,
            record_type,
            str(record_id or ""),
            details,
            json.dumps(old_val) if old_val is not None else "",
            json.dumps(new_val) if new_val is not None else "",
        ),
    )


# ------------------------------------------------------------------
# HEALTH, FRONTEND & APK DOWNLOAD
# ------------------------------------------------------------------
@app.route("/download-apk")
@app.route("/api/download-apk")
@app.route("/PRESS_SHOP_MFG-2.apk")
def download_apk():
    apk_filename = "PRESS_SHOP_MFG-2.apk"
    candidate_dirs = [
        os.path.join(WEB_APP_DIR, "public"),
        APK_DIR,
        os.path.join(WEB_APP_DIR, "apk"),
        os.path.join(ROOT_DIR, "apk"),
        DIST_DIR,
    ]
    target_dir = next((d for d in candidate_dirs if os.path.exists(os.path.join(d, apk_filename))), None)
    if not target_dir:
        return jsonify({"error": "APK not found. Build the Android APK first."}), 404
    return send_from_directory(
        target_dir,
        apk_filename,
        as_attachment=True,
        mimetype="application/vnd.android.package-archive",
    )


@app.route("/api/health")
def api_health():
    return jsonify({
        "status": "success",
        "system": "PHA INDIA PRIVATE LIMITED",
        "plant": "Plant 1",
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/"):
        return jsonify({"error": "Endpoint not found"}), 404
    if path != "" and os.path.exists(os.path.join(DIST_DIR, path)):
        return send_from_directory(DIST_DIR, path)
    if os.path.exists(os.path.join(DIST_DIR, "index.html")):
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify({"system": "PHA INDIA PRIVATE LIMITED", "status": "operational"})


# ------------------------------------------------------------------
# AUTHENTICATION, ROLE GATEWAY & RECOVERY
# ------------------------------------------------------------------
@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))
    expected_role = str(data.get("role", "")).strip()

    ip = request.remote_addr or "unknown"
    if not _check_rate_limit(f"login:{ip}", 20, 300):
        return jsonify({"error": "Too many sign-in attempts. Please wait a few minutes."}), 429

    if not username or not password:
        return jsonify({"error": "Invalid credentials."}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE LOWER(username) = ?", (username,))
    user = cur.fetchone()

    if not user or not user["is_active"] or not verify_password(password, user["password_hash"]):
        conn.close()
        return jsonify({"error": "Invalid credentials."}), 401

    if expected_role and expected_role in ("Admin", "Supervisor") and user["role"] != expected_role:
        conn.close()
        return jsonify({"error": "Invalid credentials."}), 401

    cur.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", (user["id"],))
    _log_audit(conn, user["username"], user["role"], "LOGIN", "Auth", str(user["id"]), f"{user['role']} signed in")
    conn.commit()
    conn.close()

    token = sign_session_token({
        "uid": user["id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "role": user["role"],
    })
    resp_data = {
        "success": True,
        "token": token,
        "expires_in": SESSION_TTL_SECONDS,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "department": user["department"],
            "must_change_password": bool(user["must_change_password"]),
            "recovery_email": user["recovery_email"] or "" if user["role"] == "Admin" else "",
            "recovery_email_verified": bool(user["recovery_email_verified"]) if user["role"] == "Admin" else False,
        },
    }
    resp = make_response(jsonify(resp_data))
    resp.set_cookie(
        "pha_session",
        token,
        httponly=True,
        samesite="Lax",
        secure=request.is_secure,
        max_age=SESSION_TTL_SECONDS,
    )
    return resp


@app.route("/api/auth/role-session", methods=["POST"])
def create_unauthenticated_role_session():
    """Issue strictly restricted signed session for passwordless Operator or Dashboard roles ONLY."""
    data = request.get_json(silent=True) or {}
    role = str(data.get("role", "")).strip()
    display_name = str(data.get("full_name", "")).strip()

    if role not in ("Operator", "Dashboard"):
        return jsonify({"error": "Password authentication is required for Admin and Supervisor."}), 403

    username = "operator" if role == "Operator" else "dashboard_kiosk"
    full_name = display_name or ("Line Operator" if role == "Operator" else "Shopfloor Monitor")

    token = sign_session_token({
        "uid": None,
        "username": username,
        "full_name": full_name,
        "role": role,
    })

    resp = make_response(jsonify({
        "success": True,
        "token": token,
        "expires_in": SESSION_TTL_SECONDS,
        "user": {
            "username": username,
            "full_name": full_name,
            "role": role,
            "department": "Press Shop MFG-2",
            "must_change_password": False,
        },
    }))
    resp.set_cookie("pha_session", token, httponly=True, samesite="Lax", secure=request.is_secure, max_age=SESSION_TTL_SECONDS)
    return resp


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    user = extract_session_from_request(get_db, REVOKED_TOKENS)
    if user and user.get("token"):
        REVOKED_TOKENS.add(user["token"])
    resp = make_response(jsonify({"success": True}))
    resp.delete_cookie("pha_session")
    return resp


@app.route("/api/auth/me", methods=["GET"])
def me():
    user = extract_session_from_request(get_db, REVOKED_TOKENS)
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({
        "user": {
            "id": user.get("uid"),
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "department": user["department"],
            "must_change_password": user.get("must_change_password", False),
            "recovery_email": user.get("recovery_email", "") if user["role"] == "Admin" else "",
            "recovery_email_verified": user.get("recovery_email_verified", False) if user["role"] == "Admin" else False,
        }
    })


@app.route("/api/auth/change-password", methods=["POST"])
@_auth("Admin", "Supervisor", allow_pending_pw=True)
def change_password():
    data = request.get_json(silent=True) or {}
    current_pw = str(data.get("current_password", ""))
    new_pw = str(data.get("new_password", ""))

    pw_err = validate_strong_password(new_pw)
    if pw_err:
        return jsonify({"error": pw_err}), 400
    if current_pw == new_pw:
        return jsonify({"error": "New password must differ from current password."}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (g.current_user["uid"],))
    user = cur.fetchone()
    if not user or not verify_password(current_pw, user["password_hash"]):
        conn.close()
        return jsonify({"error": "Current password is incorrect."}), 400

    new_hash = hash_password(new_pw)
    cur.execute(
        "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (new_hash, user["id"]),
    )
    cur.execute(
        "INSERT INTO recovery_audit_logs (target_role, event_type, success, detail, ip_address) VALUES (?, 'PASSWORD_CHANGED', 1, ?, ?)",
        (user["role"], f"{user['username']} replaced password", request.remote_addr or ""),
    )
    _log_audit(conn, user["username"], user["role"], "UPDATE", "Auth", str(user["id"]), "Password changed")
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Password updated successfully."})


@app.route("/api/auth/change-username", methods=["POST"])
@_auth("Admin", "Supervisor")
def change_username():
    data = request.get_json(silent=True) or {}
    current_pw = str(data.get("current_password", ""))
    new_username = str(data.get("new_username", "")).strip().lower()

    if not re.match(r"^[a-z0-9][a-z0-9._-]{2,31}$", new_username):
        return jsonify({"error": "User ID must be 3-32 characters (letters, numbers, ., _, -)."}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (g.current_user["uid"],))
    user = cur.fetchone()
    if not user or not verify_password(current_pw, user["password_hash"]):
        conn.close()
        return jsonify({"error": "Current password is incorrect."}), 400

    if new_username == user["username"].lower():
        conn.close()
        return jsonify({"error": "New User ID must differ from your current User ID."}), 400

    cur.execute("SELECT id FROM users WHERE LOWER(username) = ? AND id != ?", (new_username, user["id"]))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": f'User ID "{new_username}" is already in use.'}), 409

    cur.execute("UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_username, user["id"]))
    cur.execute(
        "INSERT INTO recovery_audit_logs (target_role, event_type, success, detail, ip_address) VALUES (?, 'USERNAME_CHANGED', 1, ?, ?)",
        (user["role"], f"{user['username']} -> {new_username}", request.remote_addr or ""),
    )
    _log_audit(conn, new_username, user["role"], "UPDATE", "Account", str(user["id"]), f"Changed User ID from {user['username']} to {new_username}")
    conn.commit()
    conn.close()

    token = sign_session_token({
        "uid": user["id"],
        "username": new_username,
        "full_name": user["full_name"],
        "role": user["role"],
    })
    return jsonify({"success": True, "username": new_username, "token": token})


@app.route("/api/auth/recovery-email", methods=["POST"])
@_auth("Admin")
def set_recovery_email():
    data = request.get_json(silent=True) or {}
    email = str(data.get("recovery_email", "")).strip().lower()
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return jsonify({"error": "Enter a valid recovery email address."}), 400

    code = generate_six_digit_code()
    code_hash = hash_recovery_code(g.current_user["uid"], f"verify:{email}:{code}")
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).replace(tzinfo=None).isoformat()

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET recovery_email = ?, recovery_email_verified = 0,
            recovery_verify_code_hash = ?, recovery_verify_expires_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (email, code_hash, expires_at, g.current_user["uid"]),
    )

    sent, detail = send_smtp_email(
        email,
        "PHA INDIA Press Shop — Verify Recovery Email",
        f"Your single-use recovery email verification code is: {code}\n\nThis code expires in 15 minutes.",
    )
    cur.execute(
        "INSERT INTO recovery_audit_logs (target_role, email, event_type, success, detail, ip_address) VALUES ('Admin', ?, 'RECOVERY_EMAIL_VERIFICATION_SENT', ?, ?, ?)",
        (email, 1 if sent else 0, detail, request.remote_addr or ""),
    )
    conn.commit()
    conn.close()

    if not sent:
        return jsonify({
            "error": "Recovery email saved as pending verification, but email delivery is unavailable because SMTP credentials are not configured.",
            "pending_verification": True,
        }), 503

    return jsonify({"success": True, "message": "Verification code sent to recovery email."})


@app.route("/api/auth/verify-recovery-email", methods=["POST"])
@_auth("Admin")
def verify_recovery_email():
    data = request.get_json(silent=True) or {}
    code = str(data.get("code", "")).strip()

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (g.current_user["uid"],))
    user = cur.fetchone()
    if not user or not user["recovery_email"] or not user["recovery_verify_code_hash"]:
        conn.close()
        return jsonify({"error": "No pending verification found."}), 400

    if datetime.now(timezone.utc).replace(tzinfo=None) > datetime.fromisoformat(user["recovery_verify_expires_at"].replace("Z", "")):
        conn.close()
        return jsonify({"error": "Verification code expired."}), 400

    expected = hash_recovery_code(user["id"], f"verify:{user['recovery_email']}:{code}")
    if expected != user["recovery_verify_code_hash"]:
        cur.execute(
            "INSERT INTO recovery_audit_logs (target_role, email, event_type, success, ip_address) VALUES ('Admin', ?, 'RECOVERY_EMAIL_VERIFY_FAILED', 0, ?)",
            (user["recovery_email"], request.remote_addr or ""),
        )
        conn.commit()
        conn.close()
        return jsonify({"error": "Invalid verification code."}), 400

    cur.execute(
        "UPDATE users SET recovery_email_verified = 1, recovery_verify_code_hash = '', recovery_verify_expires_at = '' WHERE id = ?",
        (user["id"],),
    )
    cur.execute(
        "INSERT INTO recovery_audit_logs (target_role, email, event_type, success, ip_address) VALUES ('Admin', ?, 'RECOVERY_EMAIL_VERIFIED', 1, ?)",
        (user["recovery_email"], request.remote_addr or ""),
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Recovery email verified."})


@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    ip = request.remote_addr or "unknown"
    if not _check_rate_limit(f"forgot:{ip}", 3, 900):
        return jsonify({"error": "Too many recovery requests. Please wait 15 minutes."}), 429

    data = request.get_json(silent=True) or {}
    role = "Supervisor" if data.get("role") == "Supervisor" else "Admin"
    email = str(data.get("email", "")).strip().lower()

    generic_msg = "If a verified recovery email matches this account, a short-lived single-use reset code has been sent."

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM users WHERE role = ? AND LOWER(recovery_email) = ? AND recovery_email_verified = 1 AND is_active = 1",
        (role, email),
    )
    user = cur.fetchone()
    if not user:
        cur.execute(
            "INSERT INTO recovery_audit_logs (target_role, email, event_type, success, detail, ip_address) VALUES (?, ?, 'RESET_REQUEST', 0, 'No verified match', ?)",
            (role, email, ip),
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": generic_msg})

    code = generate_six_digit_code()
    code_hash = hash_recovery_code(user["id"], f"reset:{code}")
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).replace(tzinfo=None).isoformat()
    cur.execute(
        "INSERT INTO password_recovery_tokens (user_id, target_role, email, code_hash, expires_at, requested_ip) VALUES (?, ?, ?, ?, ?, ?)",
        (user["id"], role, email, code_hash, expires_at, ip),
    )

    sent, detail = send_smtp_email(
        email,
        "PHA INDIA Press Shop — Password Reset Code",
        f"Your single-use password reset code is: {code}\n\nThis code expires in 15 minutes.",
    )
    cur.execute(
        "INSERT INTO recovery_audit_logs (target_role, email, event_type, success, detail, ip_address) VALUES (?, ?, 'RESET_REQUEST', ?, ?, ?)",
        (role, email, 1 if sent else 0, detail, ip),
    )
    conn.commit()
    conn.close()

    if not sent:
        return jsonify({
            "error": "Email recovery cannot complete because SMTP email delivery is not configured on the server.",
        }), 503

    return jsonify({"success": True, "message": generic_msg})


@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    ip = request.remote_addr or "unknown"
    if not _check_rate_limit(f"reset:{ip}", 5, 900):
        return jsonify({"error": "Too many reset attempts. Please wait 15 minutes."}), 429

    data = request.get_json(silent=True) or {}
    role = "Supervisor" if data.get("role") == "Supervisor" else "Admin"
    email = str(data.get("email", "")).strip().lower()
    code = str(data.get("code", "")).strip()
    new_pw = str(data.get("new_password", ""))

    pw_err = validate_strong_password(new_pw)
    if pw_err:
        return jsonify({"error": pw_err}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM password_recovery_tokens
        WHERE target_role = ? AND LOWER(email) = ? AND (used_at IS NULL OR used_at = '')
        ORDER BY id DESC LIMIT 1
        """,
        (role, email),
    )
    token_row = cur.fetchone()
    if not token_row or token_row["attempt_count"] >= 5 or datetime.now(timezone.utc).replace(tzinfo=None) > datetime.fromisoformat(token_row["expires_at"].replace("Z", "")):
        cur.execute(
            "INSERT INTO recovery_audit_logs (target_role, email, event_type, success, detail, ip_address) VALUES (?, ?, 'RESET_CONFIRM', 0, 'Invalid/expired token', ?)",
            (role, email, ip),
        )
        conn.commit()
        conn.close()
        return jsonify({"error": "Invalid or expired reset code."}), 400

    expected = hash_recovery_code(token_row["user_id"], f"reset:{code}")
    if expected != token_row["code_hash"]:
        cur.execute("UPDATE password_recovery_tokens SET attempt_count = attempt_count + 1 WHERE id = ?", (token_row["id"],))
        cur.execute(
            "INSERT INTO recovery_audit_logs (target_role, email, event_type, success, detail, ip_address) VALUES (?, ?, 'RESET_CONFIRM', 0, 'Code mismatch', ?)",
            (role, email, ip),
        )
        conn.commit()
        conn.close()
        return jsonify({"error": "Invalid or expired reset code."}), 400

    cur.execute("UPDATE password_recovery_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?", (token_row["id"],))
    cur.execute(
        "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (hash_password(new_pw), token_row["user_id"]),
    )
    cur.execute(
        "INSERT INTO recovery_audit_logs (target_role, email, event_type, success, detail, ip_address) VALUES (?, ?, 'RESET_CONFIRM', 1, 'Password reset completed', ?)",
        (role, email, ip),
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Password reset successfully. Sign in with your new password."})


# ------------------------------------------------------------------
# ADMIN USER & ROLE MANAGEMENT
# ------------------------------------------------------------------
@app.route("/api/users", methods=["GET", "POST"])
@_auth("Admin")
def manage_users():
    conn = get_db()
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        username = str(data.get("username", "")).strip().lower()
        full_name = str(data.get("full_name", "")).strip()
        role = "Admin" if data.get("role") == "Admin" else "Supervisor"
        temp_pw = str(data.get("temp_password") or data.get("password") or "")
        dept = str(data.get("department", "Press Shop MFG-2")).strip()

        if not username or not full_name or len(temp_pw) < 6:
            conn.close()
            return jsonify({"error": "Username, full name, and temporary password are required."}), 400

        cur.execute("SELECT id FROM users WHERE LOWER(username) = ?", (username,))
        if cur.fetchone():
            conn.close()
            return jsonify({"error": "Username already exists."}), 400

        cur.execute(
            """
            INSERT INTO users (username, password_hash, full_name, role, department, must_change_password, is_active)
            VALUES (?, ?, ?, ?, ?, 1, 1)
            """,
            (username, hash_password(temp_pw), full_name, role, dept),
        )
        _log_audit(conn, g.current_user["username"], "Admin", "CREATE", "User", username, f"Created {role} user {username}")
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"User {username} created with temporary password."}), 201

    cur.execute("SELECT id, username, full_name, role, department, recovery_email, recovery_email_verified, must_change_password, is_active, last_login_at, created_at FROM users ORDER BY role, username")
    users = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"success": True, "users": users})


@app.route("/api/users/<int:user_id>", methods=["PATCH"])
@_auth("Admin")
def update_user_account(user_id):
    data = request.get_json(silent=True) or {}
    if user_id == g.current_user["uid"] and data.get("is_active") is False:
        return jsonify({"error": "You cannot deactivate your own active Admin account."}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "User not found."}), 404

    next_active = existing["is_active"] if "is_active" not in data else (1 if data["is_active"] else 0)
    next_role = existing["role"]
    if "role" in data and data["role"] in ("Admin", "Supervisor"):
        next_role = data["role"]
    next_name = str(data.get("full_name", existing["full_name"])).strip() or existing["full_name"]
    next_username = str(data.get("username", existing["username"])).strip().lower() or existing["username"]
    if next_username != existing["username"]:
        cur.execute("SELECT id FROM users WHERE LOWER(username) = ? AND id != ?", (next_username, user_id))
        if cur.fetchone():
            conn.close()
            return jsonify({"error": f'Username "{next_username}" is already in use.'}), 409

    cur.execute(
        "UPDATE users SET username = ?, is_active = ?, role = ?, full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (next_username, next_active, next_role, next_name, user_id),
    )
    pw_val = data.get("temp_password") or data.get("new_password")
    if pw_val:
        cur.execute(
            "UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?",
            (hash_password(str(pw_val)), user_id),
        )

    _log_audit(conn, g.current_user["username"], "Admin", "UPDATE", "User", next_username, f"Updated role={next_role}, active={bool(next_active)}")
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ------------------------------------------------------------------
# DASHBOARD & CELL STATUS (UNIFIED METRICS)
# ------------------------------------------------------------------
@app.route("/api/dashboard/kpis", methods=["GET"])
@_auth("Admin", "Supervisor")
def get_dashboard_kpis():
    selected_date = request.args.get("date", date.today().isoformat())
    selected_shift = request.args.get("shift", get_current_shift())
    machine_group = request.args.get("group", "ALL")

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM machines ORDER BY machine_type ASC, machine_number ASC")
    machines = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM production_records WHERE date = ? AND shift = ? ORDER BY id DESC", (selected_date, selected_shift))
    shift_records = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM machine_downtime WHERE status = 'Open'")
    open_dts = [dict(r) for r in cur.fetchall()]

    unified = compute_shift_metrics(shift_records, machines, open_dts, machine_group)

    hour_slots = [
        ("Hour 1", "08:00 - 09:00"),
        ("Hour 2", "09:00 - 10:00"),
        ("Hour 3", "10:00 - 11:00"),
        ("Hour 4", "11:00 - 12:00"),
        ("Hour 5", "12:30 - 13:30"),
        ("Hour 6", "13:30 - 14:30"),
        ("Hour 7", "14:30 - 15:30"),
        ("Hour 8", "15:30 - 16:30"),
    ]
    hourly_breakdown = []
    for h_key, h_span in hour_slots:
        slot_recs = [
            r for r in shift_records
            if (h_key in str(r.get("hour_interval", "")) or h_span in str(r.get("hour_interval", "")))
            and (machine_group.upper() == "ALL" or r.get("production_type", "").upper() == machine_group.upper())
        ]
        hourly_breakdown.append({
            "hour": h_key,
            "hour_interval": f"{h_key} ({h_span})",
            "actual": sum(int(r.get("actual_qty") or 0) for r in slot_recs),
            "target": sum(int(r.get("target_qty") or 0) for r in slot_recs),
        })

    cur.execute("SELECT COUNT(*) FROM employees WHERE status = 'Active'")
    total_employees = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM attendance WHERE date = ? AND shift = ? AND status IN ('Present', 'On-Duty')", (selected_date, selected_shift))
    present_employees = cur.fetchone()[0]
    conn.close()

    return jsonify({
        "date": selected_date,
        "shift": selected_shift,
        "plant_id": request.args.get("plant", "Plant 1"),
        "machine_group": machine_group,
        "totals": unified["totals"],
        "machine_counts": unified["machine_counts"],
        "machine_performance": unified["machines"],
        "hourly_breakdown": hourly_breakdown,
        "recent_production": shift_records[:12],
        "total_employees": total_employees,
        "employees_present": present_employees,
    })


@app.route("/api/dashboard/cell-status", methods=["GET"])
@_auth("Admin", "Supervisor", "Operator", "Dashboard")
def get_cell_status():
    selected_date = request.args.get("date", date.today().isoformat())
    selected_shift = request.args.get("shift", get_current_shift())
    filter_type = request.args.get("type", "ALL").upper()

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM machines ORDER BY machine_type ASC, machine_number ASC")
    machines = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM production_records WHERE date = ? AND shift = ?", (selected_date, selected_shift))
    shift_records = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM machine_downtime WHERE status = 'Open'")
    open_dts = [dict(r) for r in cur.fetchall()]
    conn.close()

    unified = compute_shift_metrics(shift_records, machines, open_dts, filter_type)
    return jsonify({
        "status": "success",
        "date": selected_date,
        "shift": selected_shift,
        "plant_id": "Plant 1",
        "totals": unified["totals"],
        "machine_counts": unified["machine_counts"],
        "machines": unified["machines"],
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    })


# ------------------------------------------------------------------
# MACHINES DIRECTORY & ADMIN CONFIGURATION
# ------------------------------------------------------------------
@app.route("/api/machines", methods=["GET", "POST"])
def machines_api():
    if request.method == "GET":
        @_auth("Admin", "Supervisor", "Operator", "Dashboard")
        def _get():
            m_type = request.args.get("type", "")
            conn = get_db()
            cur = conn.cursor()
            query = "SELECT * FROM machines WHERE 1=1"
            params = []
            if m_type:
                query += " AND machine_type = ?"
                params.append(m_type)
            query += " ORDER BY machine_type ASC, machine_number ASC"
            cur.execute(query, params)
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return jsonify({"machines": rows, "count": len(rows)})
        return _get()

    @_auth("Admin")
    def _post():
        data = request.get_json(silent=True) or {}
        m_num = str(data.get("machine_number", "")).strip().upper()
        m_type = "Tandem" if data.get("machine_type") == "Tandem" else "NC"
        tonnage = float(data.get("tonnage", 0) or 0)
        target = int(data.get("production_target", 500) or 500)
        if not m_num or tonnage < 0 or target < 0:
            return jsonify({"error": "Valid machine number, non-negative tonnage and target required."}), 400

        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM machines WHERE machine_number = ?", (m_num,))
        if cur.fetchone():
            conn.close()
            return jsonify({"error": f"Machine {m_num} already exists."}), 400

        cur.execute(
            """
            INSERT INTO machines (machine_number, machine_type, machine_group, plant_id, tonnage, production_target, status, assigned_operator, assigned_shift, maintenance_notes, version, updated_by)
            VALUES (?, ?, ?, 'Plant 1', ?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                m_num,
                m_type,
                m_type,
                tonnage,
                target,
                data.get("status", "Idle"),
                data.get("assigned_operator", ""),
                data.get("assigned_shift", "Shift A"),
                data.get("maintenance_notes", ""),
                g.current_user["username"],
            ),
        )
        _log_audit(conn, g.current_user["username"], "Admin", "CREATE", "Machine", m_num, f"Created machine {m_num} ({m_type}, {tonnage}T)")
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Machine {m_num} registered."}), 201
    return _post()


@app.route("/api/machines/<machine_number>", methods=["PUT", "DELETE"])
@_auth("Admin")
def single_machine_api(machine_number):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM machines WHERE machine_number = ?", (machine_number,))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Machine not found."}), 404

    if request.method == "DELETE":
        cur.execute("DELETE FROM machines WHERE machine_number = ?", (machine_number,))
        _log_audit(conn, g.current_user["username"], "Admin", "DELETE", "Machine", machine_number, f"Deleted machine {machine_number}", dict(existing), None)
        conn.commit()
        conn.close()
        return jsonify({"success": True})

    data = request.get_json(silent=True) or {}
    expected_version = data.get("version")
    if expected_version is not None and int(expected_version) != int(existing["version"]):
        conn.close()
        return jsonify({"error": "Conflict: machine was updated by another session. Reload before saving.", "conflict": True}), 409

    next_number = str(data.get("machine_number", existing["machine_number"])).strip().upper()
    next_type = data.get("machine_type", existing["machine_type"])
    if next_type not in ("NC", "Tandem"):
        conn.close()
        return jsonify({"error": "Machine type must be NC or Tandem."}), 400
    next_tonnage = float(data.get("tonnage", existing["tonnage"]))
    next_target = int(data.get("production_target", existing["production_target"]))
    next_status = data.get("status", existing["status"])
    if next_status not in ("Running", "Idle", "Maintenance", "Breakdown") or next_tonnage < 0 or next_target < 0:
        conn.close()
        return jsonify({"error": "Invalid machine configuration values."}), 400

    next_version = int(existing["version"]) + 1
    cur.execute(
        """
        UPDATE machines SET
            machine_number = ?,
            machine_type = ?,
            machine_group = ?,
            tonnage = ?,
            production_target = ?,
            status = ?,
            assigned_operator = ?,
            assigned_shift = ?,
            maintenance_notes = ?,
            version = ?,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = ?
        WHERE id = ?
        """,
        (
            next_number,
            next_type,
            next_type,
            next_tonnage,
            next_target,
            next_status,
            data.get("assigned_operator", existing["assigned_operator"] or ""),
            data.get("assigned_shift", existing["assigned_shift"] or "Shift A"),
            data.get("maintenance_notes", existing["maintenance_notes"] or ""),
            next_version,
            g.current_user["username"],
            existing["id"],
        ),
    )
    cur.execute("SELECT * FROM machines WHERE id = ?", (existing["id"],))
    updated = dict(cur.fetchone())
    _log_audit(
        conn,
        g.current_user["username"],
        "Admin",
        "UPDATE",
        "Machine",
        next_number,
        f"Updated {machine_number} config (v{existing['version']} -> v{next_version})",
        dict(existing),
        updated,
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True, "machine": updated})


# ------------------------------------------------------------------
# PRODUCTION RECORDS & IDEMPOTENT HOURLY ENTRY
# ------------------------------------------------------------------
@app.route("/api/production/hourly", methods=["GET", "POST", "OPTIONS"])
def hourly_production_api():
    if request.method == "OPTIONS":
        return "", 200

    if request.method == "GET":
        @_auth("Admin", "Supervisor", "Operator")
        def _get():
            filter_date = request.args.get("date", date.today().isoformat())
            filter_shift = request.args.get("shift", "")
            machine = request.args.get("machine_or_line") or request.args.get("machine") or ""
            conn = get_db()
            cur = conn.cursor()
            query = "SELECT * FROM production_records WHERE date = ?"
            params = [filter_date]
            if filter_shift:
                query += " AND shift = ?"
                params.append(filter_shift)
            if machine:
                query += " AND UPPER(machine_or_line) = ?"
                params.append(machine.upper())
            query += " ORDER BY hour_interval ASC, machine_or_line ASC"
            cur.execute(query, params)
            records = [dict(r) for r in cur.fetchall()]
            conn.close()
            return jsonify({"records": records})
        return _get()

    @_auth("Admin", "Supervisor", "Operator")
    def _post():
        data = request.get_json(silent=True) or {}
        items = data.get("records") if isinstance(data.get("records"), list) else [data]
        conn = get_db()
        cur = conn.cursor()
        saved_records = []

        for item in items:
            m_num = str(item.get("machine_or_line", "")).strip().upper()
            p_date = str(item.get("date", "")).strip()
            p_shift = str(item.get("shift", "")).strip()
            hour_interval = str(item.get("hour_interval", "")).strip()
            sub_id = str(item.get("client_submission_id", "")).strip() or None

            if not m_num or not p_date or p_shift not in ("Shift A", "Shift B", "Shift C") or not hour_interval:
                conn.close()
                return jsonify({"error": "Machine, date, shift, and hour interval are required."}), 400

            if sub_id:
                cur.execute("SELECT * FROM production_records WHERE client_submission_id = ?", (sub_id,))
                dup = cur.fetchone()
                if dup:
                    saved_records.append(dict(dup))
                    continue

            try:
                actual_qty = int(item["actual_qty"])
                rejected_qty = int(item.get("rejected_qty", 0) or 0)
                downtime_min = int(item.get("downtime_minutes", 0) or 0)
                uph_val = float(item.get("uph", 0) or 0)
                running_min = float(item.get("running_minutes", 60) or 60)
                if running_min <= 0 or running_min > 60:
                    running_min = 60.0
                target_qty = int(round(uph_val * running_min)) if uph_val > 0 else int(item.get("target_qty", 0) or 0)
            except (KeyError, ValueError, TypeError):
                conn.close()
                return jsonify({"error": "Numeric fields must be valid integers/numbers."}), 400

            if actual_qty < 0 or actual_qty > 100000 or rejected_qty < 0 or rejected_qty > actual_qty or downtime_min < 0 or downtime_min > 480 or target_qty < 0:
                conn.close()
                return jsonify({"error": "Quantity or downtime values are outside permitted bounds."}), 400

            good_qty = max(0, actual_qty - rejected_qty)
            pct = round((actual_qty / target_qty) * 100, 1) if target_qty > 0 else 0.0
            p_type = "Tandem" if (m_num.startswith("LP") or m_num.startswith("HP")) else "NC"
            entry_time = str(item.get("entry_time", "")).strip() or datetime.now().strftime("%H:%M:%S")

            cur.execute(
                """
                INSERT INTO production_records (
                    plant_id, production_type, machine_or_line, date, shift, hour_interval,
                    operator_name, tool_number, uph, target_qty, actual_qty, good_qty, rejected_qty,
                    downtime_minutes, downtime_code, downtime_reason, remarks,
                    production_pct, hourly_output_pct, entry_time, client_submission_id, submitted_by_role, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(machine_or_line, date, shift, hour_interval) DO UPDATE SET
                    operator_name = excluded.operator_name,
                    tool_number = excluded.tool_number,
                    uph = excluded.uph,
                    target_qty = excluded.target_qty,
                    actual_qty = excluded.actual_qty,
                    good_qty = excluded.good_qty,
                    rejected_qty = excluded.rejected_qty,
                    downtime_minutes = excluded.downtime_minutes,
                    downtime_code = excluded.downtime_code,
                    downtime_reason = excluded.downtime_reason,
                    remarks = excluded.remarks,
                    production_pct = excluded.production_pct,
                    hourly_output_pct = excluded.hourly_output_pct,
                    entry_time = excluded.entry_time,
                    client_submission_id = COALESCE(excluded.client_submission_id, production_records.client_submission_id),
                    submitted_by_role = excluded.submitted_by_role,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    str(item.get("plant_id", "Plant 1")),
                    p_type,
                    m_num,
                    p_date,
                    p_shift,
                    hour_interval,
                    str(item.get("operator_name", "")).strip(),
                    str(item.get("tool_number", "")).strip(),
                    uph_val,
                    target_qty,
                    actual_qty,
                    good_qty,
                    rejected_qty,
                    downtime_min,
                    str(item.get("downtime_code", "D01")).strip(),
                    str(item.get("downtime_reason", "")).strip(),
                    str(item.get("remarks", "")).strip(),
                    pct,
                    pct,
                    entry_time,
                    sub_id,
                    g.current_user["role"],
                ),
            )
            cur.execute("SELECT * FROM production_records WHERE machine_or_line = ? AND date = ? AND shift = ? AND hour_interval = ?", (m_num, p_date, p_shift, hour_interval))
            saved_records.append(dict(cur.fetchone()))

        conn.commit()
        conn.close()
        return jsonify({"success": True, "record": saved_records[0] if len(saved_records) == 1 else None, "records": saved_records})
    return _post()


@app.route("/api/production/records", methods=["GET"])
@_auth("Admin", "Supervisor", "Operator", "Dashboard")
def get_production_records():
    conn = get_db()
    cur = conn.cursor()
    query = "SELECT * FROM production_records WHERE 1=1"
    params = []
    for param_name, col in [("date", "date"), ("shift", "shift"), ("machine", "machine_or_line"), ("type", "production_type")]:
        val = request.args.get(param_name)
        if val:
            query += f" AND {col} = ?"
            params.append(val)
    query += " ORDER BY date DESC, id DESC LIMIT 500"
    cur.execute(query, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"success": True, "records": rows})


@app.route("/api/production/records", methods=["POST"])
@_auth("Admin", "Supervisor", "Operator")
def post_production_records():
    return hourly_production_api()


@app.route("/api/production/hourly-batch", methods=["POST", "OPTIONS"])
def hourly_batch_production_api():
    if request.method == "OPTIONS":
        return "", 200
    @_auth("Admin", "Supervisor", "Operator")
    def _post_batch():
        data = request.get_json(silent=True) or {}
        parts = data.get("parts") or []
        if not parts:
            return jsonify({"error": "At least one tool/part entry is required."}), 400
        p_type = str(data.get("production_type", "NC")).strip()
        tandem_mode = str(data.get("tandem_mode", "simultaneous")).strip().lower()
        enforce_pool = p_type != "Tandem" or tandem_mode == "sequential"
        total_mins = sum(float(p.get("running_minutes", 60) or 60) for p in parts)
        if enforce_pool and total_mins > 60:
            return jsonify({"error": f"Total allocated time ({int(round(total_mins))} min) exceeds 60 minutes in this hour."}), 400
        conn = get_db()
        cur = conn.cursor()
        saved = []
        base_hour = str(data.get("hour_interval", "")).strip()
        m_num = str(data.get("machine_or_line", "")).strip().upper()
        p_date = str(data.get("date", "")).strip()
        p_shift = str(data.get("shift", "")).strip()
        op_name = str(data.get("operator_name", "")).strip()
        if not m_num or not p_date or not p_shift or not base_hour or not op_name:
            conn.close()
            return jsonify({"error": "Date, shift, operator, machine/line, and hour are required."}), 400
        cur.execute(
            "DELETE FROM production_records WHERE machine_or_line = ? AND date = ? AND shift = ? AND (hour_interval = ? OR hour_interval LIKE ?)",
            (m_num, p_date, p_shift, base_hour, f"{base_hour} [P%"),
        )
        for idx, p in enumerate(parts, start=1):
            uph_val = float(p.get("uph") or 0)
            mins = float(p.get("running_minutes", 60) or 60)
            actual_qty = int(p.get("actual_qty") or 0)
            rejected_qty = int(p.get("rejected_qty") or 0)
            good_qty = max(0, actual_qty - rejected_qty)
            target_qty = int(round(uph_val * mins)) if uph_val > 0 else int(p.get("target_qty") or 0)
            pct = round((actual_qty / target_qty) * 100, 1) if target_qty > 0 else 0.0
            slot_dt = int(p.get("downtime_minutes") or 0) if idx == 1 else 0
            slot_key = base_hour if idx == 1 else f"{base_hour} [P{idx}]"
            cur.execute(
                """
                INSERT INTO production_records (
                    plant_id, production_type, machine_or_line, date, shift, hour_interval,
                    operator_name, tool_number, uph, target_qty, actual_qty, good_qty, rejected_qty,
                    downtime_minutes, downtime_code, downtime_reason, remarks,
                    production_pct, hourly_output_pct, entry_time, submitted_by_role, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    str(data.get("plant_id", "Plant 1")), p_type, m_num, p_date, p_shift, slot_key,
                    op_name, str(p.get("tool_number", "")).strip().upper(), uph_val, target_qty,
                    actual_qty, good_qty, rejected_qty, slot_dt,
                    str(p.get("downtime_code", "D01")), str(p.get("downtime_reason", "")),
                    str(p.get("remarks", data.get("remarks", ""))), pct, pct,
                    datetime.now().strftime("%H:%M:%S"), g.current_user["role"],
                ),
            )
            cur.execute("SELECT * FROM production_records WHERE id = ?", (cur.lastrowid,))
            saved.append(dict(cur.fetchone()))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "records": saved})
    return _post_batch()


@app.route("/api/production/delete-slot", methods=["POST"])
@_auth("Admin")
def delete_production_slot():
    data = request.get_json(silent=True) or {}
    m_num = str(data.get("machine_or_line", "")).strip().upper()
    p_date = str(data.get("date", "")).strip()
    p_shift = str(data.get("shift", "")).strip()
    base_hour = str(data.get("hour_interval", "")).strip()
    if not m_num or not p_date or not p_shift or not base_hour:
        return jsonify({"error": "Machine, date, shift, and hour are required."}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM production_records WHERE machine_or_line = ? AND date = ? AND shift = ? AND (hour_interval = ? OR hour_interval LIKE ?)",
        (m_num, p_date, p_shift, base_hour, f"{base_hour} [P%"),
    )
    deleted = cur.rowcount
    if deleted == 0:
        conn.close()
        return jsonify({"error": "No matching hourly records found to delete."}), 404
    _log_audit(conn, g.current_user["username"], "Admin", "DELETE", "Production Slot", f"{m_num} {p_date} {p_shift} {base_hour}", f"Deleted {deleted} hourly production row(s)")
    conn.commit()
    conn.close()
    return jsonify({"success": True, "deleted": deleted})


@app.route("/api/production/records/<int:record_id>", methods=["DELETE"])
@_auth("Admin")
def delete_production_record(record_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM production_records WHERE id = ?", (record_id,))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": f"Production record #{record_id} not found."}), 404
    _log_audit(conn, g.current_user["username"], "Admin", "DELETE", "Production Record", str(record_id), f"Deleted production record #{record_id}")
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/production/shift-comparison", methods=["GET"])
@_auth("Admin", "Supervisor")
def shift_comparison_api():
    comp_date = request.args.get("date", date.today().isoformat())
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM machines")
    machines = [dict(r) for r in cur.fetchall()]
    results = {}
    for s in ("Shift A", "Shift B", "Shift C"):
        cur.execute("SELECT * FROM production_records WHERE date = ? AND shift = ?", (comp_date, s))
        s_recs = [dict(r) for r in cur.fetchall()]
        m = compute_shift_metrics(s_recs, machines)
        cur.execute("SELECT COUNT(*) FROM attendance WHERE date = ? AND shift = ? AND status IN ('Present', 'On-Duty')", (comp_date, s))
        manpower = cur.fetchone()[0]
        results[s] = {
            **m["totals"],
            "manpower_present": manpower,
            "nc_actual": sum(int(r.get("actual_qty") or 0) for r in s_recs if r.get("production_type") == "NC"),
            "tandem_actual": sum(int(r.get("actual_qty") or 0) for r in s_recs if r.get("production_type") == "Tandem"),
        }
    conn.close()
    return jsonify({"date": comp_date, "shifts": results})


# ------------------------------------------------------------------
# EMPLOYEES & ATTENDANCE (PII & SALARY PROTECTED)
# ------------------------------------------------------------------
@app.route("/api/employees/roster", methods=["GET"])
@_auth("Admin", "Supervisor", "Operator")
def employees_operational_roster():
    """Operational roster only (name, emp_id, shift, assigned_machine) — NO PII or salary."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, emp_id, name, department, designation, shift, assigned_machine, plant_id, status FROM employees WHERE status = 'Active' ORDER BY emp_id")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"employees": rows})


@app.route("/api/employees", methods=["GET", "POST"])
def employees_api():
    if request.method == "GET":
        @_auth("Admin", "Supervisor")
        def _get():
            conn = get_db()
            cur = conn.cursor()
            if g.current_user["role"] == "Admin":
                cur.execute("SELECT * FROM employees ORDER BY emp_id ASC")
            else:
                # Supervisor gets operational fields only — no salary/personal phone/email admin data
                cur.execute("SELECT id, emp_id, name, department, designation, shift, assigned_machine, plant_id, status FROM employees ORDER BY emp_id ASC")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return jsonify({"employees": rows, "count": len(rows)})
        return _get()

    @_auth("Admin", "Supervisor")
    def _post():
        data = request.get_json(silent=True) or {}
        emp_id = str(data.get("emp_id", "")).strip().upper()
        name = str(data.get("name", "")).strip()
        if not emp_id or not name:
            return jsonify({"error": "Employee ID and Name are required."}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM employees WHERE emp_id = ?", (emp_id,))
        if cur.fetchone():
            conn.close()
            return jsonify({"error": f"Employee ID {emp_id} already exists."}), 400
        cur.execute(
            """
            INSERT INTO employees (emp_id, name, department, designation, phone, email, shift, assigned_machine, plant_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Plant 1', ?)
            """,
            (
                emp_id,
                name,
                data.get("department", "NC Production"),
                data.get("designation", "Operator"),
                data.get("phone", "") if g.current_user["role"] == "Admin" else "",
                data.get("email", "") if g.current_user["role"] == "Admin" else "",
                data.get("shift", "Shift A"),
                data.get("assigned_machine", ""),
                data.get("status", "Active"),
            ),
        )
        _log_audit(conn, g.current_user["username"], g.current_user["role"], "CREATE", "Employee", emp_id, f"Registered {emp_id} ({name})")
        conn.commit()
        conn.close()
        return jsonify({"success": True, "emp_id": emp_id}), 201
    return _post()


@app.route("/api/employees/<emp_id>", methods=["PUT", "DELETE"])
@_auth("Admin", "Supervisor")
def single_employee_api(emp_id):
    if request.method == "DELETE" and g.current_user["role"] != "Admin":
        return jsonify({"error": "Only Admin can permanently delete employees."}), 403
    conn = get_db()
    cur = conn.cursor()
    if request.method == "DELETE":
        cur.execute("SELECT * FROM employees WHERE emp_id = ?", (emp_id,))
        emp = cur.fetchone()
        if not emp:
            conn.close()
            return jsonify({"error": f"Employee {emp_id} not found."}), 404
        cur.execute("SELECT COUNT(*) FROM attendance WHERE emp_id = ?", (emp_id,))
        att_cnt = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM overtime WHERE emp_id = ?", (emp_id,))
        ot_cnt = cur.fetchone()[0]
        if att_cnt > 0 or ot_cnt > 0:
            # Preserve historical attendance & overtime records instead of cascading deletes
            cur.execute("UPDATE employees SET status = 'Inactive', assigned_machine = '', updated_at = CURRENT_TIMESTAMP WHERE emp_id = ?", (emp_id,))
            _log_audit(conn, g.current_user["username"], "Admin", "ARCHIVE", "Employee", emp_id, f"Archived employee {emp_id} to preserve {att_cnt} attendance and {ot_cnt} overtime record(s)")
            conn.commit()
            conn.close()
            return jsonify({"success": True, "archived": True, "message": f"Employee {emp_id} marked Inactive to preserve historical attendance/overtime records."})
        cur.execute("UPDATE machines SET assigned_operator = '' WHERE assigned_operator = ?", (emp["name"],))
        cur.execute("DELETE FROM employees WHERE emp_id = ?", (emp_id,))
        _log_audit(conn, g.current_user["username"], "Admin", "DELETE", "Employee", emp_id, f"Deleted employee {emp_id}")
        conn.commit()
        conn.close()
        return jsonify({"success": True})

    data = request.get_json(silent=True) or {}
    cur.execute(
        """
        UPDATE employees SET
            name = COALESCE(?, name),
            department = COALESCE(?, department),
            designation = COALESCE(?, designation),
            shift = COALESCE(?, shift),
            assigned_machine = COALESCE(?, assigned_machine),
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE emp_id = ?
        """,
        (data.get("name"), data.get("department"), data.get("designation"), data.get("shift"), data.get("assigned_machine"), data.get("status"), emp_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/attendance", methods=["GET", "POST"])
@_auth("Admin", "Supervisor")
def attendance_api():
    conn = get_db()
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        records = data.get("records") if isinstance(data.get("records"), list) else [data]
        count = 0
        for rec in records:
            emp_id = rec.get("emp_id")
            att_date = rec.get("date", date.today().isoformat())
            att_shift = rec.get("shift", "Shift A")
            att_status = rec.get("status", "Present")
            if not emp_id or att_status not in ("Present", "Absent", "Leave", "Half-day", "On-Duty"):
                continue
            cur.execute(
                """
                INSERT INTO attendance (emp_id, date, shift, status, check_in_time, notes)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(emp_id, date, shift) DO UPDATE SET
                    status = excluded.status,
                    notes = COALESCE(excluded.notes, attendance.notes)
                """,
                (emp_id, att_date, att_shift, att_status, rec.get("check_in_time", ""), rec.get("notes", "")),
            )
            count += 1
        conn.commit()
        conn.close()
        return jsonify({"success": True, "saved_records": count})

    att_date = request.args.get("date", date.today().isoformat())
    att_shift = request.args.get("shift", "")
    query = "SELECT a.*, e.name as emp_name, e.department FROM attendance a JOIN employees e ON a.emp_id = e.emp_id WHERE a.date = ?"
    params = [att_date]
    if att_shift:
        query += " AND a.shift = ?"
        params.append(att_shift)
    cur.execute(query, params)
    records = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"date": att_date, "shift": att_shift, "attendance": records})


# ------------------------------------------------------------------
# HANDOVERS, PLANS, DOWNTIME & SETTINGS
# ------------------------------------------------------------------
@app.route("/api/handovers", methods=["GET", "POST"])
@_auth("Admin", "Supervisor")
def handovers_api():
    conn = get_db()
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        notes = str(data.get("handover_notes", "")).strip()
        if not notes:
            conn.close()
            return jsonify({"error": "Handover notes are required."}), 400
        cur.execute(
            """
            INSERT INTO shift_handovers (date, outgoing_shift, incoming_shift, department_or_machine, handover_notes, production_status, pending_work, machine_problems, downtime_info, quality_issues, follow_up_actions, responsible_person, completion_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data.get("date", date.today().isoformat()),
                data.get("outgoing_shift", "Shift A"),
                data.get("incoming_shift", "Shift B"),
                data.get("department_or_machine", "All Shopfloor"),
                notes,
                data.get("production_status", ""),
                data.get("pending_work", ""),
                data.get("machine_problems", ""),
                data.get("downtime_info", ""),
                data.get("quality_issues", ""),
                data.get("follow_up_actions", ""),
                data.get("responsible_person", g.current_user["full_name"]),
                data.get("completion_status", "Open"),
            ),
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True}), 201

    cur.execute("SELECT * FROM shift_handovers ORDER BY date DESC, id DESC LIMIT 100")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"handovers": rows})


@app.route("/api/handovers/<int:hid>", methods=["PUT", "DELETE"])
@_auth("Admin", "Supervisor")
def update_handover(hid):
    conn = get_db()
    cur = conn.cursor()
    if request.method == "DELETE":
        if g.current_user["role"] != "Admin":
            conn.close()
            return jsonify({"error": "Only Admin can delete shift handovers."}), 403
        cur.execute("DELETE FROM shift_handovers WHERE id = ?", (hid,))
        if cur.rowcount == 0:
            conn.close()
            return jsonify({"error": f"Shift handover #{hid} not found."}), 404
        _log_audit(conn, g.current_user["username"], "Admin", "DELETE", "Handover", str(hid), f"Deleted shift handover #{hid}")
        conn.commit()
        conn.close()
        return jsonify({"success": True})

    data = request.get_json(silent=True) or {}
    cur.execute(
        "UPDATE shift_handovers SET completion_status = COALESCE(?, completion_status), follow_up_actions = COALESCE(?, follow_up_actions) WHERE id = ?",
        (data.get("completion_status"), data.get("follow_up_actions"), hid),
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/plans", methods=["GET", "POST"])
def plans_api():
    if request.method == "GET":
        @_auth("Admin", "Supervisor", "Operator")
        def _get():
            machine = request.args.get("machine", "").strip().upper()
            conn = get_db()
            cur = conn.cursor()
            if machine:
                cur.execute("SELECT * FROM machine_plans WHERE machine_number = ? ORDER BY plan_index", (machine,))
            else:
                cur.execute("SELECT * FROM machine_plans ORDER BY machine_number, plan_index")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return jsonify({"plans": rows})
        return _get()

    @_auth("Admin", "Supervisor")
    def _post():
        data = request.get_json(silent=True) or {}
        machine = str(data.get("machine_number", "")).strip().upper()
        plan_index = int(data.get("plan_index", 1))
        tool = str(data.get("tool_number", "")).strip()
        qty = int(data.get("plan_quantity", 0))
        if not machine or not tool or plan_index < 1 or plan_index > 5 or qty <= 0:
            return jsonify({"error": "Valid machine, plan slot (1-5), tool number, and positive quantity required."}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO machine_plans (machine_number, plan_index, tool_number, plan_quantity, part_name, status, target_date, target_shift, remarks, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(machine_number, plan_index) DO UPDATE SET
                tool_number = excluded.tool_number, plan_quantity = excluded.plan_quantity,
                part_name = excluded.part_name, status = excluded.status, remarks = excluded.remarks, updated_at = CURRENT_TIMESTAMP
            """,
            (machine, plan_index, tool, qty, data.get("part_name", ""), data.get("status", "Queued"), data.get("target_date", ""), data.get("target_shift", ""), data.get("remarks", "")),
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    return _post()


@app.route("/api/plans/<int:plan_id>", methods=["DELETE"])
@_auth("Admin", "Supervisor")
def delete_plan(plan_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM machine_plans WHERE id = ?", (plan_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/downtime-codes", methods=["GET", "POST"])
def downtime_codes_api():
    if request.method == "GET":
        @_auth("Admin", "Supervisor", "Operator", "Dashboard")
        def _get():
            conn = get_db()
            cur = conn.cursor()
            cur.execute("SELECT * FROM downtime_codes WHERE is_active = 1 ORDER BY display_order ASC LIMIT 6")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return jsonify({"success": True, "codes": rows})
        return _get()

    @_auth("Admin")
    def _post():
        data = request.get_json(silent=True) or {}
        codes = data.get("codes") if isinstance(data.get("codes"), list) else [data]
        conn = get_db()
        cur = conn.cursor()
        for c in codes[:6]:
            cur.execute(
                "INSERT INTO downtime_codes (code, name, description, display_order) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name, description = excluded.description",
                (c["code"], c["name"], c.get("description", ""), int(c.get("display_order", 1))),
            )
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    return _post()


@app.route("/api/machine-downtime", methods=["GET", "POST"])
def machine_downtime_api():
    if request.method == "GET":
        @_auth("Admin", "Supervisor", "Operator", "Dashboard")
        def _get():
            conn = get_db()
            cur = conn.cursor()
            cur.execute("SELECT * FROM machine_downtime ORDER BY id DESC LIMIT 200")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return jsonify({"success": True, "downtimes": rows})
        return _get()

    @_auth("Admin", "Supervisor", "Operator")
    def _post():
        data = request.get_json(silent=True) or {}
        m_num = str(data.get("machine_number", "")).strip().upper()
        if not m_num:
            return jsonify({"error": "Machine number is required."}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM machine_downtime WHERE machine_number = ? AND status = 'Open'", (m_num,))
        if cur.fetchone():
            conn.close()
            return jsonify({"error": f"Machine {m_num} already has an open downtime."}), 400
        cur.execute(
            """
            INSERT INTO machine_downtime (machine_number, downtime_code, breakdown_start, breakdown_reason, operator_name, reported_by, date, shift, status, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?)
            """,
            (
                m_num,
                data.get("downtime_code", "D01"),
                data.get("start_time") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                data.get("reason", "Machine Breakdown"),
                data.get("operator_name", ""),
                data.get("operator_name", ""),
                data.get("date", date.today().isoformat()),
                data.get("shift", get_current_shift()),
                data.get("remarks", ""),
            ),
        )
        cur.execute("UPDATE machines SET status = 'Breakdown' WHERE machine_number = ?", (m_num,))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    return _post()


@app.route("/api/machine-downtime/<int:dt_id>/resolve", methods=["PUT"])
@_auth("Admin", "Supervisor", "Operator")
def resolve_machine_downtime(dt_id):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM machine_downtime WHERE id = ?", (dt_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Downtime record not found."}), 404
    mins = max(1, int(data.get("duration_minutes") or 15))
    b_end = data.get("end_time") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cur.execute("UPDATE machine_downtime SET status = 'Resolved', breakdown_end = ?, total_downtime_minutes = ? WHERE id = ?", (b_end, mins, dt_id))
    cur.execute("UPDATE machines SET status = 'Running' WHERE machine_number = ?", (row["machine_number"],))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/settings/public", methods=["GET"])
@_auth("Admin", "Supervisor", "Operator", "Dashboard")
def public_settings():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT key, value FROM app_settings WHERE key IN ('company_name', 'plant_location', 'shift_a_start', 'shift_a_end', 'shift_b_start', 'shift_b_end', 'shift_c_start', 'shift_c_end', 'hours_per_shift', 'target_efficiency_threshold')")
    settings = {r["key"]: r["value"] for r in cur.fetchall()}
    conn.close()
    return jsonify({"settings": settings})


@app.route("/api/settings", methods=["GET", "POST"])
@_auth("Admin")
def admin_settings_api():
    conn = get_db()
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        for k, v in data.items():
            cur.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", (str(k), str(v)))
        _log_audit(conn, g.current_user["username"], "Admin", "UPDATE", "Settings", "app_settings", "Updated plant settings")
        conn.commit()
        conn.close()
        return jsonify({"success": True})

    cur.execute("SELECT key, value FROM app_settings")
    settings = {r["key"]: r["value"] for r in cur.fetchall()}
    conn.close()
    return jsonify({"settings": settings})


# ------------------------------------------------------------------
# REPORTS, EXPORTS & ADMIN AUDIT LOGS
# ------------------------------------------------------------------
@app.route("/api/reports/data", methods=["GET"])
@_auth("Admin", "Supervisor")
def reports_data():
    from_date = request.args.get("from_date", date.today().isoformat())
    to_date = request.args.get("to_date", date.today().isoformat())
    shift = request.args.get("shift", "")
    machine = request.args.get("machine", "")
    operator = request.args.get("operator", "")
    plant = request.args.get("plant", "")

    conn = get_db()
    cur = conn.cursor()
    query = "SELECT * FROM production_records WHERE date BETWEEN ? AND ?"
    params = [from_date, to_date]
    if shift:
        query += " AND shift = ?"
        params.append(shift)
    if machine:
        query += " AND machine_or_line = ?"
        params.append(machine)
    if operator:
        query += " AND LOWER(operator_name) LIKE ?"
        params.append(f"%{operator.lower()}%")
    if plant and plant != "ALL":
        query += " AND plant_id = ?"
        params.append(plant)
    query += " ORDER BY date DESC, shift ASC, machine_or_line ASC, hour_interval ASC"
    cur.execute(query, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    total_actual = sum(int(r.get("actual_qty") or 0) for r in rows)
    total_target = sum(int(r.get("target_qty") or 0) for r in rows)
    total_good = sum(int(r.get("good_qty") or 0) for r in rows)
    total_rejected = sum(int(r.get("rejected_qty") or 0) for r in rows)
    total_downtime = sum(int(r.get("downtime_minutes") or 0) for r in rows)

    return jsonify({
        "success": True,
        "count": len(rows),
        "rows": rows,
        "totals": {
            "actual": total_actual,
            "target": total_target,
            "good": total_good,
            "rejected": total_rejected,
            "downtime_minutes": total_downtime,
            "achievement_pct": round((total_actual / total_target) * 100, 1) if total_target > 0 else 0.0,
        },
    })


@app.route("/api/activity-logs", methods=["GET"])
@_auth("Admin")
def get_activity_logs():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM activity_logs ORDER BY id DESC LIMIT 200")
    logs = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM recovery_audit_logs ORDER BY id DESC LIMIT 100")
    recovery_logs = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"success": True, "logs": logs, "recovery_logs": recovery_logs})


@app.route("/api/notifications", methods=["GET"])
@_auth("Admin", "Supervisor")
def get_live_notifications():
    today_str = date.today().isoformat()
    curr_shift = get_current_shift()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT machine_number, machine_type FROM machines WHERE status = 'Breakdown'")
    breakdowns = cur.fetchall()
    notifications = [
        {
            "id": f"bd-{m['machine_number']}",
            "type": "warning",
            "category": "Maintenance",
            "title": f"Breakdown: {m['machine_number']}",
            "message": f"{m['machine_type']} unit {m['machine_number']} is currently stopped.",
            "time": "Active",
        }
        for m in breakdowns
    ]
    cur.execute("SELECT COUNT(*) FROM attendance WHERE date = ? AND shift = ?", (today_str, curr_shift))
    if cur.fetchone()[0] == 0:
        notifications.append({
            "id": "att-pending",
            "type": "info",
            "category": "Attendance",
            "title": f"Attendance pending ({curr_shift})",
            "message": f"Shift attendance has not yet been recorded for {today_str}.",
            "time": curr_shift,
        })
    conn.close()
    return jsonify({"success": True, "notifications": notifications})


@app.route("/api/state", methods=["GET"])
@_auth("Admin")
def handle_state_readonly():
    return jsonify(get_full_state())


@app.route("/api/machine-downtime/<int:dt_id>", methods=["DELETE"])
@_auth("Admin")
def delete_machine_downtime(dt_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM machine_downtime WHERE id = ?", (dt_id,))
    deleted = cur.rowcount
    if deleted == 0:
        conn.close()
        return jsonify({"error": "Downtime record not found."}), 404
    _log_audit(conn, g.current_user["username"], "Admin", "DELETE", "Downtime", str(dt_id), f"Deleted downtime record #{dt_id}")
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/whatsapp/status", methods=["GET"])
@_auth("Admin", "Supervisor")
def whatsapp_status_api():
    token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "").strip()
    phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    version = os.environ.get("WHATSAPP_API_VERSION", "v21.0").strip()
    tmpl = os.environ.get("WHATSAPP_TEMPLATE_NAME", "").strip()
    missing = [k for k, v in [("WHATSAPP_ACCESS_TOKEN", token), ("WHATSAPP_PHONE_NUMBER_ID", phone_id)] if not v]
    return jsonify({
        "configured": bool(token and phone_id),
        "provider": "Meta WhatsApp Business Platform Cloud API",
        "apiVersion": version,
        "hasTemplateConfigured": bool(tmpl),
        "missingEnvVars": missing,
    })


@app.route("/api/whatsapp/recipients", methods=["GET", "POST"])
@_auth("Admin", "Supervisor")
def whatsapp_recipients_api():
    conn = get_db()
    cur = conn.cursor()
    if request.method == "GET":
        cur.execute("SELECT * FROM whatsapp_recipients ORDER BY id ASC")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return jsonify({"recipients": rows})
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    phone = re.sub(r"[\s\-()]", "", str(data.get("phone_number", "")).strip())
    if not name or not re.match(r"^\+[1-9]\d{6,14}$", phone):
        conn.close()
        return jsonify({"error": "Valid recipient name and international E.164 phone number (e.g. +919876543210) are required."}), 400
    cur.execute("SELECT COUNT(*) FROM whatsapp_recipients")
    if cur.fetchone()[0] >= 5:
        conn.close()
        return jsonify({"error": "Maximum 5 WhatsApp recipients allowed."}), 400
    cur.execute("SELECT id FROM whatsapp_recipients WHERE phone_number = ?", (phone,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": f"Phone number {phone} is already saved."}), 409
    cur.execute(
        "INSERT INTO whatsapp_recipients (name, phone_number, created_by) VALUES (?, ?, ?)",
        (name, phone, g.current_user["username"]),
    )
    rid = cur.lastrowid
    conn.commit()
    cur.execute("SELECT * FROM whatsapp_recipients WHERE id = ?", (rid,))
    row = dict(cur.fetchone())
    conn.close()
    return jsonify({"recipient": row}), 201


@app.route("/api/whatsapp/recipients/<int:rid>", methods=["PUT", "DELETE"])
@_auth("Admin", "Supervisor")
def whatsapp_single_recipient_api(rid):
    conn = get_db()
    cur = conn.cursor()
    if request.method == "DELETE":
        cur.execute("DELETE FROM whatsapp_recipients WHERE id = ?", (rid,))
        if cur.rowcount == 0:
            conn.close()
            return jsonify({"error": "Recipient not found."}), 404
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    phone = re.sub(r"[\s\-()]", "", str(data.get("phone_number", "")).strip())
    if not name or not re.match(r"^\+[1-9]\d{6,14}$", phone):
        conn.close()
        return jsonify({"error": "Valid recipient name and E.164 phone number required."}), 400
    cur.execute("SELECT id FROM whatsapp_recipients WHERE phone_number = ? AND id != ?", (phone, rid))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": f"Phone number {phone} already exists."}), 409
    cur.execute(
        "UPDATE whatsapp_recipients SET name = ?, phone_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (name, phone, rid),
    )
    conn.commit()
    cur.execute("SELECT * FROM whatsapp_recipients WHERE id = ?", (rid,))
    row = cur.fetchone()
    conn.close()
    return jsonify({"recipient": dict(row) if row else None})


@app.route("/api/whatsapp/history", methods=["GET"])
@_auth("Admin", "Supervisor")
def whatsapp_history_api():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM whatsapp_reports_log ORDER BY id DESC LIMIT 50")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"history": rows})


@app.route("/api/whatsapp/send", methods=["POST"])
@_auth("Admin", "Supervisor")
def whatsapp_send_api():
    import urllib.request
    import urllib.error
    data = request.get_json(silent=True) or {}
    recipients = (data.get("recipients") or [])[:5]
    message_text = str(data.get("message", "")).strip()
    if not recipients or not message_text:
        return jsonify({"error": "Recipients and report message are required."}), 400

    token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "").strip()
    phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    version = os.environ.get("WHATSAPP_API_VERSION", "v21.0").strip()
    tmpl = os.environ.get("WHATSAPP_TEMPLATE_NAME", "").strip()
    tmpl_lang = os.environ.get("WHATSAPP_TEMPLATE_LANG", "en").strip()

    if not token or not phone_id:
        missing = [k for k, v in [("WHATSAPP_ACCESS_TOKEN", token), ("WHATSAPP_PHONE_NUMBER_ID", phone_id)] if not v]
        return jsonify({
            "configured": False,
            "error": f"WhatsApp Business Cloud API is not configured on the server. Missing: {', '.join(missing)}.",
            "missingEnvVars": missing,
            "results": [{"name": r.get("name", ""), "phone_number": r.get("phone_number", ""), "status": "failed", "error": f"Missing {', '.join(missing)}"} for r in recipients],
        }), 503

    results = []
    for r in recipients:
        phone = re.sub(r"[\s\-()]", "", str(r.get("phone_number", "")).strip())
        if not re.match(r"^\+[1-9]\d{6,14}$", phone):
            results.append({"name": r.get("name", ""), "phone_number": phone, "status": "failed", "error": "Invalid E.164 phone number."})
            continue
        wa_to = phone.lstrip("+")
        payload = (
            {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": wa_to,
                "type": "template",
                "template": {"name": tmpl, "language": {"code": tmpl_lang}, "components": [{"type": "body", "parameters": [{"type": "text", "text": message_text[:1024]}]}]},
            }
            if tmpl
            else {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": wa_to,
                "type": "text",
                "text": {"preview_url": False, "body": message_text[:4096]},
            }
        )
        req = urllib.request.Request(
            f"https://graph.facebook.com/{version}/{phone_id}/messages",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp_json = json.loads(resp.read().decode("utf-8"))
                results.append({"name": r.get("name", ""), "phone_number": phone, "status": "sent", "message_id": (resp_json.get("messages") or [{}])[0].get("id", "")})
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            try:
                err_msg = json.loads(err_body).get("error", {}).get("message", err_body)
            except Exception:
                err_msg = err_body or str(e)
            results.append({"name": r.get("name", ""), "phone_number": phone, "status": "failed", "error": err_msg})
        except Exception as e:
            results.append({"name": r.get("name", ""), "phone_number": phone, "status": "failed", "error": str(e)})

    sent_cnt = sum(1 for x in results if x["status"] == "sent")
    overall = "sent" if sent_cnt == len(results) else ("partial" if sent_cnt > 0 else "failed")
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO whatsapp_reports_log (
                report_type, report_label, recipients_json, recipient_count, sent_count, failed_count,
                overall_status, message_preview, filters_json, sent_by, delivery_mode, client_send_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cloud_api', ?)
            """,
            (
                str(data.get("report_type", "combined")),
                str(data.get("report_label", "Report")),
                json.dumps(results),
                len(results),
                sent_cnt,
                len(results) - sent_cnt,
                overall,
                message_text[:300],
                json.dumps(data.get("filters") or {}),
                g.current_user["username"],
                str(data.get("client_send_id", "")).strip() or None,
            ),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass
    return jsonify({
        "configured": True,
        "success": sent_cnt > 0,
        "overall_status": overall,
        "sent_count": sent_cnt,
        "failed_count": len(results) - sent_cnt,
        "results": results,
    }), (200 if sent_cnt > 0 else 502)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
