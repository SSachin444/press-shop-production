import sqlite3
import os
import json
import hashlib
from datetime import datetime, date

# Database path in backend directory
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "pha_india.db")

def hash_password(password: str) -> str:
    """Hash password using SHA-256 with a salt."""
    salt = "PHA_INDIA_SECURE_SALT_2026"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def get_db():
    """Get SQLite connection with Row factory and WAL mode for high concurrency."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn

def init_db():
    """Initialize database tables and seed required initial configuration."""
    conn = get_db()
    cursor = conn.cursor()

    # 1. Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('Admin', 'Management', 'Supervisor', 'Operator')),
        department TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 2. Employees table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emp_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        designation TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        joining_date TEXT,
        shift TEXT DEFAULT 'Shift A',
        assigned_machine TEXT,
        status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
        basic_salary REAL DEFAULT 0,
        hra REAL DEFAULT 0,
        da REAL DEFAULT 0,
        conveyance REAL DEFAULT 0,
        special_allowance REAL DEFAULT 0,
        pf_deduction REAL DEFAULT 0,
        esi_deduction REAL DEFAULT 0,
        tds_deduction REAL DEFAULT 0,
        ot_hourly_rate REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 3. Attendance table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emp_id TEXT NOT NULL,
        date TEXT NOT NULL,
        shift TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Leave', 'Half-day', 'On-Duty')),
        check_in_time TEXT,
        check_out_time TEXT,
        notes TEXT,
        doc_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON UPDATE CASCADE,
        UNIQUE(emp_id, date, shift)
    )
    """)

    # 4. Overtime records
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS overtime (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emp_id TEXT NOT NULL,
        date TEXT NOT NULL,
        shift TEXT NOT NULL,
        regular_hours REAL DEFAULT 8.0,
        ot_hours REAL NOT NULL,
        reason TEXT,
        approval_status TEXT DEFAULT 'Pending' CHECK(approval_status IN ('Pending', 'Approved', 'Rejected')),
        approved_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON UPDATE CASCADE,
        UNIQUE(emp_id, date, shift)
    )
    """)

    # 5. Machines table (both NC and Tandem lines)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS machines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_number TEXT UNIQUE NOT NULL,
        machine_type TEXT NOT NULL CHECK(machine_type IN ('NC', 'Tandem')),
        tonnage REAL DEFAULT 0,
        production_target INTEGER DEFAULT 500,
        status TEXT DEFAULT 'Idle' CHECK(status IN ('Running', 'Idle', 'Maintenance', 'Breakdown')),
        assigned_operator TEXT,
        assigned_shift TEXT DEFAULT 'Shift A',
        maintenance_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 6. Hourly Production Records (for both NC and Tandem)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS production_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        production_type TEXT NOT NULL CHECK(production_type IN ('NC', 'Tandem')),
        machine_or_line TEXT NOT NULL,
        date TEXT NOT NULL,
        shift TEXT NOT NULL CHECK(shift IN ('Shift A', 'Shift B', 'Shift C')),
        hour_interval TEXT NOT NULL,
        operator_name TEXT,
        tonnage REAL DEFAULT 0,
        target_qty INTEGER NOT NULL DEFAULT 0,
        actual_qty INTEGER NOT NULL DEFAULT 0,
        good_qty INTEGER NOT NULL DEFAULT 0,
        rejected_qty INTEGER NOT NULL DEFAULT 0,
        downtime_minutes INTEGER NOT NULL DEFAULT 0,
        downtime_reason TEXT,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(machine_or_line, date, shift, hour_interval)
    )
    """)

    # 7. Shift Handovers table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS shift_handovers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        outgoing_shift TEXT NOT NULL CHECK(outgoing_shift IN ('Shift A', 'Shift B', 'Shift C')),
        incoming_shift TEXT NOT NULL CHECK(incoming_shift IN ('Shift A', 'Shift B', 'Shift C')),
        department_or_machine TEXT NOT NULL,
        handover_notes TEXT NOT NULL,
        production_status TEXT,
        pending_work TEXT,
        machine_problems TEXT,
        downtime_info TEXT,
        quality_issues TEXT,
        follow_up_actions TEXT,
        responsible_person TEXT NOT NULL,
        completion_status TEXT DEFAULT 'Open' CHECK(completion_status IN ('Open', 'In-Progress', 'Resolved')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 8. Application Settings
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    # 9. App State persistent store (stores full PHA state for direct compatibility)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state_json TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 10. Machine Tool Next Plans (Max 5 plans per machine covered by Tool Number)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS machine_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_number TEXT NOT NULL,
        plan_index INTEGER NOT NULL CHECK(plan_index >= 1 AND plan_index <= 5),
        tool_number TEXT NOT NULL,
        plan_quantity INTEGER NOT NULL DEFAULT 0,
        part_name TEXT,
        status TEXT DEFAULT 'Queued' CHECK(status IN ('Queued', 'In Setup', 'Ready', 'In Progress', 'Completed')),
        target_date TEXT,
        target_shift TEXT,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(machine_number, plan_index)
    )
    """)

    # Ensure tool_number, supervisor_name, uph, production_pct, hourly_output_pct, entry_time columns exist in production_records
    for col_def in [
        ("tool_number", "TEXT DEFAULT ''"),
        ("supervisor_name", "TEXT DEFAULT ''"),
        ("uph", "REAL DEFAULT 0"),
        ("production_pct", "REAL DEFAULT 0"),
        ("hourly_output_pct", "REAL DEFAULT 0"),
        ("entry_time", "TEXT DEFAULT ''")
    ]:
        try:
            cursor.execute(f"ALTER TABLE production_records ADD COLUMN {col_def[0]} {col_def[1]}")
        except Exception:
            pass

    # 11. Activity Logs for Audit History
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        action TEXT NOT NULL,
        record_type TEXT NOT NULL,
        record_id TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 12. Machine Breakdown and Downtime Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS machine_downtime (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_number TEXT NOT NULL,
        downtime_code TEXT DEFAULT 'D01',
        breakdown_start TEXT NOT NULL,
        breakdown_end TEXT,
        breakdown_reason TEXT NOT NULL,
        total_downtime_minutes INTEGER DEFAULT 0,
        remarks TEXT,
        reported_by TEXT,
        operator_name TEXT DEFAULT '',
        date TEXT DEFAULT '',
        shift TEXT DEFAULT 'Shift A',
        status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'Resolved', 'Under Repair')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    for col_def in [
        ("downtime_code", "TEXT DEFAULT 'D01'"),
        ("operator_name", "TEXT DEFAULT ''"),
        ("date", "TEXT DEFAULT ''"),
        ("shift", "TEXT DEFAULT 'Shift A'")
    ]:
        try:
            cursor.execute(f"ALTER TABLE machine_downtime ADD COLUMN {col_def[0]} {col_def[1]}")
        except Exception:
            pass

    # 13. Configurable Downtime Codes (Maximum 6 Codes)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS downtime_codes (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        display_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Seed the 6 Configured Downtime Codes
    default_downtime_codes = [
        ('D01', 'Machine Breakdown', 'Mechanical or electrical failure', 1),
        ('D02', 'Tool Problem', 'Tool wear, breakage, or die alignment', 2),
        ('D03', 'Material Shortage', 'Raw material, blank, or coil unavailability', 3),
        ('D04', 'Power Failure', 'Electrical grid, power outage, or generator fault', 4),
        ('D05', 'Quality Problem', 'Defects, burr, crack, or dimensional issues', 5),
        ('D06', 'Other Issues', 'Maintenance, safety, air pressure, or miscellaneous', 6)
    ]
    for code, name, desc, order_num in default_downtime_codes:
        cursor.execute("""
        INSERT INTO downtime_codes (code, name, description, display_order)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(code) DO NOTHING
        """, (code, name, desc, order_num))

    conn.commit()

    # Seed Default Admin & Initial Setup if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO users (username, password_hash, full_name, role, department)
        VALUES (?, ?, ?, ?, ?)
        """, ('admin', hash_password('admin123'), 'PHA Administrator', 'Admin', 'Management'))
        cursor.execute("""
        INSERT INTO users (username, password_hash, full_name, role, department)
        VALUES (?, ?, ?, ?, ?)
        """, ('supervisor', hash_password('super123'), 'Shift Supervisor', 'Supervisor', 'Production'))
        cursor.execute("""
        INSERT INTO users (username, password_hash, full_name, role, department)
        VALUES (?, ?, ?, ?, ?)
        """, ('management', hash_password('mgmt123'), 'Plant General Manager', 'Management', 'Operations'))
        conn.commit()

    # Seed Default Machines if none exist (16 NC Machines + 6 Tandem Lines)
    cursor.execute("SELECT COUNT(*) FROM machines")
    if cursor.fetchone()[0] == 0:
        # 16 NC Machine positions
        nc_tonnages = [1000, 1000, 800, 800, 600, 600, 500, 500, 400, 400, 300, 300, 250, 250, 200, 200]
        for i in range(1, 17):
            m_num = f"NC-{i:02d}"
            tonnage = nc_tonnages[i-1]
            cursor.execute("""
            INSERT INTO machines (machine_number, machine_type, tonnage, production_target, status)
            VALUES (?, 'NC', ?, 600, 'Idle')
            """, (m_num, tonnage))

        # 6 Tandem lines
        tandem_lines = [
            ("LP-1", 1200, 800),
            ("LP-2", 1200, 800),
            ("HP-1", 1600, 1000),
            ("HP-2", 1600, 1000),
            ("HP-3", 2000, 1200),
            ("HP-4", 2000, 1200)
        ]
        for line_name, tonnage, target in tandem_lines:
            cursor.execute("""
            INSERT INTO machines (machine_number, machine_type, tonnage, production_target, status)
            VALUES (?, 'Tandem', ?, ?, 'Idle')
            """, (line_name, tonnage, target))
        conn.commit()

    # Seed Default Settings (12-Hour Timings)
    default_settings = {
        "company_name": "PHA INDIA PRIVATE LIMITED",
        "plant_location": "Sriperumbudur, Tamil Nadu",
        "shift_a_start": "08:00 AM",
        "shift_a_end": "04:30 PM",
        "shift_b_start": "04:30 PM",
        "shift_b_end": "01:00 AM",
        "shift_c_start": "01:00 AM",
        "shift_c_end": "08:00 AM",
        "default_ot_multiplier": "1.5",
        "hours_per_shift": "8"
    }
    for k, v in default_settings.items():
        cursor.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", (k, v))
    conn.commit()

    # Seed Default Machine Tool Plans (Max 5 plans per machine) if empty
    cursor.execute("SELECT COUNT(*) FROM machine_plans")
    if cursor.fetchone()[0] == 0:
        sample_plans = [
            ("NC-01", 1, "TL-1001-CTR", 1500, "Center Pillar Inner LH", "In Progress", "Die cleaned and loaded"),
            ("NC-01", 2, "TL-1002-CTR", 1200, "Center Pillar Inner RH", "Ready", "Next changeover scheduled"),
            ("NC-01", 3, "TL-1045-FLR", 800, "Front Floor Member", "In Setup", "Tool staging in progress"),
            ("NC-01", 4, "TL-1090-BRK", 2500, "Dash Reinforcement Bracket", "Queued", "Raw material dispatched"),
            ("NC-01", 5, "TL-1110-PLT", 1000, "Bumper Mounting Plate", "Queued", "Tool inspection pending"),

            ("NC-02", 1, "TL-2010-DRF", 900, "Door Frame Front LH", "In Progress", "Running normal"),
            ("NC-02", 2, "TL-2012-DRF", 950, "Door Frame Front RH", "Ready", "Die ready at rack A-3"),
            ("NC-02", 3, "TL-2040-HNG", 1400, "Hinge Reinforcement", "Queued", "Material allocated"),

            ("NC-03", 1, "TL-3022-ROF", 750, "Roof Rail Inner LH", "In Progress", "Running at 80 pcs/hr"),
            ("NC-03", 2, "TL-3023-ROF", 750, "Roof Rail Inner RH", "Ready", "Die inspection cleared"),

            ("LP-1", 1, "DIE-LP1-SIDE", 600, "Side Outer Panel LH", "In Progress", "Line running 65 pcs/hr"),
            ("LP-1", 2, "DIE-LP1-SIDR", 600, "Side Outer Panel RH", "Ready", "Tool staging bay 1"),
            ("LP-1", 3, "DIE-LP1-FLOR", 850, "Under Floor Main", "Queued", "Coil feeding scheduled"),

            ("HP-1", 1, "DIE-HP1-HOOD", 700, "Hood Outer Skin", "In Progress", "Critical surface inspection"),
            ("HP-1", 2, "DIE-HP1-TRNK", 750, "Trunk Lid Outer", "Ready", "Bolster pre-set"),
        ]
        for m_num, p_idx, t_num, qty, part, status, rem in sample_plans:
            cursor.execute("""
            INSERT OR IGNORE INTO machine_plans 
            (machine_number, plan_index, tool_number, plan_quantity, part_name, status, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (m_num, p_idx, t_num, qty, part, status, rem))
        conn.commit()

    conn.close()

def get_current_shift(time_str=None):
    """Determine current shift based on configured 12-hour shift timings."""
    if not time_str:
        now = datetime.now()
        time_str = now.strftime("%H:%M")
    
    # Factory Shifts (12-hour AM/PM format matching):
    # Shift A: 08:00 AM to 04:30 PM (08:00 to 16:30)
    # Shift B: 04:30 PM to 01:00 AM (16:30 to 01:00)
    # Shift C: 01:00 AM to 08:00 AM (01:00 to 08:00)
    if "08:00" <= time_str < "16:30":
        return "Shift A"
    elif "16:30" <= time_str or time_str < "01:00":
        return "Shift B"
    else:
        return "Shift C"

def get_full_state():
    """
    Returns entire structured state for compatibility with /api/state.
    All data is pulled dynamically from SQLite.
    """
    conn = get_db()
    cursor = conn.cursor()

    # Employees
    cursor.execute("SELECT * FROM employees ORDER BY emp_id ASC")
    employees = [dict(row) for row in cursor.fetchall()]

    # Machines
    cursor.execute("SELECT * FROM machines ORDER BY machine_type ASC, machine_number ASC")
    machines = [dict(row) for row in cursor.fetchall()]

    # Attendance (recent 500)
    cursor.execute("""
    SELECT a.*, e.name as emp_name, e.department 
    FROM attendance a 
    JOIN employees e ON a.emp_id = e.emp_id 
    ORDER BY a.date DESC, a.shift ASC
    LIMIT 500
    """)
    attendance = [dict(row) for row in cursor.fetchall()]

    # Overtime (recent 500)
    cursor.execute("""
    SELECT o.*, e.name as emp_name, e.department, e.ot_hourly_rate
    FROM overtime o
    JOIN employees e ON o.emp_id = e.emp_id
    ORDER BY o.date DESC
    LIMIT 500
    """)
    overtime = [dict(row) for row in cursor.fetchall()]

    # Production records
    cursor.execute("""
    SELECT * FROM production_records 
    ORDER BY date DESC, shift ASC, hour_interval ASC
    LIMIT 1000
    """)
    production_records = [dict(row) for row in cursor.fetchall()]

    # Shift handovers
    cursor.execute("""
    SELECT * FROM shift_handovers 
    ORDER BY date DESC, id DESC
    LIMIT 200
    """)
    handovers = [dict(row) for row in cursor.fetchall()]

    # Settings
    cursor.execute("SELECT key, value FROM app_settings")
    settings = {row['key']: row['value'] for row in cursor.fetchall()}

    conn.close()

    today_str = date.today().isoformat()
    curr_shift = get_current_shift()

    return {
        "status": "success",
        "current_date": today_str,
        "current_shift": curr_shift,
        "employees": employees,
        "machines": machines,
        "attendance": attendance,
        "overtime": overtime,
        "production_records": production_records,
        "shift_handovers": handovers,
        "settings": settings
    }

def save_app_state(state_data):
    """Save raw state snapshot to SQLite."""
    conn = get_db()
    cursor = conn.cursor()
    if isinstance(state_data, dict):
        state_json = json.dumps(state_data)
    else:
        state_json = str(state_data)
    cursor.execute("""
    INSERT INTO app_state (id, state_json, updated_at) 
    VALUES (1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET 
        state_json = excluded.state_json,
        updated_at = CURRENT_TIMESTAMP
    """, (state_json,))
    conn.commit()
    conn.close()

def get_app_state():
    """Get raw state snapshot from SQLite."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT state_json FROM app_state WHERE id = 1")
    row = cursor.fetchone()
    conn.close()
    if row and row["state_json"]:
        try:
            return json.loads(row["state_json"])
        except Exception:
            pass
    # If not yet saved in app_state, return default clean empty structure
    return {
        "manpower": [],
        "machines": [],
        "production": [],
        "attendance": {},
        "settings": {"supervisor": "", "shift": "Shift A"},
        "quick": {}
    }
