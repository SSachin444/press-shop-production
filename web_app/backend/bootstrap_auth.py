"""
Server-side initial credential provisioning script for PHA INDIA Press Shop System.
Reads initial temporary passwords strictly from environment variables or interactive prompt
so credentials are never hardcoded in source code or bundled into client applications.

Usage:
  set ADMIN_INITIAL_PASSWORD=<temp_password>
  set SUPERVISOR_INITIAL_PASSWORD=<temp_password>
  python web_app/backend/bootstrap_auth.py
"""
import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import get_db, init_db  # noqa: E402
from security import hash_password  # noqa: E402


def provision_accounts(admin_password: str, supervisor_password: str) -> list[dict]:
    init_db()
    conn = get_db()
    cur = conn.cursor()

    accounts = [
        ("admin", admin_password, "Plant Administrator", "Admin", "Plant Management"),
        ("supervisor", supervisor_password, "Shift Supervisor", "Supervisor", "Press Shop MFG-2"),
    ]

    results = []
    for username, pw, full_name, role, dept in accounts:
        cur.execute("SELECT id FROM users WHERE username = ?", (username,))
        existing = cur.fetchone()
        pw_hash = hash_password(pw)
        if existing:
            cur.execute(
                """
                UPDATE users
                SET password_hash = ?, role = ?, full_name = ?, department = ?,
                    must_change_password = 1, is_active = 1
                WHERE username = ?
                """,
                (pw_hash, role, full_name, dept, username),
            )
            results.append({"username": username, "role": role, "status": "updated_temporary"})
        else:
            cur.execute(
                """
                INSERT INTO users (username, password_hash, full_name, role, department, must_change_password, is_active)
                VALUES (?, ?, ?, ?, ?, 1, 1)
                """,
                (username, pw_hash, full_name, role, dept),
            )
            results.append({"username": username, "role": role, "status": "created_temporary"})

        cur.execute(
            """
            INSERT INTO recovery_audit_logs (target_role, event_type, success, detail)
            VALUES (?, 'BOOTSTRAP_TEMP_ACCOUNT', 1, ?)
            """,
            (role, f"Temporary credentials provisioned for {username}; replacement required on first login"),
        )

    conn.commit()
    conn.close()
    return results


if __name__ == "__main__":
    admin_pw = os.environ.get("ADMIN_INITIAL_PASSWORD") or getpass.getpass("Initial temporary Admin password: ")
    sup_pw = os.environ.get("SUPERVISOR_INITIAL_PASSWORD") or getpass.getpass("Initial temporary Supervisor password: ")
    if not admin_pw or not sup_pw:
        print("Error: both initial passwords are required.")
        sys.exit(1)
    summary = provision_accounts(admin_pw, sup_pw)
    for item in summary:
        print(f"Provisioned {item['username']} ({item['role']}): {item['status']}")
