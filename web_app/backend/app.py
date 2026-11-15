import os
import sys
# Ensure backend directory is always in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import csv
import io
import json
from datetime import datetime, date
from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
from database import get_db, init_db, hash_password, get_full_state, get_current_shift, DB_PATH, save_app_state, get_app_state

app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# Initialize DB on startup
with app.app_context():
    init_db()

# -------------------------------------------------------------
# HELPER FUNCTIONS
# -------------------------------------------------------------
def get_user_from_header():
    """Extract mock/bearer session user from request header."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()
        # Simple token format: username:role
        parts = token.split(":")
        if len(parts) >= 2:
            return {"username": parts[0], "role": parts[1]}
    return {"username": "guest", "role": "Operator"}

def query_to_dicts(cursor):
    """Convert cursor results to list of dicts."""
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.dirname(BACKEND_DIR)
ROOT_DIR = os.path.dirname(WEB_APP_DIR)
# Prioritize web_app local directories for standalone deployment
DIST_DIR = os.path.join(WEB_APP_DIR, "dist") if os.path.exists(os.path.join(WEB_APP_DIR, "dist")) else os.path.join(ROOT_DIR, "dist")
APK_DIR = os.path.join(WEB_APP_DIR, "apk") if os.path.exists(os.path.join(WEB_APP_DIR, "apk")) else os.path.join(ROOT_DIR, "apk")

# -------------------------------------------------------------
# HEALTH & FRONTEND SERVING & APK DOWNLOAD
# -------------------------------------------------------------
@app.route("/download-apk")
@app.route("/api/download-apk")
@app.route("/PRESS_SHOP_MFG-2.apk")
def download_apk():
    apk_filename = "PRESS_SHOP_MFG-2.apk"
    candidate_dirs = [
        APK_DIR,
        os.path.join(WEB_APP_DIR, "apk"),
        ROOT_DIR,
        DIST_DIR
    ]
    target_dir = next((d for d in candidate_dirs if os.path.exists(os.path.join(d, apk_filename))), None)
    if not target_dir:
        return jsonify({"error": "APK not found. Please assemble APK first."}), 404
    return send_from_directory(
        target_dir,
        apk_filename,
        as_attachment=True,
        mimetype="application/vnd.android.package-archive"
    )

@app.route("/api/health")
def api_health():
    return jsonify({
        "status": "success",
        "system": "PHA INDIA PRIVATE LIMITED",
        "timestamp": datetime.now().isoformat()
    })

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    # Do not intercept API routes
    if path.startswith("api/"):
        return jsonify({"error": "Endpoint not found"}), 404

    if path != "" and os.path.exists(os.path.join(DIST_DIR, path)):
        return send_from_directory(DIST_DIR, path)
    elif os.path.exists(os.path.join(DIST_DIR, "index.html")):
        return send_from_directory(DIST_DIR, "index.html")
    else:
        return jsonify({
            "system": "PHA INDIA PRIVATE LIMITED",
            "description": "Employee Management & Industrial Production Management System",
            "status": "operational",
            "api_prefix": "/api",
            "database": "pha_india.db"
        })

@app.route("/api/state", methods=["GET", "POST"])
def handle_state():
    """Unified endpoint for /api/state supporting both UI state and REST compatibility."""
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        save_app_state(data)
        
        # Also sync manpower to employees table if provided
        if "manpower" in data and isinstance(data["manpower"], list):
            conn = get_db()
            cursor = conn.cursor()
            current_ids = []
            for m in data["manpower"]:
                emp_id = m.get("empId") or m.get("id")
                if not emp_id:
                    continue
                current_ids.append(emp_id)
                emp_status = "Active" if m.get("status") in ["Present", "Active", None, ""] else ("Inactive" if m.get("status") == "Inactive" else "Active")
                cursor.execute("""
                INSERT INTO employees (emp_id, name, department, designation, assigned_machine, status)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(emp_id) DO UPDATE SET
                    name = excluded.name,
                    assigned_machine = excluded.assigned_machine,
                    designation = excluded.designation,
                    status = excluded.status
                """, (
                    emp_id,
                    m.get("name", ""),
                    "NC Production",
                    m.get("role", "Operator"),
                    m.get("machineId", ""),
                    emp_status
                ))
            if current_ids:
                placeholders = ",".join("?" * len(current_ids))
                cursor.execute(f"DELETE FROM attendance WHERE emp_id NOT IN ({placeholders})", current_ids)
                cursor.execute(f"DELETE FROM overtime WHERE emp_id NOT IN ({placeholders})", current_ids)
                cursor.execute(f"DELETE FROM employees WHERE emp_id NOT IN ({placeholders})", current_ids)
            conn.commit()
            conn.close()

        return jsonify({"status": "success", "message": "Saved to SQLite database"})
    else:
        app_state = get_app_state()
        full_state = get_full_state()
        
        # If app_state has no manpower yet but employees exists in DB, seed manpower from employees
        if not app_state.get("manpower") and full_state.get("employees"):
            app_state["manpower"] = [
                {
                    "id": str(e["emp_id"]),
                    "empId": str(e["emp_id"]),
                    "name": e["name"],
                    "machineId": e.get("assigned_machine") or "",
                    "role": e.get("designation") or "",
                    "status": e.get("status") or "Present",
                    "remarks": ""
                }
                for e in full_state["employees"]
            ]
        # Ensure all machines have both UI and REST compatibility fields
        db_machines = full_state.get("machines", [])
        merged_machines = {}
        for m in db_machines:
            m_no = str(m["machine_number"])
            merged_machines[m_no] = {
                "id": m_no,
                "no": m_no,
                "machine_number": m_no,
                "machine_type": m.get("machine_type", "NC"),
                "operation": m.get("machine_type", "NC"),
                "tonnage": m.get("tonnage", 200),
                "plan": m.get("production_target", 500),
                "production_target": m.get("production_target", 500),
                "status": m.get("status", "Active"),
                "remarks": ""
            }
        for m in app_state.get("machines", []):
            m_no = str(m.get("no") or m.get("machine_number") or m.get("id"))
            if m_no in merged_machines:
                merged_machines[m_no].update(m)
                merged_machines[m_no]["machine_type"] = merged_machines[m_no].get("machine_type") or merged_machines[m_no].get("operation") or "NC"
                merged_machines[m_no]["production_target"] = merged_machines[m_no].get("production_target") or merged_machines[m_no].get("plan") or 500
            else:
                m_type = m.get("machine_type") or m.get("operation") or ("Tandem" if "TANDEM" in m_no.upper() else "NC")
                merged_machines[m_no] = {
                    "id": m_no,
                    "no": m_no,
                    "machine_number": m_no,
                    "machine_type": m_type,
                    "operation": m_type,
                    "tonnage": m.get("tonnage", 200),
                    "plan": m.get("plan", 500),
                    "production_target": m.get("production_target", m.get("plan", 500)),
                    "status": m.get("status", "Active"),
                    "remarks": m.get("remarks", "")
                }
        
        final_machines = list(merged_machines.values())
        app_state["machines"] = final_machines
            
        combined = {
            "status": "success",
            **full_state,
            **app_state
        }
        return jsonify(combined)

# -------------------------------------------------------------
# AUTHENTICATION
# -------------------------------------------------------------
@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    role = data.get("role", "").strip()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    full_name = data.get("full_name", "").strip()

    # Passwordless role-based login (Supervisor, Admin, Others)
    if role or not password:
        selected_role = role or ("Admin" if username.lower() == "admin" else ("Supervisor" if username.lower() == "supervisor" else "Others"))
        if selected_role not in ["Admin", "Supervisor", "Others", "Operator", "Management"]:
            selected_role = "Supervisor"
        
        display_name = full_name or ("PHA Administrator" if selected_role == "Admin" else ("Shift Supervisor" if selected_role == "Supervisor" else "Shopfloor Operator"))
        uname = username or selected_role.lower()
        dept = "Plant Management" if selected_role == "Admin" else ("Press Shop MFG-2" if selected_role == "Supervisor" else "Shopfloor Operations")

        token = f"{uname}:{selected_role}"
        return jsonify({
            "success": True,
            "token": token,
            "user": {
                "id": 1 if selected_role == "Admin" else (2 if selected_role == "Supervisor" else 3),
                "username": uname,
                "full_name": display_name,
                "role": selected_role,
                "department": dept
            }
        })

    # Standard username/password login
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "Invalid username or password"}), 401

    hashed = hash_password(password)
    if user["password_hash"] != hashed:
        return jsonify({"error": "Invalid username or password"}), 401

    token = f"{user['username']}:{user['role']}"
    return jsonify({
        "success": True,
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "department": user["department"]
        }
    })

@app.route("/api/auth/quick-login", methods=["POST"])
def quick_login():
    data = request.get_json(silent=True) or {}
    role = data.get("role", "Supervisor").strip()
    full_name = data.get("full_name", "").strip()
    
    if role not in ["Admin", "Supervisor", "Others", "Operator", "Management"]:
        role = "Supervisor"
    
    uname = role.lower()
    display_name = full_name or ("PHA Administrator" if role == "Admin" else ("Shift Supervisor" if role == "Supervisor" else "Shopfloor Operator"))
    dept = "Plant Management" if role == "Admin" else ("Press Shop MFG-2" if role == "Supervisor" else "Shopfloor Operations")
    
    token = f"{uname}:{role}"
    return jsonify({
        "success": True,
        "token": token,
        "user": {
            "id": 1 if role == "Admin" else (2 if role == "Supervisor" else 3),
            "username": uname,
            "full_name": display_name,
            "role": role,
            "department": dept
        }
    })

@app.route("/api/auth/me", methods=["GET"])
def me():
    auth_user = get_user_from_header()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, full_name, role, department FROM users WHERE username = ?", (auth_user["username"],))
    row = cursor.fetchone()
    conn.close()
    if row:
        return jsonify({"user": dict(row)})
    return jsonify({"user": {"username": "guest", "full_name": "PHA Guest", "role": "Supervisor", "department": "Production"}})

# -------------------------------------------------------------
# DASHBOARD KPIs
# -------------------------------------------------------------
@app.route("/api/dashboard/kpis", methods=["GET"])
def get_dashboard_kpis():
    selected_date = request.args.get("date", date.today().isoformat())
    selected_shift = request.args.get("shift", get_current_shift())

    conn = get_db()
    cursor = conn.cursor()

    # 1. Employee statistics
    cursor.execute("SELECT COUNT(*) FROM employees WHERE status = 'Active'")
    total_employees = cursor.fetchone()[0]

    cursor.execute("""
    SELECT 
        COUNT(CASE WHEN status = 'Present' THEN 1 END) as present_count,
        COUNT(CASE WHEN status = 'Absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN status = 'Leave' THEN 1 END) as leave_count,
        COUNT(CASE WHEN status = 'On-Duty' THEN 1 END) as onduty_count
    FROM attendance 
    WHERE date = ? AND shift = ?
    """, (selected_date, selected_shift))
    att_row = cursor.fetchone()
    employees_present = att_row["present_count"] or 0
    employees_absent = att_row["absent_count"] or 0
    employees_on_leave = att_row["leave_count"] or 0

    # 2. Machines statistics
    cursor.execute("SELECT COUNT(*) FROM machines WHERE machine_type = 'NC' AND status = 'Running'")
    active_nc_machines = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM machines WHERE machine_type = 'Tandem' AND status = 'Running'")
    active_tandem_lines = cursor.fetchone()[0]

    # Total NC machines and Tandem lines registered
    cursor.execute("SELECT COUNT(*) FROM machines WHERE machine_type = 'NC'")
    total_nc_machines = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM machines WHERE machine_type = 'Tandem'")
    total_tandem_lines = cursor.fetchone()[0]

    # 3. Production Today (Selected Date & Shift)
    cursor.execute("""
    SELECT 
        COALESCE(SUM(target_qty), 0) as total_target,
        COALESCE(SUM(actual_qty), 0) as total_actual,
        COALESCE(SUM(good_qty), 0) as total_good,
        COALESCE(SUM(rejected_qty), 0) as total_rejected,
        COALESCE(SUM(downtime_minutes), 0) as total_downtime
    FROM production_records
    WHERE date = ? AND shift = ?
    """, (selected_date, selected_shift))
    prod_row = cursor.fetchone()

    total_target = prod_row["total_target"]
    total_actual = prod_row["total_actual"]
    total_good = prod_row["total_good"]
    total_rejected = prod_row["total_rejected"]
    total_downtime = prod_row["total_downtime"]

    achievement_pct = round((total_actual / total_target * 100), 1) if total_target > 0 else 0
    rejection_pct = round((total_rejected / total_actual * 100), 1) if total_actual > 0 else 0

    # Full Day Total Production
    cursor.execute("""
    SELECT 
        COALESCE(SUM(target_qty), 0) as day_target,
        COALESCE(SUM(actual_qty), 0) as day_actual,
        COALESCE(SUM(good_qty), 0) as day_good,
        COALESCE(SUM(rejected_qty), 0) as day_rejected,
        COALESCE(SUM(downtime_minutes), 0) as day_downtime
    FROM production_records
    WHERE date = ?
    """, (selected_date,))
    day_row = cursor.fetchone()

    # NC Summary (today + shift)
    cursor.execute("""
    SELECT 
        COALESCE(SUM(target_qty), 0) as target,
        COALESCE(SUM(actual_qty), 0) as actual,
        COALESCE(SUM(good_qty), 0) as good,
        COALESCE(SUM(rejected_qty), 0) as rejected,
        COALESCE(SUM(downtime_minutes), 0) as downtime
    FROM production_records
    WHERE date = ? AND shift = ? AND production_type = 'NC'
    """, (selected_date, selected_shift))
    nc_summary = dict(cursor.fetchone())
    nc_summary["achievement_pct"] = round((nc_summary["actual"] / nc_summary["target"] * 100), 1) if nc_summary["target"] > 0 else 0

    # Tandem Summary (today + shift)
    cursor.execute("""
    SELECT 
        COALESCE(SUM(target_qty), 0) as target,
        COALESCE(SUM(actual_qty), 0) as actual,
        COALESCE(SUM(good_qty), 0) as good,
        COALESCE(SUM(rejected_qty), 0) as rejected,
        COALESCE(SUM(downtime_minutes), 0) as downtime
    FROM production_records
    WHERE date = ? AND shift = ? AND production_type = 'Tandem'
    """, (selected_date, selected_shift))
    tandem_summary = dict(cursor.fetchone())
    tandem_summary["achievement_pct"] = round((tandem_summary["actual"] / tandem_summary["target"] * 100), 1) if tandem_summary["target"] > 0 else 0

    # Shift-wise production comparison for the selected date
    shifts = ['Shift A', 'Shift B', 'Shift C']
    shift_breakdown = {}
    for s in shifts:
        cursor.execute("""
        SELECT 
            COALESCE(SUM(target_qty), 0) as target,
            COALESCE(SUM(actual_qty), 0) as actual,
            COALESCE(SUM(good_qty), 0) as good,
            COALESCE(SUM(rejected_qty), 0) as rejected,
            COALESCE(SUM(downtime_minutes), 0) as downtime
        FROM production_records
        WHERE date = ? AND shift = ?
        """, (selected_date, s))
        sb = dict(cursor.fetchone())
        sb["achievement_pct"] = round((sb["actual"] / sb["target"] * 100), 1) if sb["target"] > 0 else 0
        shift_breakdown[s] = sb

    # Hourly production breakdown for selected date & shift
    cursor.execute("""
    SELECT 
        hour_interval,
        COALESCE(SUM(target_qty), 0) as target,
        COALESCE(SUM(actual_qty), 0) as actual,
        COALESCE(SUM(good_qty), 0) as good,
        COALESCE(SUM(rejected_qty), 0) as rejected,
        COALESCE(SUM(downtime_minutes), 0) as downtime
    FROM production_records
    WHERE date = ? AND shift = ?
    GROUP BY hour_interval
    ORDER BY hour_interval ASC
    """, (selected_date, selected_shift))
    hourly_breakdown = [dict(row) for row in cursor.fetchall()]

    # Pending handovers count and list
    cursor.execute("""
    SELECT * FROM shift_handovers 
    WHERE completion_status != 'Resolved'
    ORDER BY date DESC, id DESC
    LIMIT 5
    """)
    pending_handovers = [dict(row) for row in cursor.fetchall()]

    # Recent entries
    cursor.execute("""
    SELECT * FROM production_records 
    ORDER BY id DESC LIMIT 5
    """)
    recent_production = [dict(row) for row in cursor.fetchall()]

    cursor.execute("""
    SELECT a.*, e.name as emp_name, e.department
    FROM attendance a
    JOIN employees e ON a.emp_id = e.emp_id
    ORDER BY a.id DESC LIMIT 5
    """)
    recent_attendance = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        "selected_date": selected_date,
        "selected_shift": selected_shift,
        "current_shift": get_current_shift(),
        "total_employees": total_employees,
        "employees_present": employees_present,
        "employees_absent": employees_absent,
        "employees_on_leave": employees_on_leave,
        "active_nc_machines": active_nc_machines,
        "total_nc_machines": total_nc_machines,
        "active_tandem_lines": active_tandem_lines,
        "total_tandem_lines": total_tandem_lines,
        "shift_production": {
            "target": total_target,
            "actual": total_actual,
            "good": total_good,
            "rejected": total_rejected,
            "downtime_minutes": total_downtime,
            "achievement_pct": achievement_pct,
            "rejection_pct": rejection_pct
        },
        "day_production": {
            "target": day_row["day_target"],
            "actual": day_row["day_actual"],
            "good": day_row["day_good"],
            "rejected": day_row["day_rejected"],
            "downtime_minutes": day_row["day_downtime"],
            "achievement_pct": round((day_row["day_actual"] / day_row["day_target"] * 100), 1) if day_row["day_target"] > 0 else 0
        },
        "nc_summary": nc_summary,
        "tandem_summary": tandem_summary,
        "shift_breakdown": shift_breakdown,
        "hourly_breakdown": hourly_breakdown,
        "pending_handovers": pending_handovers,
        "recent_production": recent_production,
        "recent_attendance": recent_attendance
    })

# -------------------------------------------------------------
# CELL STATUS (MACHINE OUTPUT PERCENTAGES & DOWNTIME PARETO)
# Matching Shopfloor Cell Status Dashboard Layout
# -------------------------------------------------------------
@app.route("/api/dashboard/cell-status", methods=["GET"])
def get_cell_status():
    selected_date = request.args.get("date", date.today().isoformat())
    selected_shift = request.args.get("shift", get_current_shift())
    filter_type = request.args.get("type", "ALL").upper()  # ALL, NC, TANDEM

    conn = get_db()
    cursor = conn.cursor()

    # Retrieve all machines entered in the system
    machine_query = "SELECT * FROM machines"
    params = []
    if filter_type in ["NC", "TANDEM"]:
        machine_query += " WHERE machine_type = ?"
        params.append(filter_type)
    machine_query += " ORDER BY machine_type ASC, machine_number ASC"
    cursor.execute(machine_query, params)
    machines = [dict(row) for row in cursor.fetchall()]

    # Retrieve all production records for the date & shift
    cursor.execute("""
    SELECT 
        machine_or_line,
        COALESCE(SUM(target_qty), 0) as target,
        COALESCE(SUM(actual_qty), 0) as actual,
        COALESCE(SUM(good_qty), 0) as good,
        COALESCE(SUM(rejected_qty), 0) as rejected,
        COALESCE(SUM(downtime_minutes), 0) as downtime,
        downtime_reason
    FROM production_records
    WHERE date = ? AND shift = ?
    GROUP BY machine_or_line
    """, (selected_date, selected_shift))
    records_by_machine = {row["machine_or_line"].upper(): dict(row) for row in cursor.fetchall()}

    # Retrieve active tool for each machine from machine_plans (Plan 1)
    cursor.execute("""
    SELECT machine_number, tool_number, plan_quantity, part_name, status
    FROM machine_plans
    WHERE plan_index = 1
    """)
    active_plans = {row["machine_number"].upper(): dict(row) for row in cursor.fetchall()}

    cell_machines = []
    top_ticker = []

    for m in machines:
        m_num = m["machine_number"].upper()
        rec = records_by_machine.get(m_num, {})
        target = rec.get("target") or m.get("production_target") or 600
        actual = rec.get("actual") or 0
        good = rec.get("good") or (actual if actual > 0 else 0)
        rejected = rec.get("rejected") or 0
        downtime = rec.get("downtime") or 0

        # Calculations for OEE, Performance, Quality, Availability
        output_pct = round((actual / target * 100), 1) if target > 0 else 0
        perf_pct = min(125, round((actual / max(target, 1)) * 100)) if actual > 0 else (100 if actual == target and target > 0 else 0)
        quality_pct = round((good / max(actual, 1)) * 100) if actual > 0 else 100
        shift_minutes = 480
        avail_pct = max(0, min(100, round(((shift_minutes - downtime) / shift_minutes) * 100)))

        # Composite OEE: (Performance * Quality * Availability) / 10000
        oee_val = round((perf_pct * quality_pct * avail_pct) / 10000) if actual > 0 else (output_pct if output_pct > 0 else 0)
        
        # Color coding
        color_class = "green" if output_pct >= 85 else ("yellow" if output_pct >= 70 else ("red" if output_pct > 0 else "gray"))

        plan_info = active_plans.get(m_num, {})
        
        cell_item = {
            "machine_number": m["machine_number"],
            "machine_type": m["machine_type"],
            "tonnage": m["tonnage"],
            "status": m.get("status", "Idle"),
            "target": target,
            "actual": actual,
            "good": good,
            "rejected": rejected,
            "downtime_minutes": downtime,
            "downtime_reason": rec.get("downtime_reason", ""),
            "output_pct": output_pct,
            "oee": oee_val if oee_val > 0 else output_pct,
            "performance": perf_pct,
            "quality": quality_pct,
            "availability": avail_pct,
            "color_class": color_class,
            "active_tool": plan_info.get("tool_number", "TL-STD"),
            "active_part": plan_info.get("part_name", "General Panel"),
            "plan_status": plan_info.get("status", "Queued")
        }
        cell_machines.append(cell_item)

        # Add to top ticker
        top_ticker.append({
            "name": m["machine_number"],
            "pct": f"{output_pct:.2f}%",
            "val": output_pct,
            "status": color_class
        })

    # Sort ticker so top active machines show clearly
    top_ticker.sort(key=lambda x: x["val"], reverse=True)

    # 4. Downtime Pareto Chart Data
    cursor.execute("""
    SELECT 
        COALESCE(NULLIF(downtime_reason, ''), 'Uncategorized') as category,
        SUM(downtime_minutes) as minutes
    FROM production_records
    WHERE date = ? AND shift = ? AND downtime_minutes > 0
    GROUP BY category
    ORDER BY minutes DESC
    """, (selected_date, selected_shift))
    raw_pareto = cursor.fetchall()

    pareto_categories = []
    total_dt = sum(row["minutes"] for row in raw_pareto)
    
    # If no recorded downtime yet, provide standard shopfloor category distribution
    if total_dt == 0:
        standard_distribution = [
            ("Call Maintenance", 45),
            ("Short Stop", 30),
            ("Die Change Over", 25),
            ("Line Waiting", 20),
            ("Sanitation / Clean", 15),
            ("Uncategorized", 10),
            ("Part Jam", 8),
            ("Operator Break", 5)
        ]
        total_dt = sum(item[1] for item in standard_distribution)
        cum = 0
        for cat, mins in standard_distribution:
            cum += mins
            pareto_categories.append({
                "category": cat,
                "minutes": mins,
                "cumulative_pct": round((cum / total_dt) * 100, 1)
            })
    else:
        cum = 0
        for r in raw_pareto:
            mins = r["minutes"]
            cum += mins
            pareto_categories.append({
                "category": r["category"],
                "minutes": mins,
                "cumulative_pct": round((cum / total_dt) * 100, 1)
            })

    conn.close()

    return jsonify({
        "status": "success",
        "date": selected_date,
        "shift": selected_shift,
        "total_machines": len(cell_machines),
        "machines": cell_machines,
        "ticker": top_ticker[:10],
        "downtime_pareto": pareto_categories
    })

# -------------------------------------------------------------
# MACHINE TOOL NEXT PLANS (Max 5 Plans per machine)
# -------------------------------------------------------------
@app.route("/api/plans", methods=["GET", "POST"])
def manage_plans():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        machine = data.get("machine_number", "").strip().upper()
        plan_index = int(data.get("plan_index", 1))
        tool_number = data.get("tool_number", "").strip()
        plan_qty = int(data.get("plan_quantity", 0))
        part_name = data.get("part_name", "").strip()
        plan_status = data.get("status", "Queued").strip()
        remarks = data.get("remarks", "").strip()
        target_date = data.get("target_date", date.today().isoformat())
        target_shift = data.get("target_shift", get_current_shift())

        if not machine or not tool_number:
            conn.close()
            return jsonify({"error": "Machine number and Tool number are required"}), 400

        if plan_index < 1 or plan_index > 5:
            conn.close()
            return jsonify({"error": "Each machine has a maximum of 5 next plans (plan_index must be 1 to 5)"}), 400

        cursor.execute("""
        INSERT INTO machine_plans 
        (machine_number, plan_index, tool_number, plan_quantity, part_name, status, target_date, target_shift, remarks, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(machine_number, plan_index) DO UPDATE SET
            tool_number = excluded.tool_number,
            plan_quantity = excluded.plan_quantity,
            part_name = excluded.part_name,
            status = excluded.status,
            target_date = excluded.target_date,
            target_shift = excluded.target_shift,
            remarks = excluded.remarks,
            updated_at = CURRENT_TIMESTAMP
        """, (machine, plan_index, tool_number, plan_qty, part_name, plan_status, target_date, target_shift, remarks))
        conn.commit()

        # Retrieve updated plan
        cursor.execute("SELECT * FROM machine_plans WHERE machine_number = ? AND plan_index = ?", (machine, plan_index))
        saved = dict(cursor.fetchone())
        conn.close()
        return jsonify({"success": True, "message": f"Plan #{plan_index} for machine {machine} saved successfully", "plan": saved})

    # GET plans
    machine_filter = request.args.get("machine", "").strip().upper()
    if machine_filter:
        cursor.execute("""
        SELECT * FROM machine_plans 
        WHERE machine_number = ? 
        ORDER BY plan_index ASC
        """, (machine_filter,))
    else:
        cursor.execute("""
        SELECT * FROM machine_plans 
        ORDER BY machine_number ASC, plan_index ASC
        """)
    
    plans = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"status": "success", "plans": plans})

@app.route("/api/plans/<int:plan_id>", methods=["PUT", "DELETE"])
def plan_detail_api(plan_id):
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "DELETE":
        cursor.execute("DELETE FROM machine_plans WHERE id = ?", (plan_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Plan #{plan_id} deleted."})

    # PUT
    data = request.get_json(silent=True) or {}
    tool_number = data.get("tool_number", "").strip()
    plan_qty = int(data.get("plan_quantity", 0))
    part_name = data.get("part_name", "").strip()
    plan_status = data.get("status", "Queued").strip()
    remarks = data.get("remarks", "").strip()

    cursor.execute("""
    UPDATE machine_plans 
    SET tool_number = COALESCE(NULLIF(?, ''), tool_number),
        plan_quantity = ?,
        part_name = COALESCE(NULLIF(?, ''), part_name),
        status = ?,
        remarks = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (tool_number, plan_qty, part_name, plan_status, remarks, plan_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Plan #{plan_id} updated."})


# -------------------------------------------------------------
# EMPLOYEE MANAGEMENT
# -------------------------------------------------------------
@app.route("/api/employees", methods=["GET", "POST"])
def employees_api():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        emp_id = data.get("emp_id", "").strip().upper()
        name = data.get("name", "").strip()
        department = data.get("department", "NC Production").strip()
        designation = data.get("designation", "Operator").strip()

        if not emp_id or not name:
            conn.close()
            return jsonify({"error": "Employee ID and Name are required"}), 400

        # Check unique emp_id
        cursor.execute("SELECT id FROM employees WHERE emp_id = ?", (emp_id,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": f"Employee ID '{emp_id}' already exists"}), 400

        cursor.execute("""
        INSERT INTO employees 
        (emp_id, name, department, designation, phone, email, joining_date, shift, assigned_machine, status,
         basic_salary, hra, da, conveyance, special_allowance, pf_deduction, esi_deduction, tds_deduction, ot_hourly_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            emp_id, name, department, designation,
            data.get("phone", ""), data.get("email", ""),
            data.get("joining_date", date.today().isoformat()),
            data.get("shift", "Shift A"),
            data.get("assigned_machine", ""),
            data.get("status", "Active"),
            float(data.get("basic_salary", 0) or 0),
            float(data.get("hra", 0) or 0),
            float(data.get("da", 0) or 0),
            float(data.get("conveyance", 0) or 0),
            float(data.get("special_allowance", 0) or 0),
            float(data.get("pf_deduction", 0) or 0),
            float(data.get("esi_deduction", 0) or 0),
            float(data.get("tds_deduction", 0) or 0),
            float(data.get("ot_hourly_rate", 0) or 0)
        ))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Employee {emp_id} registered successfully", "emp_id": emp_id}), 201

    # GET request - list employees with search and filters
    search = request.args.get("search", "").strip().lower()
    department = request.args.get("department", "").strip()
    shift = request.args.get("shift", "").strip()
    status = request.args.get("status", "").strip()

    query = "SELECT * FROM employees WHERE 1=1"
    params = []

    if search:
        query += " AND (LOWER(emp_id) LIKE ? OR LOWER(name) LIKE ? OR LOWER(designation) LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
    if department:
        query += " AND department = ?"
        params.append(department)
    if shift:
        query += " AND shift = ?"
        params.append(shift)
    if status:
        query += " AND status = ?"
        params.append(status)

    query += " ORDER BY emp_id ASC"
    cursor.execute(query, params)
    employees = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({"employees": employees, "count": len(employees)})

@app.route("/api/employees/<emp_id>", methods=["GET", "PUT", "DELETE"])
def single_employee_api(emp_id):
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "GET":
        cursor.execute("SELECT * FROM employees WHERE emp_id = ?", (emp_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({"error": "Employee not found"}), 404
        emp = dict(row)

        # Fetch attendance history
        cursor.execute("SELECT * FROM attendance WHERE emp_id = ? ORDER BY date DESC LIMIT 30", (emp_id,))
        attendance_history = [dict(r) for r in cursor.fetchall()]

        # Fetch overtime history
        cursor.execute("SELECT * FROM overtime WHERE emp_id = ? ORDER BY date DESC LIMIT 30", (emp_id,))
        ot_history = [dict(r) for r in cursor.fetchall()]

        conn.close()
        return jsonify({
            "employee": emp,
            "attendance_history": attendance_history,
            "overtime_history": ot_history
        })

    elif request.method == "PUT":
        data = request.get_json(silent=True) or {}
        cursor.execute("SELECT id FROM employees WHERE emp_id = ?", (emp_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Employee not found"}), 404

        cursor.execute("""
        UPDATE employees SET
            name = COALESCE(?, name),
            department = COALESCE(?, department),
            designation = COALESCE(?, designation),
            phone = COALESCE(?, phone),
            email = COALESCE(?, email),
            joining_date = COALESCE(?, joining_date),
            shift = COALESCE(?, shift),
            assigned_machine = COALESCE(?, assigned_machine),
            status = COALESCE(?, status),
            basic_salary = COALESCE(?, basic_salary),
            hra = COALESCE(?, hra),
            da = COALESCE(?, da),
            conveyance = COALESCE(?, conveyance),
            special_allowance = COALESCE(?, special_allowance),
            pf_deduction = COALESCE(?, pf_deduction),
            esi_deduction = COALESCE(?, esi_deduction),
            tds_deduction = COALESCE(?, tds_deduction),
            ot_hourly_rate = COALESCE(?, ot_hourly_rate),
            updated_at = CURRENT_TIMESTAMP
        WHERE emp_id = ?
        """, (
            data.get("name"), data.get("department"), data.get("designation"),
            data.get("phone"), data.get("email"), data.get("joining_date"),
            data.get("shift"), data.get("assigned_machine"), data.get("status"),
            data.get("basic_salary"), data.get("hra"), data.get("da"),
            data.get("conveyance"), data.get("special_allowance"),
            data.get("pf_deduction"), data.get("esi_deduction"),
            data.get("tds_deduction"), data.get("ot_hourly_rate"),
            emp_id
        ))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Employee {emp_id} updated successfully"})

    elif request.method == "DELETE":
        # Permanently delete employee and cascade cleanup of any associated records
        cursor.execute("DELETE FROM attendance WHERE emp_id = ?", (emp_id,))
        cursor.execute("DELETE FROM overtime WHERE emp_id = ?", (emp_id,))
        cursor.execute("DELETE FROM employees WHERE emp_id = ?", (emp_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Employee {emp_id} permanently deleted from database."})

# -------------------------------------------------------------
# ATTENDANCE MANAGEMENT
# -------------------------------------------------------------
@app.route("/api/attendance", methods=["GET", "POST"])
def attendance_api():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        # Supports either single entry or batch list of records
        records = data.get("records", [])
        if not records and "emp_id" in data:
            records = [data]

        saved_count = 0
        for rec in records:
            emp_id = rec.get("emp_id")
            att_date = rec.get("date", date.today().isoformat())
            att_shift = rec.get("shift", "Shift A")
            att_status = rec.get("status", "Present")

            if not emp_id or not att_date:
                continue

            cursor.execute("""
            INSERT INTO attendance (emp_id, date, shift, status, check_in_time, check_out_time, notes, doc_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(emp_id, date, shift) DO UPDATE SET
                status = excluded.status,
                check_in_time = COALESCE(excluded.check_in_time, attendance.check_in_time),
                check_out_time = COALESCE(excluded.check_out_time, attendance.check_out_time),
                notes = COALESCE(excluded.notes, attendance.notes),
                doc_url = COALESCE(excluded.doc_url, attendance.doc_url)
            """, (
                emp_id, att_date, att_shift, att_status,
                rec.get("check_in_time", ""), rec.get("check_out_time", ""),
                rec.get("notes", ""), rec.get("doc_url", "")
            ))
            saved_count += 1

        conn.commit()
        conn.close()
        return jsonify({"success": True, "saved_records": saved_count})

    # GET request
    att_date = request.args.get("date", date.today().isoformat())
    att_shift = request.args.get("shift", "")
    dept = request.args.get("department", "")
    emp_id = request.args.get("emp_id", "")

    query = """
    SELECT a.*, e.name as emp_name, e.department, e.designation
    FROM attendance a
    JOIN employees e ON a.emp_id = e.emp_id
    WHERE 1=1
    """
    params = []
    if att_date:
        query += " AND a.date = ?"
        params.append(att_date)
    if att_shift:
        query += " AND a.shift = ?"
        params.append(att_shift)
    if dept:
        query += " AND e.department = ?"
        params.append(dept)
    if emp_id:
        query += " AND a.emp_id = ?"
        params.append(emp_id)

    query += " ORDER BY e.department ASC, e.emp_id ASC"
    cursor.execute(query, params)
    records = [dict(row) for row in cursor.fetchall()]

    # Roster view: List of all active employees with their attendance status for this date/shift
    roster_query = """
    SELECT e.emp_id, e.name, e.department, e.designation, e.shift as default_shift,
           a.id as attendance_id, a.status, a.check_in_time, a.check_out_time, a.notes, a.doc_url
    FROM employees e
    LEFT JOIN attendance a ON e.emp_id = a.emp_id AND a.date = ?
    """
    roster_params = [att_date]
    if att_shift:
        roster_query += " AND a.shift = ?"
        roster_params.append(att_shift)
    
    roster_query += " WHERE e.status = 'Active'"
    if dept:
        roster_query += " AND e.department = ?"
        roster_params.append(dept)

    roster_query += " ORDER BY e.emp_id ASC"
    cursor.execute(roster_query, roster_params)
    roster = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return jsonify({
        "date": att_date,
        "shift": att_shift,
        "records": records,
        "roster": roster,
        "total_marked": len(records)
    })

# -------------------------------------------------------------
# OVERTIME MANAGEMENT
# -------------------------------------------------------------
@app.route("/api/overtime", methods=["GET", "POST"])
def overtime_api():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        emp_id = data.get("emp_id")
        ot_date = data.get("date", date.today().isoformat())
        ot_shift = data.get("shift", "Shift A")
        ot_hours = float(data.get("ot_hours", 0) or 0)
        reg_hours = float(data.get("regular_hours", 8.0) or 8.0)
        reason = data.get("reason", "")

        if not emp_id or ot_hours <= 0:
            conn.close()
            return jsonify({"error": "Employee ID and valid overtime hours are required"}), 400

        cursor.execute("""
        INSERT INTO overtime (emp_id, date, shift, regular_hours, ot_hours, reason, approval_status)
        VALUES (?, ?, ?, ?, ?, ?, 'Pending')
        ON CONFLICT(emp_id, date, shift) DO UPDATE SET
            regular_hours = excluded.regular_hours,
            ot_hours = excluded.ot_hours,
            reason = excluded.reason
        """, (emp_id, ot_date, ot_shift, reg_hours, ot_hours, reason))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Overtime record submitted"})

    # GET
    ot_date = request.args.get("date", "")
    ot_month = request.args.get("month", "") # YYYY-MM
    emp_id = request.args.get("emp_id", "")
    status = request.args.get("status", "")

    query = """
    SELECT o.*, e.name as emp_name, e.department, e.ot_hourly_rate
    FROM overtime o
    JOIN employees e ON o.emp_id = e.emp_id
    WHERE 1=1
    """
    params = []
    if ot_date:
        query += " AND o.date = ?"
        params.append(ot_date)
    if ot_month:
        query += " AND o.date LIKE ?"
        params.append(f"{ot_month}%")
    if emp_id:
        query += " AND o.emp_id = ?"
        params.append(emp_id)
    if status:
        query += " AND o.approval_status = ?"
        params.append(status)

    query += " ORDER BY o.date DESC"
    cursor.execute(query, params)
    overtime_list = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({"overtime": overtime_list, "count": len(overtime_list)})

@app.route("/api/overtime/<int:id>/status", methods=["PUT"])
def update_overtime_status(id):
    data = request.get_json(silent=True) or {}
    status = data.get("status", "Approved")
    approved_by = data.get("approved_by", "Supervisor")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE overtime SET approval_status = ?, approved_by = ? WHERE id = ?
    """, (status, approved_by, id))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Overtime #{id} marked as {status}"})

# -------------------------------------------------------------
# SALARY MANAGEMENT (Restricted to Admin / Management)
# -------------------------------------------------------------
@app.route("/api/salary", methods=["GET"])
def get_salaries():
    auth_user = get_user_from_header()
    # Check permissions
    if auth_user["role"] not in ["Admin", "Management"]:
        return jsonify({"error": "Unauthorized access to salary management"}), 403

    month = request.args.get("month", date.today().strftime("%Y-%m"))
    dept = request.args.get("department", "")

    conn = get_db()
    cursor = conn.cursor()

    # Get active employees
    emp_query = "SELECT * FROM employees WHERE status = 'Active'"
    params = []
    if dept:
        emp_query += " AND department = ?"
        params.append(dept)
    emp_query += " ORDER BY emp_id ASC"
    cursor.execute(emp_query, params)
    employees = [dict(row) for row in cursor.fetchall()]

    salary_sheets = []
    total_payroll_payout = 0

    for emp in employees:
        emp_id = emp["emp_id"]
        # Approved OT hours for the month
        cursor.execute("""
        SELECT COALESCE(SUM(ot_hours), 0) 
        FROM overtime 
        WHERE emp_id = ? AND date LIKE ? AND approval_status = 'Approved'
        """, (emp_id, f"{month}%"))
        approved_ot_hours = cursor.fetchone()[0]

        # Days present in the month
        cursor.execute("""
        SELECT COUNT(*) FROM attendance 
        WHERE emp_id = ? AND date LIKE ? AND status IN ('Present', 'On-Duty')
        """, (emp_id, f"{month}%"))
        present_days = cursor.fetchone()[0]

        basic = float(emp["basic_salary"] or 0)
        hra = float(emp["hra"] or 0)
        da = float(emp["da"] or 0)
        conveyance = float(emp["conveyance"] or 0)
        special = float(emp["special_allowance"] or 0)
        ot_rate = float(emp["ot_hourly_rate"] or 0)
        
        ot_pay = round(approved_ot_hours * ot_rate, 2)
        gross_salary = round(basic + hra + da + conveyance + special + ot_pay, 2)

        pf = float(emp["pf_deduction"] or 0)
        esi = float(emp["esi_deduction"] or 0)
        tds = float(emp["tds_deduction"] or 0)
        total_deductions = round(pf + esi + tds, 2)

        net_salary = round(gross_salary - total_deductions, 2)
        total_payroll_payout += net_salary

        salary_sheets.append({
            "emp_id": emp_id,
            "name": emp["name"],
            "department": emp["department"],
            "designation": emp["designation"],
            "month": month,
            "present_days": present_days,
            "approved_ot_hours": approved_ot_hours,
            "ot_rate": ot_rate,
            "ot_pay": ot_pay,
            "basic_salary": basic,
            "hra": hra,
            "da": da,
            "conveyance": conveyance,
            "special_allowance": special,
            "gross_salary": gross_salary,
            "pf_deduction": pf,
            "esi_deduction": esi,
            "tds_deduction": tds,
            "total_deductions": total_deductions,
            "net_salary": net_salary
        })

    conn.close()
    return jsonify({
        "month": month,
        "salary_sheets": salary_sheets,
        "total_employees": len(salary_sheets),
        "total_payroll_payout": round(total_payroll_payout, 2)
    })

@app.route("/api/salary/<emp_id>", methods=["PUT"])
def update_salary_config(emp_id):
    auth_user = get_user_from_header()
    if auth_user["role"] not in ["Admin", "Management"]:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json(silent=True) or {}
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
    UPDATE employees SET
        basic_salary = ?,
        hra = ?,
        da = ?,
        conveyance = ?,
        special_allowance = ?,
        pf_deduction = ?,
        esi_deduction = ?,
        tds_deduction = ?,
        ot_hourly_rate = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE emp_id = ?
    """, (
        float(data.get("basic_salary", 0)),
        float(data.get("hra", 0)),
        float(data.get("da", 0)),
        float(data.get("conveyance", 0)),
        float(data.get("special_allowance", 0)),
        float(data.get("pf_deduction", 0)),
        float(data.get("esi_deduction", 0)),
        float(data.get("tds_deduction", 0)),
        float(data.get("ot_hourly_rate", 0)),
        emp_id
    ))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Salary structure updated for {emp_id}"})

# -------------------------------------------------------------
# MACHINE MANAGEMENT
# -------------------------------------------------------------
@app.route("/api/machines", methods=["GET", "POST"])
def machines_api():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        machine_number = data.get("machine_number", "").strip().upper()
        machine_type = data.get("machine_type", "NC").strip()
        tonnage = float(data.get("tonnage", 0) or 0)
        target = int(data.get("production_target", 500) or 500)

        if not machine_number:
            conn.close()
            return jsonify({"error": "Machine number is required"}), 400

        cursor.execute("SELECT id FROM machines WHERE machine_number = ?", (machine_number,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": f"Machine {machine_number} already exists"}), 400

        cursor.execute("""
        INSERT INTO machines (machine_number, machine_type, tonnage, production_target, status, assigned_operator, assigned_shift, maintenance_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            machine_number, machine_type, tonnage, target,
            data.get("status", "Idle"),
            data.get("assigned_operator", ""),
            data.get("assigned_shift", "Shift A"),
            data.get("maintenance_notes", "")
        ))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Machine {machine_number} registered"}), 201

    # GET machines
    m_type = request.args.get("type", "")
    query = "SELECT * FROM machines WHERE 1=1"
    params = []
    if m_type:
        query += " AND machine_type = ?"
        params.append(m_type)
    query += " ORDER BY machine_type ASC, machine_number ASC"
    cursor.execute(query, params)
    machines = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({"machines": machines, "count": len(machines)})

@app.route("/api/machines/<machine_number>", methods=["PUT", "DELETE"])
def single_machine_api(machine_number):
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        cursor.execute("""
        UPDATE machines SET
            machine_type = COALESCE(?, machine_type),
            tonnage = COALESCE(?, tonnage),
            production_target = COALESCE(?, production_target),
            status = COALESCE(?, status),
            assigned_operator = COALESCE(?, assigned_operator),
            assigned_shift = COALESCE(?, assigned_shift),
            maintenance_notes = COALESCE(?, maintenance_notes)
        WHERE machine_number = ?
        """, (
            data.get("machine_type"),
            data.get("tonnage"),
            data.get("production_target"),
            data.get("status"),
            data.get("assigned_operator"),
            data.get("assigned_shift"),
            data.get("maintenance_notes"),
            machine_number
        ))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Machine {machine_number} updated"})

    elif request.method == "DELETE":
        cursor.execute("DELETE FROM machines WHERE machine_number = ?", (machine_number,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Machine {machine_number} removed"})

# -------------------------------------------------------------
# NC PRODUCTION MANAGEMENT (Dedicated 16 Machines)
# -------------------------------------------------------------
@app.route("/api/production/nc", methods=["GET", "POST"])
def nc_production_api():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        machine_num = data.get("machine_or_line", "").strip().upper()
        prod_date = data.get("date", date.today().isoformat())
        prod_shift = data.get("shift", "Shift A")
        hour = data.get("hour_interval", "Hour 1 (08:00 AM - 09:00 AM)")
        target = int(data.get("target_qty", 0) or 0)
        actual = int(data.get("actual_qty", 0) or 0)
        good = int(data.get("good_qty", actual) or 0)
        rejected = int(data.get("rejected_qty", 0) or 0)
        downtime = int(data.get("downtime_minutes", 0) or 0)

        if not machine_num:
            conn.close()
            return jsonify({"error": "Machine number is required"}), 400

        # Upsert record
        cursor.execute("""
        INSERT INTO production_records 
        (production_type, machine_or_line, date, shift, hour_interval, operator_name, tonnage, target_qty, actual_qty, good_qty, rejected_qty, downtime_minutes, downtime_reason, remarks)
        VALUES ('NC', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(machine_or_line, date, shift, hour_interval) DO UPDATE SET
            operator_name = COALESCE(excluded.operator_name, production_records.operator_name),
            tonnage = COALESCE(excluded.tonnage, production_records.tonnage),
            target_qty = excluded.target_qty,
            actual_qty = excluded.actual_qty,
            good_qty = excluded.good_qty,
            rejected_qty = excluded.rejected_qty,
            downtime_minutes = excluded.downtime_minutes,
            downtime_reason = excluded.downtime_reason,
            remarks = excluded.remarks
        """, (
            machine_num, prod_date, prod_shift, hour,
            data.get("operator_name", ""),
            float(data.get("tonnage", 0) or 0),
            target, actual, good, rejected, downtime,
            data.get("downtime_reason", ""),
            data.get("remarks", "")
        ))

        # Also update machine status to Running if producing, or Idle
        new_status = "Running" if actual > 0 else "Idle"
        if downtime > 30:
            new_status = "Breakdown" if "breakdown" in data.get("downtime_reason", "").lower() else "Maintenance"
        cursor.execute("UPDATE machines SET status = ? WHERE machine_number = ?", (new_status, machine_num))

        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"NC Production recorded for {machine_num}"})

    # GET - NC Overview & Matrix for all 16 machines
    filter_date = request.args.get("date", date.today().isoformat())
    filter_shift = request.args.get("shift", get_current_shift())

    # Get all NC machines from database
    cursor.execute("SELECT * FROM machines WHERE machine_type = 'NC' ORDER BY machine_number ASC")
    nc_machines = [dict(row) for row in cursor.fetchall()]

    machine_matrix = []
    total_target = 0
    total_actual = 0
    total_good = 0
    total_rejected = 0
    total_downtime = 0

    for m in nc_machines:
        m_num = m["machine_number"]
        cursor.execute("""
        SELECT 
            COALESCE(SUM(target_qty), 0) as target,
            COALESCE(SUM(actual_qty), 0) as actual,
            COALESCE(SUM(good_qty), 0) as good,
            COALESCE(SUM(rejected_qty), 0) as rejected,
            COALESCE(SUM(downtime_minutes), 0) as downtime,
            COUNT(*) as recorded_hours
        FROM production_records
        WHERE machine_or_line = ? AND date = ? AND shift = ?
        """, (m_num, filter_date, filter_shift))
        p = dict(cursor.fetchone())

        # If no target recorded yet for this shift, use machine's default target
        effective_target = p["target"] if p["target"] > 0 else m["production_target"]
        achievement = round((p["actual"] / effective_target * 100), 1) if effective_target > 0 else 0
        rejection_pct = round((p["rejected"] / p["actual"] * 100), 1) if p["actual"] > 0 else 0

        total_target += effective_target
        total_actual += p["actual"]
        total_good += p["good"]
        total_rejected += p["rejected"]
        total_downtime += p["downtime"]

        machine_matrix.append({
            "machine_number": m_num,
            "tonnage": m["tonnage"],
            "status": m["status"],
            "operator": m["assigned_operator"],
            "target": effective_target,
            "actual": p["actual"],
            "good": p["good"],
            "rejected": p["rejected"],
            "downtime_minutes": p["downtime"],
            "achievement_pct": achievement,
            "rejection_pct": rejection_pct,
            "recorded_hours": p["recorded_hours"]
        })

    # Recent NC hourly entries
    cursor.execute("""
    SELECT * FROM production_records 
    WHERE production_type = 'NC' AND date = ? AND shift = ?
    ORDER BY hour_interval ASC, machine_or_line ASC
    """, (filter_date, filter_shift))
    hourly_entries = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        "date": filter_date,
        "shift": filter_shift,
        "machine_matrix": machine_matrix,
        "total_target": total_target,
        "total_actual": total_actual,
        "total_good": total_good,
        "total_rejected": total_rejected,
        "total_downtime": total_downtime,
        "achievement_pct": round((total_actual / total_target * 100), 1) if total_target > 0 else 0,
        "rejection_pct": round((total_rejected / total_actual * 100), 1) if total_actual > 0 else 0,
        "hourly_entries": hourly_entries
    })

# -------------------------------------------------------------
# TANDEM PRODUCTION MANAGEMENT (Dedicated 6 Lines)
# -------------------------------------------------------------
@app.route("/api/production/tandem", methods=["GET", "POST"])
def tandem_production_api():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        line_num = data.get("machine_or_line", "").strip().upper()
        prod_date = data.get("date", date.today().isoformat())
        prod_shift = data.get("shift", "Shift A")
        hour = data.get("hour_interval", "Hour 1 (08:00 AM - 09:00 AM)")
        target = int(data.get("target_qty", 0) or 0)
        actual = int(data.get("actual_qty", 0) or 0)
        good = int(data.get("good_qty", actual) or 0)
        rejected = int(data.get("rejected_qty", 0) or 0)
        downtime = int(data.get("downtime_minutes", 0) or 0)

        if not line_num:
            conn.close()
            return jsonify({"error": "Tandem Line is required"}), 400

        cursor.execute("""
        INSERT INTO production_records 
        (production_type, machine_or_line, date, shift, hour_interval, operator_name, tonnage, target_qty, actual_qty, good_qty, rejected_qty, downtime_minutes, downtime_reason, remarks)
        VALUES ('Tandem', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(machine_or_line, date, shift, hour_interval) DO UPDATE SET
            operator_name = COALESCE(excluded.operator_name, production_records.operator_name),
            tonnage = COALESCE(excluded.tonnage, production_records.tonnage),
            target_qty = excluded.target_qty,
            actual_qty = excluded.actual_qty,
            good_qty = excluded.good_qty,
            rejected_qty = excluded.rejected_qty,
            downtime_minutes = excluded.downtime_minutes,
            downtime_reason = excluded.downtime_reason,
            remarks = excluded.remarks
        """, (
            line_num, prod_date, prod_shift, hour,
            data.get("operator_name", ""),
            float(data.get("tonnage", 0) or 0),
            target, actual, good, rejected, downtime,
            data.get("downtime_reason", ""),
            data.get("remarks", "")
        ))

        new_status = "Running" if actual > 0 else "Idle"
        if downtime > 30:
            new_status = "Breakdown" if "breakdown" in data.get("downtime_reason", "").lower() else "Maintenance"
        cursor.execute("UPDATE machines SET status = ? WHERE machine_number = ?", (new_status, line_num))

        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Tandem Production recorded for {line_num}"})

    # GET - Tandem 6 Lines overview
    filter_date = request.args.get("date", date.today().isoformat())
    filter_shift = request.args.get("shift", get_current_shift())

    cursor.execute("SELECT * FROM machines WHERE machine_type = 'Tandem' ORDER BY machine_number ASC")
    lines = [dict(row) for row in cursor.fetchall()]

    line_matrix = []
    total_target = 0
    total_actual = 0
    total_good = 0
    total_rejected = 0
    total_downtime = 0

    for l in lines:
        l_num = l["machine_number"]
        cursor.execute("""
        SELECT 
            COALESCE(SUM(target_qty), 0) as target,
            COALESCE(SUM(actual_qty), 0) as actual,
            COALESCE(SUM(good_qty), 0) as good,
            COALESCE(SUM(rejected_qty), 0) as rejected,
            COALESCE(SUM(downtime_minutes), 0) as downtime,
            COUNT(*) as recorded_hours
        FROM production_records
        WHERE machine_or_line = ? AND date = ? AND shift = ?
        """, (l_num, filter_date, filter_shift))
        p = dict(cursor.fetchone())

        effective_target = p["target"] if p["target"] > 0 else l["production_target"]
        achievement = round((p["actual"] / effective_target * 100), 1) if effective_target > 0 else 0
        rejection_pct = round((p["rejected"] / p["actual"] * 100), 1) if p["actual"] > 0 else 0

        total_target += effective_target
        total_actual += p["actual"]
        total_good += p["good"]
        total_rejected += p["rejected"]
        total_downtime += p["downtime"]

        line_matrix.append({
            "line_number": l_num,
            "tonnage": l["tonnage"],
            "status": l["status"],
            "operator": l["assigned_operator"],
            "target": effective_target,
            "actual": p["actual"],
            "good": p["good"],
            "rejected": p["rejected"],
            "downtime_minutes": p["downtime"],
            "achievement_pct": achievement,
            "rejection_pct": rejection_pct,
            "recorded_hours": p["recorded_hours"]
        })

    cursor.execute("""
    SELECT * FROM production_records 
    WHERE production_type = 'Tandem' AND date = ? AND shift = ?
    ORDER BY hour_interval ASC, machine_or_line ASC
    """, (filter_date, filter_shift))
    hourly_entries = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        "date": filter_date,
        "shift": filter_shift,
        "line_matrix": line_matrix,
        "total_target": total_target,
        "total_actual": total_actual,
        "total_good": total_good,
        "total_rejected": total_rejected,
        "total_downtime": total_downtime,
        "achievement_pct": round((total_actual / total_target * 100), 1) if total_target > 0 else 0,
        "rejection_pct": round((total_rejected / total_actual * 100), 1) if total_actual > 0 else 0,
        "hourly_entries": hourly_entries
    })

# -------------------------------------------------------------
# HOURLY PRODUCTION (HIGH PRIORITY)
# -------------------------------------------------------------
@app.route("/api/production/hourly", methods=["GET", "POST", "OPTIONS"])
def hourly_production_api():
    if request.method == "OPTIONS":
        return "", 200

    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        try:
            data = request.get_json(silent=True) or {}
            # Support either batch list under "records" or single record
            records_to_process = data.get("records") if isinstance(data.get("records"), list) else [data]

            saved_count = 0
            last_machine = None
            for item in records_to_process:
                machine_or_line = str(item.get("machine_or_line", "")).strip().upper()
                if not machine_or_line:
                    continue

                raw_ptype = str(item.get("production_type", "")).strip().upper()
                if "LP" in machine_or_line or "HP" in machine_or_line or raw_ptype == "TANDEM":
                    p_type = "Tandem"
                else:
                    p_type = "NC"

                prod_date = str(item.get("date", "")).strip() or date.today().isoformat()
                
                # Normalize shift
                raw_shift = str(item.get("shift", "Shift A")).strip()
                if "C" in raw_shift.upper() or "3" in raw_shift:
                    prod_shift = "Shift C"
                elif "B" in raw_shift.upper() or "2" in raw_shift:
                    prod_shift = "Shift B"
                else:
                    prod_shift = "Shift A"

                hour_interval = str(item.get("hour_interval", "Hour 1")).strip()
                try:
                    target_qty = max(0, int(float(str(item.get("target_qty", 0) or 0))))
                except (ValueError, TypeError):
                    target_qty = 0

                try:
                    actual_qty = max(0, int(float(str(item.get("actual_qty", 0) or 0))))
                except (ValueError, TypeError):
                    actual_qty = 0

                try:
                    rejected_qty = max(0, int(float(str(item.get("rejected_qty", 0) or 0))))
                except (ValueError, TypeError):
                    rejected_qty = 0

                try:
                    good_qty = max(0, int(float(str(item.get("good_qty", actual_qty - rejected_qty) or (actual_qty - rejected_qty)))))
                except (ValueError, TypeError):
                    good_qty = max(0, actual_qty - rejected_qty)

                try:
                    downtime_min = max(0, int(float(str(item.get("downtime_minutes", 0) or 0))))
                except (ValueError, TypeError):
                    downtime_min = 0

                op_name = str(item.get("operator_name", "")).strip()
                tool_num = str(item.get("tool_number", "")).strip()
                downtime_reason = str(item.get("downtime_reason", "")).strip()
                remarks = str(item.get("remarks", "")).strip()

                try:
                    tonnage_val = float(item.get("tonnage", 0) or 0)
                except (ValueError, TypeError):
                    tonnage_val = 1000.0

                last_machine = machine_or_line
                cursor.execute("""
                INSERT INTO production_records 
                (production_type, machine_or_line, date, shift, hour_interval, operator_name, tonnage, target_qty, actual_qty, good_qty, rejected_qty, downtime_minutes, downtime_reason, remarks, tool_number)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(machine_or_line, date, shift, hour_interval) DO UPDATE SET
                    production_type = excluded.production_type,
                    operator_name = COALESCE(NULLIF(excluded.operator_name, ''), production_records.operator_name),
                    tonnage = COALESCE(excluded.tonnage, production_records.tonnage),
                    target_qty = excluded.target_qty,
                    actual_qty = excluded.actual_qty,
                    good_qty = excluded.good_qty,
                    rejected_qty = excluded.rejected_qty,
                    downtime_minutes = excluded.downtime_minutes,
                    downtime_reason = excluded.downtime_reason,
                    remarks = excluded.remarks,
                    tool_number = COALESCE(NULLIF(excluded.tool_number, ''), production_records.tool_number)
                """, (
                    p_type, machine_or_line, prod_date, prod_shift, hour_interval,
                    op_name, tonnage_val,
                    target_qty, actual_qty, good_qty, rejected_qty, downtime_min,
                    downtime_reason, remarks, tool_num
                ))
                saved_count += 1

                # Update machine status accordingly
                new_status = "Running" if actual_qty > 0 else "Idle"
                if downtime_min > 30:
                    new_status = "Breakdown" if "breakdown" in downtime_reason.lower() else "Maintenance"
                cursor.execute("UPDATE machines SET status = ? WHERE machine_number = ?", (new_status, machine_or_line))

            conn.commit()
            conn.close()
            return jsonify({
                "success": True, 
                "message": f"Saved {saved_count} hourly production record(s) for {last_machine or 'units'}.",
                "saved_count": saved_count
            })
        except Exception as e:
            conn.rollback()
            conn.close()
            return jsonify({"success": False, "error": f"Failed to save hourly records: {str(e)}"}), 500

    # GET hourly production details
    prod_type = request.args.get("production_type", "")
    machine_or_line = request.args.get("machine_or_line", "")
    filter_date = request.args.get("date", date.today().isoformat())
    filter_shift = request.args.get("shift", get_current_shift())

    query = "SELECT * FROM production_records WHERE date = ?"
    params = [filter_date]

    if filter_shift:
        query += " AND shift = ?"
        params.append(filter_shift)
    if prod_type:
        query += " AND production_type = ?"
        params.append(prod_type)
    if machine_or_line:
        query += " AND machine_or_line = ?"
        params.append(machine_or_line)

    query += " ORDER BY hour_interval ASC, machine_or_line ASC"
    cursor.execute(query, params)
    records = [dict(row) for row in cursor.fetchall()]

    # Aggregates for shift
    shift_target = sum(r["target_qty"] for r in records)
    shift_actual = sum(r["actual_qty"] for r in records)
    shift_good = sum(r["good_qty"] for r in records)
    shift_rejected = sum(r["rejected_qty"] for r in records)
    shift_downtime = sum(r["downtime_minutes"] for r in records)
    remaining_qty = max(0, shift_target - shift_actual)
    achievement_pct = round((shift_actual / shift_target * 100), 1) if shift_target > 0 else 0

    # Aggregates for whole day
    cursor.execute("""
    SELECT 
        COALESCE(SUM(target_qty), 0) as day_target,
        COALESCE(SUM(actual_qty), 0) as day_actual
    FROM production_records
    WHERE date = ?
    """ + (" AND machine_or_line = ?" if machine_or_line else ""),
    ([filter_date, machine_or_line] if machine_or_line else [filter_date]))
    day_res = cursor.fetchone()

    conn.close()

    return jsonify({
        "date": filter_date,
        "shift": filter_shift,
        "machine_or_line": machine_or_line,
        "records": records,
        "summary": {
            "shift_target": shift_target,
            "shift_actual": shift_actual,
            "shift_good": shift_good,
            "shift_rejected": shift_rejected,
            "shift_downtime": shift_downtime,
            "remaining_qty": remaining_qty,
            "achievement_pct": achievement_pct,
            "day_target": day_res["day_target"],
            "day_actual": day_res["day_actual"]
        }
    })

# -------------------------------------------------------------
# THREE-SHIFT MANAGEMENT & COMPARISON
# -------------------------------------------------------------
@app.route("/api/production/shift-comparison", methods=["GET"])
def shift_comparison_api():
    conn = get_db()
    cursor = conn.cursor()

    comp_date = request.args.get("date", date.today().isoformat())
    shifts = ["Shift A", "Shift B", "Shift C"]
    results = {}

    daily_total_target = 0
    daily_total_actual = 0
    daily_total_good = 0
    daily_total_rejected = 0
    daily_total_downtime = 0

    for s in shifts:
        cursor.execute("""
        SELECT 
            COALESCE(SUM(target_qty), 0) as target,
            COALESCE(SUM(actual_qty), 0) as actual,
            COALESCE(SUM(good_qty), 0) as good,
            COALESCE(SUM(rejected_qty), 0) as rejected,
            COALESCE(SUM(downtime_minutes), 0) as downtime,
            COUNT(DISTINCT machine_or_line) as active_machines_lines
        FROM production_records
        WHERE date = ? AND shift = ?
        """, (comp_date, s))
        p = dict(cursor.fetchone())

        # Manpower present in this shift
        cursor.execute("""
        SELECT COUNT(*) FROM attendance 
        WHERE date = ? AND shift = ? AND status IN ('Present', 'On-Duty')
        """, (comp_date, s))
        manpower = cursor.fetchone()[0]

        p["manpower_present"] = manpower
        p["achievement_pct"] = round((p["actual"] / p["target"] * 100), 1) if p["target"] > 0 else 0
        p["rejection_pct"] = round((p["rejected"] / p["actual"] * 100), 1) if p["actual"] > 0 else 0

        # NC output for shift
        cursor.execute("SELECT COALESCE(SUM(actual_qty), 0) FROM production_records WHERE date = ? AND shift = ? AND production_type = 'NC'", (comp_date, s))
        p["nc_actual"] = cursor.fetchone()[0]

        # Tandem output for shift
        cursor.execute("SELECT COALESCE(SUM(actual_qty), 0) FROM production_records WHERE date = ? AND shift = ? AND production_type = 'Tandem'", (comp_date, s))
        p["tandem_actual"] = cursor.fetchone()[0]

        results[s] = p

        daily_total_target += p["target"]
        daily_total_actual += p["actual"]
        daily_total_good += p["good"]
        daily_total_rejected += p["rejected"]
        daily_total_downtime += p["downtime"]

    conn.close()

    return jsonify({
        "date": comp_date,
        "shifts": results,
        "daily_totals": {
            "target": daily_total_target,
            "actual": daily_total_actual,
            "good": daily_total_good,
            "rejected": daily_total_rejected,
            "downtime_minutes": daily_total_downtime,
            "achievement_pct": round((daily_total_actual / daily_total_target * 100), 1) if daily_total_target > 0 else 0,
            "rejection_pct": round((daily_total_rejected / daily_total_actual * 100), 1) if daily_total_actual > 0 else 0
        }
    })

# -------------------------------------------------------------
# SHIFT HANDOVERS
# -------------------------------------------------------------
@app.route("/api/handovers", methods=["GET", "POST"])
def handovers_api():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        h_date = data.get("date", date.today().isoformat())
        out_shift = data.get("outgoing_shift", "Shift A")
        in_shift = data.get("incoming_shift", "Shift B")
        dept_m = data.get("department_or_machine", "General Plant")
        notes = data.get("handover_notes", "").strip()
        resp_person = data.get("responsible_person", "Supervisor").strip()

        if not notes:
            conn.close()
            return jsonify({"error": "Handover notes are required"}), 400

        cursor.execute("""
        INSERT INTO shift_handovers 
        (date, outgoing_shift, incoming_shift, department_or_machine, handover_notes, production_status, pending_work, machine_problems, downtime_info, quality_issues, follow_up_actions, responsible_person, completion_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            h_date, out_shift, in_shift, dept_m, notes,
            data.get("production_status", ""),
            data.get("pending_work", ""),
            data.get("machine_problems", ""),
            data.get("downtime_info", ""),
            data.get("quality_issues", ""),
            data.get("follow_up_actions", ""),
            resp_person,
            data.get("completion_status", "Open")
        ))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Shift handover logged successfully"}), 201

    # GET
    filter_date = request.args.get("date", "")
    status = request.args.get("status", "")
    query = "SELECT * FROM shift_handovers WHERE 1=1"
    params = []
    if filter_date:
        query += " AND date = ?"
        params.append(filter_date)
    if status:
        query += " AND completion_status = ?"
        params.append(status)

    query += " ORDER BY date DESC, id DESC"
    cursor.execute(query, params)
    handovers = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({"handovers": handovers, "count": len(handovers)})

@app.route("/api/handovers/<int:id>", methods=["PUT"])
def update_handover(id):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
    UPDATE shift_handovers SET
        completion_status = COALESCE(?, completion_status),
        follow_up_actions = COALESCE(?, follow_up_actions),
        responsible_person = COALESCE(?, responsible_person)
    WHERE id = ?
    """, (
        data.get("completion_status"),
        data.get("follow_up_actions"),
        data.get("responsible_person"),
        id
    ))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Handover #{id} updated"})

# -------------------------------------------------------------
# SETTINGS
# -------------------------------------------------------------
@app.route("/api/settings", methods=["GET", "POST"])
def settings_api():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        auth_user = get_user_from_header()
        if auth_user["role"] != "Admin":
            conn.close()
            return jsonify({"error": "Only Administrators can modify settings"}), 403

        data = request.get_json(silent=True) or {}
        for k, v in data.items():
            cursor.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", (str(k), str(v)))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Settings updated"})

    cursor.execute("SELECT key, value FROM app_settings")
    settings = {row["key"]: row["value"] for row in cursor.fetchall()}
    conn.close()
    return jsonify({"settings": settings})

# -------------------------------------------------------------
# REPORTS & EXPORTS
# -------------------------------------------------------------
@app.route("/api/reports/export", methods=["GET"])
def export_report():
    report_type = request.args.get("type", "attendance")
    export_format = request.args.get("format", "csv")
    filter_date = request.args.get("date", "")
    filter_shift = request.args.get("shift", "")

    conn = get_db()
    cursor = conn.cursor()

    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "attendance":
        writer.writerow(["Employee ID", "Employee Name", "Department", "Date", "Shift", "Status", "Check In", "Check Out", "Notes"])
        query = """
        SELECT a.emp_id, e.name, e.department, a.date, a.shift, a.status, a.check_in_time, a.check_out_time, a.notes
        FROM attendance a
        JOIN employees e ON a.emp_id = e.emp_id
        WHERE 1=1
        """
        params = []
        if filter_date:
            query += " AND a.date = ?"
            params.append(filter_date)
        if filter_shift:
            query += " AND a.shift = ?"
            params.append(filter_shift)
        query += " ORDER BY a.date DESC, e.emp_id ASC"
        cursor.execute(query, params)
        for r in cursor.fetchall():
            writer.writerow(list(r))

    elif report_type == "overtime":
        writer.writerow(["Employee ID", "Employee Name", "Department", "Date", "Shift", "Regular Hours", "OT Hours", "Reason", "Status", "Approved By"])
        query = """
        SELECT o.emp_id, e.name, e.department, o.date, o.shift, o.regular_hours, o.ot_hours, o.reason, o.approval_status, o.approved_by
        FROM overtime o
        JOIN employees e ON o.emp_id = e.emp_id
        WHERE 1=1
        """
        params = []
        if filter_date:
            query += " AND o.date = ?"
            params.append(filter_date)
        query += " ORDER BY o.date DESC"
        cursor.execute(query, params)
        for r in cursor.fetchall():
            writer.writerow(list(r))

    elif report_type in ["nc_production", "tandem_production", "production"]:
        writer.writerow(["Type", "Machine / Line", "Date", "Shift", "Hour Interval", "Operator", "Tonnage", "Target Qty", "Actual Qty", "Good Qty", "Rejected Qty", "Downtime (Min)", "Downtime Reason", "Remarks"])
        query = "SELECT production_type, machine_or_line, date, shift, hour_interval, operator_name, tonnage, target_qty, actual_qty, good_qty, rejected_qty, downtime_minutes, downtime_reason, remarks FROM production_records WHERE 1=1"
        params = []
        if report_type == "nc_production":
            query += " AND production_type = 'NC'"
        elif report_type == "tandem_production":
            query += " AND production_type = 'Tandem'"
        if filter_date:
            query += " AND date = ?"
            params.append(filter_date)
        if filter_shift:
            query += " AND shift = ?"
            params.append(filter_shift)
        query += " ORDER BY date DESC, machine_or_line ASC, hour_interval ASC"
        cursor.execute(query, params)
        for r in cursor.fetchall():
            writer.writerow(list(r))

    elif report_type == "employees":
        writer.writerow(["Employee ID", "Name", "Department", "Designation", "Shift", "Assigned Machine", "Phone", "Email", "Joining Date", "Status"])
        cursor.execute("SELECT emp_id, name, department, designation, shift, assigned_machine, phone, email, joining_date, status FROM employees ORDER BY emp_id ASC")
        for r in cursor.fetchall():
            writer.writerow(list(r))

    conn.close()

    filename = f"PHA_{report_type}_{filter_date or date.today().isoformat()}.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename={filename}"}
    )

# -------------------------------------------------------------
# ADMIN: CLEAR SAMPLE / TEST DATA
# -------------------------------------------------------------
@app.route("/api/admin/clear-sample-data", methods=["POST", "DELETE"])
def clear_sample_data():
    """
    Clears sample/dummy/test records:
    - Clears production_records (hourly test entries)
    - Clears shift_handovers (test handover notes)
    - Deletes dummy employee records (like EMP-001) and associated test attendance
    Preserves real plant employees (A20755, A20556, etc.) and all machines.
    """
    conn = get_db()
    cursor = conn.cursor()

    data = request.get_json(silent=True) or {}
    clear_production = data.get("clear_production", True)
    clear_handovers = data.get("clear_handovers", True)
    clear_dummy_employees = data.get("clear_dummy_employees", True)

    cleared_counts = {}

    if clear_production:
        cursor.execute("SELECT COUNT(*) FROM production_records")
        cleared_counts["production_records"] = cursor.fetchone()[0]
        cursor.execute("DELETE FROM production_records")

    if clear_handovers:
        cursor.execute("SELECT COUNT(*) FROM shift_handovers")
        cleared_counts["shift_handovers"] = cursor.fetchone()[0]
        cursor.execute("DELETE FROM shift_handovers")

    if clear_dummy_employees:
        # Delete EMP-001 or any dummy/sample employee
        cursor.execute("DELETE FROM attendance WHERE emp_id LIKE 'EMP-%'")
        cursor.execute("DELETE FROM overtime WHERE emp_id LIKE 'EMP-%'")
        cursor.execute("DELETE FROM employees WHERE emp_id LIKE 'EMP-%'")
        cleared_counts["dummy_employees"] = cursor.rowcount

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Sample and test data cleared successfully! System is clean for production entries.",
        "cleared": cleared_counts
    })

@app.route("/api/production/records/<int:record_id>", methods=["DELETE"])
def delete_single_production_record(record_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM production_records WHERE id = ?", (record_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Production record #{record_id} deleted."})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
