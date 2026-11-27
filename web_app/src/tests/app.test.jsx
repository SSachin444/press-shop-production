import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import {
  ROLES,
  getAllowedRoutes,
  getCapabilities,
  canAccessTab,
  getDefaultTabForRole,
} from '../config/roles';
import {
  computeProductionMetrics,
  buildCsvDocument,
  calculateFullHourTargetFromUph,
  calculateTargetFromUph,
  computeTimeAllocationSummary,
  validateTimeAllocation,
  normalizeWhatsAppPhone,
  WHATSAPP_REPORT_TYPES,
  generateWhatsAppReportText,
  validatePhoneNumber,
  validateEmailAddress,
  validateScrapReasons,
  validateDowntimeProblems,
  groupHourlyMachineEntries,
} from '../services/metrics';
import {
  purgeLegacyLocalStorage,
  saveActiveSession,
  getActiveSession,
  clearActiveSession,
} from '../services/authSession';
import { cloudApi } from '../services/cloudClient';
import RoleGateway from '../components/RoleGateway';
import DashboardView from '../components/DashboardView';
import ReportsView from '../components/ReportsView';
import HourlyEntryView from '../components/HourlyEntryView';
import TandemProductionView from '../components/TandemProductionView';
import MachinesView from '../components/MachinesView';
import EmployeesView from '../components/EmployeesView';
import ToolsView from '../components/ToolsView';
import ProductionSummaryView from '../components/ProductionSummaryView';
import LiveCellStatusView from '../components/LiveCellStatusView';
import MechanicalPressBackground from '../components/MechanicalPressBackground';
import WhatsAppReportsView from '../components/WhatsAppReportsView';
import PasswordModal from '../components/PasswordModal';

describe('Metrics Calculation Engine & Validations', () => {
  const machines = [
    { machine_number: 'P01075', machine_type: 'NC', plant_id: 'Plant 1', tonnage: 1000, production_target: 600, status: 'Running' },
    { machine_number: 'LP-1', machine_type: 'Tandem', plant_id: 'Plant 1', tonnage: 1200, production_target: 700, status: 'Running' },
  ];

  const records = [
    // Multi-part NC Hour 3 (3 parts in same hour; downtime only on part 1, legacy duplicate test on part 2)
    {
      id: 1,
      plant_id: 'Plant 1',
      date: '2026-11-26',
      shift: 'Shift A',
      machine_or_line: 'P01075',
      production_type: 'NC',
      hour_interval: 'Hour 3 (10:00 - 11:00)',
      part_index: 1,
      tool_number: 'T001',
      uph: 1200,
      running_minutes: 60,
      actual_qty: 1000,
      target_qty: 1200,
      good_qty: 990,
      rejected_qty: 10,
      scrap_breakdown: [{ reason_name: 'Burr / Sharp Edge', qty: 6 }, { reason_name: 'Crack / Tear', qty: 4 }],
      downtime_minutes: 15,
      downtime_problems: [{ start_time: '10:15', end_time: '10:30', duration_minutes: 15, downtime_code: 'D02', downtime_reason: 'Tool Problem' }],
    },
    {
      id: 2,
      plant_id: 'Plant 1',
      date: '2026-11-26',
      shift: 'Shift A',
      machine_or_line: 'P01075',
      production_type: 'NC',
      hour_interval: 'Hour 3 (10:00 - 11:00)',
      part_index: 2,
      tool_number: 'T002',
      uph: 800,
      running_minutes: 60,
      actual_qty: 650,
      target_qty: 800,
      good_qty: 645,
      rejected_qty: 5,
      downtime_minutes: 15, // Should NOT double-count against part 1 in the same hour!
    },
    {
      id: 3,
      plant_id: 'Plant 1',
      date: '2026-11-26',
      shift: 'Shift A',
      machine_or_line: 'P01075',
      production_type: 'NC',
      hour_interval: 'Hour 3 (10:00 - 11:00)',
      part_index: 3,
      tool_number: 'T003',
      uph: 600,
      running_minutes: 60,
      actual_qty: 450,
      target_qty: 600,
      good_qty: 442,
      rejected_qty: 8,
      downtime_minutes: 0,
    },
    // Tandem simultaneous run on LP-1
    {
      id: 4,
      plant_id: 'Plant 1',
      date: '2026-11-26',
      shift: 'Shift A',
      machine_or_line: 'LP-1',
      production_type: 'Tandem',
      hour_interval: 'Hour 3 (10:00 - 11:00)',
      part_index: 1,
      tool_number: 'T001',
      uph: 600,
      running_minutes: 60,
      actual_qty: 500,
      target_qty: 600,
      good_qty: 495,
      rejected_qty: 5,
      downtime_minutes: 0,
    },
  ];

  it('calculates UPH × 60 full-hour target, Applicable Target (UPH × min), 60-min time pool, and prevents downtime double-counting', () => {
    expect(calculateFullHourTargetFromUph(120)).toBe(7200);
    expect(calculateTargetFromUph(120, 60)).toBe(7200);
    expect(calculateTargetFromUph(120, 30)).toBe(3600);
    expect(calculateTargetFromUph(120, 20)).toBe(2400);

    const poolAfterFirst = computeTimeAllocationSummary([{ running_minutes: 30 }]);
    expect(poolAfterFirst.remainingMinutes).toBe(30);
    const poolAfterSecond = computeTimeAllocationSummary([{ running_minutes: 30 }, { running_minutes: 20 }]);
    expect(poolAfterSecond.remainingMinutes).toBe(10);
    const overPool = validateTimeAllocation([{ running_minutes: 40 }, { running_minutes: 30 }], 60, true);
    expect(overPool.valid).toBe(false);

    const metrics = computeProductionMetrics(records, machines, [], {
      plant: 'Plant 1',
      date: '2026-11-26',
      shift: 'Shift A',
      machineGroup: 'ALL',
    });

    expect(metrics.ncTotals.actual).toBe(2100);
    expect(metrics.ncTotals.target).toBe(2600);
    expect(metrics.ncTotals.rejected).toBe(23);
    expect(metrics.ncTotals.downtimeMinutes).toBe(15); // NOT 30!

    expect(metrics.tandemTotals.actual).toBe(500);
    expect(metrics.totals.actual).toBe(2600);
    expect(metrics.totals.target).toBe(3200);
    expect(metrics.totals.downtimeMinutes).toBe(15);

    const grouped = groupHourlyMachineEntries(records.filter((r) => r.machine_or_line === 'P01075'));
    expect(grouped).toHaveLength(1);
    expect(grouped[0].parts).toHaveLength(3);
    expect(grouped[0].totalActual).toBe(2100);
  });

  it('validates phone numbers, email addresses, scrap reason limits, and overlapping downtime prevention', () => {
    expect(validatePhoneNumber('+91 9876543210').valid).toBe(true);
    expect(validatePhoneNumber('123').valid).toBe(false);
    expect(validateEmailAddress('sachin@phaindia.com').valid).toBe(true);
    expect(validateEmailAddress('bad-email').valid).toBe(false);

    // Scrap reasons max 5 and total <= scrapQty
    const scrapOk = validateScrapReasons(10, [
      { reason_name: 'Burr / Sharp Edge', qty: 6 },
      { reason_name: 'Custom Tear', is_custom: true, qty: 4 },
    ]);
    expect(scrapOk.valid).toBe(true);
    expect(scrapOk.totalReasonQty).toBe(10);

    const scrapOverflow = validateScrapReasons(10, [
      { reason_name: 'Burr / Sharp Edge', qty: 7 },
      { reason_name: 'Crack / Tear', qty: 5 },
    ]);
    expect(scrapOverflow.valid).toBe(false);

    // Downtime problems overlap & duplicate prevention
    const dtOk = validateDowntimeProblems([
      { start_time: '10:00', end_time: '10:15', downtime_code: 'D01', downtime_reason: 'Machine Breakdown' },
      { start_time: '10:20', end_time: '10:35', downtime_code: 'D02', downtime_reason: 'Tool Problem' },
    ]);
    expect(dtOk.valid).toBe(true);
    expect(dtOk.totalMinutes).toBe(30);

    const dtOverlap = validateDowntimeProblems([
      { start_time: '10:00', end_time: '10:20', downtime_code: 'D01', downtime_reason: 'Machine Breakdown' },
      { start_time: '10:15', end_time: '10:30', downtime_code: 'D02', downtime_reason: 'Tool Problem' },
    ]);
    expect(dtOverlap.valid).toBe(false);
  });

  it('exports CSV with UTF-8 BOM, escaped cells, and matching summary row', () => {
    const csv = buildCsvDocument(
      [
        { header: 'Machine', key: 'machine_or_line' },
        { header: 'Actual', key: 'actual_qty' },
        { header: 'Operator', key: 'operator_name' },
      ],
      [{ machine_or_line: 'NC-01', actual_qty: 550, operator_name: 'Ramesh "R"' }],
      { machine_or_line: 'TOTAL', actual_qty: 550, operator_name: '1 row' }
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Ramesh ""R"""');
    expect(csv).toContain('"TOTAL","550","1 row"');
  });
});

describe('Role Access Control & Session Storage Hygiene', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('enforces exact route & capability boundaries for all 4 roles including new pages', () => {
    expect(getAllowedRoutes(ROLES.OPERATOR).map((r) => r.id)).toEqual([
      'hourly-production',
      'tandem-production',
      'cell-status',
    ]);
    expect(getAllowedRoutes(ROLES.DASHBOARD).map((r) => r.id)).toEqual(['cell-status']);
    expect(getDefaultTabForRole(ROLES.DASHBOARD)).toBe('cell-status');

    expect(canAccessTab(ROLES.SUPERVISOR, 'dashboard')).toBe(true);
    expect(canAccessTab(ROLES.SUPERVISOR, 'tools')).toBe(true);
    expect(canAccessTab(ROLES.SUPERVISOR, 'production-summary')).toBe(true);
    expect(canAccessTab(ROLES.SUPERVISOR, 'tandem-production')).toBe(true);
    expect(canAccessTab(ROLES.SUPERVISOR, 'settings')).toBe(false);
    expect(canAccessTab(ROLES.SUPERVISOR, 'users')).toBe(false);
    expect(canAccessTab(ROLES.SUPERVISOR, 'activity-logs')).toBe(false);

    const supCaps = getCapabilities(ROLES.SUPERVISOR);
    expect(supCaps.canEditMachines).toBe(false);
    expect(supCaps.canDeleteMachines).toBe(false);
    expect(supCaps.canManageManpowerContacts).toBe(true);
    expect(supCaps.canManageTools).toBe(true);

    const admCaps = getCapabilities(ROLES.ADMIN);
    expect(admCaps.canEditMachines).toBe(true);
    expect(admCaps.canDeleteMachines).toBe(true);
    expect(admCaps.canManageUsers).toBe(true);
    expect(admCaps.canViewAuditLog).toBe(true);
    expect(admCaps.canViewSettings).toBe(true);
  });

  it('purges legacy localStorage auth keys and stores sessions exclusively in sessionStorage', () => {
    localStorage.setItem('pha_auth', 'legacy-secret');
    localStorage.setItem('pha_user', 'legacy-admin');
    purgeLegacyLocalStorage();
    expect(localStorage.getItem('pha_auth')).toBeNull();
    expect(localStorage.getItem('pha_user')).toBeNull();

    saveActiveSession({
      user: { username: 'admin', role: ROLES.ADMIN },
      token: 'ephemeral-session-token',
      mode: 'rest-api',
      expiresInSeconds: 3600,
    });
    expect(localStorage.getItem('pha_verified_session_v2')).toBeNull();
    expect(getActiveSession()?.user?.role).toBe(ROLES.ADMIN);
    clearActiveSession();
    expect(getActiveSession()).toBeNull();
  });
});

describe('UI Components & Multi-Part Workflows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('renders PHA Role Gateway with all 4 roles and 3D background fallback cleanly', () => {
    render(<MechanicalPressBackground />);
    render(<RoleGateway onAuthenticated={() => {}} />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Supervisor')).toBeInTheDocument();
    expect(screen.getByText('Operator')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Admin'));
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Operator'));
    expect(screen.queryByLabelText(/^password/i)).not.toBeInTheDocument();
  });

  it('renders Dashboard with 10 KPIs, charts, loading skeleton, and matches Reports totals', () => {
    const machines = [{ machine_number: 'P01075', machine_type: 'NC', plant_id: 'Plant 1', tonnage: 1000, production_target: 600, status: 'Running' }];
    const records = [
      {
        id: 10,
        plant_id: 'Plant 1',
        date: '2026-11-26',
        shift: 'Shift A',
        machine_or_line: 'P01075',
        production_type: 'NC',
        hour_interval: 'Hour 1 (08:00 - 09:00)',
        part_index: 1,
        tool_number: 'T001',
        uph: 600,
        running_minutes: 60,
        actual_qty: 520,
        target_qty: 600,
        good_qty: 500,
        rejected_qty: 20,
        downtime_minutes: 10,
      },
    ];

    const { rerender } = render(
      <DashboardView
        selectedPlant="Plant 1"
        setSelectedPlant={() => {}}
        selectedDate="2026-11-26"
        setSelectedDate={() => {}}
        selectedShift="Shift A"
        setSelectedShift={() => {}}
        machineGroup="ALL"
        setMachineGroup={() => {}}
        machines={[]}
        records={[]}
        downtimes={[]}
        employeesCount={3}
        dataState="loading"
        onRetry={() => {}}
        onNavigate={() => {}}
      />
    );
    expect(screen.getByLabelText(/loading dashboard/i)).toBeInTheDocument();

    rerender(
      <DashboardView
        selectedPlant="Plant 1"
        setSelectedPlant={() => {}}
        selectedDate="2026-11-26"
        setSelectedDate={() => {}}
        selectedShift="Shift A"
        setSelectedShift={() => {}}
        machineGroup="ALL"
        setMachineGroup={() => {}}
        machines={machines}
        records={records}
        downtimes={[]}
        employeesCount={3}
        dataState="ready"
        lastSyncedAt="2026-11-26T06:00:00Z"
        onRetry={() => {}}
        onNavigate={() => {}}
      />
    );
    expect(screen.getAllByText('520').length).toBeGreaterThan(0);
    expect(screen.getByText(/1\. Hourly Production/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. NC vs Tandem Comparison/i)).toBeInTheDocument();

    render(<ReportsView selectedPlant="Plant 1" selectedDate="2026-11-26" machines={machines} records={records} onRefresh={() => {}} />);
    expect(screen.getAllByText('520').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/86\.7%/).length).toBeGreaterThan(0);
  });

  it('supports up to 3 NC parts per hour in HourlyEntryView and submits batch cleanly', async () => {
    vi.spyOn(cloudApi, 'getOperationalRoster').mockResolvedValue([{ emp_id: 'A20755', name: 'SACHIN S' }]);
    const submitSpy = vi.spyOn(cloudApi, 'submitProductionBatch').mockResolvedValue({ success: true, records: [{ id: 99 }] });

    render(
      <HourlyEntryView
        selectedPlant="Plant 1"
        selectedDate="2026-11-26"
        setSelectedDate={() => {}}
        selectedShift="Shift A"
        setSelectedShift={() => {}}
        machines={[{ machine_number: 'P01075', machine_type: 'NC', tonnage: 1000, status: 'Running' }]}
        tools={[{ tool_number: 'T001', part_name: 'Bracket', compatible_type: 'Both', standard_uph: 1200, status: 'Active' }]}
        records={[]}
        downtimeCodes={[]}
        currentUser={{ role: ROLES.OPERATOR, full_name: 'SACHIN S' }}
        onEntrySaved={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText(/5\. Machine Speed \(UPH\)/i), { target: { value: '120' } });
    fireEvent.change(document.getElementById('nc-p1-tool'), { target: { value: 'T001' } });
    fireEvent.change(document.getElementById('nc-p1-run'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/8\. Actual Production/i), { target: { value: '3500' } });

    // Read-only Full-Hour Target = UPH x 60 (120 x 60 = 7,200) and Applicable Target = 120 x 30 = 3,600
    expect(screen.getAllByText(/7,200 pcs\/hr/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3,600 pcs/i).length).toBeGreaterThan(0);

    // Add Part 2: auto-populates with Remaining Time = 30 min (never resets to 60!)
    fireEvent.click(screen.getByRole('button', { name: /add tool \/ part/i }));
    const p2RunInput = document.getElementById('nc-p2-run');
    expect(p2RunInput.value).toBe('30');
    fireEvent.change(p2RunInput, { target: { value: '20' } });

    // Add Part 3: Remaining Time = 60 - (30 + 20) = 10 min!
    fireEvent.click(screen.getByRole('button', { name: /add tool \/ part/i }));
    const p3RunInput = document.getElementById('nc-p3-run');
    expect(p3RunInput.value).toBe('10');
    expect(screen.getByRole('button', { name: /add tool \/ part/i })).toBeDisabled();

    // Remove Part 3 cleanly to submit 2-part batch (30m + 20m)
    fireEvent.click(screen.getByRole('button', { name: /remove part 3/i }));
    fireEvent.change(document.getElementById('nc-p2-tool'), { target: { value: '__OTHER__' } });
    fireEvent.change(screen.getByLabelText(/Tool #2 \* manual entry/i), { target: { value: 'T002' } });
    fireEvent.change(document.getElementById('nc-p2-uph'), { target: { value: '120' } });
    fireEvent.change(document.getElementById('nc-p2-actual'), { target: { value: '2300' } });

    fireEvent.click(screen.getByRole('button', { name: /save hourly production/i }));

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));
    expect(submitSpy.mock.calls[0][0].parts).toHaveLength(2);
    expect(submitSpy.mock.calls[0][0].parts[0].running_minutes).toBe(30);
    expect(submitSpy.mock.calls[0][0].parts[0].actual_qty).toBe(3500);
    expect(submitSpy.mock.calls[0][0].parts[1].running_minutes).toBe(20);
    expect(submitSpy.mock.calls[0][0].parts[1].actual_qty).toBe(2300);
  });

  it('supports up to 4 simultaneous parts in TandemProductionView across all 6 lines', () => {
    render(
      <TandemProductionView
        selectedPlant="Plant 1"
        selectedDate="2026-11-26"
        setSelectedDate={() => {}}
        selectedShift="Shift A"
        setSelectedShift={() => {}}
        machines={[]}
        tools={[]}
        records={[]}
        downtimes={[]}
        downtimeCodes={[]}
        currentUser={{ role: ROLES.SUPERVISOR, full_name: 'Sup' }}
        onEntrySaved={() => {}}
      />
    );

    expect(screen.getAllByText('LP-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('HP-4').length).toBeGreaterThan(0);

    const addBtn = screen.getByRole('button', { name: /add simultaneous part/i });
    fireEvent.click(addBtn);
    fireEvent.click(addBtn);
    fireEvent.click(addBtn);
    expect(addBtn).toBeDisabled();
    expect(screen.getAllByText(/Part 4/i).length).toBeGreaterThan(0);
  });

  it('renders Machine Directory delete confirmation with machine number and Supervisor read-only protection', () => {
    const machines = [{ machine_number: 'P01075', machine_type: 'NC', tonnage: 1000, production_target: 8000, status: 'Running', version: 1 }];

    const { rerender } = render(
      <MachinesView
        machines={machines}
        downtimes={[]}
        downtimeCodes={[]}
        currentUser={{ role: ROLES.SUPERVISOR, username: 'sup' }}
        onReload={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: /add machine/i })).not.toBeInTheDocument();

    rerender(
      <MachinesView
        machines={machines}
        downtimes={[]}
        downtimeCodes={[]}
        currentUser={{ role: ROLES.ADMIN, username: 'admin' }}
        onReload={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /delete machine p01075/i }));
    expect(screen.getByText(/Confirm Machine Deletion/i)).toBeInTheDocument();
    expect(screen.getAllByText('P01075').length).toBeGreaterThan(0);
  });

  it('allows entering and validating phone & email in Manpower Directory, and renders Tools & Production Summary', async () => {
    vi.spyOn(cloudApi, 'getEmployees').mockResolvedValue([
      { emp_id: 'A20755', name: 'SACHIN S', department: 'NC Production', designation: 'Line Lead', phone: '', email: '', shift: 'Shift A', status: 'Active' },
    ]);
    vi.spyOn(cloudApi, 'getProductionRecords').mockResolvedValue([]);

    render(<EmployeesView machines={[]} currentUser={{ role: ROLES.SUPERVISOR }} />);
    await waitFor(() => expect(screen.getAllByText('SACHIN S').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();

    render(<ToolsView tools={[{ tool_number: 'HDB16', part_name: 'Bracket', compatible_type: 'NC', status: 'Active' }]} machines={[]} records={[]} currentUser={{ role: ROLES.ADMIN }} />);
    expect(screen.getByText(/Tool & Die Management/i)).toBeInTheDocument();

    render(<ProductionSummaryView selectedDate="2026-11-26" selectedShift="Shift A" machines={[]} tools={[]} records={[]} downtimes={[]} />);
    expect(screen.getByText(/Production Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Machine Achievement %/i)).toBeInTheDocument();

    render(
      <LiveCellStatusView
        kioskMode={true}
        selectedPlant="Plant 1"
        selectedDate="2026-11-26"
        selectedShift="Shift A"
        machines={[]}
        records={[]}
        downtimes={[]}
        dataState="ready"
        isOnline={true}
        onRefresh={() => {}}
        onExitKiosk={() => {}}
      />
    );
    expect(screen.getByText(/Live Cell Status Display/i)).toBeInTheDocument();
  });

  it('supports Account & Password management (User ID + Password tabs) via cloudApi', async () => {
    const chgUserSpy = vi.spyOn(cloudApi, 'changeUsername').mockResolvedValue({ success: true, username: 'shift_lead_1' });
    const completedSpy = vi.fn();

    render(
      <PasswordModal
        isOpen={true}
        forced={false}
        currentUser={{ role: ROLES.SUPERVISOR, username: 'supervisor', full_name: 'Shift Sup' }}
        onClose={() => {}}
        onCompleted={completedSpy}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /change user id/i }));
    fireEvent.change(screen.getByLabelText(/new user id/i), { target: { value: 'shift_lead_1' } });
    fireEvent.change(screen.getByLabelText(/confirm current password/i), { target: { value: 'StrongSuper#2026' } });
    fireEvent.click(screen.getByRole('button', { name: /update user id/i }));

    await waitFor(() => expect(chgUserSpy).toHaveBeenCalledWith({
      newUsername: 'shift_lead_1',
      currentPassword: 'StrongSuper#2026',
    }));
    await waitFor(() => expect(completedSpy).toHaveBeenCalled());
  });

  it('enforces WhatsApp Reports RBAC, recipient validation, 6 report types (no payroll), and API dispatch', async () => {
    // Operator role blocked from WhatsApp Reports
    const { unmount } = render(
      <WhatsAppReportsView
        selectedDate="2026-11-27"
        selectedShift="Shift A"
        machines={[]}
        tools={[]}
        records={[]}
        downtimes={[]}
        currentUser={{ role: ROLES.OPERATOR, username: 'operator' }}
      />
    );
    expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
    unmount();

    expect(WHATSAPP_REPORT_TYPES).toHaveLength(6);
    expect(normalizeWhatsAppPhone('+91 9876543210').valid).toBe(true);
    expect(normalizeWhatsAppPhone('98765').valid).toBe(false);

    const preview = generateWhatsAppReportText({
      reportType: 'hourly',
      date: '2026-11-27',
      shift: 'Shift A',
      machine: 'ALL',
      tool: 'ALL',
      records: [
        { machine_or_line: 'P01075', date: '2026-11-27', shift: 'Shift A', hour_interval: 'Hour 1', tool_number: 'T001', uph: 120, running_minutes: 60, target_qty: 7200, actual_qty: 6900, rejected_qty: 20, downtime_minutes: 5 },
      ],
      machines: [],
      downtimes: [],
    });
    expect(preview).toContain('P01075');
    expect(preview).not.toMatch(/salary|wage|payroll/i);

    vi.spyOn(cloudApi, 'getWhatsAppRecipients').mockResolvedValue([
      { id: 1, name: 'Plant Head', phone_number: '+919876543210' },
    ]);
    vi.spyOn(cloudApi, 'getWhatsAppHistory').mockResolvedValue([]);
    vi.spyOn(cloudApi, 'getWhatsAppStatus').mockResolvedValue({ configured: true, apiVersion: 'v21.0' });
    vi.spyOn(cloudApi, 'getProductionRecords').mockResolvedValue([
      { id: 5, machine_or_line: 'P01075', date: '2026-11-27', shift: 'Shift A', hour_interval: 'Hour 1', tool_number: 'T001', uph: 120, running_minutes: 60, target_qty: 7200, actual_qty: 6900, rejected_qty: 20, downtime_minutes: 5 },
    ]);
    const sendSpy = vi.spyOn(cloudApi, 'sendWhatsAppReport').mockResolvedValue({
      ok: true,
      sent_count: 1,
      failed_count: 0,
      results: [{ name: 'Plant Head', phone_number: '+919876543210', status: 'sent', message_id: 'wamid.123' }],
    });

    render(
      <WhatsAppReportsView
        selectedDate="2026-11-27"
        selectedShift="Shift A"
        machines={[{ machine_number: 'P01075', machine_type: 'NC' }]}
        tools={[{ tool_number: 'T001' }]}
        records={[]}
        downtimes={[]}
        currentUser={{ role: ROLES.SUPERVISOR, username: 'supervisor' }}
      />
    );

    await waitFor(() => expect(screen.getByText('Plant Head')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /send report via whatsapp api/i }));

    await waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1));
    expect(sendSpy.mock.calls[0][0].recipients).toHaveLength(1);
    expect(await screen.findByText(/Sent \(wamid\.123\)/i)).toBeInTheDocument();
  });

  it('requires confirmation dialog before deleting a production record in ReportsView (Admin only)', async () => {
    const delSpy = vi.spyOn(cloudApi, 'deleteProductionRecord').mockResolvedValue({ success: true });
    render(
      <ReportsView
        selectedPlant="Plant 1"
        selectedDate="2026-11-27"
        machines={[{ machine_number: 'P01075', machine_type: 'NC' }]}
        records={[
          { id: 77, plant_id: 'Plant 1', date: '2026-11-27', shift: 'Shift A', production_type: 'NC', machine_or_line: 'P01075', hour_interval: 'Hour 1', tool_number: 'T001', operator_name: 'SACHIN', uph: 120, target_qty: 7200, actual_qty: 7000, good_qty: 6990, rejected_qty: 10, downtime_minutes: 0 },
        ]}
        currentUser={{ role: ROLES.ADMIN, username: 'admin' }}
        onRefresh={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /delete production record 77/i }));
    expect(screen.getByText(/Delete Production Record\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    await waitFor(() => expect(delSpy).toHaveBeenCalledWith(77));
  });
});
