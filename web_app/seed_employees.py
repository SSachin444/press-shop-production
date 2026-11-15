import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'pha_india.db')
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

employees_to_seed = [
    ('A20755', 'SACHIN S', 'NC Production', 'Operator', '9876543210', 'sachin@phaindia.com', '2022-04-10', 'Shift A', 'NC-01', 'Active', 25000, 5000, 2000, 1500, 2000, 1800, 250, 0, 120),
    ('A20556', 'SRIRAM', 'NC Production', 'Operator', '9876543211', 'sriram@phaindia.com', '2021-08-15', 'Shift A', 'NC-02', 'Active', 26000, 5200, 2000, 1500, 2000, 1800, 250, 0, 125),
    ('A20821', 'KARTHIK M', 'NC Production', 'Helper', '9876543212', 'karthik@phaindia.com', '2023-01-20', 'Shift B', 'NC-03', 'Active', 18000, 3600, 1500, 1500, 1000, 1800, 250, 0, 90),
    ('A20112', 'MURUGAN R', 'Tandem Line', 'Line Lead', '9876543213', 'murugan@phaindia.com', '2019-06-01', 'Shift A', 'LP-1', 'Active', 32000, 6400, 2500, 1500, 3000, 1800, 250, 500, 150),
    ('A20340', 'SURESH K', 'Tandem Line', 'Operator', '9876543214', 'suresh@phaindia.com', '2020-11-12', 'Shift A', 'LP-2', 'Active', 27000, 5400, 2000, 1500, 2000, 1800, 250, 0, 130),
    ('A20455', 'PRAKASH M', 'Tandem Line', 'Operator', '9876543215', 'prakash@phaindia.com', '2021-05-18', 'Shift B', 'HP-1', 'Active', 27000, 5400, 2000, 1500, 2000, 1800, 250, 0, 130),
    ('A20610', 'ANAND T', 'Tandem Line', 'Operator', '9876543216', 'anand@phaindia.com', '2022-09-05', 'Shift C', 'HP-2', 'Active', 26500, 5300, 2000, 1500, 2000, 1800, 250, 0, 128),
    ('A20722', 'RAJESH P', 'Tandem Line', 'Operator', '9876543217', 'rajesh@phaindia.com', '2023-03-14', 'Shift C', 'HP-3', 'Active', 25500, 5100, 2000, 1500, 2000, 1800, 250, 0, 122),
    ('A20890', 'VIGNESH V', 'NC Production', 'Operator', '9876543218', 'vignesh@phaindia.com', '2023-07-22', 'Shift A', 'NC-04', 'Active', 24000, 4800, 2000, 1500, 1500, 1800, 250, 0, 115),
    ('A20912', 'MANIKANDAN G', 'NC Production', 'Operator', '9876543219', 'manikandan@phaindia.com', '2023-09-10', 'Shift A', 'NC-05', 'Active', 24000, 4800, 2000, 1500, 1500, 1800, 250, 0, 115),
    ('A20944', 'SARAVANAN S', 'NC Production', 'Operator', '9876543220', 'saravanan@phaindia.com', '2023-11-01', 'Shift B', 'NC-06', 'Active', 24500, 4900, 2000, 1500, 1500, 1800, 250, 0, 118),
    ('A21005', 'DINESH KUMAR', 'NC Production', 'Operator', '9876543221', 'dinesh@phaindia.com', '2024-01-15', 'Shift B', 'NC-07', 'Active', 23500, 4700, 2000, 1500, 1500, 1800, 250, 0, 112),
    ('A21040', 'SIVAKUMAR M', 'NC Production', 'Operator', '9876543222', 'sivakumar@phaindia.com', '2024-02-20', 'Shift C', 'NC-08', 'Active', 23500, 4700, 2000, 1500, 1500, 1800, 250, 0, 112),
    ('A21088', 'BALAJI R', 'NC Production', 'Operator', '9876543223', 'balaji@phaindia.com', '2024-04-10', 'Shift C', 'NC-09', 'Active', 23000, 4600, 2000, 1500, 1500, 1800, 250, 0, 110),
    ('A21120', 'GOPALAKRISHNAN', 'Tandem Line', 'Operator', '9876543224', 'gopal@phaindia.com', '2024-06-01', 'Shift A', 'HP-4', 'Active', 26000, 5200, 2000, 1500, 2000, 1800, 250, 0, 125),
    ('A21155', 'MOHAN RAJ', 'Quality Control', 'QC Inspector', '9876543225', 'mohan@phaindia.com', '2022-02-15', 'Shift A', 'NC-01', 'Active', 28000, 5600, 2000, 1500, 2500, 1800, 250, 0, 135)
]

for emp in employees_to_seed:
    c.execute("""
    INSERT OR REPLACE INTO employees 
    (emp_id, name, department, designation, phone, email, joining_date, shift, assigned_machine, status, basic_salary, hra, da, conveyance, special_allowance, pf_deduction, esi_deduction, tds_deduction, ot_hourly_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, emp)

conn.commit()

c.execute("SELECT COUNT(*) FROM employees")
print("Updated total employees count:", c.fetchone()[0])
conn.close()
