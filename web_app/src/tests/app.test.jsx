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
import { computeProductionMetrics, buildCsvDocument } from '../services/metrics';
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
import MachinesView from '../components/MachinesView';
import LiveCellStatusView from '../components/LiveCellStatusView';

describe('Metrics Single Source of Truth', () => {
  const machines = [
    { machine_number: 'NC-01', machine_type: 'NC', plant_id: 'Plant 1', tonnage: 1000, production_target: 600, status: 'Running' },
    { machine_number: 'NC-02', machine_type: 'NC', plant_id: 'Plant 1', tonnage: 800, production_target: 550, status: 'Idle' },
  ];

  const records = [
    {
      id: 1,
      plant_id: 'Plant 1',
      date: '2026-11-25',
      shift: 'Shift A',
      machine_or_line: 'NC-01',
      production_type: 'NC',
      hour_interval: 'Hour 1 (08:00 - 09:00)',
      actual_qty: 1350,
      target_qty: 1920,
      good_qty: 1340,
      rejected_qty: 10,
      downtime_minutes: 15,
    },
    {
      id: 2,
      plant_id: 'Plant 1',
      date: '2026-11-25',
      shift: 'Shift A',
      machine_or_line: 'NC-01',
      production_type: 'NC',
      hour_interval: 'Hour 2 (09:00 - 10:00)',
      actual_qty: 1500,
      target_qty: 1920,
      good_qty: 1490,
      rejected_qty: 10,
      downtime_minutes: 0,
    },
  ];

  it('computes shift actual and target consistently from filtered production records', () => {
    const metrics = computeProductionMetrics(records, machines, [], {
      plant: 'Plant 1',
      date: '2026-11-25',
      shift: 'Shift A',
      machineGroup: 'ALL',
    });

    expect(metrics.totals.actual).toBe(2850);
    expect(metrics.totals.target).toBe(3840);
    expect(metrics.totals.achievementPct).toBe(74.2);
    expect(metrics.totals.good).toBe(2830);
    expect(metrics.totals.rejected).toBe(20);
    expect(metrics.totals.downtimeMinutes).toBe(15);
    expect(metrics.totals.machinesAffected).toBe(1);
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

  it('enforces exact route & capability boundaries for all 4 roles', () => {
    expect(getAllowedRoutes(ROLES.OPERATOR).map((r) => r.id)).toEqual(['hourly-production', 'cell-status']);
    expect(getAllowedRoutes(ROLES.DASHBOARD).map((r) => r.id)).toEqual(['cell-status']);
    expect(getDefaultTabForRole(ROLES.DASHBOARD)).toBe('cell-status');

    expect(canAccessTab(ROLES.SUPERVISOR, 'dashboard')).toBe(true);
    expect(canAccessTab(ROLES.SUPERVISOR, 'settings')).toBe(false);
    expect(canAccessTab(ROLES.SUPERVISOR, 'users')).toBe(false);
    expect(canAccessTab(ROLES.SUPERVISOR, 'activity-logs')).toBe(false);

    const supCaps = getCapabilities(ROLES.SUPERVISOR);
    expect(supCaps.canEditMachines).toBe(false);
    expect(supCaps.canViewPersonalEmployeeFields).toBe(false);
    expect(supCaps.canDeleteEmployees).toBe(false);

    const admCaps = getCapabilities(ROLES.ADMIN);
    expect(admCaps.canEditMachines).toBe(true);
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

describe('UI Components: RoleGateway, Dashboard, Reports, HourlyEntry, Machines, Kiosk', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('renders PHA Role Gateway with all 4 roles and password gate for Admin/Supervisor', async () => {
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

  it('renders loading skeleton (never fake zeros) and matches Reports totals on ready data', () => {
    const machines = [{ machine_number: 'NC-01', machine_type: 'NC', plant_id: 'Plant 1', tonnage: 1000, production_target: 600, status: 'Running' }];
    const records = [
      {
        id: 10,
        plant_id: 'Plant 1',
        date: '2026-11-25',
        shift: 'Shift A',
        machine_or_line: 'NC-01',
        production_type: 'NC',
        hour_interval: 'Hour 1 (08:00 - 09:00)',
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
        selectedDate="2026-11-25"
        setSelectedDate={() => {}}
        selectedShift="Shift A"
        setSelectedShift={() => {}}
        machineGroup="ALL"
        setMachineGroup={() => {}}
        machines={[]}
        records={[]}
        downtimes={[]}
        dataState="loading"
        onRetry={() => {}}
        onNavigate={() => {}}
      />
    );
    expect(screen.getByLabelText(/loading dashboard/i)).toBeInTheDocument();
    expect(screen.queryByText(/actual production/i)).not.toBeInTheDocument();

    rerender(
      <DashboardView
        selectedPlant="Plant 1"
        setSelectedPlant={() => {}}
        selectedDate="2026-11-25"
        setSelectedDate={() => {}}
        selectedShift="Shift A"
        setSelectedShift={() => {}}
        machineGroup="ALL"
        setMachineGroup={() => {}}
        machines={machines}
        records={records}
        downtimes={[]}
        dataState="ready"
        lastSyncedAt="2026-11-25T06:00:00Z"
        onRetry={() => {}}
        onNavigate={() => {}}
      />
    );
    expect(screen.getAllByText('520').length).toBeGreaterThan(0);

    render(<ReportsView selectedPlant="Plant 1" selectedDate="2026-11-25" machines={machines} records={records} onRefresh={() => {}} />);
    expect(screen.getAllByText('520').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/86\.7%/).length).toBeGreaterThan(0);
  });

  it('allows clearing and replacing numeric inputs in HourlyEntryView and sends client_submission_id once', async () => {
    vi.spyOn(cloudApi, 'getOperationalRoster').mockResolvedValue([]);
    const submitSpy = vi.spyOn(cloudApi, 'submitProductionEntry').mockResolvedValue({ success: true, record: { id: 99 } });

    render(
      <HourlyEntryView
        selectedPlant="Plant 1"
        selectedDate="2026-11-25"
        setSelectedDate={() => {}}
        selectedShift="Shift A"
        setSelectedShift={() => {}}
        machines={[{ machine_number: 'NC-01', machine_type: 'NC', status: 'Running' }]}
        records={[]}
        downtimeCodes={[]}
        currentUser={{ role: ROLES.OPERATOR, full_name: 'Operator One' }}
        onEntrySaved={() => {}}
      />
    );

    const uphInput = screen.getByLabelText(/uph rate/i);
    const actualInput = screen.getByLabelText(/actual quantity/i);
    const toolInput = screen.getByLabelText(/tool \/ die number/i);

    fireEvent.change(uphInput, { target: { value: '' } });
    expect(uphInput.value).toBe('');
    fireEvent.change(uphInput, { target: { value: '12' } });
    expect(uphInput.value).toBe('12');

    fireEvent.change(actualInput, { target: { value: '680' } });
    fireEvent.change(toolInput, { target: { value: 'DIE-77' } });

    fireEvent.click(screen.getByRole('button', { name: /save production entry/i }));

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));
    expect(submitSpy.mock.calls[0][0].client_submission_id).toBeTruthy();
    expect(submitSpy.mock.calls[0][0].actual_qty).toBe(680);
  });

  it('enforces read-only MachinesView for Supervisor and Kiosk mode with zero entry/admin buttons for Dashboard role', () => {
    const machines = [{ machine_number: 'NC-01', machine_type: 'NC', tonnage: 1000, production_target: 600, status: 'Running', version: 1 }];

    render(
      <MachinesView
        machines={machines}
        downtimes={[]}
        downtimeCodes={[]}
        currentUser={{ role: ROLES.SUPERVISOR, username: 'sup' }}
        onReload={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: /add machine/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();

    render(
      <LiveCellStatusView
        kioskMode={true}
        selectedPlant="Plant 1"
        selectedDate="2026-11-25"
        selectedShift="Shift A"
        machines={machines}
        records={[]}
        downtimes={[]}
        dataState="ready"
        isOnline={true}
        onRefresh={() => {}}
        onExitKiosk={() => {}}
      />
    );
    expect(screen.getByText(/Live Cell Status Display/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save hourly/i })).not.toBeInTheDocument();
  });
});
