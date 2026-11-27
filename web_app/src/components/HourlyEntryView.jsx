import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  Layers,
  Clock,
  ShieldAlert,
  X,
} from 'lucide-react';
import { getCapabilities } from '../config/roles';
import {
  HOUR_SLOTS,
  SHIFTS,
  calculateFullHourTargetFromUph,
  calculateTargetFromUph,
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

function createEmptyPart(defaultMinutes = '60') {
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

export default function HourlyEntryView({
  selectedPlant,
  selectedDate,
  setSelectedDate,
  selectedShift,
  setSelectedShift,
  machines,
  tools = [],
  records,
  downtimeCodes,
  currentUser,
  onEntrySaved,
}) {
  const caps = getCapabilities(currentUser?.role);

  // Filter NC machines from Machine Directory (fallback to all if none labeled NC)
  const ncMachineOptions = useMemo(() => {
    const nc = (machines || []).filter((m) => m.machine_type === 'NC');
    return nc.length > 0 ? nc : machines || [];
  }, [machines]);

  const [selectedMachine, setSelectedMachine] = useState('');
  const [selectedHour, setSelectedHour] = useState(HOUR_SLOTS[0].label);
  const [operatorName, setOperatorName] = useState(
    currentUser?.role === 'Operator' ? currentUser.full_name || '' : ''
  );
  const [parts, setParts] = useState([createEmptyPart('60')]);
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
    if (ncMachineOptions.length > 0 && !ncMachineOptions.some((m) => m.machine_number === selectedMachine)) {
      setSelectedMachine(ncMachineOptions[0].machine_number);
    }
  }, [ncMachineOptions, selectedMachine]);

  const activeMachineObj = useMemo(
    () => ncMachineOptions.find((m) => m.machine_number === selectedMachine) || null,
    [ncMachineOptions, selectedMachine]
  );

  // Scoped strictly to selectedMachine + selectedDate + selectedShift
  const machineHourlyGroups = useMemo(() => {
    const filtered = (records || []).filter(
      (r) =>
        String(r.machine_or_line || '').toUpperCase() === selectedMachine.toUpperCase() &&
        r.date === selectedDate &&
        r.shift === selectedShift
    );
    return groupHourlyMachineEntries(filtered);
  }, [records, selectedMachine, selectedDate, selectedShift]);

  // Prefill ONLY when user changes selectedMachine, selectedHour, selectedDate, or selectedShift
  useEffect(() => {
    if (!selectedMachine) return;
    const slotKey = selectedHour.split(' (')[0];
    const existingGroup = machineHourlyGroups.find(
      (g) => g.hour_interval === selectedHour || String(g.hour_interval || '').includes(slotKey)
    );
    if (existingGroup && existingGroup.parts.length > 0) {
      const sortedParts = [...existingGroup.parts]
        .slice(0, 3)
        .sort((a, b) => (a.part_index || 1) - (b.part_index || 1));

      setOperatorName(sortedParts[0].operator_name || operatorName);
      setParts(
        sortedParts.map((p) => ({
          tool_number: p.tool_number || '',
          part_name: p.part_name || '',
          uph: p.uph ? String(p.uph) : '',
          running_minutes: p.running_minutes ? String(p.running_minutes) : '60',
          actual_qty: String(p.actual_qty ?? ''),
          rejected_qty: p.rejected_qty ? String(p.rejected_qty) : '',
          scrap_breakdown: Array.isArray(p.scrap_breakdown) ? p.scrap_breakdown : [],
        }))
      );
      setDowntimeProblems(sortedParts[0].downtime_problems || []);
      setRemarks(sortedParts[0].remarks || '');
    } else {
      setParts([createEmptyPart('60')]);
      setDowntimeProblems([]);
      setRemarks('');
    }
    setPendingSubmissionId(createSubmissionId());
    setSyncStatus({ state: 'idle', message: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachine, selectedHour, selectedDate, selectedShift]);

  const timePool = useMemo(() => computeTimeAllocationSummary(parts, 60), [parts]);

  const updatePart = (idx, patch) => {
    setParts((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const handleAddPart = () => {
    if (parts.length >= 3) return;
    if (timePool.remainingMinutes <= 0) {
      setSyncStatus({
        state: 'failed',
        message: 'Remaining available time in this 60-minute hour is 0 minutes. Reduce allocated minutes on an existing tool before adding another tool.',
      });
      return;
    }
    setParts((prev) => [...prev, createEmptyPart(String(timePool.remainingMinutes))]);
  };

  const handleRemovePart = (idx) => {
    if (parts.length <= 1) return;
    setParts((prev) => prev.filter((_, i) => i !== idx));
  };

  // Real-time aggregates across up to 3 parts
  const summary = useMemo(() => {
    const dtCheck = validateDowntimeProblems(downtimeProblems, 5, 60);
    let totalActual = 0;
    let totalTarget = 0;
    let totalFullHourTarget = 0;
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
      totalFullHourTarget += fullHourTarget;
      totalScrap += scrap;
      return { fullHourTarget, target, runMin, actual, scrap, good, pct };
    });

    const totalGood = Math.max(0, totalActual - totalScrap);
    const combinedPct = totalTarget > 0 ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : 0;
    return {
      partMetrics,
      totalActual,
      totalTarget,
      totalFullHourTarget,
      totalScrap,
      totalGood,
      combinedPct,
      totalDowntime: dtCheck.totalMinutes,
      dtValid: dtCheck.valid,
      dtError: dtCheck.error,
    };
  }, [parts, downtimeProblems]);

  const validateAndBuildBatch = () => {
    if (!selectedDate) return { error: '1. Please select a Date.' };
    if (!selectedShift) return { error: '2. Please select a Shift.' };
    if (!operatorName.trim()) return { error: '3. Please select or enter an Operator.' };
    if (!selectedMachine) return { error: '4. Please select an NC Machine.' };
    if (!selectedHour) return { error: '7. Please select an Hour interval.' };

    const timeCheck = validateTimeAllocation(parts, 60, true);
    if (!timeCheck.valid) return { error: timeCheck.error };

    const dtCheck = validateDowntimeProblems(downtimeProblems, 5, 60);
    if (!dtCheck.valid) return { error: dtCheck.error };

    const normalizedParts = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const num = i + 1;
      const uph = p.uph.trim() === '' ? NaN : Number(p.uph);
      const runMin = p.running_minutes.trim() === '' ? NaN : Number(p.running_minutes);
      const actual = p.actual_qty.trim() === '' ? NaN : Number(p.actual_qty);
      const scrap = p.rejected_qty.trim() === '' ? 0 : Number(p.rejected_qty);

      if (!String(p.tool_number || '').trim()) {
        return { error: `Part ${num}: Tool Number is required.` };
      }
      if (!Number.isFinite(uph) || uph <= 0 || uph > 50000) {
        return { error: `Part ${num}: Enter a valid Machine Speed (UPH) greater than 0.` };
      }
      if (!Number.isFinite(runMin) || runMin <= 0 || runMin > 60) {
        return { error: `Part ${num}: Allocated time must be between 1 and 60 minutes.` };
      }
      if (!Number.isInteger(actual) || actual < 0 || actual > 100000) {
        return { error: `Part ${num}: Enter a valid whole number for Actual Production.` };
      }
      if (!Number.isInteger(scrap) || scrap < 0 || scrap > actual) {
        return { error: `Part ${num}: Scrap quantity cannot be negative or exceed Actual Production.` };
      }

      const scrapCheck = validateScrapReasons(scrap, p.scrap_breakdown || [], 5);
      if (!scrapCheck.valid) {
        return { error: `Part ${num}: ${scrapCheck.error}` };
      }

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

    return {
      payload: {
        isBatch: true,
        tandem_mode: 'sequential',
        client_submission_id: pendingSubmissionId,
        plant_id: selectedPlant,
        production_type: 'NC',
        machine_or_line: selectedMachine,
        date: selectedDate,
        shift: selectedShift,
        hour_interval: selectedHour,
        operator_name: operatorName.trim(),
        tonnage: activeMachineObj?.tonnage || 0,
        parts: normalizedParts,
        downtime_problems: dtCheck.normalized,
        remarks: remarks.trim(),
        entry_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
    };
  };

  const executeSubmit = async (payloadToSend) => {
    setSyncStatus({ state: 'saving', message: 'Saving multi-part hourly production to cloud...' });
    try {
      await cloudApi.submitProductionBatch(payloadToSend);
      setSyncStatus({
        state: 'saved',
        message: `Saved ${payloadToSend.machine_or_line} (${payloadToSend.hour_interval}): ${payloadToSend.parts.length} tool(s), ${summary.totalActual.toLocaleString()} pcs vs Applicable Target ${summary.totalTarget.toLocaleString()} pcs (${summary.combinedPct}%).`,
      });
      setPendingSubmissionId(createSubmissionId());
      setLastPayload(null);
      if (onEntrySaved) await onEntrySaved();
    } catch (err) {
      setLastPayload(payloadToSend);
      if (err.isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setSyncStatus({
          state: 'offline',
          message: 'Offline: multi-part entry queued safely and will sync when back online.',
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
        machine_or_line: selectedMachine,
        hour_interval: deleteSlotTarget.hour_interval,
      });
      setSyncStatus({
        state: 'saved',
        message: `Deleted hourly entry for ${selectedMachine} (${deleteSlotTarget.hour_interval}).`,
      });
      if (deleteSlotTarget.hour_interval === selectedHour) {
        setParts([createEmptyPart('60')]);
        setDowntimeProblems([]);
        setRemarks('');
      }
      setDeleteSlotTarget(null);
      if (onEntrySaved) await onEntrySaved();
    } catch (err) {
      setSyncStatus({ state: 'failed', message: err?.message || 'Unable to delete hourly entry.' });
      setDeleteSlotTarget(null);
    } finally {
      setDeletingSlot(false);
    }
  };

  const part1 = parts[0];
  const part1Metrics = summary.partMetrics[0];
  const tone = getAchievementTone(summary.combinedPct, summary.totalTarget);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="surface-card" aria-labelledby="hourly-entry-heading">
        <div className="section-header">
          <div>
            <h2 id="hourly-entry-heading" className="section-title">
              NC Hourly Output Entry (Color-Coded 10-Step Shopfloor Workflow)
            </h2>
            <p className="section-subtitle">
              Hourly Target = Machine Speed (UPH) × 60 • Applicable Target = Machine Speed (UPH) × Allocated Minutes • Shared 60-minute pool per Machine / Shift / Date / Hour.
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
              {syncStatus.state === 'failed' && 'Failed'}
            </span>
          )}
        </div>

        {/* Zone Color Legend */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span className="status-pill is-orange">Orange: Target &amp; Planning</span>
          <span className="status-pill is-info">Blue: Machine &amp; Speed (UPH)</span>
          <span className="status-pill is-yellow">Yellow: Tool &amp; 60-Min Pool</span>
          <span className="status-pill is-ok">Green: Actual Production</span>
          <span className="status-pill is-err">Red: Scrap &amp; Downtime</span>
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
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => executeSubmit(lastPayload)}>
                <RefreshCw size={14} />
                <span>Retry Sync</span>
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* STEP 1 & 2 (ORANGE ZONE: Production Planning - Date & Shift) + STEP 3-5 (BLUE ZONE: Operator, Machine & UPH) */}
          <div className="hourly-top-grid">
            <div className="zone-panel zone-orange">
              <div className="zone-header">
                <span className="zone-title">
                  <span className="step-badge">1–2</span> Production Schedule
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="nc-entry-date">1. Date *</label>
                  <input
                    id="nc-entry-date"
                    type="date"
                    className="field-input tabular"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="nc-entry-shift">2. Shift *</label>
                  <select
                    id="nc-entry-shift"
                    className="field-select"
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                  >
                    {SHIFTS.map((s) => (
                      <option key={s.id} value={s.id}>{s.id}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* STEP 3 & 4 & 5 (BLUE ZONE: Operator, Machine & Machine Speed UPH) */}
            <div className="zone-panel zone-blue">
              <div className="zone-header">
                <span className="zone-title">
                  <span className="step-badge">3–5</span> Operator, Machine &amp; Machine Speed (UPH)
                </span>
                <span className="status-pill is-info tabular">
                  {activeMachineObj ? `${activeMachineObj.machine_number} • ${activeMachineObj.tonnage}T` : 'Select Press'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="nc-entry-operator">3. Operator *</label>
                  <select
                    id="nc-entry-operator"
                    className="field-select"
                    value={roster.some((op) => op.name === operatorName) ? operatorName : operatorName ? '__CUSTOM__' : ''}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') setOperatorName('');
                      else setOperatorName(e.target.value);
                    }}
                  >
                    <option value="">-- Select Operator --</option>
                    {roster.map((op) => (
                      <option key={op.emp_id} value={op.name}>
                        {op.name} ({op.emp_id})
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Enter Custom Operator</option>
                  </select>
                  {(!operatorName || !roster.some((op) => op.name === operatorName)) && (
                    <input
                      type="text"
                      className="field-input"
                      aria-label="Operator Name manual entry"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                      placeholder="Type operator name"
                      style={{ marginTop: 4 }}
                    />
                  )}
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="nc-entry-machine">4. Machine (NC) *</label>
                  <select
                    id="nc-entry-machine"
                    className="field-select mono"
                    value={selectedMachine}
                    onChange={(e) => setSelectedMachine(e.target.value)}
                  >
                    {ncMachineOptions.map((m) => (
                      <option key={m.machine_number} value={m.machine_number}>
                        {m.machine_number} ({m.tonnage}T • {m.status || 'Idle'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="nc-p1-uph">5. Machine Speed (UPH) *</label>
                  <input
                    id="nc-p1-uph"
                    type="text"
                    inputMode="decimal"
                    className="field-input tabular"
                    value={part1.uph}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) updatePart(0, { uph: v });
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="e.g. 120"
                    required
                  />
                  <span className="field-help tabular">
                    Full-Hr Target (×60): <strong>{part1Metrics.fullHourTarget.toLocaleString()} pcs</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 6 (YELLOW ZONE: Tool Number & Time Allocation) */}
          <div className="zone-panel zone-yellow">
            <div className="zone-header">
              <span className="zone-title">
                <span className="step-badge">6</span> Tool Number &amp; 60-Minute Hour Pool — Part 1
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={`status-pill tabular ${timePool.isExceeded ? 'is-err' : 'is-yellow'}`}>
                  Allocated: {timePool.totalAllocated} / 60 min
                </span>
                <span className={`status-pill tabular ${timePool.isExceeded ? 'is-err' : timePool.isZeroRemaining ? 'is-yellow' : 'is-ok'}`}>
                  Remaining: {timePool.isExceeded ? `-${timePool.totalAllocated - 60}` : timePool.remainingMinutes} min
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              <ToolSelectorField
                id="nc-p1-tool"
                label="6. Tool Number *"
                value={part1.tool_number}
                tools={tools}
                machineType="NC"
                onChange={(val, matched) => {
                  const patch = { tool_number: val };
                  if (matched) {
                    if (matched.part_name) patch.part_name = matched.part_name;
                    if (matched.standard_uph > 0 && !part1.uph) patch.uph = String(matched.standard_uph);
                  }
                  updatePart(0, patch);
                }}
              />

              <div className="field-group">
                <label className="field-label" htmlFor="nc-p1-run">Allocated Run Time (min of 60)</label>
                <input
                  id="nc-p1-run"
                  type="text"
                  inputMode="numeric"
                  className="field-input tabular"
                  value={part1.running_minutes}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^\d+$/.test(v)) updatePart(0, { running_minutes: v });
                  }}
                  placeholder="60"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="nc-p1-partname">Part Description / Name</label>
                <input
                  id="nc-p1-partname"
                  type="text"
                  className="field-input"
                  value={part1.part_name}
                  onChange={(e) => updatePart(0, { part_name: e.target.value })}
                  placeholder="Auto-filled from Tool Catalog"
                />
              </div>
            </div>

            {timePool.isExceeded && (
              <div className="banner is-err" role="alert" style={{ marginTop: 10 }}>
                <span>
                  Time allocation exceeded! Combined running minutes ({timePool.totalAllocated} min) cannot exceed 60 minutes in {selectedHour} on {selectedMachine}.
                </span>
              </div>
            )}

            {!timePool.isExceeded && timePool.isZeroRemaining && parts.length < 3 && (
              <div className="banner is-warn" style={{ marginTop: 10 }}>
                <span>
                  <strong>0 minutes remaining</strong> in {selectedHour} on {selectedMachine}. Reduce allocated minutes on Tool 1 to allocate time to a 2nd or 3rd tool.
                </span>
              </div>
            )}
          </div>

          {/* STEP 7 (ORANGE ZONE: Hour Selection & Read-Only Target Calculations) + STEP 8 (GREEN ZONE: Actual Production) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <div className="zone-panel zone-orange">
              <div className="zone-header">
                <span className="zone-title">
                  <span className="step-badge">7</span> Hour &amp; Calculated Targets
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="nc-entry-hour">7. Hour *</label>
                  <select
                    id="nc-entry-hour"
                    className="field-select"
                    value={selectedHour}
                    onChange={(e) => setSelectedHour(e.target.value)}
                  >
                    {HOUR_SLOTS.map((h) => (
                      <option key={h.key} value={h.label}>{h.label}</option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <span className="field-label">Hourly Target (UPH × 60)</span>
                  <div className="field-input tabular" style={{ background: 'rgba(255,255,255,0.85)', fontWeight: 800, color: 'var(--orange-ink)' }}>
                    {part1Metrics.fullHourTarget.toLocaleString()} pcs/hr
                  </div>
                </div>

                <div className="field-group">
                  <span className="field-label">Applicable Target (UPH × {part1Metrics.runMin}m)</span>
                  <div className="field-input tabular" style={{ background: 'rgba(255,255,255,0.85)', fontWeight: 800, color: 'var(--navy)' }}>
                    {part1Metrics.target.toLocaleString()} pcs
                  </div>
                </div>
              </div>
            </div>

            <div className="zone-panel zone-green">
              <div className="zone-header">
                <span className="zone-title">
                  <span className="step-badge">8</span> Actual Production &amp; Efficiency
                </span>
                <span className={`status-pill tabular ${part1Metrics.pct >= 85 ? 'is-ok' : part1Metrics.pct >= 60 ? 'is-orange' : 'is-err'}`}>
                  Prod %: {part1Metrics.target > 0 ? `${part1Metrics.pct}%` : '—'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="nc-p1-actual">8. Actual Production *</label>
                  <input
                    id="nc-p1-actual"
                    type="text"
                    inputMode="numeric"
                    className="field-input tabular"
                    style={{ fontWeight: 800, fontSize: '0.96rem', borderColor: '#16A34A' }}
                    value={part1.actual_qty}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d+$/.test(v)) updatePart(0, { actual_qty: v });
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="Enter produced pcs"
                    required
                  />
                </div>

                <div className="field-group">
                  <span className="field-label">Good Output (Actual − Scrap)</span>
                  <div className="field-input tabular" style={{ background: 'rgba(255,255,255,0.88)', fontWeight: 800, color: 'var(--status-ok-ink)' }}>
                    {part1Metrics.good.toLocaleString()} pcs
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 9 (RED ZONE: Scrap Details for Part 1) */}
          <ScrapSectionPanel
            partNumber={1}
            stepLabel="9."
            idPrefix="nc-p1"
            scrapQty={part1.rejected_qty}
            onChangeScrapQty={(val) => updatePart(0, { rejected_qty: val })}
            reasons={part1.scrap_breakdown}
            onChangeReasons={(list) => updatePart(0, { scrap_breakdown: list })}
            actualQty={part1Metrics.actual}
          />

          {/* ADDITIONAL TOOLS IN SAME HOUR (PART 2 & PART 3 — AUTO-POPULATED REMAINING MINUTES) */}
          {parts.slice(1).map((part, relIdx) => {
            const idx = relIdx + 1;
            const pm = summary.partMetrics[idx];
            return (
              <div key={idx} className="part-entry-card" style={{ borderLeftColor: '#EAB308' }}>
                <div className="part-entry-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="status-pill is-yellow">Tool / Part {idx + 1}</span>
                    <strong>Additional Tool Run in {selectedHour}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="status-pill is-orange tabular">Hourly Target: {pm.fullHourTarget.toLocaleString()}</span>
                    <span className="status-pill is-ok tabular">
                      Output: {pm.actual.toLocaleString()} / {pm.target.toLocaleString()} pcs ({pm.pct}%)
                    </span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRemovePart(idx)}
                      aria-label={`Remove Part ${idx + 1}`}
                    >
                      <Trash2 size={13} />
                      <span>Remove Tool</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div className="zone-panel zone-yellow" style={{ padding: 10 }}>
                    <ToolSelectorField
                      id={`nc-p${idx + 1}-tool`}
                      label={`Tool #${idx + 1} *`}
                      value={part.tool_number}
                      tools={tools}
                      machineType="NC"
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
                      <label className="field-label" htmlFor={`nc-p${idx + 1}-uph`}>Machine Speed (UPH) *</label>
                      <input
                        id={`nc-p${idx + 1}-uph`}
                        type="text"
                        inputMode="decimal"
                        className="field-input tabular"
                        value={part.uph}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d*\.?\d*$/.test(v)) updatePart(idx, { uph: v });
                        }}
                        placeholder="e.g. 120"
                      />
                    </div>
                  </div>

                  <div className="zone-panel zone-yellow" style={{ padding: 10 }}>
                    <div className="field-group">
                      <label className="field-label" htmlFor={`nc-p${idx + 1}-run`}>Allocated Time (min)</label>
                      <input
                        id={`nc-p${idx + 1}-run`}
                        type="text"
                        inputMode="numeric"
                        className="field-input tabular"
                        value={part.running_minutes}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d+$/.test(v)) updatePart(idx, { running_minutes: v });
                        }}
                        placeholder={String(Math.max(1, timePool.remainingMinutes))}
                      />
                      <span className="field-help tabular">Target: {pm.target.toLocaleString()} pcs</span>
                    </div>
                  </div>

                  <div className="zone-panel zone-green" style={{ padding: 10 }}>
                    <div className="field-group">
                      <label className="field-label" htmlFor={`nc-p${idx + 1}-actual`}>Actual Production *</label>
                      <input
                        id={`nc-p${idx + 1}-actual`}
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
                  idPrefix={`nc-p${idx + 1}`}
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
                disabled={parts.length >= 3 || timePool.remainingMinutes <= 0}
              >
                <Plus size={14} />
                <span>
                  Add Tool / Part ({parts.length}/3 • {timePool.remainingMinutes} min free)
                </span>
              </button>
              <span className="status-pill is-yellow tabular">
                <Clock size={12} /> Pool: {timePool.totalAllocated}m used / {timePool.remainingMinutes}m left
              </span>
            </div>

            <div className="hourly-calc-strip">
              <span><strong>Actual Output:</strong> <span className="tabular">{summary.totalActual.toLocaleString()} pcs</span></span>
              <span><strong>Applicable Target:</strong> <span className="tabular">{summary.totalTarget.toLocaleString()} pcs</span></span>
              <span>
                <strong>Production %:</strong>{' '}
                <span className={`status-pill tabular ${tone === 'green' ? 'is-ok' : tone === 'orange' ? 'is-orange' : tone === 'red' ? 'is-err' : ''}`}>
                  {summary.totalTarget > 0 ? `${summary.combinedPct}%` : '—'}
                </span>
              </span>
              <span><strong>Total Scrap:</strong> <span className="tabular">{summary.totalScrap.toLocaleString()} pcs</span></span>
            </div>
          </div>

          {/* STEP 10 (RED ZONE: Downtime Details) */}
          <DowntimeProblemsPanel
            stepLabel="10."
            problems={downtimeProblems}
            onChangeProblems={setDowntimeProblems}
            downtimeCodes={downtimeCodes}
            machine={selectedMachine}
            operator={operatorName}
            date={selectedDate}
            shift={selectedShift}
            hour={selectedHour}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div className="field-group">
              <label className="field-label" htmlFor="nc-remarks">Shift / Hour Remarks</label>
              <input
                id="nc-remarks"
                type="text"
                className="field-input"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional production or die changeover notes"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={syncStatus.state === 'saving' || timePool.isExceeded}
            >
              <Save size={16} aria-hidden="true" />
              <span>{syncStatus.state === 'saving' ? 'Saving...' : 'Save Hourly Production'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Shift 8-Hour Multi-Part Matrix */}
      <section className="surface-card" aria-labelledby="nc-matrix-heading">
        <div className="section-header">
          <div>
            <h2 id="nc-matrix-heading" className="section-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} style={{ color: 'var(--blue)' }} />
              {selectedMachine} — {selectedShift} Hourly Log ({selectedDate})
            </h2>
            <p className="section-subtitle">Click any hour row to load or update multi-part entries.</p>
          </div>
        </div>

        <div className="table-scroll-wrap desktop-table-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hour</th>
                <th>Parts &amp; Tools</th>
                <th>Operator</th>
                <th>Applicable Target</th>
                <th>Actual Output</th>
                <th>Prod %</th>
                <th>Scrap</th>
                <th>Downtime</th>
                {caps.canDeleteProduction && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {HOUR_SLOTS.map((slot) => {
                const grp = machineHourlyGroups.find(
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {grp.parts.map((pt, idx) => (
                            <div key={pt.id || idx} style={{ fontSize: '0.78rem' }}>
                              <span className="mono" style={{ fontWeight: 700 }}>P{pt.part_index}: {pt.tool_number}</span>{' '}
                              <span className="tabular">({pt.running_minutes}m • {pt.actual_qty}/{pt.target_qty} pcs, scrap {pt.rejected_qty})</span>
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
                            aria-label={`Delete hour ${slot.label}`}
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

        <div className="mobile-card-list">
          {HOUR_SLOTS.map((slot) => {
            const grp = machineHourlyGroups.find(
              (g) => g.hour_interval === slot.label || String(g.hour_interval || '').includes(slot.key)
            );
            return (
              <div
                key={slot.key}
                style={{
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: selectedHour === slot.label ? '2px solid var(--blue)' : '1px solid var(--border)',
                  background: selectedHour === slot.label ? 'var(--blue-soft)' : 'var(--bg-surface)',
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedHour(slot.label)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedHour(slot.label)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{slot.label}</strong>
                    <span className="tabular" style={{ fontWeight: 700 }}>
                      {grp ? `${grp.totalActual.toLocaleString()} / ${grp.totalTarget.toLocaleString()} pcs` : 'Not logged'}
                    </span>
                  </div>
                  {grp && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                      {grp.parts.length} tool(s): {grp.tools.join(', ')} • Scrap: {grp.totalScrap} • DT: {grp.downtimeMinutes}m
                    </div>
                  )}
                </div>
                {caps.canDeleteProduction && grp && (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteSlotTarget(grp)}
                    >
                      <Trash2 size={12} /> Delete Hour
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {deleteSlotTarget && caps.canDeleteProduction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nc-del-slot-title">
          <div className="modal-dialog" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 id="nc-del-slot-title" className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-err-ink)' }}>
                <ShieldAlert size={18} />
                Delete Hourly Entry?
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteSlotTarget(null)} disabled={deletingSlot}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Delete all {deleteSlotTarget.parts.length} part record(s) for machine <strong className="mono">{selectedMachine}</strong> on{' '}
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
