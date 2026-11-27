import sqlite3
import os
import json
from datetime import datetime, date

from security import hash_password as pbkdf2_hash_password

# Database path in backend directory (override via PHA_DB_PATH for isolated staging/tests)
DB_DIR = os.path.dirname(os.path.abspath(__file__))


def get_db_path() -> str:
    return os.environ.get("PHA_DB_PATH") or os.path.join(DB_DIR, "pha_india.db")


DB_PATH = get_db_path()


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with a random per-user salt."""
    return pbkdf2_hash_password(password)


def get_db():
    """Get SQLite connection with Row factory and WAL mode for high concurrency."""
    conn = sqlite3.connect(get_db_path(), timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def _safe_add_column(cursor, table: str, column: str, definition: str):
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    except Exception:
        pass


def init_db():
    """Initialize database tables safely without seeding hardcoded credentials."""
    conn = get_db()
    cursor = conn.cursor()

    # 1. Users table (Admin & Supervisor authenticated accounts; no hardcoded passwords)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('Admin', 'Management', 'Supervisor', 'Operator')),
        department TEXT DEFAULT 'Press Shop MFG-2',
        recovery_email TEXT DEFAULT '',
        recovery_email_verified INTEGER NOT NULL DEFAULT 0,
        recovery_verify_code_hash TEXT DEFAULT '',
        recovery_verify_expires_at TEXT DEFAULT '',
        must_change_password INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_login_at TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    for col, col_def in [
        ("recovery_email", "TEXT DEFAULT ''"),
        ("recovery_email_verified", "INTEGER NOT NULL DEFAULT 0"),
        ("recovery_verify_code_hash", "TEXT DEFAULT ''"),
        ("recovery_verify_expires_at", "TEXT DEFAULT ''"),
        ("must_change_password", "INTEGER NOT NULL DEFAULT 1"),
        ("is_active", "INTEGER NOT NULL DEFAULT 1"),
        ("last_login_at", "TEXT DEFAULT ''"),
        ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
    ]:
        _safe_add_column(cursor, "users", col, col_def)

    # 1b. Password recovery single-use tokens & audit log
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS password_recovery_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        target_role TEXT NOT NULL,
        email TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT DEFAULT '',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        requested_ip TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS recovery_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_role TEXT DEFAULT '',
        email TEXT DEFAULT '',
        event_type TEXT NOT NULL,
        success INTEGER NOT NULL DEFAULT 0,
        detail TEXT DEFAULT '',
        ip_address TEXT DEFAULT '',
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
        plant_id TEXT NOT NULL DEFAULT 'Plant 1',
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
    _safe_add_column(cursor, "employees", "plant_id", "TEXT NOT NULL DEFAULT 'Plant 1'")

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
        machine_group TEXT NOT NULL DEFAULT 'NC',
        plant_id TEXT NOT NULL DEFAULT 'Plant 1',
        tonnage REAL DEFAULT 0,
        production_target INTEGER DEFAULT 500,
        status TEXT DEFAULT 'Idle' CHECK(status IN ('Running', 'Idle', 'Maintenance', 'Breakdown')),
        assigned_operator TEXT,
        assigned_shift TEXT DEFAULT 'Shift A',
        maintenance_notes TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    for col, col_def in [
        ("machine_group", "TEXT NOT NULL DEFAULT 'NC'"),
        ("plant_id", "TEXT NOT NULL DEFAULT 'Plant 1'"),
        ("version", "INTEGER NOT NULL DEFAULT 1"),
        ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ("updated_by", "TEXT DEFAULT ''"),
    ]:
        _safe_add_column(cursor, "machines", col, col_def)

    # 6. Production Records (Hourly & Standard)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS production_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plant_id TEXT NOT NULL DEFAULT 'Plant 1',
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
        downtime_code TEXT DEFAULT 'D01',
        downtime_reason TEXT,
        remarks TEXT,
        client_submission_id TEXT,
        submitted_by_role TEXT DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(machine_or_line, date, shift, hour_interval)
    )
    """)

    for col, col_def in [
        ("plant_id", "TEXT NOT NULL DEFAULT 'Plant 1'"),
        ("tool_number", "TEXT DEFAULT ''"),
        ("supervisor_name", "TEXT DEFAULT ''"),
        ("uph", "REAL DEFAULT 0"),
        ("production_pct", "REAL DEFAULT 0"),
        ("hourly_output_pct", "REAL DEFAULT 0"),
        ("entry_time", "TEXT DEFAULT ''"),
        ("downtime_code", "TEXT DEFAULT 'D01'"),
        ("client_submission_id", "TEXT"),
        ("submitted_by_role", "TEXT DEFAULT ''"),
        ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
    ]:
        _safe_add_column(cursor, "production_records", col, col_def)

    cursor.execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS idx_production_client_submission_id
    ON production_records(client_submission_id)
    WHERE client_submission_id IS NOT NULL
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

    # 9. App State persistent store
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state_json TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 10. Machine Tool Next Plans (Max 5 plans per machine)
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

    # 11. Activity Logs for Audit History
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        actor_role TEXT DEFAULT '',
        action TEXT NOT NULL,
        record_type TEXT NOT NULL,
        record_id TEXT,
        details TEXT,
        old_value TEXT DEFAULT '',
        new_value TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    for col, col_def in [
        ("actor_role", "TEXT DEFAULT ''"),
        ("old_value", "TEXT DEFAULT ''"),
        ("new_value", "TEXT DEFAULT ''"),
    ]:
        _safe_add_column(cursor, "activity_logs", col, col_def)

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
    for col, col_def in [
        ("downtime_code", "TEXT DEFAULT 'D01'"),
        ("operator_name", "TEXT DEFAULT ''"),
        ("date", "TEXT DEFAULT ''"),
        ("shift", "TEXT DEFAULT 'Shift A'"),
    ]:
        _safe_add_column(cursor, "machine_downtime", col, col_def)

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

    default_downtime_codes = [
        ("D01", "Machine Breakdown", "Mechanical or electrical failure", 1),
        ("D02", "Tool Problem", "Tool wear, breakage, or die alignment", 2),
        ("D03", "Material Shortage", "Raw material, blank, or coil unavailability", 3),
        ("D04", "Power Failure", "Electrical grid, power outage, or generator fault", 4),
        ("D05", "Quality Problem", "Defects, burr, crack, or dimensional issues", 5),
        ("D06", "Other Issues", "Maintenance, safety, air pressure, or miscellaneous", 6),
    ]
    for code, name, desc, order_num in default_downtime_codes:
        cursor.execute(
            """
            INSERT INTO downtime_codes (code, name, description, display_order)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(code) DO NOTHING
            """,
            (code, name, desc, order_num),
        )

    # 14. Tool Directory
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_number TEXT UNIQUE NOT NULL,
        part_name TEXT DEFAULT '',
        description TEXT DEFAULT '',
        customer TEXT DEFAULT '',
        compatible_type TEXT NOT NULL DEFAULT 'Both',
        compatible_machines TEXT DEFAULT '',
        standard_uph REAL NOT NULL DEFAULT 0,
        tonnage_required REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Active',
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 15. WhatsApp Recipients & Report Dispatch History
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS whatsapp_recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone_number TEXT UNIQUE NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_by TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS whatsapp_reports_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_send_id TEXT UNIQUE,
        report_type TEXT NOT NULL,
        report_title TEXT DEFAULT '',
        filters_json TEXT NOT NULL DEFAULT '{}',
        message_preview TEXT NOT NULL DEFAULT '',
        recipients_json TEXT NOT NULL DEFAULT '[]',
        delivery_mode TEXT NOT NULL DEFAULT 'cloud-api',
        overall_status TEXT NOT NULL DEFAULT 'pending',
        sent_by TEXT DEFAULT '',
        sent_by_role TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()

    # Seed Default Machines if none exist (16 NC Machines + 6 Tandem Lines)
    cursor.execute("SELECT COUNT(*) FROM machines")
    if cursor.fetchone()[0] == 0:
        nc_tonnages = [1000, 800, 800, 600, 600, 500, 500, 400, 400, 300, 300, 300, 250, 250, 200, 200]
        nc_targets = [600, 550, 550, 500, 500, 450, 450, 400, 400, 350, 350, 350, 300, 300, 250, 250]
        for i in range(1, 17):
            m_num = f"NC-{i:02d}"
            cursor.execute(
                """
                INSERT INTO machines (machine_number, machine_type, machine_group, plant_id, tonnage, production_target, status)
                VALUES (?, 'NC', 'NC', 'Plant 1', ?, ?, 'Idle')
                """,
                (m_num, nc_tonnages[i - 1], nc_targets[i - 1]),
            )

        tandem_lines = [
            ("LP-1", 1200, 700),
            ("LP-2", 1000, 650),
            ("HP-1", 1500, 800),
            ("HP-2", 1500, 800),
            ("HP-3", 2000, 900),
            ("HP-4", 2000, 900),
        ]
        for line_name, tonnage, target in tandem_lines:
            cursor.execute(
                """
                INSERT INTO machines (machine_number, machine_type, machine_group, plant_id, tonnage, production_target, status)
                VALUES (?, 'Tandem', 'Tandem', 'Plant 1', ?, ?, 'Idle')
                """,
                (line_name, tonnage, target),
            )
        conn.commit()

    # Seed Default Settings (do not overwrite existing operator/admin modifications)
    default_settings = {
        "company_name": "PHA INDIA PRIVATE LIMITED",
        "plant_location": "Plant 1 • Sriperumbudur, Tamil Nadu",
        "shift_a_start": "08:00",
        "shift_a_end": "16:30",
        "shift_b_start": "16:30",
        "shift_b_end": "01:00",
        "shift_c_start": "01:00",
        "shift_c_end": "08:00",
        "target_efficiency_threshold": "85",
        "hours_per_shift": "8",
    }
    for k, v in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", (k, v))
    conn.commit()
    conn.close()


def get_current_shift(time_str=None):
    """Determine current shift based on configured shift timings."""
    if not time_str:
        now = datetime.now()
        time_str = now.strftime("%H:%M")

    if "08:00" <= time_str < "16:30":
        return "Shift A"
    elif "16:30" <= time_str or time_str < "01:00":
        return "Shift B"
    else:
        return "Shift C"


def get_full_state():
    """Return full state from SQLite for compatibility."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, emp_id, name, department, designation, shift, assigned_machine, plant_id, status FROM employees ORDER BY emp_id ASC")
    employees = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM machines ORDER BY machine_type ASC, machine_number ASC")
    machines = [dict(row) for row in cursor.fetchall()]

    cursor.execute("""
    SELECT a.*, e.name as emp_name, e.department
    FROM attendance a
    JOIN employees e ON a.emp_id = e.emp_id
    ORDER BY a.date DESC, a.shift ASC
    LIMIT 500
    """)
    attendance = [dict(row) for row in cursor.fetchall()]

    cursor.execute("""
    SELECT o.*, e.name as emp_name, e.department
    FROM overtime o
    JOIN employees e ON o.emp_id = e.emp_id
    ORDER BY o.date DESC
    LIMIT 500
    """)
    overtime = [dict(row) for row in cursor.fetchall()]

    cursor.execute("""
    SELECT * FROM production_records
    ORDER BY date DESC, shift ASC, hour_interval ASC
    LIMIT 1000
    """)
    production_records = [dict(row) for row in cursor.fetchall()]

    cursor.execute("""
    SELECT * FROM shift_handovers
    ORDER BY date DESC, id DESC
    LIMIT 200
    """)
    handovers = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT key, value FROM app_settings")
    settings = {row["key"]: row["value"] for row in cursor.fetchall()}

    conn.close()

    return {
        "status": "success",
        "current_date": date.today().isoformat(),
        "current_shift": get_current_shift(),
        "employees": employees,
        "machines": machines,
        "attendance": attendance,
        "overtime": overtime,
        "production_records": production_records,
        "shift_handovers": handovers,
        "settings": settings,
    }


def save_app_state(state_data):
    conn = get_db()
    cursor = conn.cursor()
    state_json = json.dumps(state_data) if isinstance(state_data, dict) else str(state_data)
    cursor.execute(
        """
        INSERT INTO app_state (id, state_json, updated_at)
        VALUES (1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            state_json = excluded.state_json,
            updated_at = CURRENT_TIMESTAMP
        """,
        (state_json,),
    )
    conn.commit()
    conn.close()


def get_app_state():
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
    return {
        "manpower": [],
        "machines": [],
        "production": [],
        "attendance": {},
        "settings": {"supervisor": "", "shift": "Shift A"},
        "quick": {},
    }
