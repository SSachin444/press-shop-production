import sqlite3
DB = r'd:\project web\web_app\backend\pha_india.db'
conn = sqlite3.connect(DB)
c = conn.cursor()

# Reset all machine statuses to Idle and clear operator assignments
c.execute("UPDATE machines SET status='Idle', assigned_operator=NULL")
print(f'Machines reset to Idle: {c.rowcount} rows')

# Reset auto-increment sequences for cleared tables
for table in ['employees', 'attendance', 'overtime', 'production_records', 'shift_handovers', 'machine_plans']:
    try:
        c.execute('UPDATE sqlite_sequence SET seq=0 WHERE name=?', (table,))
        print(f'  Reset sequence for {table}')
    except Exception as e:
        print(f'  Skipped {table}: {e}')

conn.commit()
conn.close()
print('Done.')
