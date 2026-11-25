// Single Source of Truth Metrics, Filtering, and CSV Export Utility
// Used consistently by Dashboard, Live Cell Status, Production Overview, and Reports.

export const PLANTS = ['Plant 1'];

export const SHIFTS = [
  { id: 'Shift A', label: 'Shift A (08:00 AM - 04:30 PM)' },
  { id: 'Shift B', label: 'Shift B (04:30 PM - 01:00 AM)' },
  { id: 'Shift C', label: 'Shift C (01:00 AM - 08:00 AM)' },
];

export const HOUR_SLOTS = [
  { key: 'Hour 1', span: '08:00 - 09:00', label: 'Hour 1 (08:00 - 09:00)', shortLabel: 'Hr 1' },
  { key: 'Hour 2', span: '09:00 - 10:00', label: 'Hour 2 (09:00 - 10:00)', shortLabel: 'Hr 2' },
  { key: 'Hour 3', span: '10:00 - 11:00', label: 'Hour 3 (10:00 - 11:00)', shortLabel: 'Hr 3' },
  { key: 'Hour 4', span: '11:00 - 12:00', label: 'Hour 4 (11:00 - 12:00)', shortLabel: 'Hr 4' },
  { key: 'Hour 5', span: '12:30 - 13:30', label: 'Hour 5 (12:30 - 13:30)', shortLabel: 'Hr 5' },
  { key: 'Hour 6', span: '13:30 - 14:30', label: 'Hour 6 (13:30 - 14:30)', shortLabel: 'Hr 6' },
  { key: 'Hour 7', span: '14:30 - 15:30', label: 'Hour 7 (14:30 - 15:30)', shortLabel: 'Hr 7' },
  { key: 'Hour 8', span: '15:30 - 16:30', label: 'Hour 8 (15:30 - 16:30)', shortLabel: 'Hr 8' },
];

export function getDefaultMachinesList() {
  return [
    { machine_number: 'NC-01', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 1000, production_target: 600, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-02', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 800, production_target: 550, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-03', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 800, production_target: 550, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-04', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 600, production_target: 500, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-05', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 600, production_target: 500, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-06', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 500, production_target: 450, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-07', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 500, production_target: 450, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-08', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 400, production_target: 400, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-09', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 400, production_target: 400, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-10', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 300, production_target: 350, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-11', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 300, production_target: 350, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-12', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 300, production_target: 350, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-13', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 250, production_target: 300, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-14', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 250, production_target: 300, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-15', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 200, production_target: 250, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-16', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 200, production_target: 250, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'LP-1', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 1200, production_target: 700, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'LP-2', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 1000, production_target: 650, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'HP-1', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 1500, production_target: 800, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'HP-2', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 1500, production_target: 800, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'HP-3', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 2000, production_target: 900, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'HP-4', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 2000, production_target: 900, status: 'Idle', assigned_operator: '', version: 1 },
  ];
}

export const DEFAULT_DOWNTIME_CODES = [
  { code: 'D01', name: 'Machine Breakdown', description: 'Mechanical or electrical failure', display_order: 1, is_active: true },
  { code: 'D02', name: 'Tool Problem', description: 'Tool wear, breakage, or die alignment', display_order: 2, is_active: true },
  { code: 'D03', name: 'Material Shortage', description: 'Raw material, blank, or coil unavailability', display_order: 3, is_active: true },
  { code: 'D04', name: 'Power Failure', description: 'Electrical grid, power outage, or generator fault', display_order: 4, is_active: true },
  { code: 'D05', name: 'Quality Problem', description: 'Defects, burr, crack, or dimensional issues', display_order: 5, is_active: true },
  { code: 'D06', name: 'Other Issues', description: 'Maintenance, safety, air pressure, or miscellaneous', display_order: 6, is_active: true },
];

export function getCurrentShiftName(now = new Date()) {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${mm}`;
  if (timeStr >= '08:00' && timeStr < '16:30') return 'Shift A';
  if (timeStr >= '16:30' || timeStr < '01:00') return 'Shift B';
  return 'Shift C';
}

export function normalizeRecord(raw) {
  const actual = Math.max(0, Number(raw?.actual_qty) || 0);
  const rejected = Math.max(0, Number(raw?.rejected_qty) || 0);
  const good =
    raw?.good_qty !== undefined && raw?.good_qty !== null
      ? Math.max(0, Number(raw.good_qty) || 0)
      : Math.max(0, actual - rejected);
  const target = Math.max(0, Number(raw?.target_qty) || 0);
  const downtime = Math.max(0, Number(raw?.downtime_minutes) || 0);
  const machine = String(raw?.machine_or_line || raw?.machine || '').trim().toUpperCase();
  const group =
    raw?.production_type ||
    (machine.startsWith('LP') || machine.startsWith('HP') ? 'Tandem' : 'NC');

  return {
    ...raw,
    plant_id: raw?.plant_id || 'Plant 1',
    machine_or_line: machine,
    production_type: group,
    actual_qty: actual,
    target_qty: target,
    rejected_qty: rejected,
    good_qty: good,
    downtime_minutes: downtime,
    achievement_pct: target > 0 ? Number(((actual / target) * 100).toFixed(1)) : 0,
  };
}

export function filterProductionRecords(records, filters = {}) {
  const {
    plant = 'ALL',
    date = '',
    fromDate = '',
    toDate = '',
    shift = '',
    machineGroup = 'ALL',
    machine = '',
    operator = '',
    search = '',
  } = filters;

  const groupUpper = String(machineGroup || 'ALL').toUpperCase();
  const machineUpper = String(machine || '').trim().toUpperCase();
  const operatorLower = String(operator || '').trim().toLowerCase();
  const searchLower = String(search || '').trim().toLowerCase();

  return (records || []).map(normalizeRecord).filter((r) => {
    if (plant && plant !== 'ALL' && (r.plant_id || 'Plant 1') !== plant) return false;
    if (date && r.date !== date) return false;
    if (fromDate && r.date < fromDate) return false;
    if (toDate && r.date > toDate) return false;
    if (shift && shift !== 'ALL' && r.shift !== shift) return false;
    if (groupUpper !== 'ALL' && String(r.production_type || '').toUpperCase() !== groupUpper) return false;
    if (machineUpper && machineUpper !== 'ALL' && r.machine_or_line !== machineUpper) return false;
    if (operatorLower && !String(r.operator_name || '').toLowerCase().includes(operatorLower)) return false;
    if (searchLower) {
      const hay = [
        r.date,
        r.shift,
        r.machine_or_line,
        r.production_type,
        r.tool_number,
        r.operator_name,
        r.hour_interval,
        r.downtime_reason,
        r.remarks,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(searchLower)) return false;
    }
    return true;
  });
}

export function computeProductionMetrics(records, machines, downtimes = [], filters = {}) {
  const groupUpper = String(filters.machineGroup || 'ALL').toUpperCase();
  const plantFilter = filters.plant || 'Plant 1';

  const normalizedMachines = (machines || []).filter((m) => {
    if (plantFilter && plantFilter !== 'ALL' && (m.plant_id || 'Plant 1') !== plantFilter) return false;
    if (groupUpper === 'ALL') return true;
    return String(m.machine_type || m.machine_group || 'NC').toUpperCase() === groupUpper;
  });

  const filteredRecords = filterProductionRecords(records, {
    plant: plantFilter,
    date: filters.date,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    shift: filters.shift,
    machineGroup: groupUpper,
    machine: filters.machine,
    operator: filters.operator,
    search: filters.search,
  });

  const openDowntimes = (downtimes || []).filter((d) => {
    if (d.status !== 'Open') return false;
    if (groupUpper === 'ALL') return true;
    return normalizedMachines.some(
      (m) => m.machine_number.toUpperCase() === String(d.machine_number || '').toUpperCase()
    );
  });

  const totalActual = filteredRecords.reduce((s, r) => s + r.actual_qty, 0);
  const totalTarget = filteredRecords.reduce((s, r) => s + r.target_qty, 0);
  const totalGood = filteredRecords.reduce((s, r) => s + r.good_qty, 0);
  const totalRejected = filteredRecords.reduce((s, r) => s + r.rejected_qty, 0);
  const totalDowntimeMinutes = filteredRecords.reduce((s, r) => s + r.downtime_minutes, 0);

  const achievementPct = totalTarget > 0 ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : 0;
  const qualityPct = totalActual > 0 ? Number(((totalGood / totalActual) * 100).toFixed(1)) : 0;
  const scrapPct = totalActual > 0 ? Number(((totalRejected / totalActual) * 100).toFixed(1)) : 0;

  const affectedMachinesSet = new Set();
  filteredRecords.forEach((r) => {
    if (r.downtime_minutes > 0) affectedMachinesSet.add(r.machine_or_line);
  });
  openDowntimes.forEach((d) => {
    if (d.machine_number) affectedMachinesSet.add(String(d.machine_number).toUpperCase());
  });

  let runningCount = 0;
  let maintenanceCount = 0;
  let stoppedCount = 0;

  const machineRows = normalizedMachines.map((m) => {
    const mNum = String(m.machine_number).toUpperCase();
    const mRecs = filteredRecords
      .filter((r) => r.machine_or_line === mNum)
      .sort((a, b) => String(a.hour_interval || '').localeCompare(String(b.hour_interval || '')) || (Number(a.id) || 0) - (Number(b.id) || 0));

    const actual = mRecs.reduce((s, r) => s + r.actual_qty, 0);
    const target = mRecs.reduce((s, r) => s + r.target_qty, 0);
    const good = mRecs.reduce((s, r) => s + r.good_qty, 0);
    const rejected = mRecs.reduce((s, r) => s + r.rejected_qty, 0);
    const downtime = mRecs.reduce((s, r) => s + r.downtime_minutes, 0);

    const activeDt = openDowntimes.find((d) => String(d.machine_number || '').toUpperCase() === mNum) || null;
    const status = activeDt ? 'Breakdown' : (m.status || (actual > 0 ? 'Running' : 'Idle'));

    if (status === 'Running') runningCount += 1;
    else if (status === 'Maintenance') maintenanceCount += 1;
    else stoppedCount += 1;

    const latestRec = mRecs.length > 0 ? mRecs[mRecs.length - 1] : null;
    const hourlyActual = latestRec ? latestRec.actual_qty : 0;
    const hourlyTarget = latestRec ? latestRec.target_qty : 0;
    const totalPct = target > 0 ? Number(((actual / target) * 100).toFixed(1)) : 0;
    const hourlyPct = hourlyTarget > 0 ? Number(((hourlyActual / hourlyTarget) * 100).toFixed(1)) : 0;

    return {
      ...m,
      machine_number: m.machine_number,
      machine_type: m.machine_type || 'NC',
      machine_group: m.machine_group || m.machine_type || 'NC',
      plant_id: m.plant_id || 'Plant 1',
      tonnage: Number(m.tonnage) || 0,
      configured_target: Number(m.production_target) || 0,
      target,
      actual,
      good,
      rejected,
      downtime,
      achievement_pct: totalPct,
      total_output_pct: totalPct,
      hourly_actual: hourlyActual,
      hourly_target: hourlyTarget,
      hourly_output_pct: hourlyPct,
      status,
      is_stopped: status === 'Breakdown' || status === 'Idle',
      active_downtime: activeDt,
      operator: (latestRec && latestRec.operator_name) || m.assigned_operator || '',
      tool_number: (latestRec && latestRec.tool_number) || '',
      records_count: mRecs.length,
    };
  });

  const hourlySeries = HOUR_SLOTS.map((slot) => {
    const slotRecs = filteredRecords.filter(
      (r) => String(r.hour_interval || '').includes(slot.key) || String(r.hour_interval || '').includes(slot.span)
    );
    const slotActual = slotRecs.reduce((s, r) => s + r.actual_qty, 0);
    const slotTarget = slotRecs.reduce((s, r) => s + r.target_qty, 0);
    return {
      hour: slot.key,
      shortLabel: slot.shortLabel,
      hour_interval: slot.label,
      actual: slotActual,
      target: slotTarget,
      pct: slotTarget > 0 ? Number(((slotActual / slotTarget) * 100).toFixed(1)) : 0,
    };
  });

  const activeMachinesWithRecords = machineRows.filter((m) => m.records_count > 0);
  const sortedByPerf = [...activeMachinesWithRecords].sort((a, b) => b.achievement_pct - a.achievement_pct || b.actual - a.actual);
  const topMachine = sortedByPerf.length > 0 ? sortedByPerf[0] : null;
  const bottleneckMachine = sortedByPerf.length > 1 ? sortedByPerf[sortedByPerf.length - 1] : null;

  return {
    totals: {
      actual: totalActual,
      target: totalTarget,
      good: totalGood,
      rejected: totalRejected,
      downtimeMinutes: totalDowntimeMinutes,
      achievementPct,
      qualityPct,
      scrapPct,
      machinesAffected: affectedMachinesSet.size,
      recordCount: filteredRecords.length,
    },
    machineCounts: {
      total: normalizedMachines.length,
      running: runningCount,
      maintenance: maintenanceCount,
      stopped: stoppedCount,
    },
    machines: machineRows,
    hourlySeries,
    filteredRecords,
    topMachine,
    bottleneckMachine,
  };
}

export function escapeCsvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildCsvDocument(columns, rows, summaryRow = null) {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(typeof c.accessor === 'function' ? c.accessor(row) : row[c.key])).join(',')
  );
  if (summaryRow) {
    dataLines.push(columns.map((c) => escapeCsvCell(summaryRow[c.key] ?? '')).join(','));
  }
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
}
