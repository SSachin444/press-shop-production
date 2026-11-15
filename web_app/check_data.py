import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'pha_india.db')
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("SELECT COUNT(*) FROM employees")
print("Total employees in DB:", c.fetchone()[0])

c.execute("SELECT emp_id, name, department, designation, assigned_machine, shift, status FROM employees LIMIT 10")
for row in c.fetchall():
    print(row)

c.execute("SELECT COUNT(*) FROM production_records")
print("\nTotal production records in DB:", c.fetchone()[0])

c.execute("SELECT date, shift, machine_or_line, hour_interval, target_qty, actual_qty FROM production_records ORDER BY id DESC LIMIT 5")
for row in c.fetchall():
    print(row)
