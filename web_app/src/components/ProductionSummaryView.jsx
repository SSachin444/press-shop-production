import React, { useEffect, useMemo, useState } from 'react';
import { Cpu, Wrench, RefreshCw, Search, Layers, Trash2, ShieldAlert, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getCapabilities } from '../config/roles';
import { cloudApi } from '../services/cloudClient';
import {
  SHIFTS,
  computeProductionMetrics,
  getHourSortOrder,
  groupHourlyMachineEntries,
  normalizeRecord,
} from '../services/metrics';
import CircularGauge from './CircularGauge';

export default function ProductionSummaryView({
  selectedDate,
  selectedShift,
  machines = [],
  tools = [],
  records = [],
  downtimes = [],
  currentUser = null,
  onReload = null,
}) {
  const caps = getCapabilities(currentUser?.role);
  const [trackingMode, setTrackingMode] = useState('machine'); // 'machine' | 'tool'
  const [fromDate, setFromDate] = useState(selectedDate);
  const [toDate, setToDate] = useState(selectedDate);
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [machineSearch, setMachineSearch] = useState('');
  const [selectedTool, setSelectedTool] = useState('');
  const [toolSearch, setToolSearch] = useState('');

  const [rangeRecords, setRangeRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { mode: 'record' | 'slot', record?, group? }
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadRangeRecords = async () => {
    setLoading(true);
    try {
      const list = await cloudApi.getProductionRecords({ fromDate, toDate });
      setRangeRecords(list || []);
    } catch {
      setRangeRecords(records || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRangeRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const activeDataset = rangeRecords.length > 0 || !loading ? rangeRecords : records;

  // All machines from directory + any historical machines from records
  const allMachineOptions = useMemo(() => {
    const byNum = new Map();
    (machines || []).forEach((m) => {
      byNum.set(String(m.machine_number).toUpperCase(), m);
    });
    (activeDataset || []).forEach((r) => {
      const mn = String(r.machine_or_line || '').toUpperCase();
      if (mn && !byNum.has(mn)) {
        byNum.set(mn, {
          machine_number: mn,
          machine_type: r.production_type || 'NC',
          tonnage: r.tonnage || 0,
          status: 'Historical',
        });
      }
    });
    const list = Array.from(byNum.values());
    const q = machineSearch.trim().toLowerCase();
    return q
      ? list.filter(
          (m) =>
            m.machine_number.toLowerCase().includes(q) ||
            String(m.machine_type || '').toLowerCase().includes(q)
        )
      : list;
  }, [machines, activeDataset, machineSearch]);

  useEffect(() => {
    if (allMachineOptions.length > 0 && !allMachineOptions.some((m) => m.machine_number === selectedMachine)) {
      setSelectedMachine(allMachineOptions[0].machine_number);
    }
  }, [allMachineOptions, selectedMachine]);

  // All tools from directory + historical records
  const allToolOptions = useMemo(() => {
    const set = new Set();
    (tools || []).forEach((t) => {
      if (t.tool_number) set.add(String(t.tool_number).toUpperCase());
    });
    (activeDataset || []).forEach((r) => {
      if (r.tool_number) set.add(String(r.tool_number).toUpperCase());
    });
    const arr = Array.from(set).sort();
    const q = toolSearch.trim().toLowerCase();
    return q ? arr.filter((t) => t.toLowerCase().includes(q)) : arr;
  }, [tools, activeDataset, toolSearch]);

  useEffect(() => {
    if (!selectedTool && allToolOptions.length > 0) {
      setSelectedTool(allToolOptions[0]);
    }
  }, [allToolOptions, selectedTool]);

  // Overall metrics for gauges (Daily & Shift comparison)
  const dailyMetrics = useMemo(
    () =>
      computeProductionMetrics(activeDataset, machines, downtimes, {
        plant: 'ALL',
        fromDate,
        toDate,
        shift: 'ALL',
        machineGroup: 'ALL',
      }),
    [activeDataset, machines, downtimes, fromDate, toDate]
  );

  const shiftMetrics = useMemo(
    () =>
      computeProductionMetrics(activeDataset, machines, downtimes, {
        plant: 'ALL',
        fromDate,
        toDate,
        shift: shiftFilter === 'ALL' ? selectedShift : shiftFilter,
        machineGroup: 'ALL',
      }),
    [activeDataset, machines, downtimes, fromDate, toDate, shiftFilter, selectedShift]
  );

  // Machine-wise tracking computation
  const machineTracking = useMemo(() => {
    const machNum = String(selectedMachine || '').toUpperCase();
    const machMetrics = computeProductionMetrics(activeDataset, machines, downtimes, {
      plant: 'ALL',
      fromDate,
      toDate,
      shift: shiftFilter,
      machine: machNum,
      machineGroup: 'ALL',
    });

    const filtered = machMetrics.filteredRecords;
    const chronologicalHours = groupHourlyMachineEntries(filtered);
    const latestSlot = chronologicalHours.length > 0 ? chronologicalHours[chronologicalHours.length - 1] : null;
    const operators = Array.from(new Set(filtered.map((r) => r.operator_name).filter(Boolean)));
    const toolsUsed = Array.from(new Set(filtered.map((r) => r.tool_number).filter(Boolean)));
    const machInfo = allMachineOptions.find((m) => m.machine_number === machNum) || null;

    const shiftTotals = SHIFTS.map((s) => {
      const sRecs = filtered.filter((r) => r.shift === s.id);
      const sGroups = groupHourlyMachineEntries(sRecs);
      return {
        shift: s.id,
        actual: sGroups.reduce((sum, g) => sum + g.totalActual, 0),
        target: sGroups.reduce((sum, g) => sum + g.totalTarget, 0),
        scrap: sGroups.reduce((sum, g) => sum + g.totalScrap, 0),
        downtime: sGroups.reduce((sum, g) => sum + g.downtimeMinutes, 0),
      };
    });

    return {
      machInfo,
      totals: machMetrics.totals,
      chronologicalHours,
      latestSlot,
      operators,
      toolsUsed,
      shiftTotals,
    };
  }, [selectedMachine, activeDataset, machines, downtimes, fromDate, toDate, shiftFilter, allMachineOptions]);

  // Tool-wise tracking computation
  const toolTracking = useMemo(() => {
    const tNum = String(selectedTool || '').toUpperCase();
    const toolMetrics = computeProductionMetrics(activeDataset, machines, downtimes, {
      plant: 'ALL',
      fromDate,
      toDate,
      shift: shiftFilter,
      tool: tNum,
      machineGroup: 'ALL',
    });

    const recs = [...toolMetrics.filteredRecords].sort(
      (a, b) =>
        String(a.date || '').localeCompare(String(b.date || '')) ||
        String(a.shift || '').localeCompare(String(b.shift || '')) ||
        getHourSortOrder(a.hour_interval) - getHourSortOrder(b.hour_interval)
    );
    const ncMachines = Array.from(new Set(recs.filter((r) => r.production_type === 'NC').map((r) => r.machine_or_line)));
    const tandemLines = Array.from(new Set(recs.filter((r) => r.production_type === 'Tandem').map((r) => r.machine_or_line)));
    const toolMeta = (tools || []).find((t) => String(t.tool_number || '').toUpperCase() === tNum) || null;
    const latestRun = recs.length > 0 ? recs[recs.length - 1] : null;

    return {
      toolNumber: tNum,
      toolMeta,
      totals: toolMetrics.totals,
      records: recs,
      ncMachines,
      tandemLines,
      latestRun,
    };
  }, [selectedTool, activeDataset, machines, downtimes, fromDate, toDate, shiftFilter, tools]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Filters & Mode Switcher */}
      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Production Summary — Machine-Wise &amp; Tool-Wise Tracking</h2>
            <p className="section-subtitle">
              Real-time achievement gauges calculated from UPH × running hours and verified database entries.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm ${trackingMode === 'machine' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTrackingMode('machine')}
            >
              <Cpu size={14} />
              <span>Machine-Wise Tracking</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${trackingMode === 'tool' ? 'btn-green' : 'btn-secondary'}`}
              onClick={() => setTrackingMode('tool')}
            >
              <Wrench size={14} />
              <span>Tool-Wise Tracking</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadRangeRecords} disabled={loading}>
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="filter-bar">
          <div className="field-group">
            <label className="field-label" htmlFor="sum-from">From Date</label>
            <input
              id="sum-from"
              type="date"
              className="field-input tabular"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="sum-to">To Date</label>
            <input
              id="sum-to"
              type="date"
              className="field-input tabular"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="sum-shift">Shift Filter</label>
            <select
              id="sum-shift"
              className="field-select"
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
            >
              <option value="ALL">All Shifts</option>
              {SHIFTS.map((s) => (
                <option key={s.id} value={s.id}>{s.id}</option>
              ))}
            </select>
          </div>

          {trackingMode === 'machine' ? (
            <>
              <div className="field-group">
                <label className="field-label" htmlFor="sum-mach-search">Search Machine</label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: 14, color: 'var(--ink-muted)' }} />
                  <input
                    id="sum-mach-search"
                    type="text"
                    className="field-input"
                    style={{ paddingLeft: 28 }}
                    value={machineSearch}
                    onChange={(e) => setMachineSearch(e.target.value)}
                    placeholder="Filter machine..."
                  />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="sum-mach-select">Select Machine</label>
                <select
                  id="sum-mach-select"
                  className="field-select mono"
                  value={selectedMachine}
                  onChange={(e) => setSelectedMachine(e.target.value)}
                >
                  {allMachineOptions.map((m) => (
                    <option key={m.machine_number} value={m.machine_number}>
                      {m.machine_number} ({m.machine_type})
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="field-group">
                <label className="field-label" htmlFor="sum-tool-search">Search Tool Number</label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: 14, color: 'var(--ink-muted)' }} />
                  <input
                    id="sum-tool-search"
                    type="text"
                    className="field-input mono"
                    style={{ paddingLeft: 28 }}
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value.toUpperCase())}
                    placeholder="Search tool..."
                  />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="sum-tool-select">Select Tool</label>
                <select
                  id="sum-tool-select"
                  className="field-select mono"
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                >
                  {allToolOptions.length === 0 ? (
                    <option value="">No tools found</option>
                  ) : (
                    allToolOptions.map((tn) => (
                      <option key={tn} value={tn}>{tn}</option>
                    ))
                  )}
                </select>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Circular Achievement Indicators */}
      <section className="surface-card" aria-label="Achievement circular progress indicators">
        <div className="section-header" style={{ marginBottom: 10 }}>
          <div>
            <h3 className="section-title">Production Achievement Indicators</h3>
            <p className="section-subtitle">Green: Target Achieved (≥85%) • Orange: Attention (60–84%) • Red: Below Target (&lt;60%)</p>
          </div>
        </div>

        <div className="gauges-grid">
          <CircularGauge
            value={machineTracking.totals.achievementPct}
            target={machineTracking.totals.target}
            label="Machine Achievement %"
            sublabel={`${selectedMachine || '—'}: ${machineTracking.totals.actual.toLocaleString()} / ${machineTracking.totals.target.toLocaleString()}`}
          />
          <CircularGauge
            value={toolTracking.totals.achievementPct}
            target={toolTracking.totals.target}
            label="Tool Achievement %"
            sublabel={`${selectedTool || '—'}: ${toolTracking.totals.actual.toLocaleString()} / ${toolTracking.totals.target.toLocaleString()}`}
          />
          <CircularGauge
            value={
              trackingMode === 'machine'
                ? machineTracking.latestSlot?.achievementPct || 0
                : toolTracking.latestRun?.achievement_pct || 0
            }
            target={
              trackingMode === 'machine'
                ? machineTracking.latestSlot?.totalTarget || 0
                : toolTracking.latestRun?.target_qty || 0
            }
            label="Hourly Achievement %"
            sublabel={
              trackingMode === 'machine'
                ? machineTracking.latestSlot
                  ? `${machineTracking.latestSlot.hour_interval}`
                  : 'No hourly run'
                : toolTracking.latestRun
                ? `${toolTracking.latestRun.hour_interval}`
                : 'No hourly run'
            }
          />
          <CircularGauge
            value={shiftMetrics.totals.achievementPct}
            target={shiftMetrics.totals.target}
            label="Shift Achievement %"
            sublabel={`${shiftFilter === 'ALL' ? selectedShift : shiftFilter}: ${shiftMetrics.totals.actual.toLocaleString()} pcs`}
          />
          <CircularGauge
            value={dailyMetrics.totals.achievementPct}
            target={dailyMetrics.totals.target}
            label="Daily Achievement %"
            sublabel={`All Units: ${dailyMetrics.totals.actual.toLocaleString()} / ${dailyMetrics.totals.target.toLocaleString()}`}
          />
        </div>
      </section>

      {/* MODE A: MACHINE-WISE TRACKING */}
      {trackingMode === 'machine' && (
        <>
          <section className="surface-card">
            <div className="section-header">
              <div>
                <h3 className="section-title">
                  Machine Dossier — <span className="mono">{selectedMachine || '—'}</span>
                  {machineTracking.machInfo ? ` (${machineTracking.machInfo.machine_type}, ${machineTracking.machInfo.tonnage || 0}T)` : ''}
                </h3>
                <p className="section-subtitle">
                  {fromDate} to {toDate} • Shift: {shiftFilter} • Operators: {machineTracking.operators.join(', ') || '—'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {machineTracking.toolsUsed.map((tn) => (
                  <button
                    key={tn}
                    type="button"
                    className="status-pill is-orange"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedTool(tn);
                      setTrackingMode('tool');
                    }}
                  >
                    Tool: {tn}
                  </button>
                ))}
              </div>
            </div>

            <div className="kpi-grid-4" style={{ marginBottom: 16 }}>
              <div className="kpi-box is-green-accent" style={{ cursor: 'default' }}>
                <span className="kpi-label">Total Production</span>
                <div className="kpi-number tabular">{machineTracking.totals.actual.toLocaleString()} <span className="kpi-unit">pcs</span></div>
                <span className="kpi-comparison">UPH Target: {machineTracking.totals.target.toLocaleString()} pcs</span>
              </div>
              <div className="kpi-box is-orange-accent" style={{ cursor: 'default' }}>
                <span className="kpi-label">Achievement %</span>
                <div className="kpi-number tabular">{machineTracking.totals.achievementPct}%</div>
                <span className="kpi-comparison">Good: {machineTracking.totals.good.toLocaleString()} pcs</span>
              </div>
              <div className="kpi-box" style={{ cursor: 'default' }}>
                <span className="kpi-label">Total Scrap</span>
                <div className="kpi-number tabular">{machineTracking.totals.rejected.toLocaleString()} <span className="kpi-unit">pcs</span></div>
                <span className="kpi-comparison">Scrap Rate: {machineTracking.totals.scrapPct}%</span>
              </div>
              <div className="kpi-box" style={{ cursor: 'default' }}>
                <span className="kpi-label">Downtime &amp; Problems</span>
                <div className="kpi-number tabular">{machineTracking.totals.downtimeMinutes} <span className="kpi-unit">min</span></div>
                <span className="kpi-comparison">Problems logged: {machineTracking.totals.problemCount}</span>
              </div>
            </div>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Layers size={15} style={{ color: 'var(--accent)' }} />
              Chronological Hourly Production Entries ({machineTracking.chronologicalHours.length} hour slot(s))
            </h4>

            {machineTracking.chronologicalHours.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.86rem' }}>
                No hourly production records logged for {selectedMachine} between {fromDate} and {toDate}.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {machineTracking.chronologicalHours.map((grp) => (
                  <div key={grp.key} className="hourly-summary-block">
                    <div className="hourly-summary-head">
                      <div>
                        <strong className="tabular">{grp.date}</strong> • <strong>{grp.shift}</strong> •{' '}
                        <strong style={{ color: 'var(--accent-hover)' }}>{grp.hour_interval}</strong>
                        <span style={{ color: 'var(--ink-muted)', marginLeft: 8, fontSize: '0.78rem' }}>
                          Operator: {grp.operators.join(', ') || '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="status-pill tabular is-ok">
                          Combined Output: {grp.totalActual.toLocaleString()} / {grp.totalTarget.toLocaleString()} pcs ({grp.achievementPct}%)
                        </span>
                        <span className="status-pill tabular">Scrap: {grp.totalScrap}</span>
                        <span className={`status-pill tabular ${grp.downtimeMinutes > 0 ? 'is-warn' : ''}`}>
                          DT: {grp.downtimeMinutes}m ({grp.problemCount} prob)
                        </span>
                        {caps.canDeleteProduction && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              setDeleteError('');
                              setDeleteTarget({ mode: 'slot', group: grp });
                            }}
                          >
                            <Trash2 size={13} /> Delete Hour
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="table-scroll-wrap" style={{ marginTop: 8 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Part #</th>
                            <th>Tool Number</th>
                            <th>UPH</th>
                            <th>Duration</th>
                            <th>Part Target</th>
                            <th>Actual Output</th>
                            <th>Part Ach %</th>
                            <th>Scrap</th>
                            <th>Scrap Reasons</th>
                            {caps.canDeleteProduction && <th>Action</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {grp.parts.map((pt) => (
                            <tr key={pt.id || `${grp.key}-p${pt.part_index}`}>
                              <td className="mono"><strong>Part {pt.part_index}</strong></td>
                              <td className="mono"><strong>{pt.tool_number || '—'}</strong></td>
                              <td className="tabular">{pt.uph || '—'}</td>
                              <td className="tabular">{pt.running_minutes} min</td>
                              <td className="tabular">{pt.target_qty.toLocaleString()}</td>
                              <td className="tabular"><strong>{pt.actual_qty.toLocaleString()}</strong></td>
                              <td className="tabular">{pt.achievement_pct}%</td>
                              <td className="tabular">{pt.rejected_qty}</td>
                              <td style={{ fontSize: '0.78rem' }}>
                                {pt.scrap_breakdown && pt.scrap_breakdown.length > 0
                                  ? pt.scrap_breakdown.map((sb) => `${sb.reason_name}: ${sb.qty}`).join(', ')
                                  : '—'}
                              </td>
                              {caps.canDeleteProduction && (
                                <td>
                                  {pt.id ? (
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      aria-label={`Delete part ${pt.part_index} record`}
                                      onClick={() => {
                                        setDeleteError('');
                                        setDeleteTarget({ mode: 'record', record: pt });
                                      }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                          {grp.parts.length > 1 && (
                            <tr style={{ background: 'var(--accent-tint)', fontWeight: 700 }}>
                              <td colSpan={4}>COMBINED HOURLY TOTAL ({grp.parts.length} parts)</td>
                              <td className="tabular">{grp.totalTarget.toLocaleString()}</td>
                              <td className="tabular">{grp.totalActual.toLocaleString()}</td>
                              <td className="tabular">{grp.achievementPct}%</td>
                              <td className="tabular">{grp.totalScrap}</td>
                              <td className="tabular" colSpan={caps.canDeleteProduction ? 2 : 1}>DT: {grp.downtimeMinutes}m</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {grp.downtimeProblems && grp.downtimeProblems.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--status-warn-ink)' }}>
                        <strong>Downtime Problems ({grp.downtimeProblems.length}):</strong>{' '}
                        {grp.downtimeProblems
                          .map(
                            (dp) =>
                              `${dp.start_time || ''}${dp.end_time ? `–${dp.end_time}` : ''} [${dp.downtime_code || 'DT'}] ${dp.downtime_reason} (${dp.duration_minutes}m)${dp.problem_description ? `: ${dp.problem_description}` : ''}`
                          )
                          .join(' | ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Totals Summary */}
            <div className="summary-footer-grid" style={{ marginTop: 18 }}>
              <div className="summary-total-box">
                <div className="kpi-label">Total Hourly Output</div>
                <div className="tabular" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  {machineTracking.totals.actual.toLocaleString()} pcs
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                  Avg/Hour Slot: {machineTracking.chronologicalHours.length > 0 ? Math.round(machineTracking.totals.actual / machineTracking.chronologicalHours.length).toLocaleString() : 0} pcs
                </div>
              </div>
              <div className="summary-total-box">
                <div className="kpi-label">Shift Production Breakdown</div>
                <div style={{ fontSize: '0.78rem', marginTop: 4 }} className="tabular">
                  {machineTracking.shiftTotals.map((st) => (
                    <div key={st.shift}>
                      <strong>{st.shift}:</strong> {st.actual.toLocaleString()} pcs
                    </div>
                  ))}
                </div>
              </div>
              <div className="summary-total-box">
                <div className="kpi-label">Total Daily / Range Production</div>
                <div className="tabular" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--status-ok)' }}>
                  {machineTracking.totals.actual.toLocaleString()} pcs
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                  Target: {machineTracking.totals.target.toLocaleString()} pcs
                </div>
              </div>
              <div className="summary-total-box">
                <div className="kpi-label">Total Scrap &amp; Downtime</div>
                <div className="tabular" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent)' }}>
                  {machineTracking.totals.rejected.toLocaleString()} scrap • {machineTracking.totals.downtimeMinutes} min DT
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                  Problems: {machineTracking.totals.problemCount}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* MODE B: TOOL-WISE TRACKING */}
      {trackingMode === 'tool' && (
        <section className="surface-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                Tool Traceability — <span className="mono">{toolTracking.toolNumber || '—'}</span>
                {toolTracking.toolMeta?.part_name ? ` (${toolTracking.toolMeta.part_name})` : ''}
              </h3>
              <p className="section-subtitle">
                {toolTracking.toolMeta?.description || 'Complete production runs across NC machines and Tandem lines'}
              </p>
            </div>
          </div>

          <div className="kpi-grid-4" style={{ marginBottom: 16 }}>
            <div className="kpi-box is-green-accent" style={{ cursor: 'default' }}>
              <span className="kpi-label">Total Tool Production</span>
              <div className="kpi-number tabular">{toolTracking.totals.actual.toLocaleString()} <span className="kpi-unit">pcs</span></div>
              <span className="kpi-comparison">Target: {toolTracking.totals.target.toLocaleString()} pcs ({toolTracking.totals.achievementPct}%)</span>
            </div>
            <div className="kpi-box is-orange-accent" style={{ cursor: 'default' }}>
              <span className="kpi-label">NC Machines Used</span>
              <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 4 }}>
                {toolTracking.ncMachines.length > 0 ? toolTracking.ncMachines.join(', ') : 'None'}
              </div>
              <span className="kpi-comparison">Across {toolTracking.ncMachines.length} NC unit(s)</span>
            </div>
            <div className="kpi-box" style={{ cursor: 'default' }}>
              <span className="kpi-label">Tandem Lines Used</span>
              <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 4 }}>
                {toolTracking.tandemLines.length > 0 ? toolTracking.tandemLines.join(', ') : 'None'}
              </div>
              <span className="kpi-comparison">Across {toolTracking.tandemLines.length} Tandem line(s)</span>
            </div>
            <div className="kpi-box" style={{ cursor: 'default' }}>
              <span className="kpi-label">Tool Scrap &amp; Downtime</span>
              <div className="kpi-number tabular">{toolTracking.totals.rejected.toLocaleString()} <span className="kpi-unit">scrap</span></div>
              <span className="kpi-comparison">Downtime: {toolTracking.totals.downtimeMinutes} min</span>
            </div>
          </div>

          {toolTracking.records.length === 0 ? (
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.86rem' }}>
              No production entries recorded for tool <strong className="mono">{toolTracking.toolNumber}</strong> in the selected date range.
            </p>
          ) : (
            <div className="table-scroll-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Shift</th>
                    <th>Group</th>
                    <th>Machine / Tandem Line</th>
                    <th>Hour</th>
                    <th>Part #</th>
                    <th>Operator</th>
                    <th>Target</th>
                    <th>Hourly Output</th>
                    <th>Ach %</th>
                    <th>Scrap</th>
                    <th>Downtime</th>
                    {caps.canDeleteProduction && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {toolTracking.records.map((r, i) => (
                    <tr key={r.id || i}>
                      <td className="tabular">{r.date}</td>
                      <td>{r.shift}</td>
                      <td>
                        <span className={`status-pill ${r.production_type === 'Tandem' ? 'is-orange' : 'is-ok'}`}>
                          {r.production_type}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="mono"
                          onClick={() => {
                            setSelectedMachine(r.machine_or_line);
                            setTrackingMode('machine');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontWeight: 700,
                            color: 'var(--accent-hover)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          {r.machine_or_line}
                        </button>
                      </td>
                      <td>{r.hour_interval}</td>
                      <td className="mono">P{r.part_index}</td>
                      <td>{r.operator_name || '—'}</td>
                      <td className="tabular">{r.target_qty.toLocaleString()}</td>
                      <td className="tabular"><strong>{r.actual_qty.toLocaleString()}</strong></td>
                      <td className="tabular">{r.achievement_pct}%</td>
                      <td className="tabular">{r.rejected_qty.toLocaleString()}</td>
                      <td className="tabular">{r.downtime_minutes}m</td>
                      {caps.canDeleteProduction && (
                        <td>
                          {r.id ? (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              aria-label={`Delete tool record ${r.id}`}
                              onClick={() => {
                                setDeleteError('');
                                setDeleteTarget({ mode: 'record', record: r });
                              }}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {notice && (
        <div className={`banner ${notice.type === 'ok' ? 'is-ok' : 'is-err'}`} role={notice.type === 'err' ? 'alert' : 'status'}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {notice.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {notice.message}
          </span>
        </div>
      )}

      {deleteTarget && caps.canDeleteProduction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sum-del-title">
          <div className="modal-dialog" style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <h3 id="sum-del-title" className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-err-ink)' }}>
                <ShieldAlert size={18} />
                {deleteTarget.mode === 'slot' ? 'Delete Full Hourly Entry?' : 'Delete Production Record?'}
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deleteError && (
                <div className="banner is-err" role="alert">
                  <span>{deleteError}</span>
                </div>
              )}
              {deleteTarget.mode === 'slot' ? (
                <p>
                  Remove all part entries for machine <strong className="mono">{selectedMachine}</strong> on{' '}
                  <strong className="tabular">{deleteTarget.group.date}</strong> ({deleteTarget.group.shift},{' '}
                  <strong>{deleteTarget.group.hour_interval}</strong> — {deleteTarget.group.parts.length} part row(s))?
                </p>
              ) : (
                <p>
                  Remove record <strong className="mono">#{deleteTarget.record.id}</strong> (Machine{' '}
                  <strong className="mono">{deleteTarget.record.machine_or_line}</strong>, Tool{' '}
                  <strong className="mono">{deleteTarget.record.tool_number}</strong>, Actual{' '}
                  <strong className="tabular">{deleteTarget.record.actual_qty}</strong>)?
                </p>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError('');
                  try {
                    if (deleteTarget.mode === 'slot') {
                      await cloudApi.deleteHourlyProductionSlot({
                        date: deleteTarget.group.date,
                        shift: deleteTarget.group.shift,
                        machine_or_line: selectedMachine,
                        hour_interval: deleteTarget.group.hour_interval,
                      });
                      setNotice({
                        type: 'ok',
                        message: `Deleted hourly entry for ${selectedMachine} (${deleteTarget.group.hour_interval}).`,
                      });
                    } else {
                      await cloudApi.deleteProductionRecord(deleteTarget.record.id);
                      setNotice({
                        type: 'ok',
                        message: `Deleted production record #${deleteTarget.record.id}.`,
                      });
                    }
                    setDeleteTarget(null);
                    await loadRangeRecords();
                    if (onReload) await onReload();
                  } catch (err) {
                    setDeleteError(err?.message || 'Unable to delete entry.');
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
