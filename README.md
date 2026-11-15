# PHA INDIA PRIVATE LIMITED
## Complete Employee Management & Industrial Production Management System

A professional, enterprise-grade Manufacturing Execution System (MES) and Human Resource Management System (HRMS) custom-built for **PHA INDIA PRIVATE LIMITED** (Sriperumbudur Plant, Tamil Nadu).

---

### System Capabilities & Architecture

- **Workforce Scale**: Engineered for initial ~500 employees, architected to scale seamlessly to 1,000+ personnel.
- **Frontend**: React 19, Vite, Lucide Icons, Modern Enterprise Industrial Theme.
- **Backend**: Python Flask with robust SQLite database (`pha_india.db`).
- **Data Persistence**: Normalized SQLite database with Write-Ahead Logging (`WAL`), strict foreign keys, atomic transactions, and zero dummy/fake data.
- **Compatibility**: Direct integration with `/api/state` and fine-grained REST endpoints.

---

### Core Modules

1. **Enterprise Dashboard**:
   - Live KPI cards: Total active workforce, Shift attendance, Absent/Leave counts.
   - Machine statuses: 16 NC press units and 6 Tandem lines live status.
   - Shift & daily production target vs actual achievement %.
   - Real-time hour-by-hour output timeline, pending handovers, and downtime alerts.
   - Displays real database figures only (0 / empty states when unrecorded).

2. **Employee Management**:
   - Register workforce with unique alphanumeric Employee IDs (e.g. `PHA-001`).
   - Store name, department, designation, contact info, shift, assigned machine, and joining date.
   - View complete individual profile with historical attendance and overtime records.
   - Search & filter by department, shift, and status.
   - Deactivate records safely while preserving all historical attendance and production records.

3. **Daily Attendance Management**:
   - Shift-based roster marking (`Shift A`, `Shift B`, `Shift C`).
   - One-click status selection: `Present`, `Absent`, `Leave`, `On-Duty`.
   - "Mark All Present" batch operation.
   - Persistent database storage preventing duplicate records.
   - Check-in timestamps, remarks, and documentation references.

4. **Overtime & Salary Management**:
   - **Overtime Module**: Employee ID, Date, Shift, Regular Hours, Overtime Hours, Reasons, and Supervisor Approvals (`Pending`, `Approved`, `Rejected`).
   - **Salary Module (Role-Restricted)**: Automatically computes monthly payroll based on basic salary, HRA, DA, conveyance, special allowances, approved overtime pay (`OT Hours × Configured Rate`), and statutory deductions (`PF`, `ESI`, `TDS`).
   - Includes printable pay slip generator with company branding.

5. **Machine Management**:
   - Machine directory supporting NC Presses and Tandem Lines.
   - Supports machine number, tonnage (e.g. 1000T, 800T, 500T, 300T), production targets, status (`Running`, `Idle`, `Maintenance`, `Breakdown`), operator assignment, and maintenance logs.

6. **NC Production Management (16 Dedicated Positions)**:
   - Dedicated management view for all 16 NC machine positions individually (`NC-01` to `NC-16`).
   - Machine-specific targets, actual outputs, good parts, rejections, downtime minutes, and achievement %.
   - Hourly production log and machine performance matrix.

7. **Tandem Production Management (6 Dedicated Lines)**:
   - Dedicated management view for all 6 Tandem production lines:
     1. `LP-1` (Low Press 1)
     2. `LP-2` (Low Press 2)
     3. `HP-1` (Heavy Press 1)
     4. `HP-2` (Heavy Press 2)
     5. `HP-3` (Heavy Press 3)
     6. `HP-4` (Heavy Press 4)
   - Individual line performance cards, targets, outputs, and crew assignments.

8. **Hourly Production Tracking (High Priority)**:
   - Dedicated hour-by-hour operational output control across all 8 shift intervals.
   - Interactive entry matrix for both NC Machines and Tandem Lines.
   - Calculations: Hourly target, actual output, achievement %, remaining deficit, good/reject count, shift total, day total.
   - Auto-advances to the next hour on submission to maximize shopfloor speed.

9. **Three-Shift Management**:
   - Full 3-shift operational architecture: `Shift A`, `Shift B`, `Shift C`.
   - Side-by-side shift cards, manpower present, shift-to-shift variance, and combined 24-hour day totals.
   - Configurable shift start and end timings.

10. **Management Production Analytics**:
    - Visually distinct NC Press and Tandem Line analytics.
    - 16 NC machine comparison chart and 6 Tandem lines comparison cards.
    - Scrap rate analysis and downtime tracking.

11. **Shift Handover Log**:
    - Shift-to-shift transition notes, pending work orders, machine problems, downtime, and quality issues.
    - Follow-up action item tracking with responsible sign-offs (`Open`, `In-Progress`, `Resolved`).

12. **Reports & Exports**:
    - Comprehensive CSV export generator for Attendance, Overtime, NC Production, Tandem Production, Hourly Production, and Employee directories.
    - Printable layout with official PHA India company headers.

---

### Installation & Quick Start

#### Option 1: Standalone Launch (Single Click)
Double-click `run.bat` in the project root:
```cmd
run.bat
```
This automatically starts the backend server and opens `http://127.0.0.1:5000` in your web browser.

#### Option 2: Live Development Mode
Double-click `run_dev.bat` or run:
```cmd
# Terminal 1: Backend
venv\Scripts\python.exe web_app\backend\app.py

# Terminal 2: Frontend
npm run dev
```
Access the development server at `http://localhost:5173`.

---

### Project Structure

```text
D:\project web
├── apk/                  # Android APK binaries & installation documentation
│   ├── PRESS_SHOP_MFG-2.apk
│   └── README.md
├── web_app/              # Complete Web Application source code
│   ├── src/              # React frontend components and pages
│   ├── public/           # Static web assets
│   ├── backend/          # Python Flask REST API server and SQLite database
│   ├── check_data.py     # Database verification tool
│   ├── seed_attendance.py
│   ├── seed_employees.py
│   └── README.md
├── android/              # Capacitor Android wrapper project
├── dist/                 # Production web build bundle
├── venv/                 # Python virtual environment
├── index.html            # Web entry point
├── package.json          # Node dependencies and build scripts
├── vite.config.js        # Vite bundler configuration
├── capacitor.config.json # Capacitor mobile configuration
├── run.bat               # Single-click launcher for production server
└── run_dev.bat           # Single-click launcher for development mode
```

---

### Default Credentials

| Role | Username | Password | Access Level |
|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Full Access (All modules, settings, salary, configuration) |
| **Plant Management** | `management` | `mgmt123` | Management Access (Analytics, production, payroll reports) |
| **Shift Supervisor** | `supervisor` | `super123` | Shopfloor Access (Attendance, production, hourly, handovers) |
| **Line Operator** | `guest` | (Open) | Operator Access (View and entry) |

---

### Testing & Verification

Run the automated backend test suite:
```cmd
venv\Scripts\python.exe web_app\backend\test_backend.py
```
Test results verify health check, `/api/state` synchronization, 16 NC machines, 6 Tandem lines, attendance persistence, overtime, salary calculations, and shift handovers.
