import React, { useMemo, useState } from 'react';
import { RefreshCw, LogOut } from 'lucide-react';
import { computeProductionMetrics } from '../services/metrics';
import LiveClock from './LiveClock';

export default function LiveCellStatusView({
  kioskMode = false,
  selectedPlant = 'Plant 1',
  selectedDate,
  selectedShift,
  machines,
  records,
  downtimes,
  dataState,
  lastSyncedAt,
  isOnline,
  onRefresh,
  onExitKiosk,
}) {
  const [groupFilter, setGroupFilter] = useState('ALL');

  const metrics = useMemo(
    () =>
      computeProductionMetrics(records, machines, downtimes, {
        plant: selectedPlant,
        date: selectedDate,
        shift: selectedShift,
        machineGroup: groupFilter,
      }),
    [records, machines, downtimes, selectedPlant, selectedDate, selectedShift, groupFilter]
  );

  const { totals, machineCounts, machines: machineRows } = metrics;

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {kioskMode && (
        <header className="surface-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div className="brand-lockup">
            <div className="brand-mark brand-mark-accent" aria-hidden="true">PHA</div>
            <div>
              <div className="brand-kicker">PHA INDIA PRIVATE LIMITED • {selectedPlant}</div>
              <h1 className="brand-title">Live Cell Status Display — {selectedShift}</h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <LiveClock />
            <span className={`status-pill ${isOnline ? 'is-ok' : 'is-err'}`}>
              {isOnline ? 'Cloud Live' : 'Offline'}
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onExitKiosk}>
              <LogOut size={14} aria-hidden="true" />
              <span>Exit Display</span>
            </button>
          </div>
        </header>
      )}

      {/* Controls & Read-Only Production Totals */}
      <section className="surface-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Filter machine group">
            {[
              { id: 'ALL', label: 'All Units' },
              { id: 'NC', label: 'NC Presses (16)' },
              { id: 'Tandem', label: 'Tandem Lines (6)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${groupFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setGroupFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
            <span className="tabular">
              {selectedPlant} • {selectedDate} • {selectedShift}
            </span>
            <span className="tabular">
              {lastSyncedAt
                ? `Updated ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Loading...'}
            </span>
            {!kioskMode && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>
                <RefreshCw size={14} aria-hidden="true" />
                <span>Refresh</span>
              </button>
            )}
          </div>
        </div>

        <div className="kpi-grid-4" style={{ marginTop: 14 }}>
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <span className="kpi-label">Shift Output</span>
            <div className="kpi-number tabular">
              {dataState === 'loading' ? '—' : totals.actual.toLocaleString()}
              <span className="kpi-unit">pcs</span>
            </div>
            <span className="kpi-comparison tabular">Target: {totals.target.toLocaleString()} pcs ({totals.achievementPct}%)</span>
          </div>
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <span className="kpi-label">Running Machines</span>
            <div className="kpi-number tabular" style={{ color: 'var(--status-ok-ink)' }}>
              {dataState === 'loading' ? '—' : machineCounts.running}
              <span className="kpi-unit">/ {machineCounts.total}</span>
            </div>
            <span className="kpi-comparison tabular">Maintenance: {machineCounts.maintenance}</span>
          </div>
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <span className="kpi-label">Stopped / Idle</span>
            <div className="kpi-number tabular" style={{ color: machineCounts.stopped > 0 ? 'var(--status-warn-ink)' : 'var(--ink-primary)' }}>
              {dataState === 'loading' ? '—' : machineCounts.stopped}
            </div>
            <span className="kpi-comparison">Active stoppages tracked</span>
          </div>
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <span className="kpi-label">Total Downtime</span>
            <div className="kpi-number tabular">
              {dataState === 'loading' ? '—' : totals.downtimeMinutes}
              <span className="kpi-unit">min</span>
            </div>
            <span className="kpi-comparison tabular">Good parts: {totals.good.toLocaleString()} pcs</span>
          </div>
        </div>
      </section>

      {/* Machine Cell Grid (Strict Read-Only Status Display) */}
      {dataState === 'loading' ? (
        <div className="surface-card">
          <div className="skeleton-line" style={{ height: 220, width: '100%' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {machineRows.map((m) => {
            const pillClass =
              m.status === 'Running' ? 'is-ok' : m.status === 'Maintenance' || m.status === 'Idle' ? 'is-warn' : 'is-err';
            return (
              <article
                key={m.machine_number}
                className="surface-card"
                style={{
                  padding: 14,
                  borderColor: m.status === 'Breakdown' ? 'var(--status-err-border)' : 'var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: '1rem' }}>{m.machine_number}</strong>
                    <span style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginLeft: 8 }}>
                      {m.machine_type} • {m.tonnage}T
                    </span>
                  </div>
                  <span className={`status-pill ${pillClass}`}>{m.status}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--bg-subtle)', padding: 10, borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', fontWeight: 600 }}>SHIFT TOTAL</div>
                    <div className="tabular" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                      {m.target > 0 ? `${m.total_output_pct}%` : '0%'}
                    </div>
                    <div className="tabular" style={{ fontSize: '0.74rem', color: 'var(--ink-secondary)' }}>
                      {m.actual.toLocaleString()} / {m.target.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', fontWeight: 600 }}>LATEST HOUR</div>
                    <div className="tabular" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                      {m.hourly_target > 0 ? `${m.hourly_output_pct}%` : '—'}
                    </div>
                    <div className="tabular" style={{ fontSize: '0.74rem', color: 'var(--ink-secondary)' }}>
                      {m.hourly_actual.toLocaleString()} / {m.hourly_target.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                  <span>Operator: {m.operator || 'Unassigned'}</span>
                  <span className="tabular">DT: {m.downtime}m</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  if (kioskMode) {
    return <main className="kiosk-shell">{content}</main>;
  }
  return content;
}
