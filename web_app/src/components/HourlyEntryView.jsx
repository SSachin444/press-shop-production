import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, Save, Plus, Trash2, Layers } from 'lucide-react';
import {
  HOUR_SLOTS,
  SHIFTS,
  calculateTargetFromUph,
  getAchievementTone,
  groupHourlyMachineEntries,
  normalizeRecord,
  validateDowntimeProblems,
  validateScrapReasons,
} from '../services/metrics';
import { cloudApi } from '../services/cloudClient';
import { createSubmissionId } from '../services/syncQueue';
import { DowntimeProblemsPanel, ScrapSectionPanel, ToolSelectorField } from './ProductionEntryParts';

function createEmptyPart() {
  return {
    tool_number: '',
    part_name: '',
    uph: '',
    running_minutes: '60',
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
  const [parts, setParts] = useState([createEmptyPart()]);
  const [downtimeProblems, setDowntimeProblems] = useState([]);
  const [remarks, setRemarks] = useState('');

  const [roster, setRoster] = useState([]);
  const [syncStatus, setSyncStatus] = useState({ state: 'idle', message: '' });
  const [pendingSubmissionId, setPendingSubmissionId] = useState(() => createSubmissionId());
  const [lastPayload, setLastPayload] = useState(null);

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
  // Never overwrite unsaved inputs on 5-second background refresh!
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
      const dtList = sortedParts[0].downtime_problems || [];
      setDowntimeProblems(dtList);
      setRemarks(sortedParts[0].remarks || '');
    } else {
      setParts([createEmptyPart()]);
      setDowntimeProblems([]);
      setRemarks('');
    }
    setPendingSubmissionId(createSubmissionId());
    setSyncStatus({ state: 'idle', message: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachine, selectedHour, selectedDate, selectedShift]);

  const updatePart = (idx, patch) => {
    setParts((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const handleAddPart = () => {
    if (parts.length >= 3) return;
    setParts((prev) => [...prev, createEmptyPart()]);
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
    let totalScrap = 0;

    const partMetrics = parts.map((p) => {
      const uph = Number(p.uph) || 0;
      const runMin = Number(p.running_minutes) || 60;
      const target = calculateTargetFromUph(uph, runMin);
      const actual = Number(p.actual_qty) || 0;
      const scrap = Number(p.rejected_qty) || 0;
      const good = Math.max(0, actual - scrap);
      const pct = target > 0 ? Number(((actual / target) * 100).toFixed(1)) : 0;

      totalActual += actual;
      totalTarget += target;
      totalScrap += scrap;
      return { target, actual, scrap, good, pct };
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
      dtValid: dtCheck.valid,
      dtError: dtCheck.error,
    };
  }, [parts, downtimeProblems]);

  const validateAndBuildBatch = () => {
    if (!selectedDate) return { error: 'Please select a Date.' };
    if (!selectedShift) return { error: 'Please select a Shift.' };
    if (!operatorName.trim()) return { error: 'Please select or enter an Operator.' };
    if (!selectedMachine) return { error: 'Please select an NC Machine.' };
    if (!selectedHour) return { error: 'Please select an Hour interval.' };

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
        return { error: `Part ${num}: Enter a valid UPH rate greater than 0.` };
      }
      if (!Number.isFinite(runMin) || runMin <= 0 || runMin > 60) {
        return { error: `Part ${num}: Running duration must be between 1 and 60 minutes.` };
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
        message: `Saved ${payloadToSend.machine_or_line} (${payloadToSend.hour_interval}): ${payloadToSend.parts.length} part(s), ${summary.totalActual.toLocaleString()} total pcs confirmed.`,
      });
      setPendingSubmissionId(createSubmissionId());
      setLastPayload(null);
      if (onEntrySaved) onEntrySaved();
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

  const part1 = parts[0];
  const part1Metrics = summary.partMetrics[0];
  const tone = getAchievementTone(summary.combinedPct, summary.totalTarget);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="surface-card" aria-labelledby="hourly-entry-heading">
        <div className="section-header">
          <div>
            <h2 id="hourly-entry-heading" className="section-title">
              NC Hourly Production Entry (Up to 3 Parts / Machine / Hour)
            </h2>
            <p className="section-subtitle">
              Target = UPH × Running Duration (hours). Supports 1–3 parts per hour, up to 5 scrap reasons per part, and up to 5 downtime problems.
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
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => executeSubmit(lastPayload)}>
                <RefreshCw size={14} />
                <span>Retry Sync</span>
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* STEPS 1–4: 1. Date | 2. Shift | 3. Operator | 4. Machine */}
          <div className="filter-bar" style={{ marginBottom: 14 }}>
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
          </div>

          {/* STEPS 5–10 (PART 1 IN EXACT ENTRY ORDER: 5. UPH | 6. Tool Number | 7. Hour | 8. Actual Production | 9. Scrap | 10. Scrap Reasons) */}
          <div className="part-entry-card" style={{ marginBottom: 14 }}>
            <div className="part-entry-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="status-pill is-orange">Part 1</span>
                <strong>Primary Part Entry</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="status-pill tabular">
                  Target: {part1Metrics.target.toLocaleString()} pcs • Good: {part1Metrics.good.toLocaleString()} pcs • {part1Metrics.pct}%
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div className="field-group">
                <label className="field-label" htmlFor="nc-p1-uph">5. UPH (Units/Hr) *</label>
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
                  placeholder="e.g. 1200"
                  required
                />
              </div>

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
                <label className="field-label" htmlFor="nc-p1-run">Running Duration (min)</label>
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
                <label className="field-label" htmlFor="nc-p1-actual">8. Actual Production *</label>
                <input
                  id="nc-p1-actual"
                  type="text"
                  inputMode="numeric"
                  className="field-input tabular"
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
            </div>

            {/* 9. Scrap & 10. Scrap Reasons for Part 1 */}
            <ScrapSectionPanel
              partNumber={1}
              idPrefix="nc-p1"
              scrapQty={part1.rejected_qty}
              onChangeScrapQty={(val) => updatePart(0, { rejected_qty: val })}
              reasons={part1.scrap_breakdown}
              onChangeReasons={(list) => updatePart(0, { scrap_breakdown: list })}
              actualQty={part1Metrics.actual}
            />
          </div>

          {/* ADDITIONAL PARTS (PART 2 & PART 3 — MAX 3 PARTS PER MACHINE / HOUR) */}
          {parts.slice(1).map((part, relIdx) => {
            const idx = relIdx + 1;
            const pm = summary.partMetrics[idx];
            return (
              <div key={idx} className="part-entry-card" style={{ marginBottom: 14 }}>
                <div className="part-entry-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="status-pill is-ok">Part {idx + 1}</span>
                    <strong>Additional Part in Same Hour</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="status-pill tabular">
                      Target: {pm.target.toLocaleString()} pcs • Good: {pm.good.toLocaleString()} pcs • {pm.pct}%
                    </span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRemovePart(idx)}
                      aria-label={`Remove Part ${idx + 1}`}
                    >
                      <Trash2 size={13} />
                      <span>Remove Part</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <ToolSelectorField
                    id={`nc-p${idx + 1}-tool`}
                    label={`Part ${idx + 1} Tool Number *`}
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

                  <div className="field-group">
                    <label className="field-label" htmlFor={`nc-p${idx + 1}-uph`}>UPH (Units/Hr) *</label>
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
                      placeholder="e.g. 800"
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor={`nc-p${idx + 1}-run`}>Running Duration (min)</label>
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
                      placeholder="60"
                    />
                  </div>

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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <button
              type="button"
              className="btn btn-green btn-sm"
              onClick={handleAddPart}
              disabled={parts.length >= 3}
            >
              <Plus size={14} />
              <span>Add Part ({parts.length}/3 Max)</span>
            </button>

            <div className="hourly-calc-strip">
              <span><strong>Combined Hourly Output:</strong> <span className="tabular">{summary.totalActual.toLocaleString()} pcs</span></span>
              <span><strong>Combined Target:</strong> <span className="tabular">{summary.totalTarget.toLocaleString()} pcs</span></span>
              <span>
                <strong>Achievement:</strong>{' '}
                <span className={`status-pill tabular ${tone === 'green' ? 'is-ok' : tone === 'orange' ? 'is-warn' : tone === 'red' ? 'is-err' : ''}`}>
                  {summary.totalTarget > 0 ? `${summary.combinedPct}%` : '—'}
                </span>
              </span>
              <span><strong>Total Scrap:</strong> <span className="tabular">{summary.totalScrap.toLocaleString()} pcs</span></span>
            </div>
          </div>

          {/* STEPS 11–12: 11. Downtime (auto total) & 12. Downtime Reasons / Problems */}
          <DowntimeProblemsPanel
            problems={downtimeProblems}
            onChangeProblems={setDowntimeProblems}
            downtimeCodes={downtimeCodes}
            machine={selectedMachine}
            operator={operatorName}
            date={selectedDate}
            shift={selectedShift}
            hour={selectedHour}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginTop: 14 }}>
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

            <button type="submit" className="btn btn-primary" disabled={syncStatus.state === 'saving'}>
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
              <Layers size={16} style={{ color: 'var(--accent)' }} />
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
                <th>Combined Target</th>
                <th>Combined Actual</th>
                <th>Ach %</th>
                <th>Scrap</th>
                <th>Downtime</th>
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
                    style={{ cursor: 'pointer', background: selectedHour === slot.label ? 'var(--accent-tint)' : undefined }}
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
                              <span className="tabular">({pt.actual_qty}/{pt.target_qty} pcs, scrap {pt.rejected_qty})</span>
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
                    {grp ? `${grp.totalActual.toLocaleString()} / ${grp.totalTarget.toLocaleString()} pcs` : 'Not logged'}
                  </span>
                </div>
                {grp && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                    {grp.parts.length} part(s): {grp.tools.join(', ')} • Scrap: {grp.totalScrap} • DT: {grp.downtimeMinutes}m
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
