import React, { useEffect, useMemo, useState } from 'react';
import { GitBranch, Plus, Trash2, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  HOUR_SLOTS,
  SHIFTS,
  TANDEM_LINES,
  calculateTargetFromUph,
  computeProductionMetrics,
  getAchievementTone,
  groupHourlyMachineEntries,
  validateDowntimeProblems,
  validateScrapReasons,
} from '../services/metrics';
import { cloudApi } from '../services/cloudClient';
import { createSubmissionId } from '../services/syncQueue';
import { DowntimeProblemsPanel, ScrapSectionPanel, ToolSelectorField } from './ProductionEntryParts';
import CircularGauge from './CircularGauge';

function createEmptyTandemPart() {
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
  const [operatorName, setOperatorName] = useState(
    currentUser?.role === 'Operator' ? currentUser.full_name || '' : ''
  );
  const [parts, setParts] = useState([createEmptyTandemPart()]);
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
      setDowntimeProblems(sorted[0].downtime_problems || []);
      setRemarks(sorted[0].remarks || '');
    } else {
      setParts([createEmptyTandemPart()]);
      setDowntimeProblems([]);
      setRemarks('');
    }
    setPendingSubmissionId(createSubmissionId());
    setSyncStatus({ state: 'idle', message: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLine, selectedHour, selectedDate, selectedShift]);

  const updatePart = (idx, patch) => {
    setParts((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const handleAddPart = () => {
    if (parts.length >= 4) return;
    setParts((prev) => [...prev, createEmptyTandemPart()]);
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
    };
  }, [parts, downtimeProblems]);

  const validateAndBuildBatch = () => {
    if (!selectedDate) return { error: 'Please select a Date.' };
    if (!selectedShift) return { error: 'Please select a Shift.' };
    if (!operatorName.trim()) return { error: 'Operator name is required.' };
    if (!selectedLine) return { error: 'Select a Tandem line.' };

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
    setSyncStatus({ state: 'saving', message: 'Saving simultaneous Tandem parts to cloud...' });
    try {
      await cloudApi.submitProductionBatch(payloadToSend);
      setSyncStatus({
        state: 'saved',
        message: `Saved ${payloadToSend.machine_or_line} (${payloadToSend.hour_interval}): ${payloadToSend.parts.length} simultaneous part(s), ${summary.totalActual.toLocaleString()} pcs total.`,
      });
      setPendingSubmissionId(createSubmissionId());
      setLastPayload(null);
      if (onEntrySaved) onEntrySaved();
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

  const tone = getAchievementTone(summary.combinedPct, summary.totalTarget);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Total Tandem Production Strip */}
      <div className="kpi-grid-4">
        <div className="kpi-box is-orange-accent" style={{ cursor: 'default' }}>
          <span className="kpi-label">Total Tandem Production</span>
          <div className="kpi-number tabular">{tandemMetrics.totals.actual.toLocaleString()} <span className="kpi-unit">pcs</span></div>
          <span className="kpi-comparison">Target: {tandemMetrics.totals.target.toLocaleString()} pcs ({selectedShift})</span>
        </div>
        <div className="kpi-box is-green-accent" style={{ cursor: 'default' }}>
          <span className="kpi-label">Tandem Achievement</span>
          <div className="kpi-number tabular" style={{ color: 'var(--status-ok)' }}>{tandemMetrics.totals.achievementPct}%</div>
          <span className="kpi-comparison">Across all 6 Tandem lines</span>
        </div>
        <div className="kpi-box" style={{ cursor: 'default' }}>
          <span className="kpi-label">Good Parts &amp; Scrap</span>
          <div className="kpi-number tabular">{tandemMetrics.totals.good.toLocaleString()} <span className="kpi-unit">good</span></div>
          <span className="kpi-comparison">Scrap: {tandemMetrics.totals.rejected.toLocaleString()} pcs ({tandemMetrics.totals.scrapPct}%)</span>
        </div>
        <div className="kpi-box" style={{ cursor: 'default' }}>
          <span className="kpi-label">Tandem Downtime</span>
          <div className="kpi-number tabular">{tandemMetrics.totals.downtimeMinutes} <span className="kpi-unit">min</span></div>
          <span className="kpi-comparison">Problems logged: {tandemMetrics.totals.problemCount}</span>
        </div>
      </div>

      {/* 6 Tandem Lines Selector Cards */}
      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <GitBranch size={17} style={{ color: 'var(--accent)' }} />
              6 Tandem Production Lines (Click Line to Enter Production)
            </h2>
            <p className="section-subtitle">LP-1, LP-2, HP-1, HP-2, HP-3, HP-4 — each line supports up to 4 simultaneous parts per hour</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <CircularGauge
              size={64}
              strokeWidth={7}
              value={tandemMetrics.totals.achievementPct}
              target={tandemMetrics.totals.target}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
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
                      lTone === 'green' ? 'is-ok' : lTone === 'orange' ? 'is-warn' : lTone === 'red' ? 'is-err' : ''
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

      {/* Multi-Part Simultaneous Entry Interface (Up to 4 Parts) */}
      <section className="surface-card" aria-labelledby="tandem-form-heading">
        <div className="section-header">
          <div>
            <h2 id="tandem-form-heading" className="section-title">
              {selectedLine} — Simultaneous Multi-Part Hourly Entry (Max 4 Parts)
            </h2>
            <p className="section-subtitle">
              Add up to 4 parts running simultaneously on {selectedLine} during {selectedHour}.
            </p>
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

        <form onSubmit={handleSubmit} noValidate>
          <div className="filter-bar" style={{ marginBottom: 14 }}>
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

          {/* Parts 1..4 */}
          {parts.map((part, idx) => {
            const pm = summary.partMetrics[idx];
            return (
              <div key={idx} className="part-entry-card" style={{ marginBottom: 14 }}>
                <div className="part-entry-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`status-pill ${idx === 0 ? 'is-orange' : 'is-ok'}`}>
                      Part {idx + 1}
                    </span>
                    <strong>Simultaneous Tool Run #{idx + 1} on {selectedLine}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="status-pill tabular">
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

                  <div className="field-group">
                    <label className="field-label" htmlFor={`tan-p${idx + 1}-uph`}>UPH (Units/Hr) *</label>
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

                  <div className="field-group">
                    <label className="field-label" htmlFor={`tan-p${idx + 1}-run`}>Running Duration (min)</label>
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
                  </div>

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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <button
              type="button"
              className="btn btn-green btn-sm"
              onClick={handleAddPart}
              disabled={parts.length >= 4}
            >
              <Plus size={14} />
              <span>Add Simultaneous Part ({parts.length}/4 Max)</span>
            </button>

            <div className="hourly-calc-strip">
              <span><strong>Line Hourly Output:</strong> <span className="tabular">{summary.totalActual.toLocaleString()} pcs</span></span>
              <span><strong>Line Target:</strong> <span className="tabular">{summary.totalTarget.toLocaleString()} pcs</span></span>
              <span>
                <strong>Line Achievement:</strong>{' '}
                <span className={`status-pill tabular ${tone === 'green' ? 'is-ok' : tone === 'orange' ? 'is-warn' : tone === 'red' ? 'is-err' : ''}`}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginTop: 14 }}>
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

            <button type="submit" className="btn btn-primary" disabled={syncStatus.state === 'saving'}>
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
            <p className="section-subtitle">Click an hour row to load or edit simultaneous parts.</p>
          </div>
        </div>

        <div className="table-scroll-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hour</th>
                <th>Simultaneous Parts &amp; Tools</th>
                <th>Operator</th>
                <th>Line Target</th>
                <th>Line Output</th>
                <th>Ach %</th>
                <th>Scrap</th>
                <th>Downtime</th>
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
                    style={{ cursor: 'pointer', background: selectedHour === slot.label ? 'var(--accent-tint)' : undefined }}
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
                              <span className="tabular">({pt.actual_qty}/{pt.target_qty} pcs)</span>
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
      </section>
    </div>
  );
}
