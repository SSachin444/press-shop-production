"""
Clear all sample/seed data from pha_india.db
Keeps: users (admin/supervisor/management), machines (NC/LP/HP definitions)
Removes: employees, production_records, attendance, overtime, shift_handovers, machine_plans, app_state
"""
import sqlite3
import os

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'pha_india.db')

print(f"Database path: {DB}")
if not os.path.exists(DB):
    print("ERROR: Database not found!")
    exit(1)

conn = sqlite3.connect(DB)
c = conn.cursor()

# Get list of all tables
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in c.fetchall()]
print(f"Tables found: {tables}")

# Tables to clear (sample/operational data)
to_clear = [
    'employees',
    'attendance',
    'overtime',
    'production_records',
    'shift_handovers',
    'machine_plans',
    'app_state',
    'daily_targets',
    'production_entries',
    'hourly_entries',
    'notifications',
    'audit_log',
    'alerts',
]

for table in to_clear:
    if table in tables:
        c.execute(f"DELETE FROM {table}")
        print(f"  Cleared table: {table} ({conn.total_changes} rows affected so far)")
    else:
        print(f"  Skipped (not found): {table}")

conn.commit()

# Verify what remains
print("\n--- Verification ---")
print("Users remaining (should keep admin/supervisor/management):")
try:
    c.execute("SELECT id, username, role FROM users")
    for row in c.fetchall():
        print(f"  {row}")
except Exception as e:
    print(f"  (no users table or error: {e})")

print("Machines remaining (should keep NC/LP/HP definitions):")
try:
    c.execute("SELECT id, name, type FROM machines LIMIT 30")
    for row in c.fetchall():
        print(f"  {row}")
except Exception as e:
    print(f"  (no machines table or error: {e})")

print("Employees remaining (should be 0):")
try:
    c.execute("SELECT COUNT(*) FROM employees")
    print(f"  Count: {c.fetchone()[0]}")
except Exception as e:
    print(f"  (no employees table: {e})")

print("Production records remaining (should be 0):")
try:
    c.execute("SELECT COUNT(*) FROM production_records")
    print(f"  Count: {c.fetchone()[0]}")
except Exception as e:
    print(f"  (no production_records table: {e})")

conn.close()
print("\nAll sample data cleared successfully!")
