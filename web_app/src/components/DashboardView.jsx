import React, { useMemo } from 'react';
import {
  RefreshCw,
  AlertCircle,
  Clock,
  Factory,
  Layers,
  GitBranch,
  Cpu,
  Users,
  AlertTriangle,
  Activity,
  TrendingUp,
} from 'lucide-react';
import {
  PLANTS,
  SHIFTS,
  computeProductionMetrics,
  getCurrentShiftName,
} from '../services/metrics';
import { getSyncQueue } from '../services/syncQueue';
import CircularGauge from './CircularGauge';

function StatusBadge({ status }) {
  const s = String(status || 'Idle');
  const cls =
    s === 'Running' ? 'is-ok' : s === 'Maintenance' || s === 'Idle' ? 'is-warn' : 'is-err';
  return <span className={`status-pill ${cls}`}>{s}</span>;
}

function SkeletonCards() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} aria-busy="true" aria-label="Loading dashboard">
      <div className="kpi-grid-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="kpi-box">
            <div className="skeleton-line" style={{ height: 12, width: '55%' }} />
            <div className="skeleton-line" style={{ height: 28, width: '45%', marginTop: 8 }} />
            <div className="skeleton-line" style={{ height: 12, width: '75%', marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div className="surface-card">
        <div className="skeleton-line" style={{ height: 18, width: '35%', marginBottom: 12 }} />
        <div className="skeleton-line" style={{ height: 160, width: '100%' }} />
      </div>
    </div>
  );
}

export default function DashboardView({
  selectedPlant,
  setSelectedPlant,
  selectedDate,
  setSelectedDate,
  selectedShift,
  setSelectedShift,
  machineGroup,
  setMachineGroup,
  machines,
  records,
  downtimes,
  employeesCount = 0,
  dataState, // 'loading' | 'ready' | 'error'
  errorMessage,
  lastSyncedAt,
  isStale,
  onRetry,
  onNavigate,
}) {
  const pendingQueue = getSyncQueue();
  const liveShiftName = getCurrentShiftName();

  const metrics = useMemo(
    () =>
      computeProductionMetrics(records, machines, downtimes, {
        plant: selectedPlant,
        date: selectedDate,
        shift: selectedShift,
        machineGroup,
      }),
    [records, machines, downtimes, selectedPlant, selectedDate, selectedShift, machineGroup]
  );

  // Full day metrics across all shifts & all groups for NC vs Tandem, Current Shift & Daily Overview
  const dayMetrics = useMemo(
    () =>
      computeProductionMetrics(records, machines, downtimes, {
        plant: selectedPlant,
        date: selectedDate,
        shift: 'ALL',
        machineGroup: 'ALL',
      }),
    [records, machines, downtimes, selectedPlant, selectedDate]
  );

  const currentShiftMetrics = useMemo(
    () =>
      computeProductionMetrics(records, machines, downtimes, {
        plant: selectedPlant,
        date: selectedDate,
        shift: liveShiftName,
        machineGroup: 'ALL',
      }),
    [records, machines, downtimes, selectedPlant, selectedDate, liveShiftName]
  );

  const {
    totals,
    ncTotals,
    tandemTotals,
    machineCounts,
    machines: machineRows,
    hourlySeries,
    shiftBreakdown,
    scrapByReason,
    downtimeByReason,
    filteredRecords,
  } = metrics;

  const maxHourlyBar = Math.max(100, ...hourlySeries.map((h) => Math.max(h.actual, h.target)));
  const maxShiftBar = Math.max(100, ...shiftBreakdown.map((s) => Math.max(s.actual, s.target)));
  const maxMachineBar = Math.max(
    100,
    ...machineRows.filter((m) => m.actual > 0 || m.target > 0).map((m) => Math.max(m.actual, m.target))
  );
  const activeMachineCharts = machineRows.filter((m) => m.actual > 0 || m.target > 0).slice(0, 12);
  const recentEntries = useMemo(() => filteredRecords.slice(0, 12), [filteredRecords]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Compact Filter Bar + 5-Second Live Sync Indicator */}
      <section className="surface-card dashboard-hero-bar" aria-label="Dashboard filters">
        <div className="filter-bar">
          <div className="field-group">
            <label className="field-label" htmlFor="dash-plant">Plant</label>
            <select
              id="dash-plant"
              className="field-select"
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
            >
              {PLANTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="dash-date">Date</label>
            <input
              id="dash-date"
              type="date"
              className="field-input tabular"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="dash-shift">Shift</label>
            <select
              id="dash-shift"
              className="field-select"
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
            >
              <option value="ALL">All Shifts (Full Day)</option>
              {SHIFTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="dash-group">Machine Group</label>
            <select
              id="dash-group"
              className="field-select"
              value={machineGroup}
              onChange={(e) => setMachineGroup(e.target.value)}
            >
              <option value="ALL">All Machines</option>
              <option value="NC">NC Presses</option>
              <option value="Tandem">Tandem Lines</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onRetry} disabled={dataState === 'loading'}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>Sync Now</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 10, fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="live-dot" aria-hidden="true" />
            <Clock size={13} aria-hidden="true" />
            Live 5s Auto-Refresh •{' '}
            {lastSyncedAt
              ? `Last cloud sync: ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Awaiting initial cloud sync'}
          </span>
          <span className="status-pill is-ok">
            Active Shift: {liveShiftName} ({currentShiftMetrics.totals.actual.toLocaleString()} pcs)
          </span>
          {isStale && (
            <span className="status-pill is-warn">Offline / Stale data — retry sync recommended</span>
          )}
        </div>
      </section>

      {dataState === 'error' && (
        <div className="banner is-err" role="alert">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} aria-hidden="true" />
            {errorMessage || 'Failed to load dashboard data from cloud.'}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {dataState === 'loading' && <SkeletonCards />}

      {dataState !== 'loading' && (
        <>
          {/* 10 MANDATORY DASHBOARD KPI CARDS (ORANGE + GREEN INDUSTRIAL THEME) */}
          <section className="kpi-grid-5" aria-label="Plant production KPI cards">
            <button type="button" className="kpi-box is-orange-accent" onClick={() => onNavigate('production')}>
              <span className="kpi-head-row">
                <span className="kpi-label">Total Production</span>
                <Factory size={15} className="kpi-icon-orange" />
              </span>
              <div className="kpi-number tabular">
                {totals.actual.toLocaleString()}
                <span className="kpi-unit">pcs</span>
              </div>
              <span className="kpi-comparison tabular">
                Target: {totals.target.toLocaleString()} • Good: {totals.good.toLocaleString()}
              </span>
            </button>

            <button type="button" className="kpi-box is-green-accent" onClick={() => onNavigate('hourly-production')}>
              <span className="kpi-head-row">
                <span className="kpi-label">NC Production</span>
                <Layers size={15} className="kpi-icon-green" />
              </span>
              <div className="kpi-number tabular" style={{ color: 'var(--status-ok-ink)' }}>
                {ncTotals.actual.toLocaleString()}
                <span className="kpi-unit">pcs</span>
              </div>
              <span className="kpi-comparison tabular">
                Target: {ncTotals.target.toLocaleString()} ({ncTotals.achievementPct}%)
              </span>
            </button>

            <button type="button" className="kpi-box is-orange-accent" onClick={() => onNavigate('tandem-production')}>
              <span className="kpi-head-row">
                <span className="kpi-label">Tandem Production</span>
                <GitBranch size={15} className="kpi-icon-orange" />
              </span>
              <div className="kpi-number tabular" style={{ color: 'var(--accent-hover)' }}>
                {tandemTotals.actual.toLocaleString()}
                <span className="kpi-unit">pcs</span>
              </div>
              <span className="kpi-comparison tabular">
                Target: {tandemTotals.target.toLocaleString()} ({tandemTotals.achievementPct}%)
              </span>
            </button>

            <button type="button" className="kpi-box is-green-accent" onClick={() => onNavigate('production-summary')}>
              <span className="kpi-head-row">
                <span className="kpi-label">Production Achievement</span>
                <TrendingUp size={15} className="kpi-icon-green" />
              </span>
              <div className="kpi-number tabular">
                {totals.achievementPct}%
              </div>
              <span className="kpi-comparison tabular">
                Quality Rate: {totals.qualityPct}% • {totals.recordCount} entries
              </span>
            </button>

            <button type="button" className="kpi-box" onClick={() => onNavigate('production')}>
              <span className="kpi-head-row">
                <span className="kpi-label">Current Shift ({liveShiftName})</span>
                <Activity size={15} className="kpi-icon-orange" />
              </span>
              <div className="kpi-number tabular">
                {currentShiftMetrics.totals.actual.toLocaleString()}
                <span className="kpi-unit">pcs</span>
              </div>
              <span className="kpi-comparison tabular">
                Shift Ach: {currentShiftMetrics.totals.achievementPct}%
              </span>
            </button>

            <button type="button" className="kpi-box" onClick={() => onNavigate('machines')}>
              <span className="kpi-head-row">
                <span className="kpi-label">Total Machines</span>
                <Cpu size={15} className="kpi-icon-orange" />
              </span>
              <div className="kpi-number tabular">
                {machineCounts.total}
                <span className="kpi-unit">units</span>
              </div>
              <span className="kpi-comparison tabular">
                NC: {machines.filter((m) => m.machine_type === 'NC').length} • Tandem: {machines.filter((m) => m.machine_type === 'Tandem').length}
              </span>
            </button>

            <button type="button" className="kpi-box is-green-accent" onClick={() => onNavigate('cell-status')}>
              <span className="kpi-head-row">
                <span className="kpi-label">Active Machines</span>
                <Cpu size={15} className="kpi-icon-green" />
              </span>
              <div className="kpi-number tabular" style={{ color: 'var(--status-ok)' }}>
                {machineCounts.running}
                <span className="kpi-unit">/ {machineCounts.total}</span>
              </div>
              <span className="kpi-comparison tabular">
                Stopped/Idle: {machineCounts.stopped} • Maint: {machineCounts.maintenance}
              </span>
            </button>

            <button type="button" className="kpi-box" onClick={() => onNavigate('employees')}>
              <span className="kpi-head-row">
                <span className="kpi-label">Total Manpower</span>
                <Users size={15} className="kpi-icon-green" />
              </span>
              <div className="kpi-number tabular">
                {employeesCount}
                <span className="kpi-unit">staff</span>
              </div>
              <span className="kpi-comparison">Active plant roster</span>
            </button>

            <button type="button" className="kpi-box is-orange-accent" onClick={() => onNavigate('reports')}>
              <span className="kpi-head-row">
                <span className="kpi-label">Total Scrap</span>
                <AlertTriangle size={15} className="kpi-icon-orange" />
              </span>
              <div className="kpi-number tabular">
                {totals.rejected.toLocaleString()}
                <span className="kpi-unit">pcs</span>
              </div>
              <span className="kpi-comparison tabular">
                Scrap Rate: {totals.scrapPct}%
              </span>
            </button>

            <button type="button" className="kpi-box" onClick={() => onNavigate('machines')}>
              <span className="kpi-head-row">
                <span className="kpi-label">Total Downtime</span>
                <Clock size={15} className="kpi-icon-orange" />
              </span>
              <div className="kpi-number tabular">
                {totals.downtimeMinutes}
                <span className="kpi-unit">min</span>
              </div>
              <span className="kpi-comparison tabular">
                Machines affected: {totals.machinesAffected} • Problems: {totals.problemCount}
              </span>
            </button>
          </section>

          {totals.recordCount === 0 && dataState === 'ready' && (
            <div className="banner is-warn" role="status">
              <span>
                No hourly production entries have been logged yet for {selectedPlant} • {selectedDate} • {selectedShift}.
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('hourly-production')}>
                  Log NC Hourly
                </button>
                <button type="button" className="btn btn-green btn-sm" onClick={() => onNavigate('tandem-production')}>
                  Log Tandem
                </button>
              </div>
            </div>
          )}

          {/* CHARTS ROW 1: Hourly Production + Production Achievement Gauges */}
          <div className="dashboard-charts-2col">
            {/* Chart 1: Hourly Production */}
            <section className="surface-card" aria-labelledby="dash-hourly-title">
              <div className="section-header">
                <div>
                  <h2 id="dash-hourly-title" className="section-title">1. Hourly Production (Actual vs Target)</h2>
                  <p className="section-subtitle">{selectedDate} • {selectedShift}</p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('hourly-production')}>
                  Open Hourly Entry
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 8, alignItems: 'end', minHeight: 175, paddingTop: 12 }}>
                {hourlySeries.map((h) => {
                  const actH = h.actual > 0 ? Math.max(8, Math.round((h.actual / maxHourlyBar) * 124)) : 2;
                  const tgtH = h.target > 0 ? Math.max(8, Math.round((h.target / maxHourlyBar) * 124)) : 2;
                  const barColor = h.target === 0 ? 'var(--border-strong)' : h.actual >= h.target ? 'var(--status-ok)' : 'var(--accent)';
                  return (
                    <div key={h.hour} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span className="tabular" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-primary)' }}>
                        {h.actual}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 128 }}>
                        <div
                          title={`${h.hour_interval} Target: ${h.target}`}
                          style={{ width: 10, height: tgtH, background: '#cbd5e1', borderRadius: '3px 3px 0 0' }}
                        />
                        <div
                          title={`${h.hour_interval} Actual: ${h.actual} (${h.partsCount} part record(s))`}
                          style={{ width: 14, height: actH, background: barColor, borderRadius: '3px 3px 0 0' }}
                        />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontWeight: 600 }}>{h.shortLabel}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, fontSize: '0.76rem', color: 'var(--ink-secondary)' }}>
                <span>Gray bar: Target</span>
                <span style={{ color: 'var(--status-ok-ink)', fontWeight: 600 }}>Green bar: Met target</span>
                <span style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>Orange bar: Below target</span>
              </div>
            </section>

            {/* Chart 5: Production Achievement Gauges */}
            <section className="surface-card" aria-labelledby="dash-ach-title">
              <div className="section-header">
                <div>
                  <h2 id="dash-ach-title" className="section-title">2. Production Achievement</h2>
                  <p className="section-subtitle">Target performance across NC, Tandem, Shift &amp; Daily totals</p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('production-summary')}>
                  Full Summary
                </button>
              </div>
              <div className="gauges-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                <CircularGauge
                  size={98}
                  value={totals.achievementPct}
                  target={totals.target}
                  label="Filtered Total"
                  sublabel={`${totals.actual.toLocaleString()} pcs`}
                />
                <CircularGauge
                  size={98}
                  value={dayMetrics.ncTotals.achievementPct}
                  target={dayMetrics.ncTotals.target}
                  label="NC Presses"
                  sublabel={`${dayMetrics.ncTotals.actual.toLocaleString()} pcs`}
                />
                <CircularGauge
                  size={98}
                  value={dayMetrics.tandemTotals.achievementPct}
                  target={dayMetrics.tandemTotals.target}
                  label="Tandem Lines"
                  sublabel={`${dayMetrics.tandemTotals.actual.toLocaleString()} pcs`}
                />
                <CircularGauge
                  size={98}
                  value={dayMetrics.totals.achievementPct}
                  target={dayMetrics.totals.target}
                  label="Full Day"
                  sublabel={`${dayMetrics.totals.actual.toLocaleString()} pcs`}
                />
              </div>
            </section>
          </div>

          {/* CHARTS ROW 2: Shift-wise + NC vs Tandem + Machine-wise Production */}
          <div className="dashboard-charts-3col">
            {/* Chart 2: Shift-wise Production */}
            <section className="surface-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">3. Shift-Wise Production</h2>
                  <p className="section-subtitle">{selectedDate} — Shift A, B, C</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {shiftBreakdown.map((s) => {
                  const pctBar = maxShiftBar > 0 ? Math.min(100, Math.round((s.actual / maxShiftBar) * 100)) : 0;
                  const met = s.target > 0 && s.actual >= s.target;
                  return (
                    <div key={s.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                        <strong>{s.id}</strong>
                        <span className="tabular">
                          <strong>{s.actual.toLocaleString()}</strong> / {s.target.toLocaleString()} pcs ({s.achievementPct}%)
                        </span>
                      </div>
                      <div className="hbar-track">
                        <div
                          className="hbar-fill"
                          style={{
                            width: `${s.actual > 0 ? Math.max(4, pctBar) : 0}%`,
                            background: met ? 'var(--status-ok)' : 'var(--accent)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Chart 3: NC vs Tandem Comparison */}
            <section className="surface-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">4. NC vs Tandem Comparison</h2>
                  <p className="section-subtitle">Output &amp; quality comparison for {selectedDate}</p>
                </div>
              </div>
              {(() => {
                const totalBoth = dayMetrics.ncTotals.actual + dayMetrics.tandemTotals.actual;
                const ncShare = totalBoth > 0 ? Math.round((dayMetrics.ncTotals.actual / totalBoth) * 100) : 50;
                const tanShare = totalBoth > 0 ? 100 - ncShare : 50;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                        <span style={{ color: 'var(--status-ok-ink)', fontWeight: 700 }}>NC Share ({ncShare}%)</span>
                        <span style={{ color: 'var(--accent-hover)', fontWeight: 700 }}>Tandem Share ({tanShare}%)</span>
                      </div>
                      <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-subtle)' }}>
                        <div style={{ width: `${ncShare}%`, background: 'var(--status-ok)' }} />
                        <div style={{ width: `${tanShare}%`, background: 'var(--accent)' }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ padding: 10, borderRadius: 8, background: 'var(--status-ok-bg)', border: '1px solid var(--status-ok-border)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--status-ok-ink)' }}>NC PRESSES</div>
                        <div className="tabular" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                          {dayMetrics.ncTotals.actual.toLocaleString()}
                        </div>
                        <div className="tabular" style={{ fontSize: '0.74rem', color: 'var(--ink-secondary)' }}>
                          Ach: {dayMetrics.ncTotals.achievementPct}% • DT: {dayMetrics.ncTotals.downtimeMinutes}m
                        </div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 8, background: 'var(--accent-tint)', border: '1px solid var(--accent-border)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-hover)' }}>TANDEM LINES</div>
                        <div className="tabular" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                          {dayMetrics.tandemTotals.actual.toLocaleString()}
                        </div>
                        <div className="tabular" style={{ fontSize: '0.74rem', color: 'var(--ink-secondary)' }}>
                          Ach: {dayMetrics.tandemTotals.achievementPct}% • DT: {dayMetrics.tandemTotals.downtimeMinutes}m
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* Chart 4: Machine-wise Production */}
            <section className="surface-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">5. Machine-Wise Production</h2>
                  <p className="section-subtitle">Active production output across machines</p>
                </div>
              </div>
              {activeMachineCharts.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>No machine output recorded for the selected filters.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeMachineCharts.map((m) => {
                    const widthPct = maxMachineBar > 0 ? Math.min(100, Math.round((m.actual / maxMachineBar) * 100)) : 0;
                    const met = m.target > 0 && m.actual >= m.target;
                    return (
                      <div key={m.machine_number}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 2 }}>
                          <strong className="mono">{m.machine_number}</strong>
                          <span className="tabular">{m.actual.toLocaleString()} / {m.target.toLocaleString()} ({m.achievement_pct}%)</span>
                        </div>
                        <div className="hbar-track">
                          <div
                            className="hbar-fill"
                            style={{
                              width: `${m.actual > 0 ? Math.max(4, widthPct) : 0}%`,
                              background: met ? 'var(--status-ok)' : 'var(--accent)',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* CHARTS ROW 3: Scrap Analysis + Downtime Analysis */}
          <div className="dashboard-charts-2col">
            {/* Chart 6: Scrap Analysis */}
            <section className="surface-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">6. Scrap Analysis by Reason</h2>
                  <p className="section-subtitle">Total Scrap: {totals.rejected.toLocaleString()} pcs ({totals.scrapPct}% of output)</p>
                </div>
              </div>
              {scrapByReason.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>Zero scrap recorded for current selection.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {scrapByReason.slice(0, 6).map((item) => (
                    <div key={item.reason}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                        <span>{item.reason}</span>
                        <span className="tabular"><strong>{item.qty} pcs</strong> ({item.pct}%)</span>
                      </div>
                      <div className="hbar-track">
                        <div className="hbar-fill" style={{ width: `${Math.max(4, item.pct)}%`, background: 'var(--accent)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Chart 7: Downtime Analysis */}
            <section className="surface-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">7. Downtime Analysis by Reason</h2>
                  <p className="section-subtitle">Total Downtime: {totals.downtimeMinutes} min ({totals.problemCount} problem(s))</p>
                </div>
              </div>
              {downtimeByReason.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>Zero downtime problems logged for current selection.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {downtimeByReason.slice(0, 6).map((item) => (
                    <div key={`${item.code}-${item.reason}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                        <span><strong className="mono">{item.code}</strong> — {item.reason}</span>
                        <span className="tabular"><strong>{item.minutes} min</strong> ({item.count}x • {item.pct}%)</span>
                      </div>
                      <div className="hbar-track">
                        <div className="hbar-fill" style={{ width: `${Math.max(4, item.pct)}%`, background: 'var(--status-err)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Live Machine Status Table */}
          <section className="surface-card" aria-labelledby="dash-machines-title">
            <div className="section-header">
              <div>
                <h2 id="dash-machines-title" className="section-title">Live Machine Status ({machineRows.length})</h2>
                <p className="section-subtitle">Output and targets aggregated from verified shift records</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('cell-status')}>
                Live Cell View
              </button>
            </div>

            <div className="table-scroll-wrap desktop-table-only">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>Group</th>
                    <th>Status</th>
                    <th>Tools Used</th>
                    <th>Output</th>
                    <th>Target</th>
                    <th>Achievement</th>
                    <th>Operator</th>
                    <th>Downtime</th>
                  </tr>
                </thead>
                <tbody>
                  {machineRows.map((m) => (
                    <tr key={m.machine_number}>
                      <td><strong className="mono">{m.machine_number}</strong></td>
                      <td>{m.machine_type} ({m.tonnage}T)</td>
                      <td><StatusBadge status={m.status} /></td>
                      <td className="mono" style={{ fontSize: '0.76rem' }}>{m.tool_number || '—'}</td>
                      <td className="tabular"><strong>{m.actual.toLocaleString()}</strong></td>
                      <td className="tabular">{m.target.toLocaleString()}</td>
                      <td className="tabular">{m.target > 0 ? `${m.achievement_pct}%` : '—'}</td>
                      <td>{m.operator || '—'}</td>
                      <td className="tabular">{m.downtime > 0 ? `${m.downtime} min` : '0 min'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-card-list">
              {machineRows.map((m) => (
                <div key={m.machine_number} className="mobile-entity-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong className="mono">{m.machine_number} • {m.machine_type}</strong>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="tabular" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
                    <span>Output: <strong>{m.actual.toLocaleString()}</strong> / {m.target.toLocaleString()}</span>
                    <span>Downtime: {m.downtime} min</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                    Operator: {m.operator || 'Unassigned'} • Tools: {m.tool_number || '—'}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Production Activity */}
          <section className="surface-card" aria-labelledby="dash-activity-title">
            <div className="section-header">
              <div>
                <h2 id="dash-activity-title" className="section-title">Recent Production Activity</h2>
                <p className="section-subtitle">Cloud-confirmed multi-part entries and pending queue items</p>
              </div>
            </div>

            {pendingQueue.length === 0 && recentEntries.length === 0 ? (
              <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
                No production activity recorded for the selected filters.
              </p>
            ) : (
              <>
                <div className="table-scroll-wrap desktop-table-only">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Machine</th>
                        <th>Hour</th>
                        <th>Part / Tool</th>
                        <th>Operator</th>
                        <th>Quantity</th>
                        <th>Sync Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingQueue.map((q) => (
                        <tr key={q.id}>
                          <td className="tabular">{new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td><strong>{q.payload.machine_or_line}</strong></td>
                          <td>{q.payload.hour_interval}</td>
                          <td className="mono">{q.payload.parts ? `${q.payload.parts.length} part(s)` : q.payload.tool_number || '—'}</td>
                          <td>{q.payload.operator_name || '—'}</td>
                          <td className="tabular">
                            {q.payload.parts
                              ? q.payload.parts.reduce((s, p) => s + (Number(p.actual_qty) || 0), 0)
                              : q.payload.actual_qty}{' '}
                            pcs
                          </td>
                          <td><span className={`status-pill ${q.status === 'offline' ? 'is-warn' : 'is-err'}`}>{q.status === 'offline' ? 'Offline (Queued)' : 'Failed to sync'}</span></td>
                        </tr>
                      ))}
                      {recentEntries.map((r) => (
                        <tr key={r.id || `${r.machine_or_line}-${r.hour_interval}-p${r.part_index}`}>
                          <td className="tabular">{r.entry_time || (r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}</td>
                          <td><strong className="mono">{r.machine_or_line}</strong></td>
                          <td>{r.hour_interval}</td>
                          <td className="mono">P{r.part_index}: {r.tool_number || '—'}</td>
                          <td>{r.operator_name || '—'}</td>
                          <td className="tabular"><strong>{r.actual_qty.toLocaleString()}</strong> / {r.target_qty.toLocaleString()} pcs</td>
                          <td><span className="status-pill is-ok">Saved</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-card-list">
                  {pendingQueue.map((q) => (
                    <div key={q.id} style={{ border: '1px solid var(--status-warn-border)', background: 'var(--status-warn-bg)', borderRadius: 'var(--radius-md)', padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{q.payload.machine_or_line} • {q.payload.hour_interval}</strong>
                        <span className="status-pill is-warn">Queued</span>
                      </div>
                      <div className="tabular" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                        {q.payload.operator_name || 'Operator'}
                      </div>
                    </div>
                  ))}
                  {recentEntries.map((r) => (
                    <div key={r.id || `${r.machine_or_line}-${r.hour_interval}-p${r.part_index}`} className="mobile-entity-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{r.machine_or_line} • {r.hour_interval} (P{r.part_index})</strong>
                        <span className="status-pill is-ok">Saved</span>
                      </div>
                      <div className="tabular" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                        {r.actual_qty.toLocaleString()} / {r.target_qty.toLocaleString()} pcs • Tool: {r.tool_number || '—'} • {r.operator_name || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
