import React, { useState, useMemo } from 'react';
import { Download, Printer, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { PLANTS, filterProductionRecords, buildCsvDocument, deduplicateSlotDowntime } from '../services/metrics';

export default function ReportsView({ selectedPlant, selectedDate, machines, records, onRefresh }) {
  const [plant, setPlant] = useState(selectedPlant || 'ALL');
  const [fromDate, setFromDate] = useState(selectedDate);
  const [toDate, setToDate] = useState(selectedDate);
  const [shift, setShift] = useState('ALL');
  const [machineGroup, setMachineGroup] = useState('ALL');
  const [machine, setMachine] = useState('ALL');
  const [operator, setOperator] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState(null);

  const filteredRows = useMemo(
    () =>
      filterProductionRecords(records, {
        plant,
        fromDate,
        toDate,
        shift,
        machineGroup,
        machine,
        operator,
        search,
      }),
    [records, plant, fromDate, toDate, shift, machineGroup, machine, operator, search]
  );

  const totals = useMemo(() => {
    const actual = filteredRows.reduce((s, r) => s + r.actual_qty, 0);
    const target = filteredRows.reduce((s, r) => s + r.target_qty, 0);
    const good = filteredRows.reduce((s, r) => s + r.good_qty, 0);
    const rejected = filteredRows.reduce((s, r) => s + r.rejected_qty, 0);
    const { totalDowntimeMinutes } = deduplicateSlotDowntime(filteredRows);
    return {
      actual,
      target,
      good,
      rejected,
      downtime: totalDowntimeMinutes,
      achievementPct: target > 0 ? Number(((actual / target) * 100).toFixed(1)) : 0,
    };
  }, [filteredRows]);

  const clearFilters = () => {
    setPlant('ALL');
    setFromDate(selectedDate);
    setToDate(selectedDate);
    setShift('ALL');
    setMachineGroup('ALL');
    setMachine('ALL');
    setOperator('');
    setSearch('');
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      setNotice({ type: 'err', message: 'Cannot export an empty report. Adjust filters to include matching records.' });
      return;
    }

    try {
      const columns = [
        { key: 'plant_id', header: 'Plant' },
        { key: 'date', header: 'Date (YYYY-MM-DD)' },
        { key: 'shift', header: 'Shift' },
        { key: 'production_type', header: 'Group' },
        { key: 'machine_or_line', header: 'Machine' },
        { key: 'hour_interval', header: 'Hour Interval' },
        { key: 'part_index', header: 'Part #' },
        { key: 'tool_number', header: 'Tool Number' },
        { key: 'operator_name', header: 'Operator' },
        { key: 'uph', header: 'UPH' },
        { key: 'running_minutes', header: 'Running (min)' },
        { key: 'target_qty', header: 'Target (pcs)' },
        { key: 'actual_qty', header: 'Actual (pcs)' },
        { key: 'good_qty', header: 'Good (pcs)' },
        { key: 'rejected_qty', header: 'Scrap (pcs)' },
        {
          key: 'scrap_reasons',
          header: 'Scrap Reasons',
          accessor: (r) =>
            (r.scrap_breakdown || []).map((s) => `${s.reason_name}: ${s.qty}`).join('; '),
        },
        { key: 'achievement_pct', header: 'Achievement (%)' },
        { key: 'downtime_minutes', header: 'Downtime (min)' },
        { key: 'downtime_reason', header: 'Downtime Reason' },
      ];

      const summaryRow = {
        plant_id: 'TOTAL',
        date: `${fromDate} to ${toDate}`,
        shift,
        production_type: machineGroup,
        machine_or_line: `${filteredRows.length} records`,
        hour_interval: '',
        part_index: '',
        tool_number: '',
        operator_name: '',
        uph: '',
        running_minutes: '',
        target_qty: totals.target,
        actual_qty: totals.actual,
        good_qty: totals.good,
        rejected_qty: totals.rejected,
        scrap_reasons: '',
        achievement_pct: totals.achievementPct,
        downtime_minutes: totals.downtime,
        downtime_reason: '',
      };

      const csv = buildCsvDocument(columns, filteredRows, summaryRow);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeShift = shift === 'ALL' ? 'AllShifts' : shift.replace(/\s+/g, '');
      const safePlant = plant === 'ALL' ? 'AllPlants' : plant.replace(/\s+/g, '');
      const filename = `PHA_${safePlant}_Production_${fromDate}_to_${toDate}_${safeShift}.csv`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice({ type: 'ok', message: `Exported ${filteredRows.length} filtered record(s) to ${filename}.` });
    } catch (err) {
      setNotice({ type: 'err', message: `Export failed: ${err.message}` });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {notice && (
        <div className={`banner ${notice.type === 'ok' ? 'is-ok' : 'is-err'}`} role={notice.type === 'err' ? 'alert' : 'status'}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {notice.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {notice.message}
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <section className="surface-card no-print" aria-labelledby="reports-filter-heading">
        <div className="section-header">
          <div>
            <h2 id="reports-filter-heading" className="section-title">Production Reports &amp; Exports</h2>
            <p className="section-subtitle">
              All report summaries and exported CSV rows derive from the exact active filters below.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              <RotateCcw size={14} aria-hidden="true" />
              <span>Clear filters</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>
              <span>Refresh Data</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
              <Printer size={14} aria-hidden="true" />
              <span>Print</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
            >
              <Download size={14} aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="filter-bar">
          <div className="field-group">
            <label className="field-label" htmlFor="rep-plant">Plant</label>
            <select id="rep-plant" className="field-select" value={plant} onChange={(e) => setPlant(e.target.value)}>
              <option value="ALL">All Plants</option>
              {PLANTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="rep-from">From Date</label>
            <input id="rep-from" type="date" className="field-input tabular" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="rep-to">To Date</label>
            <input id="rep-to" type="date" className="field-input tabular" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="rep-shift">Shift</label>
            <select id="rep-shift" className="field-select" value={shift} onChange={(e) => setShift(e.target.value)}>
              <option value="ALL">All Shifts</option>
              <option value="Shift A">Shift A</option>
              <option value="Shift B">Shift B</option>
              <option value="Shift C">Shift C</option>
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="rep-group">Machine Group</label>
            <select id="rep-group" className="field-select" value={machineGroup} onChange={(e) => setMachineGroup(e.target.value)}>
              <option value="ALL">All Groups</option>
              <option value="NC">NC</option>
              <option value="Tandem">Tandem</option>
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="rep-machine">Machine</label>
            <select id="rep-machine" className="field-select" value={machine} onChange={(e) => setMachine(e.target.value)}>
              <option value="ALL">All Machines</option>
              {(machines || []).map((m) => (
                <option key={m.machine_number} value={m.machine_number}>{m.machine_number}</option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="rep-op">Operator</label>
            <input
              id="rep-op"
              type="text"
              className="field-input"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="Filter operator"
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="rep-search">Search</label>
            <input
              id="rep-search"
              type="text"
              className="field-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tool, reason, remarks..."
            />
          </div>
        </div>
      </section>

      {/* Pre-Export Scope & Totals Confirmation */}
      <section className="surface-card" aria-label="Filtered report totals">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
            <strong>Scope:</strong> Plant {plant} • {fromDate} to {toDate} • Shift: {shift} • Group: {machineGroup} • Machine: {machine}
            {operator ? ` • Operator: ${operator}` : ''}
          </div>
          <span className="status-pill is-ok tabular">{filteredRows.length} matching record(s)</span>
        </div>

        <div className="kpi-grid-4">
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <span className="kpi-label">Filtered Actual</span>
            <div className="kpi-number tabular">{totals.actual.toLocaleString()} <span className="kpi-unit">pcs</span></div>
            <span className="kpi-comparison tabular">Target: {totals.target.toLocaleString()} pcs ({totals.achievementPct}%)</span>
          </div>
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <span className="kpi-label">Filtered Good</span>
            <div className="kpi-number tabular">{totals.good.toLocaleString()} <span className="kpi-unit">pcs</span></div>
          </div>
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <span className="kpi-label">Filtered Scrap</span>
            <div className="kpi-number tabular">{totals.rejected.toLocaleString()} <span className="kpi-unit">pcs</span></div>
          </div>
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <span className="kpi-label">Filtered Downtime</span>
            <div className="kpi-number tabular">{totals.downtime} <span className="kpi-unit">min</span></div>
          </div>
        </div>
      </section>

      {/* Filtered Table / Mobile Cards */}
      <section className="surface-card">
        {filteredRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--ink-muted)' }}>
            No records match the current filter criteria.
          </div>
        ) : (
          <>
            <div className="table-scroll-wrap desktop-table-only">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Shift</th>
                    <th>Machine</th>
                    <th>Hour</th>
                    <th>Tool</th>
                    <th>Operator</th>
                    <th>Target</th>
                    <th>Actual</th>
                    <th>Good</th>
                    <th>Scrap</th>
                    <th>Ach %</th>
                    <th>Downtime</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={r.id || i}>
                      <td className="tabular">{r.date}</td>
                      <td>{r.shift}</td>
                      <td><strong>{r.machine_or_line}</strong></td>
                      <td>{r.hour_interval}</td>
                      <td className="mono">{r.tool_number || '—'}</td>
                      <td>{r.operator_name || '—'}</td>
                      <td className="tabular">{r.target_qty.toLocaleString()}</td>
                      <td className="tabular"><strong>{r.actual_qty.toLocaleString()}</strong></td>
                      <td className="tabular">{r.good_qty.toLocaleString()}</td>
                      <td className="tabular">{r.rejected_qty.toLocaleString()}</td>
                      <td className="tabular">{r.achievement_pct}%</td>
                      <td className="tabular">{r.downtime_minutes}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-card-list">
              {filteredRows.map((r, i) => (
                <div key={r.id || i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{r.machine_or_line} • {r.date}</strong>
                    <span className="tabular" style={{ fontWeight: 700 }}>{r.achievement_pct}%</span>
                  </div>
                  <div className="tabular" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    {r.shift} • {r.hour_interval} • {r.actual_qty}/{r.target_qty} pcs
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                    Tool: {r.tool_number || '—'} • Operator: {r.operator_name || '—'} • DT: {r.downtime_minutes}m
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
