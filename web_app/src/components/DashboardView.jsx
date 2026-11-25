import React, { useMemo } from 'react';
import { RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { PLANTS, SHIFTS, computeProductionMetrics } from '../services/metrics';
import { getSyncQueue } from '../services/syncQueue';

function StatusBadge({ status }) {
  const s = String(status || 'Idle');
  const cls =
    s === 'Running' ? 'is-ok' : s === 'Maintenance' || s === 'Idle' ? 'is-warn' : 'is-err';
  return <span className={`status-pill ${cls}`}>{s}</span>;
}

function SkeletonCards() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} aria-busy="true" aria-label="Loading dashboard">
      <div className="kpi-grid-4">
        {[1, 2, 3, 4].map((i) => (
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
  dataState, // 'loading' | 'ready' | 'error'
  errorMessage,
  lastSyncedAt,
  isStale,
  onRetry,
  onNavigate,
}) {
  const pendingQueue = getSyncQueue();

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

  const { totals, machineCounts, machines: machineRows, hourlySeries, filteredRecords } = metrics;
  const maxBar = Math.max(100, ...hourlySeries.map((h) => Math.max(h.actual, h.target)));
  const recentEntries = useMemo(() => filteredRecords.slice(0, 10), [filteredRecords]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Compact Filter Bar: Plant | Date | Shift | Machine group */}
      <section className="surface-card" aria-label="Dashboard filters">
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onRetry} disabled={dataState === 'loading'}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 10, fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Clock size={13} aria-hidden="true" />
            {lastSyncedAt
              ? `Last cloud update: ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Awaiting initial cloud sync'}
          </span>
          {isStale && (
            <span className="status-pill is-warn">Stale data — retry sync recommended</span>
          )}
        </div>
      </section>

      {/* Error State with Retry */}
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

      {/* Skeleton Loading State (Never flashes temporary zeros) */}
      {dataState === 'loading' && <SkeletonCards />}

      {/* Ready State */}
      {dataState !== 'loading' && (
        <>
          {/* 4 Primary KPI Cards */}
          <section className="kpi-grid-4" aria-label="Shift key metrics">
            <button type="button" className="kpi-box" onClick={() => onNavigate('production')}>
              <span className="kpi-label">Actual Production</span>
              <div className="kpi-number tabular">
                {totals.actual.toLocaleString()}
                <span className="kpi-unit">pcs</span>
              </div>
              <span className="kpi-comparison tabular">
                Target: {totals.target.toLocaleString()} pcs ({totals.achievementPct}%)
              </span>
            </button>

            <button type="button" className="kpi-box" onClick={() => onNavigate('reports')}>
              <span className="kpi-label">Good Parts &amp; Scrap</span>
              <div className="kpi-number tabular">
                {totals.good.toLocaleString()}
                <span className="kpi-unit">good</span>
              </div>
              <span className="kpi-comparison tabular">
                Scrap: {totals.rejected.toLocaleString()} pcs • Quality: {totals.qualityPct}%
              </span>
            </button>

            <button type="button" className="kpi-box" onClick={() => onNavigate('machines')}>
              <span className="kpi-label">Machine Status</span>
              <div className="kpi-number tabular">
                {machineCounts.running}
                <span className="kpi-unit">/ {machineCounts.total} running</span>
              </div>
              <span className="kpi-comparison tabular">
                Stopped/Idle: {machineCounts.stopped} • Maintenance: {machineCounts.maintenance}
              </span>
            </button>

            <button type="button" className="kpi-box" onClick={() => onNavigate('machines')}>
              <span className="kpi-label">Downtime</span>
              <div className="kpi-number tabular">
                {totals.downtimeMinutes}
                <span className="kpi-unit">min</span>
              </div>
              <span className="kpi-comparison tabular">
                Machines affected: {totals.machinesAffected}
              </span>
            </button>
          </section>

          {/* Empty vs Confirmed-Zero Clarification */}
          {totals.recordCount === 0 && dataState === 'ready' && (
            <div className="banner is-warn" role="status">
              <span>
                No hourly production entries have been logged yet for {selectedPlant} • {selectedDate} • {selectedShift}.
              </span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('hourly-production')}>
                Log Hourly Production
              </button>
            </div>
          )}

          {totals.recordCount > 0 && totals.actual === 0 && (
            <div className="banner is-warn" role="status">
              <span>
                {totals.recordCount} record(s) logged with confirmed output of 0 pcs for {selectedShift}.
              </span>
            </div>
          )}

          {/* Hourly Actual vs Target Output */}
          <section className="surface-card" aria-labelledby="dash-hourly-title">
            <div className="section-header">
              <div>
                <h2 id="dash-hourly-title" className="section-title">Hourly Actual vs Target Output</h2>
                <p className="section-subtitle">{selectedDate} • {selectedShift}</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('hourly-production')}>
                Open Hourly Entry
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 8, alignItems: 'end', minHeight: 170, paddingTop: 12 }}>
              {hourlySeries.map((h) => {
                const actH = h.actual > 0 ? Math.max(6, Math.round((h.actual / maxBar) * 120)) : 2;
                const tgtH = h.target > 0 ? Math.max(6, Math.round((h.target / maxBar) * 120)) : 2;
                const barColor = h.target === 0 ? 'var(--border-strong)' : h.actual >= h.target ? 'var(--status-ok)' : 'var(--accent)';
                return (
                  <div key={h.hour} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span className="tabular" style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--ink-primary)' }}>
                      {h.actual}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 125 }}>
                      <div
                        title={`${h.hour_interval} Target: ${h.target}`}
                        style={{ width: 10, height: tgtH, background: '#cbd5e1', borderRadius: '2px 2px 0 0' }}
                      />
                      <div
                        title={`${h.hour_interval} Actual: ${h.actual}`}
                        style={{ width: 14, height: actH, background: barColor, borderRadius: '2px 2px 0 0' }}
                      />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontWeight: 600 }}>{h.shortLabel}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, fontSize: '0.76rem', color: 'var(--ink-secondary)' }}>
              <span>Gray bar: Target</span>
              <span style={{ color: 'var(--status-ok-ink)' }}>Green bar: Met target</span>
              <span style={{ color: 'var(--accent-hover)' }}>Orange bar: Below target</span>
            </div>
          </section>

          {/* Live Machine Status */}
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
                      <td><strong>{m.machine_number}</strong></td>
                      <td>{m.machine_type} ({m.tonnage}T)</td>
                      <td><StatusBadge status={m.status} /></td>
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
                <div key={m.machine_number} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong>{m.machine_number} • {m.machine_type}</strong>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="tabular" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
                    <span>Output: <strong>{m.actual.toLocaleString()}</strong> / {m.target.toLocaleString()}</span>
                    <span>Downtime: {m.downtime} min</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                    Operator: {m.operator || 'Unassigned'}
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
                <p className="section-subtitle">Cloud-confirmed entries and pending queue items</p>
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
                          <td>{q.payload.operator_name || '—'}</td>
                          <td className="tabular">{q.payload.actual_qty} pcs</td>
                          <td><span className={`status-pill ${q.status === 'offline' ? 'is-warn' : 'is-err'}`}>{q.status === 'offline' ? 'Offline (Queued)' : 'Failed to sync'}</span></td>
                        </tr>
                      ))}
                      {recentEntries.map((r) => (
                        <tr key={r.id || `${r.machine_or_line}-${r.hour_interval}`}>
                          <td className="tabular">{r.entry_time || (r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}</td>
                          <td><strong>{r.machine_or_line}</strong></td>
                          <td>{r.hour_interval}</td>
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
                        {q.payload.actual_qty} pcs • {q.payload.operator_name || 'Operator'}
                      </div>
                    </div>
                  ))}
                  {recentEntries.map((r) => (
                    <div key={r.id || `${r.machine_or_line}-${r.hour_interval}`} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{r.machine_or_line} • {r.hour_interval}</strong>
                        <span className="status-pill is-ok">Saved</span>
                      </div>
                      <div className="tabular" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                        {r.actual_qty.toLocaleString()} / {r.target_qty.toLocaleString()} pcs • {r.operator_name || '—'}
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
