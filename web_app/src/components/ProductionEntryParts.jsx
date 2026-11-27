import React from 'react';
import { Plus, Trash2, AlertTriangle, Clock, Wrench } from 'lucide-react';
import {
  DEFAULT_DOWNTIME_CODES,
  DEFAULT_SCRAP_REASONS,
  calculateTimeDurationMinutes,
  validateDowntimeProblems,
  validateScrapReasons,
} from '../services/metrics';

export function ScrapSectionPanel({
  partNumber = 1,
  scrapQty,
  onChangeScrapQty,
  reasons = [],
  onChangeReasons,
  actualQty = 0,
  idPrefix = 'part1',
  stepLabel = '',
}) {
  const numericScrap = Math.max(0, Number(scrapQty) || 0);
  const validation = validateScrapReasons(numericScrap, reasons, 5);
  const activeReasons = reasons || [];

  const handleAddReason = () => {
    if (activeReasons.length >= 5) return;
    onChangeReasons([
      ...activeReasons,
      { reason_name: DEFAULT_SCRAP_REASONS[0], is_custom: false, qty: '' },
    ]);
  };

  const handleUpdateReason = (idx, patch) => {
    onChangeReasons(activeReasons.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleRemoveReason = (idx) => {
    onChangeReasons(activeReasons.filter((_, i) => i !== idx));
  };

  return (
    <div className="subpanel-box is-scrap">
      <div className="subpanel-head">
        <div>
          <strong style={{ fontSize: '0.84rem', color: 'var(--status-err-ink)' }}>
            {stepLabel ? `${stepLabel} ` : ''}Scrap Details — Part {partNumber}
          </strong>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)' }}>
            Record scrap qty &amp; assign up to 5 scrap reasons (Reason total cannot exceed scrap qty)
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className={`status-pill tabular ${validation.valid ? 'is-ok' : 'is-err'}`}>
            Allocated: {validation.totalReasonQty} / {numericScrap} pcs
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddReason}
            disabled={activeReasons.length >= 5}
          >
            <Plus size={13} />
            <span>Add Scrap Reason ({activeReasons.length}/5)</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 220px) 1fr', gap: 12, alignItems: 'start', marginTop: 10 }}>
        <div className="field-group">
          <label className="field-label" htmlFor={`${idPrefix}-scrap-qty`}>
            Part {partNumber} Scrap Qty (pcs)
          </label>
          <input
            id={`${idPrefix}-scrap-qty`}
            type="text"
            inputMode="numeric"
            className="field-input tabular"
            value={scrapQty}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || /^\d+$/.test(v)) onChangeScrapQty(v);
            }}
            onFocus={(e) => e.target.select()}
            placeholder="0"
          />
          {Number(actualQty) > 0 && numericScrap > Number(actualQty) && (
            <span style={{ fontSize: '0.74rem', color: 'var(--status-err-ink)' }}>
              Scrap cannot exceed Actual ({actualQty})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeReasons.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', padding: '8px 0' }}>
              No individual scrap reasons added. Click &ldquo;Add Scrap Reason&rdquo; to break down scrap by defect type or enter a custom reason.
            </div>
          ) : (
            activeReasons.map((item, idx) => {
              const isStandard = DEFAULT_SCRAP_REASONS.includes(item.reason_name) && !item.is_custom;
              const selectValue = item.is_custom || (!isStandard && item.reason_name !== '') ? '__CUSTOM__' : item.reason_name;

              return (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: selectValue === '__CUSTOM__' ? '1fr 1fr 110px auto' : '1fr 110px auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <select
                    className="field-select"
                    aria-label={`Part ${partNumber} Scrap Reason ${idx + 1}`}
                    value={selectValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__CUSTOM__') {
                        handleUpdateReason(idx, { is_custom: true, reason_name: '' });
                      } else {
                        handleUpdateReason(idx, { is_custom: false, reason_name: val });
                      }
                    }}
                  >
                    {DEFAULT_SCRAP_REASONS.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                    <option value="__CUSTOM__">Custom Reason...</option>
                  </select>

                  {selectValue === '__CUSTOM__' && (
                    <input
                      type="text"
                      className="field-input"
                      aria-label={`Part ${partNumber} Custom Scrap Reason ${idx + 1}`}
                      value={item.reason_name}
                      onChange={(e) => handleUpdateReason(idx, { is_custom: true, reason_name: e.target.value })}
                      placeholder="Type custom scrap reason"
                    />
                  )}

                  <input
                    type="text"
                    inputMode="numeric"
                    className="field-input tabular"
                    aria-label={`Part ${partNumber} Scrap Reason ${idx + 1} Qty`}
                    value={item.qty}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d+$/.test(v)) handleUpdateReason(idx, { qty: v });
                    }}
                    placeholder="Qty"
                  />

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleRemoveReason(idx)}
                    aria-label={`Remove scrap reason ${idx + 1}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {!validation.valid && (
        <div className="banner is-err" role="alert" style={{ marginTop: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={15} />
            {validation.error}
          </span>
        </div>
      )}
    </div>
  );
}

export function DowntimeProblemsPanel({
  problems = [],
  onChangeProblems,
  downtimeCodes = [],
  machine,
  operator,
  date,
  shift,
  hour,
  stepLabel = '',
}) {
  const activeCodes = (downtimeCodes && downtimeCodes.length > 0 ? downtimeCodes : DEFAULT_DOWNTIME_CODES).filter(
    (c) => c.is_active !== false
  );
  const validation = validateDowntimeProblems(problems, 5, 60);

  const handleAddProblem = () => {
    if (problems.length >= 5) return;
    const defaultCode = activeCodes[0] || DEFAULT_DOWNTIME_CODES[0];
    onChangeProblems([
      ...problems,
      {
        start_time: '',
        end_time: '',
        duration_minutes: 0,
        downtime_code: defaultCode.code,
        downtime_reason: defaultCode.name,
        problem_description: '',
      },
    ]);
  };

  const handleUpdateProblem = (idx, patch) => {
    onChangeProblems(
      problems.map((p, i) => {
        if (i !== idx) return p;
        const next = { ...p, ...patch };
        if (patch.start_time !== undefined || patch.end_time !== undefined) {
          const dur = calculateTimeDurationMinutes(next.start_time, next.end_time);
          next.duration_minutes = dur !== null && dur > 0 ? dur : 0;
        }
        return next;
      })
    );
  };

  const handleRemoveProblem = (idx) => {
    onChangeProblems(problems.filter((_, i) => i !== idx));
  };

  return (
    <div className="subpanel-box is-downtime">
      <div className="subpanel-head">
        <div>
          <strong style={{ fontSize: '0.88rem', color: 'var(--status-err-ink)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Clock size={15} style={{ color: 'var(--status-err)' }} />
            {stepLabel ? `${stepLabel} ` : ''}Downtime Details &amp; Problems (Max 5 Problems / Hour)
          </strong>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)', marginTop: 2 }}>
            Context: <strong className="mono">{machine || '—'}</strong> • {date} • {shift} • {hour} • Operator: <strong>{operator || '—'}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className={`status-pill tabular ${validation.valid ? (validation.totalMinutes > 0 ? 'is-warn' : 'is-ok') : 'is-err'}`}>
            Total Downtime: {validation.totalMinutes} min ({problems.length}/5)
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddProblem}
            disabled={problems.length >= 5}
          >
            <Plus size={14} />
            <span>Add Downtime Problem</span>
          </button>
        </div>
      </div>

      {problems.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', paddingTop: 10 }}>
          Zero downtime reported for this machine/hour. Click &ldquo;Add Downtime Problem&rdquo; if any stoppage occurred.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {problems.map((p, idx) => {
            const calcMins = calculateTimeDurationMinutes(p.start_time, p.end_time);
            return (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  background: 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-hover)' }}>
                    Problem #{idx + 1} • {machine} ({shift})
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="status-pill tabular">
                      Duration: {calcMins !== null && calcMins > 0 ? `${calcMins} min` : '—'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRemoveProblem(idx)}
                      aria-label={`Remove downtime problem ${idx + 1}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                  <div className="field-group">
                    <label className="field-label" htmlFor={`dt-start-${idx}`}>Start Time *</label>
                    <input
                      id={`dt-start-${idx}`}
                      type="time"
                      className="field-input tabular"
                      value={p.start_time}
                      onChange={(e) => handleUpdateProblem(idx, { start_time: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor={`dt-end-${idx}`}>End Time *</label>
                    <input
                      id={`dt-end-${idx}`}
                      type="time"
                      className="field-input tabular"
                      value={p.end_time}
                      onChange={(e) => handleUpdateProblem(idx, { end_time: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor={`dt-reason-${idx}`}>Downtime Reason *</label>
                    <select
                      id={`dt-reason-${idx}`}
                      className="field-select"
                      value={p.downtime_code || 'D01'}
                      onChange={(e) => {
                        const matched = activeCodes.find((c) => c.code === e.target.value);
                        handleUpdateProblem(idx, {
                          downtime_code: e.target.value,
                          downtime_reason: matched ? matched.name : e.target.value,
                        });
                      }}
                    >
                      {activeCodes.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group" style={{ gridColumn: 'span 2' }}>
                    <label className="field-label" htmlFor={`dt-desc-${idx}`}>Problem Description</label>
                    <input
                      id={`dt-desc-${idx}`}
                      type="text"
                      className="field-input"
                      value={p.problem_description || ''}
                      onChange={(e) => handleUpdateProblem(idx, { problem_description: e.target.value })}
                      placeholder="Describe root problem or action taken..."
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!validation.valid && (
        <div className="banner is-err" role="alert" style={{ marginTop: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={15} />
            {validation.error}
          </span>
        </div>
      )}
    </div>
  );
}

export function ToolSelectorField({
  id,
  label = 'Tool Number *',
  value,
  onChange,
  tools = [],
  machineType = 'NC',
  onToolSelected,
}) {
  const compatibleTools = (tools || []).filter((t) => {
    if (t.status === 'Retired') return false;
    if (!machineType || machineType === 'ALL') return true;
    return !t.compatible_type || t.compatible_type === 'Both' || t.compatible_type === machineType;
  });

  return (
    <div className="field-group">
      <label className="field-label" htmlFor={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <Wrench size={12} />
        <span>{label}</span>
      </label>
      <select
        id={id}
        className="field-select mono"
        value={compatibleTools.some((t) => t.tool_number === value) ? value : value ? '__OTHER__' : ''}
        onChange={(e) => {
          const val = e.target.value;
          if (val === '__OTHER__') {
            onChange('');
            return;
          }
          const matched = compatibleTools.find((t) => t.tool_number === val);
          onChange(val, matched || null);
          if (onToolSelected && matched) onToolSelected(matched);
        }}
      >
        <option value="">-- Select Tool Number --</option>
        {compatibleTools.map((t) => (
          <option key={t.tool_number} value={t.tool_number}>
            {t.tool_number}{t.part_name ? ` — ${t.part_name}` : ''}{t.standard_uph > 0 ? ` (UPH ${t.standard_uph})` : ''}
          </option>
        ))}
        <option value="__OTHER__">+ Enter Unlisted Tool Number</option>
      </select>
      {(!value || !compatibleTools.some((t) => t.tool_number === value)) && (
        <input
          type="text"
          className="field-input mono"
          aria-label={`${label} manual entry`}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase(), null)}
          placeholder="Type tool code (e.g. T001)"
          style={{ marginTop: 4 }}
        />
      )}
    </div>
  );
}
