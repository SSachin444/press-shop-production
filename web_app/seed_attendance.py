import os
import sqlite3
from datetime import date

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'pha_india.db')
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

today_str = date.today().isoformat()
c.execute("SELECT emp_id, shift FROM employees")
rows = c.fetchall()

present_count = 0
for i, (emp_id, emp_shift) in enumerate(rows):
    # 17 present, 2 absent
    status = 'Absent' if i in (2, 7) else 'Present'
    c.execute("""
    INSERT OR REPLACE INTO attendance (emp_id, date, shift, status, check_in_time)
    VALUES (?, ?, ?, ?, ?)
    """, (emp_id, today_str, emp_shift or 'Shift A', status, '08:00 AM'))
    if status == 'Present':
        present_count += 1

conn.commit()
print(f"Seeded attendance for {len(rows)} employees on {today_str}: {present_count} Present, {len(rows) - present_count} Absent.")
conn.close()
