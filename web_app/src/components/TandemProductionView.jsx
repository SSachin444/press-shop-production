import React, { useEffect, useMemo, useState } from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldAlert,
  X,
} from 'lucide-react';
import { getCapabilities } from '../config/roles';
import {
  HOUR_SLOTS,
  SHIFTS,
  TANDEM_LINES,
  calculateFullHourTargetFromUph,
  calculateTargetFromUph,
  computeProductionMetrics,
  computeTimeAllocationSummary,
  getAchievementTone,
  groupHourlyMachineEntries,
  validateDowntimeProblems,
  validateScrapReasons,
  validateTimeAllocation,
} from '../services/metrics';
import { cloudApi } from '../services/cloudClient';
import { createSubmissionId } from '../services/syncQueue';
import { DowntimeProblemsPanel, ScrapSectionPanel, ToolSelectorField } from './ProductionEntryParts';
import CircularGauge from './CircularGauge';

function createEmptyTandemPart(defaultMinutes = '60') {
  return {
    tool_number: '',
    part_name: '',
    uph: '',
    running_minutes: String(defaultMinutes),
    actual_qty: '',
    rejected_qty: '',
    scrap_breakdown: [],
  };
}

export default function TandemProductionView({
  selectedPlant,
  selectedDate,
  setSelectedDate,
  selectedShift,
  setSelectedShift,
  machines = [],
  tools = [],
  records = [],
  downtimes = [],
  downtimeCodes = [],
  currentUser,
  onEntrySaved,
}) {
  const caps = getCapabilities(currentUser?.role);

  // Combine machine directory Tandem lines with canonical 6 lines (LP-1, LP-2, HP-1, HP-2, HP-3, HP-4)
  const tandemLines = useMemo(() => {
    const dirTandem = (machines || []).filter((m) => m.machine_type === 'Tandem');
    const byId = new Map();
    TANDEM_LINES.forEach((def) => {
      byId.set(def.machine_number, {
        ...def,
        machine_type: 'Tandem',
        status: 'Idle',
        assigned_operator: '',
      });
    });
    dirTandem.forEach((m) => {
      const prev = byId.get(m.machine_number) || {};
      byId.set(m.machine_number, { ...prev, ...m });
    });
    return Array.from(byId.values());
  }, [machines]);

  const [selectedLine, setSelectedLine] = useState('LP-1');
  const [selectedHour, setSelectedHour] = useState(HOUR_SLOTS[0].label);
  const [allocationMode, setAllocationMode] = useState('simultaneous'); // 'simultaneous' | 'sequential'
  const [operatorName, setOperatorName] = useState(
    currentUser?.role === 'Operator' ? currentUser.full_name || '' : ''
  );
  const [parts, setParts] = useState([createEmptyTandemPart('60')]);
  const [downtimeProblems, setDowntimeProblems] = useState([]);
  const [remarks, setRemarks] = useState('');

  const [roster, setRoster] = useState([]);
  const [syncStatus, setSyncStatus] = useState({ state: 'idle', message: '' });
  const [pendingSubmissionId, setPendingSubmissionId] = useState(() => createSubmissionId());
  const [lastPayload, setLastPayload] = useState(null);
  const [deleteSlotTarget, setDeleteSlotTarget] = useState(null);
  const [deletingSlot, setDeletingSlot] = useState(false);

  useEffect(() => {
    cloudApi
      .getOperationalRoster()
      .then((list) => setRoster(list || []))
      .catch(() => setRoster([]));
  }, []);

  useEffect(() => {
    if (tandemLines.length > 0 && !tandemLines.some((l) => l.machine_number === selectedLine)) {
      setSelectedLine(tandemLines[0].machine_number);
    }
  }, [tandemLines, selectedLine]);

  const tandemMetrics = useMemo(
    () =>
      computeProductionMetrics(records, tandemLines, downtimes, {
        plant: selectedPlant,
        date: selectedDate,
        shift: selectedShift,
        machineGroup: 'Tandem',
      }),
    [records, tandemLines, downtimes, selectedPlant, selectedDate, selectedShift]
  );

  const lineHourlyGroups = useMemo(() => {
    const filtered = (records || []).filter(
      (r) =>
        String(r.machine_or_line || '').toUpperCase() === selectedLine.toUpperCase() &&
        r.date === selectedDate &&
        r.shift === selectedShift
    );
    return groupHourlyMachineEntries(filtered);
  }, [records, selectedLine, selectedDate, selectedShift]);

  // Prefill ONLY when user switches line/hour/date/shift
  useEffect(() => {
    const slotKey = selectedHour.split(' (')[0];
    const existingGroup = lineHourlyGroups.find(
      (g) => g.hour_interval === selectedHour || String(g.hour_interval || '').includes(slotKey)
    );
    if (existingGroup && existingGroup.parts.length > 0) {
      const sorted = [...existingGroup.parts]
        .slice(0, 4)
        .sort((a, b) => (a.part_index || 1) - (b.part_index || 1));
      setOperatorName(sorted[0].operator_name || operatorName);
      setParts(
        sorted.map((p) => ({
          tool_number: p.tool_number || '',
          part_name: p.part_name || '',
          uph: p.uph ? String(p.uph) : '',
          running_minutes: p.running_minutes ? String(p.running_minutes) : '60',
          actual_qty: String(p.actual_qty ?? ''),
          rejected_qty: p.rejected_qty ? String(p.rejected_qty) : '',
          scrap_breakdown: Array.isArray(p.scrap_breakdown) ? p.scrap_breakdown : [],
        }))
      );
      const loadedSum = sorted.reduce((s, p) => s + (Number(p.running_minutes) || 60), 0);
      if (sorted.length > 1 && loadedSum <= 60) {
        setAllocationMode('sequential');
      }
      setDowntimeProblems(sorted[0].downtime_problems || []);
      setRemarks(sorted[0].remarks || '');
    } else {
      setParts([createEmptyTandemPart('60')]);
      setDowntimeProblems([]);
      setRemarks('');
    }
    setPendingSubmissionId(createSubmissionId());
    setSyncStatus({ state: 'idle', message: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLine, selectedHour, selectedDate, selectedShift]);

  const timePool = useMemo(() => computeTimeAllocationSummary(parts, 60), [parts]);
  const isSequentialMode = allocationMode === 'sequential';

  const updatePart = (idx, patch) => {
    setParts((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const handleAddPart = () => {
    if (parts.length >= 4) return;
    if (isSequentialMode) {
      if (timePool.remainingMinutes <= 0) {
        setSyncStatus({
          state: 'failed',
          message: 'Remaining available time in this 60-minute hour is 0 minutes. Reduce an existing tool’s minutes first.',
        });
        return;
      }
      setParts((prev) => [...prev, createEmptyTandemPart(String(timePool.remainingMinutes))]);
    } else {
      setParts((prev) => [...prev, createEmptyTandemPart('60')]);
    }
  };

  const handleRemovePart = (idx) => {
    if (parts.length <= 1) return;
    setParts((prev) => prev.filter((_, i) => i !== idx));
  };

  const summary = useMemo(() => {
    const dtCheck = validateDowntimeProblems(downtimeProblems, 5, 60);
    let totalActual = 0;
    let totalTarget = 0;
    let totalScrap = 0;

    const partMetrics = parts.map((p) => {
      const uph = Number(p.uph) || 0;
      const runMin = p.running_minutes === '' ? 60 : Number(p.running_minutes) || 0;
      const fullHourTarget = calculateFullHourTargetFromUph(uph);
      const target = calculateTargetFromUph(uph, runMin);
      const actual = Number(p.actual_qty) || 0;
      const scrap = Number(p.rejected_qty) || 0;
      const good = Math.max(0, actual - scrap);
      const pct = target > 0 ? Number(((actual / target) * 100).toFixed(1)) : 0;
      totalActual += actual;
      totalTarget += target;
      totalScrap += scrap;
      return { fullHourTarget, target, runMin, actual, scrap, good, pct };
    });

    const totalGood = Math.max(0, totalActual - totalScrap);
    const combinedPct = totalTarget > 0 ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : 0;
    return {
      partMetrics,
      totalActual,
      totalTarget,
      totalScrap,
      totalGood,
      combinedPct,
      totalDowntime: dtCheck.totalMinutes,
    };
  }, [parts, downtimeProblems]);

  const validateAndBuildBatch = () => {
    if (!selectedDate) return { error: 'Please select a Date.' };
    if (!selectedShift) return { error: 'Please select a Shift.' };
    if (!operatorName.trim()) return { error: 'Operator name is required.' };
    if (!selectedLine) return { error: 'Select a Tandem line.' };

    if (isSequentialMode) {
      const timeCheck = validateTimeAllocation(parts, 60, true);
      if (!timeCheck.valid) return { error: timeCheck.error };
    }

    const dtCheck = validateDowntimeProblems(downtimeProblems, 5, 60);
    if (!dtCheck.valid) return { error: dtCheck.error };

    const normalizedParts = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const num = i + 1;
      const uph = p.uph.trim() === '' ? NaN : Number(p.uph);
      const runMin = p.running_minutes.trim() === '' ? 60 : Number(p.running_minutes);
      const actual = p.actual_qty.trim() === '' ? NaN : Number(p.actual_qty);
      const scrap = p.rejected_qty.trim() === '' ? 0 : Number(p.rejected_qty);

      if (!String(p.tool_number || '').trim()) {
        return { error: `Part ${num}: Tool Number is required.` };
      }
      if (!Number.isFinite(uph) || uph <= 0 || uph > 50000) {
        return { error: `Part ${num}: Enter a valid Machine Speed (UPH) greater than 0.` };
      }
      if (!Number.isFinite(runMin) || runMin <= 0 || runMin > 60) {
        return { error: `Part ${num}: Running duration must be between 1 and 60 minutes.` };
      }
      if (!Number.isInteger(actual) || actual < 0 || actual > 100000) {
        return { error: `Part ${num}: Enter a valid whole number for Actual Production.` };
      }
      if (!Number.isInteger(scrap) || scrap < 0 || scrap > actual) {
        return { error: `Part ${num}: Scrap cannot be negative or exceed Actual Production.` };
      }

      const scrapCheck = validateScrapReasons(scrap, p.scrap_breakdown || [], 5);
      if (!scrapCheck.valid) return { error: `Part ${num}: ${scrapCheck.error}` };

      normalizedParts.push({
        tool_number: String(p.tool_number).trim().toUpperCase(),
        part_name: String(p.part_name || '').trim(),
        uph,
        running_minutes: runMin,
        actual_qty: actual,
        rejected_qty: scrap,
        scrap_breakdown: scrapCheck.normalized,
      });
    }

    const lineObj = tandemLines.find((l) => l.machine_number === selectedLine);

    return {
      payload: {
        isBatch: true,
        tandem_mode: allocationMode,
        client_submission_id: pendingSubmissionId,
        plant_id: selectedPlant,
        production_type: 'Tandem',
        machine_or_line: selectedLine,
        date: selectedDate,
        shift: selectedShift,
        hour_interval: selectedHour,
        operator_name: operatorName.trim(),
        tonnage: lineObj?.tonnage || 1200,
        parts: normalizedParts,
        downtime_problems: dtCheck.normalized,
        remarks: remarks.trim(),
        entry_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
    };
  };

  const executeSubmit = async (payloadToSend) => {
    setSyncStatus({ state: 'saving', message: 'Saving Tandem line parts to cloud...' });
    try {
      await cloudApi.submitProductionBatch(payloadToSend);
      setSyncStatus({
        state: 'saved',
        message: `Saved ${payloadToSend.machine_or_line} (${payloadToSend.hour_interval}): ${payloadToSend.parts.length} part(s), ${summary.totalActual.toLocaleString()} pcs total.`,
      });
      setPendingSubmissionId(createSubmissionId());
      setLastPayload(null);
      if (onEntrySaved) await onEntrySaved();
    } catch (err) {
      setLastPayload(payloadToSend);
      if (err.isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setSyncStatus({
          state: 'offline',
          message: 'Offline: Tandem entry queued safely for automatic cloud sync.',
        });
      } else {
        setSyncStatus({
          state: 'failed',
          message: `Failed to sync: ${err.message || 'Cloud error'}. Retry preserves no duplicates.`,
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (syncStatus.state === 'saving') return;
    const { payload, error } = validateAndBuildBatch();
    if (error) {
      setSyncStatus({ state: 'failed', message: error });
      return;
    }
    await executeSubmit(payload);
  };

  const handleConfirmDeleteSlot = async () => {
    if (!deleteSlotTarget || !caps.canDeleteProduction) return;
    setDeletingSlot(true);
    try {
      await cloudApi.deleteHourlyProductionSlot({
        date: selectedDate,
        shift: selectedShift,
        machine_or_line: selectedLine,
        hour_interval: deleteSlotTarget.hour_interval,
      });
      setSyncStatus({
        state: 'saved',
        message: `Deleted Tandem hourly entry for ${selectedLine} (${deleteSlotTarget.hour_interval}).`,
      });
      if (deleteSlotTarget.hour_interval === selectedHour) {
        setParts([createEmptyTandemPart('60')]);
        setDowntimeProblems([]);
        setRemarks('');
      }
      setDeleteSlotTarget(null);
      if (onEntrySaved) await onEntrySaved();
    } catch (err) {
      setSyncStatus({ state: 'failed', message: err?.message || 'Unable to delete Tandem hourly entry.' });
      setDeleteSlotTarget(null);
    } finally {
      setDeletingSlot(false);
    }
  };

  const selectedLineMetrics =
    tandemMetrics.machines.find((m) => m.machine_number === selectedLine) || {
      actual: 0,
      target: 0,
      good: 0,
      rejected: 0,
      achievement_pct: 0,
      downtime_minutes: 0,
    };

  const tone = getAchievementTone(summary.combinedPct, summary.totalTarget);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Dedicated Tandem Line Live Overview Cards */}
      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <GitBranch size={17} style={{ color: 'var(--orange)' }} />
              Tandem Production Lines (LP-1 to LP-2 &amp; HP-1 to HP-4)
            </h2>
            <p className="section-subtitle">
              Dedicated multi-part press lines ({selectedDate} • {selectedShift === 'ALL' ? 'All Shifts' : selectedShift})
            </p>
          </div>
          <CircularGauge
            value={tandemMetrics.totals.achievementPct}
            target={tandemMetrics.totals.target}
            label="All Tandem Lines"
            size={84}
            strokeWidth={8}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10 }}>
          {tandemMetrics.machines.map((line) => {
            const isSelected = line.machine_number === selectedLine;
            const lTone = getAchievementTone(line.achievement_pct, line.target);
            const pillClass = line.status === 'Running' ? 'is-ok' : line.status === 'Breakdown' ? 'is-err' : 'is-warn';
            return (
              <button
                key={line.machine_number}
                type="button"
                onClick={() => setSelectedLine(line.machine_number)}
                className={`tandem-line-card ${isSelected ? 'is-selected' : ''}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong className="mono" style={{ fontSize: '1.05rem' }}>{line.machine_number}</strong>
                  <span className={`status-pill ${pillClass}`}>{line.status || 'Idle'}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: 8 }}>
                  {line.tonnage}T • Tools: {line.tools_used?.length || 0}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="tabular" style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                    {line.actual.toLocaleString()}
                    <span style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', fontWeight: 500 }}>
                      {' '}/ {line.target.toLocaleString()}
                    </span>
                  </span>
                  <span
                    className={`status-pill tabular ${
                      lTone === 'green' ? 'is-ok' : lTone === 'orange' ? 'is-orange' : lTone === 'red' ? 'is-err' : ''
                    }`}
                  >
                    {line.target > 0 ? `${line.achievement_pct}%` : '—'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Multi-Part Simultaneous / Sequential Entry Interface (Up to 4 Parts) */}
      <section className="surface-card" aria-labelledby="tandem-form-heading">
        <div className="section-header">
          <div>
            <h2 id="tandem-form-heading" className="section-title">
              {selectedLine} — Multi-Part Hourly Entry (Max 4 Parts)
            </h2>
            <p className="section-subtitle">
              Hourly Target = Machine Speed (UPH) × 60 • Applicable Target = Machine Speed (UPH) × Allocated Minutes ({selectedLineMetrics.actual.toLocaleString()} pcs logged on line today).
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="tab-strip">
              <button
                type="button"
                className={`btn btn-sm ${allocationMode === 'simultaneous' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAllocationMode('simultaneous')}
              >
                Simultaneous Dies (Transfer)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${allocationMode === 'sequential' ? 'btn-orange' : 'btn-secondary'}`}
                onClick={() => setAllocationMode('sequential')}
              >
                Sequential Changeover (60m Pool)
              </button>
            </div>

            {syncStatus.state !== 'idle' && (
              <span
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
                {syncStatus.state === 'failed' && 'Failed'}
              </span>
            )}
          </div>
        </div>

        {syncStatus.message && (
          <div
            role={syncStatus.state === 'failed' ? 'alert' : 'status'}
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
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => executeSubmit(lastPayload)}>
                <RefreshCw size={14} />
                <span>Retry Sync</span>
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div className="zone-panel zone-orange">
              <div className="zone-header">
                <span className="zone-title">Date, Shift &amp; Hour</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="tan-date">Date *</label>
                  <input
                    id="tan-date"
                    type="date"
                    className="field-input tabular"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="tan-shift">Shift *</label>
                  <select
                    id="tan-shift"
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
                  <label className="field-label" htmlFor="tan-hour">Hour *</label>
                  <select
                    id="tan-hour"
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
            </div>

            <div className="zone-panel zone-blue">
              <div className="zone-header">
                <span className="zone-title">Tandem Line &amp; Operator</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="tan-operator">Operator *</label>
                  <select
                    id="tan-operator"
                    className="field-select"
                    value={roster.some((op) => op.name === operatorName) ? operatorName : operatorName ? '__CUSTOM__' : ''}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') setOperatorName('');
                      else setOperatorName(e.target.value);
                    }}
                  >
                    <option value="">-- Select Operator --</option>
                    {roster.map((op) => (
                      <option key={op.emp_id} value={op.name}>{op.name} ({op.emp_id})</option>
                    ))}
                    <option value="__CUSTOM__">+ Enter Custom Operator</option>
                  </select>
                  {(!operatorName || !roster.some((op) => op.name === operatorName)) && (
                    <input
                      type="text"
                      className="field-input"
                      aria-label="Tandem Operator manual entry"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                      placeholder="Type operator name"
                      style={{ marginTop: 4 }}
                    />
                  )}
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="tan-line">Tandem Line *</label>
                  <select
                    id="tan-line"
                    className="field-select mono"
                    value={selectedLine}
                    onChange={(e) => setSelectedLine(e.target.value)}
                  >
                    {tandemLines.map((l) => (
                      <option key={l.machine_number} value={l.machine_number}>
                        {l.machine_number} ({l.tonnage}T)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {isSequentialMode && timePool.isExceeded && (
            <div className="banner is-err" role="alert">
              <span>Sequential changeover mode active: combined minutes ({timePool.totalAllocated} min) cannot exceed 60 min in {selectedHour}.</span>
            </div>
          )}

          {/* Parts 1..4 */}
          {parts.map((part, idx) => {
            const pm = summary.partMetrics[idx];
            return (
              <div key={idx} className="part-entry-card">
                <div className="part-entry-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`status-pill ${idx === 0 ? 'is-orange' : 'is-ok'}`}>
                      Part {idx + 1}
                    </span>
                    <strong>
                      {isSequentialMode ? 'Sequential Tool Run' : 'Simultaneous Tool Run'} #{idx + 1} on {selectedLine}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="status-pill is-orange tabular">
                      Hourly Target (×60): {pm.fullHourTarget.toLocaleString()}
                    </span>
                    <span className="status-pill is-ok tabular">
                      Output: {pm.actual.toLocaleString()} / {pm.target.toLocaleString()} pcs ({pm.pct}%)
                    </span>
                    {parts.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemovePart(idx)}
                        aria-label={`Remove Tandem Part ${idx + 1}`}
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div className="zone-panel zone-yellow" style={{ padding: 10 }}>
                    <ToolSelectorField
                      id={`tan-p${idx + 1}-tool`}
                      label={`Part ${idx + 1} Tool Number *`}
                      value={part.tool_number}
                      tools={tools}
                      machineType="Tandem"
                      onChange={(val, matched) => {
                        const patch = { tool_number: val };
                        if (matched) {
                          if (matched.part_name) patch.part_name = matched.part_name;
                          if (matched.standard_uph > 0 && !part.uph) patch.uph = String(matched.standard_uph);
                        }
                        updatePart(idx, patch);
                      }}
                    />
                  </div>

                  <div className="zone-panel zone-blue" style={{ padding: 10 }}>
                    <div className="field-group">
                      <label className="field-label" htmlFor={`tan-p${idx + 1}-uph`}>Machine Speed (UPH) *</label>
                      <input
                        id={`tan-p${idx + 1}-uph`}
                        type="text"
                        inputMode="decimal"
                        className="field-input tabular"
                        value={part.uph}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d*\.?\d*$/.test(v)) updatePart(idx, { uph: v });
                        }}
                        placeholder="e.g. 500"
                      />
                    </div>
                  </div>

                  <div className="zone-panel zone-yellow" style={{ padding: 10 }}>
                    <div className="field-group">
                      <label className="field-label" htmlFor={`tan-p${idx + 1}-run`}>Allocated Time (min)</label>
                      <input
                        id={`tan-p${idx + 1}-run`}
                        type="text"
                        inputMode="numeric"
                        className="field-input tabular"
                        value={part.running_minutes}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d+$/.test(v)) updatePart(idx, { running_minutes: v });
                        }}
                        placeholder="60"
                      />
                      <span className="field-help tabular">Applicable Target: {pm.target.toLocaleString()} pcs</span>
                    </div>
                  </div>

                  <div className="zone-panel zone-green" style={{ padding: 10 }}>
                    <div className="field-group">
                      <label className="field-label" htmlFor={`tan-p${idx + 1}-actual`}>Actual Production *</label>
                      <input
                        id={`tan-p${idx + 1}-actual`}
                        type="text"
                        inputMode="numeric"
                        className="field-input tabular"
                        value={part.actual_qty}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d+$/.test(v)) updatePart(idx, { actual_qty: v });
                        }}
                        placeholder="Enter produced pcs"
                      />
                      <span className="field-help tabular">Good: {pm.good.toLocaleString()} pcs</span>
                    </div>
                  </div>
                </div>

                <ScrapSectionPanel
                  partNumber={idx + 1}
                  idPrefix={`tan-p${idx + 1}`}
                  scrapQty={part.rejected_qty}
                  onChangeScrapQty={(val) => updatePart(idx, { rejected_qty: val })}
                  reasons={part.scrap_breakdown}
                  onChangeReasons={(list) => updatePart(idx, { scrap_breakdown: list })}
                  actualQty={pm.actual}
                />
              </div>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-green btn-sm"
                onClick={handleAddPart}
                disabled={parts.length >= 4 || (isSequentialMode && timePool.remainingMinutes <= 0)}
              >
                <Plus size={14} />
                <span>
                  {isSequentialMode
                    ? `Add Tool (${parts.length}/4 • ${timePool.remainingMinutes} min free)`
                    : `Add Simultaneous Part (${parts.length}/4 Max)`}
                </span>
              </button>
              {isSequentialMode && (
                <span className="status-pill is-yellow tabular">
                  <Clock size={12} /> Pool: {timePool.totalAllocated}m used / {timePool.remainingMinutes}m left
                </span>
              )}
            </div>

            <div className="hourly-calc-strip">
              <span><strong>Line Output:</strong> <span className="tabular">{summary.totalActual.toLocaleString()} pcs</span></span>
              <span><strong>Line Target:</strong> <span className="tabular">{summary.totalTarget.toLocaleString()} pcs</span></span>
              <span>
                <strong>Line Achievement:</strong>{' '}
                <span className={`status-pill tabular ${tone === 'green' ? 'is-ok' : tone === 'orange' ? 'is-orange' : tone === 'red' ? 'is-err' : ''}`}>
                  {summary.totalTarget > 0 ? `${summary.combinedPct}%` : '—'}
                </span>
              </span>
              <span><strong>Total Scrap:</strong> <span className="tabular">{summary.totalScrap.toLocaleString()} pcs</span></span>
            </div>
          </div>

          <DowntimeProblemsPanel
            problems={downtimeProblems}
            onChangeProblems={setDowntimeProblems}
            downtimeCodes={downtimeCodes}
            machine={selectedLine}
            operator={operatorName}
            date={selectedDate}
            shift={selectedShift}
            hour={selectedHour}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div className="field-group">
              <label className="field-label" htmlFor="tan-remarks">Line / Hour Remarks</label>
              <input
                id="tan-remarks"
                type="text"
                className="field-input"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional Tandem line notes"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={syncStatus.state === 'saving' || (isSequentialMode && timePool.isExceeded)}
            >
              <Save size={16} />
              <span>{syncStatus.state === 'saving' ? 'Saving...' : `Save ${selectedLine} Entry`}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Selected Line 8-Hour Breakdown */}
      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">{selectedLine} — {selectedShift} Hourly Multi-Part Log ({selectedDate})</h2>
            <p className="section-subtitle">Click an hour row to load or edit parts.</p>
          </div>
        </div>

        <div className="table-scroll-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hour</th>
                <th>Parts &amp; Tools</th>
                <th>Operator</th>
                <th>Line Target</th>
                <th>Line Output</th>
                <th>Ach %</th>
                <th>Scrap</th>
                <th>Downtime</th>
                {caps.canDeleteProduction && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {HOUR_SLOTS.map((slot) => {
                const grp = lineHourlyGroups.find(
                  (g) => g.hour_interval === slot.label || String(g.hour_interval || '').includes(slot.key)
                );
                return (
                  <tr
                    key={slot.key}
                    onClick={() => setSelectedHour(slot.label)}
                    style={{ cursor: 'pointer', background: selectedHour === slot.label ? 'var(--blue-soft)' : undefined }}
                  >
                    <td><strong>{slot.label}</strong></td>
                    <td>
                      {!grp ? (
                        '—'
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {grp.parts.map((pt, i) => (
                            <div key={pt.id || i} style={{ fontSize: '0.78rem' }}>
                              <span className="mono" style={{ fontWeight: 700 }}>P{pt.part_index}: {pt.tool_number}</span>{' '}
                              <span className="tabular">({pt.running_minutes}m • {pt.actual_qty}/{pt.target_qty} pcs)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>{grp ? grp.operators.join(', ') || '—' : '—'}</td>
                    <td className="tabular">{grp ? `${grp.totalTarget.toLocaleString()} pcs` : '—'}</td>
                    <td className="tabular"><strong>{grp ? `${grp.totalActual.toLocaleString()} pcs` : '—'}</strong></td>
                    <td className="tabular">{grp && grp.totalTarget > 0 ? `${grp.achievementPct}%` : '—'}</td>
                    <td className="tabular">{grp ? grp.totalScrap : '—'}</td>
                    <td className="tabular">{grp ? `${grp.downtimeMinutes}m` : '—'}</td>
                    {caps.canDeleteProduction && (
                      <td onClick={(e) => e.stopPropagation()}>
                        {grp ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteSlotTarget(grp)}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {deleteSlotTarget && caps.canDeleteProduction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tan-del-slot-title">
          <div className="modal-dialog" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 id="tan-del-slot-title" className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-err-ink)' }}>
                <ShieldAlert size={18} />
                Delete Tandem Hourly Entry?
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteSlotTarget(null)} disabled={deletingSlot}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Delete all {deleteSlotTarget.parts.length} part record(s) for <strong className="mono">{selectedLine}</strong> on{' '}
                <strong className="tabular">{selectedDate}</strong> ({selectedShift}, <strong>{deleteSlotTarget.hour_interval}</strong>)?
              </p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteSlotTarget(null)} disabled={deletingSlot}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmDeleteSlot} disabled={deletingSlot}>
                {deletingSlot ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
