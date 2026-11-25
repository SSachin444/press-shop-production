import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, Save } from 'lucide-react';
import { HOUR_SLOTS, DEFAULT_DOWNTIME_CODES, SHIFTS } from '../services/metrics';
import { cloudApi } from '../services/cloudClient';
import { createSubmissionId } from '../services/syncQueue';

export default function HourlyEntryView({
  selectedPlant,
  selectedDate,
  setSelectedDate,
  selectedShift,
  setSelectedShift,
  machines,
  records,
  downtimeCodes,
  currentUser,
  onEntrySaved,
}) {
  const machineOptions = useMemo(
    () => (machines || []).map((m) => m.machine_number),
    [machines]
  );

  const [selectedMachine, setSelectedMachine] = useState('NC-01');
  const [selectedHour, setSelectedHour] = useState(HOUR_SLOTS[0].label);
  const [operatorName, setOperatorName] = useState(
    currentUser?.role === 'Operator' ? currentUser.full_name || '' : ''
  );
  const [toolNumber, setToolNumber] = useState('');
  // Controlled string inputs so users can select all, replace, and clear to "" cleanly (never stuck on "0")
  const [uphInput, setUphInput] = useState('10');
  const [actualInput, setActualInput] = useState('');
  const [rejectedInput, setRejectedInput] = useState('');
  const [downtimeInput, setDowntimeInput] = useState('');
  const [downtimeCode, setDowntimeCode] = useState('D01');
  const [remarks, setRemarks] = useState('');

  const [roster, setRoster] = useState([]);
  const [syncStatus, setSyncStatus] = useState({ state: 'idle', message: '' }); // idle | saving | saved | offline | failed
  const [pendingSubmissionId, setPendingSubmissionId] = useState(() => createSubmissionId());
  const [lastPayload, setLastPayload] = useState(null);

  const codes = downtimeCodes && downtimeCodes.length > 0 ? downtimeCodes : DEFAULT_DOWNTIME_CODES;

  useEffect(() => {
    cloudApi
      .getOperationalRoster()
      .then((list) => setRoster(list || []))
      .catch(() => setRoster([]));
  }, []);

  useEffect(() => {
    if (machineOptions.length > 0 && !machineOptions.includes(selectedMachine)) {
      setSelectedMachine(machineOptions[0]);
    }
  }, [machineOptions, selectedMachine]);

  const machineRecords = useMemo(
    () =>
      (records || []).filter(
        (r) =>
          String(r.machine_or_line || '').toUpperCase() === selectedMachine.toUpperCase() &&
          r.date === selectedDate &&
          r.shift === selectedShift
      ),
    [records, selectedMachine, selectedDate, selectedShift]
  );

  // Prefill existing saved hour when machine/hour/shift changes
  useEffect(() => {
    const existing = machineRecords.find(
      (r) =>
        r.hour_interval === selectedHour ||
        String(r.hour_interval || '').includes(selectedHour.split(' (')[0])
    );
    if (existing) {
      setOperatorName(existing.operator_name || operatorName);
      setToolNumber(existing.tool_number || '');
      setUphInput(existing.uph ? String(existing.uph) : uphInput);
      setActualInput(String(existing.actual_qty ?? ''));
      setRejectedInput(existing.rejected_qty ? String(existing.rejected_qty) : '');
      setDowntimeInput(existing.downtime_minutes ? String(existing.downtime_minutes) : '');
      setDowntimeCode(existing.downtime_code || 'D01');
      setRemarks(existing.remarks || '');
    } else {
      setActualInput('');
      setRejectedInput('');
      setDowntimeInput('');
      setRemarks('');
    }
    setPendingSubmissionId(createSubmissionId());
    setSyncStatus({ state: 'idle', message: '' });
  }, [selectedMachine, selectedHour, selectedDate, selectedShift]);

  const parsedUph = uphInput.trim() === '' ? NaN : Number(uphInput);
  const parsedActual = actualInput.trim() === '' ? NaN : Number(actualInput);
  const parsedRejected = rejectedInput.trim() === '' ? 0 : Number(rejectedInput);
  const parsedDowntime = downtimeInput.trim() === '' ? 0 : Number(downtimeInput);

  const calculatedTarget = Number.isFinite(parsedUph) && parsedUph > 0 ? Math.round(parsedUph * 60) : 0;
  const goodQty = Number.isFinite(parsedActual) ? Math.max(0, parsedActual - (Number.isFinite(parsedRejected) ? parsedRejected : 0)) : 0;

  const validateAndBuildPayload = () => {
    if (!selectedMachine) return { error: 'Please select a machine.' };
    if (!selectedHour) return { error: 'Please select an hour interval.' };
    if (!operatorName.trim()) return { error: 'Operator name or ID is required.' };
    if (!toolNumber.trim()) return { error: 'Tool number is required.' };
    if (!Number.isFinite(parsedUph) || parsedUph <= 0 || parsedUph > 2000) {
      return { error: 'Enter a valid UPH rate greater than 0.' };
    }
    if (actualInput.trim() === '' || !Number.isInteger(parsedActual) || parsedActual < 0 || parsedActual > 100000) {
      return { error: 'Enter a valid whole number for Actual Quantity (0 to 100,000).' };
    }
    if (!Number.isInteger(parsedRejected) || parsedRejected < 0 || parsedRejected > parsedActual) {
      return { error: 'Rejected / Scrap quantity cannot be negative or exceed Actual Quantity.' };
    }
    if (!Number.isInteger(parsedDowntime) || parsedDowntime < 0 || parsedDowntime > 60) {
      return { error: 'Hourly downtime minutes must be between 0 and 60.' };
    }

    const matchedCode = codes.find((c) => c.code === downtimeCode);
    const pct = calculatedTarget > 0 ? Number(((parsedActual / calculatedTarget) * 100).toFixed(1)) : 0;
    const isTandem = selectedMachine.startsWith('LP') || selectedMachine.startsWith('HP');

    return {
      payload: {
        client_submission_id: pendingSubmissionId,
        plant_id: selectedPlant,
        production_type: isTandem ? 'Tandem' : 'NC',
        machine_or_line: selectedMachine,
        date: selectedDate,
        shift: selectedShift,
        hour_interval: selectedHour,
        operator_name: operatorName.trim(),
        tool_number: toolNumber.trim().toUpperCase(),
        uph: parsedUph,
        target_qty: calculatedTarget,
        actual_qty: parsedActual,
        good_qty: goodQty,
        rejected_qty: parsedRejected,
        downtime_minutes: parsedDowntime,
        downtime_code: downtimeCode,
        downtime_reason: parsedDowntime > 0 ? matchedCode?.name || 'Downtime' : '',
        remarks: remarks.trim(),
        production_pct: pct,
        hourly_output_pct: pct,
        entry_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
    };
  };

  const executeSubmit = async (payloadToSend) => {
    setSyncStatus({ state: 'saving', message: 'Saving production entry to cloud...' });
    try {
      await cloudApi.submitProductionEntry(payloadToSend);
      setSyncStatus({
        state: 'saved',
        message: `Saved ${payloadToSend.machine_or_line} (${payloadToSend.hour_interval}): ${payloadToSend.actual_qty} pcs confirmed.`,
      });
      setPendingSubmissionId(createSubmissionId());
      setLastPayload(null);
      if (onEntrySaved) onEntrySaved();
    } catch (err) {
      setLastPayload(payloadToSend);
      if (err.isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setSyncStatus({
          state: 'offline',
          message: 'Offline: entry queued locally and will sync automatically when online.',
        });
      } else {
        setSyncStatus({
          state: 'failed',
          message: `Failed to sync: ${err.message || 'Cloud error'}. Safe retry preserves no duplicates.`,
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (syncStatus.state === 'saving') return;
    const { payload, error } = validateAndBuildPayload();
    if (error) {
      setSyncStatus({ state: 'failed', message: error });
      return;
    }
    await executeSubmit(payload);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="surface-card" aria-labelledby="hourly-entry-heading">
        <div className="section-header">
          <div>
            <h2 id="hourly-entry-heading" className="section-title">Hourly Production Entry</h2>
            <p className="section-subtitle">
              Shift target is calculated automatically from UPH (UPH × 60). Leave fields clear until confirmed.
            </p>
          </div>
          {syncStatus.state !== 'idle' && (
            <span
              role="status"
              aria-live="polite"
              className={`status-pill ${
                syncStatus.state === 'saved'
                  ? 'is-ok'
                  : syncStatus.state === 'saving' || syncStatus.state === 'offline'
                  ? 'is-warn'
                  : 'is-err'
              }`}
            >
              {syncStatus.state === 'saving' && 'Saving...'}
              {syncStatus.state === 'saved' && 'Saved'}
              {syncStatus.state === 'offline' && 'Offline (Queued)'}
              {syncStatus.state === 'failed' && 'Failed to sync'}
            </span>
          )}
        </div>

        {syncStatus.message && (
          <div
            role={syncStatus.state === 'failed' ? 'alert' : 'status'}
            aria-live="polite"
            className={`banner ${
              syncStatus.state === 'saved'
                ? 'is-ok'
                : syncStatus.state === 'saving' || syncStatus.state === 'offline'
                ? 'is-warn'
                : 'is-err'
            }`}
            style={{ marginBottom: 14 }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {syncStatus.state === 'saved' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {syncStatus.message}
            </span>
            {syncStatus.state === 'failed' && lastPayload && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => executeSubmit(lastPayload)}
              >
                <RefreshCw size={14} />
                <span>Retry Sync</span>
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Context Row */}
          <div className="filter-bar" style={{ marginBottom: 14 }}>
            <div className="field-group">
              <label className="field-label" htmlFor="entry-date">Date</label>
              <input
                id="entry-date"
                type="date"
                className="field-input tabular"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="entry-shift">Shift</label>
              <select
                id="entry-shift"
                className="field-select"
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
              >
                {SHIFTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.id}</option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="entry-machine">Machine *</label>
              <select
                id="entry-machine"
                className="field-select"
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
              >
                {machineOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="entry-hour">Hour Interval *</label>
              <select
                id="entry-hour"
                className="field-select"
                value={selectedHour}
                onChange={(e) => setSelectedHour(e.target.value)}
              >
                {HOUR_SLOTS.map((h) => (
                  <option key={h.key} value={h.label}>{h.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Shopfloor Entry Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div className="field-group">
              <label className="field-label" htmlFor="entry-actual">Actual Quantity (pcs) *</label>
              <input
                id="entry-actual"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="field-input tabular"
                value={actualInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d+$/.test(v)) setActualInput(v);
                }}
                onFocus={(e) => e.target.select()}
                placeholder="Enter produced pcs"
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="entry-uph">UPH Rate (Target: {calculatedTarget} pcs) *</label>
              <input
                id="entry-uph"
                type="text"
                inputMode="decimal"
                className="field-input tabular"
                value={uphInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setUphInput(v);
                }}
                onFocus={(e) => e.target.select()}
                placeholder="e.g. 10"
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="entry-operator">Operator Name *</label>
              <input
                id="entry-operator"
                type="text"
                list="operator-roster-list"
                className="field-input"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="Operator name"
                required
              />
              <datalist id="operator-roster-list">
                {roster.map((op) => (
                  <option key={op.emp_id} value={op.name}>{op.emp_id}</option>
                ))}
              </datalist>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="entry-tool">Tool / Die Number *</label>
              <input
                id="entry-tool"
                type="text"
                className="field-input mono"
                value={toolNumber}
                onChange={(e) => setToolNumber(e.target.value.toUpperCase())}
                placeholder="e.g. TL-1001"
                required
              />
            </div>
          </div>

          {/* Quality & Downtime Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div className="field-group">
              <label className="field-label" htmlFor="entry-scrap">Scrap / Rejected (pcs)</label>
              <input
                id="entry-scrap"
                type="text"
                inputMode="numeric"
                className="field-input tabular"
                value={rejectedInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d+$/.test(v)) setRejectedInput(v);
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
              />
            </div>

            <div className="field-group">
              <label className="field-label">Good Parts (Calculated)</label>
              <div className="field-input tabular" style={{ background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                {Number.isFinite(parsedActual) ? `${goodQty.toLocaleString()} pcs` : '—'}
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="entry-dt-mins">Downtime (Minutes)</label>
              <input
                id="entry-dt-mins"
                type="text"
                inputMode="numeric"
                className="field-input tabular"
                value={downtimeInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d+$/.test(v)) setDowntimeInput(v);
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="entry-dt-code">Downtime Code</label>
              <select
                id="entry-dt-code"
                className="field-select"
                value={downtimeCode}
                onChange={(e) => setDowntimeCode(e.target.value)}
              >
                {codes.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="entry-remarks">Remarks</label>
              <input
                id="entry-remarks"
                type="text"
                className="field-input"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional note"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={syncStatus.state === 'saving'}>
              <Save size={16} aria-hidden="true" />
              <span>{syncStatus.state === 'saving' ? 'Saving...' : 'Save production entry'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Shift 8-Hour Matrix */}
      <section className="surface-card" aria-labelledby="matrix-heading">
        <div className="section-header">
          <div>
            <h2 id="matrix-heading" className="section-title">
              {selectedMachine} — {selectedShift} Hourly Log ({selectedDate})
            </h2>
          </div>
        </div>

        <div className="table-scroll-wrap desktop-table-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hour</th>
                <th>Tool</th>
                <th>Operator</th>
                <th>Target</th>
                <th>Actual</th>
                <th>Scrap</th>
                <th>Downtime</th>
                <th>Entry Time</th>
              </tr>
            </thead>
            <tbody>
              {HOUR_SLOTS.map((slot) => {
                const rec = machineRecords.find(
                  (r) => r.hour_interval === slot.label || String(r.hour_interval || '').includes(slot.key)
                );
                return (
                  <tr
                    key={slot.key}
                    onClick={() => setSelectedHour(slot.label)}
                    style={{ cursor: 'pointer', background: selectedHour === slot.label ? 'var(--accent-tint)' : undefined }}
                  >
                    <td><strong>{slot.label}</strong></td>
                    <td className="mono">{rec?.tool_number || '—'}</td>
                    <td>{rec?.operator_name || '—'}</td>
                    <td className="tabular">{rec ? `${rec.target_qty} pcs` : '—'}</td>
                    <td className="tabular"><strong>{rec ? `${rec.actual_qty} pcs` : '—'}</strong></td>
                    <td className="tabular">{rec ? rec.rejected_qty : '—'}</td>
                    <td className="tabular">{rec ? `${rec.downtime_minutes}m` : '—'}</td>
                    <td className="tabular">{rec?.entry_time || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mobile-card-list">
          {HOUR_SLOTS.map((slot) => {
            const rec = machineRecords.find(
              (r) => r.hour_interval === slot.label || String(r.hour_interval || '').includes(slot.key)
            );
            return (
              <button
                key={slot.key}
                type="button"
                onClick={() => setSelectedHour(slot.label)}
                style={{
                  textAlign: 'left',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: selectedHour === slot.label ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedHour === slot.label ? 'var(--accent-tint)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{slot.label}</strong>
                  <span className="tabular" style={{ fontWeight: 700 }}>
                    {rec ? `${rec.actual_qty} / ${rec.target_qty} pcs` : 'Not logged'}
                  </span>
                </div>
                {rec && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                    Tool: {rec.tool_number} • Operator: {rec.operator_name} • DT: {rec.downtime_minutes}m
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
