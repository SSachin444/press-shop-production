import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getCapabilities } from '../config/roles';
import { cloudApi } from '../services/cloudClient';
import { PLANTS, SHIFTS, computeProductionMetrics } from '../services/metrics';

export default function ProductionOverviewView({
  selectedPlant,
  setSelectedPlant,
  selectedDate,
  setSelectedDate,
  selectedShift,
  setSelectedShift,
  machines,
  records,
  downtimes,
  currentUser,
  onNavigate,
  onRefresh,
}) {
  const caps = getCapabilities(currentUser?.role);
  const [subTab, setSubTab] = useState('overview'); // 'overview' | 'nc' | 'tandem' | 'shifts' | 'plans'
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [selectedPlanMachine, setSelectedPlanMachine] = useState('');
  const [planForm, setPlanForm] = useState({
    machine_number: '',
    plan_index: '1',
    tool_number: '',
    plan_quantity: '',
    part_name: '',
    target_date: selectedDate || '',
    target_shift: selectedShift || 'Shift A',
    status: 'Queued',
    remarks: '',
  });
  const [savingPlan, setSavingPlan] = useState(false);

  const loadPlans = async (machine = '') => {
    setPlansLoading(true);
    try {
      const data = await cloudApi.getPlans(machine);
      setPlans(data || []);
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Failed to load tool plans.' });
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'plans') {
      loadPlans(selectedPlanMachine);
    }
  }, [subTab, selectedPlanMachine]);

  const metricsAll = useMemo(
    () =>
      computeProductionMetrics(records, machines, downtimes, {
        plant: selectedPlant,
        date: selectedDate,
        shift: selectedShift,
        machineGroup: 'ALL',
      }),
    [records, machines, downtimes, selectedPlant, selectedDate, selectedShift]
  );

  const ncMetrics = useMemo(
    () =>
      computeProductionMetrics(records, machines, downtimes, {
        plant: selectedPlant,
        date: selectedDate,
        shift: selectedShift,
        machineGroup: 'NC',
      }),
    [records, machines, downtimes, selectedPlant, selectedDate, selectedShift]
  );

  const tandemMetrics = useMemo(
    () =>
      computeProductionMetrics(records, machines, downtimes, {
        plant: selectedPlant,
        date: selectedDate,
        shift: selectedShift,
        machineGroup: 'Tandem',
      }),
    [records, machines, downtimes, selectedPlant, selectedDate, selectedShift]
  );

  const shiftBreakdown = useMemo(
    () =>
      SHIFTS.map((s) => {
        const m = computeProductionMetrics(records, machines, downtimes, {
          plant: selectedPlant,
          date: selectedDate,
          shift: s.id,
          machineGroup: 'ALL',
        });
        return {
          ...s,
          ...m.totals,
        };
      }),
    [records, machines, downtimes, selectedPlant, selectedDate]
  );

  const displayedRows =
    subTab === 'nc'
      ? ncMetrics.machines
      : subTab === 'tandem'
        ? tandemMetrics.machines
        : metricsAll.machines;

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!caps.canManagePlans) return;
    if (!planForm.machine_number || !planForm.tool_number.trim()) {
      setNotice({ type: 'err', text: 'Select a machine and enter a tool/die number.' });
      return;
    }
    const qty = Number(planForm.plan_quantity);
    if (Number.isNaN(qty) || qty < 0) {
      setNotice({ type: 'err', text: 'Plan quantity must be zero or greater.' });
      return;
    }
    setSavingPlan(true);
    setNotice(null);
    try {
      await cloudApi.savePlan({
        ...planForm,
        plan_index: Number(planForm.plan_index) || 1,
        plan_quantity: qty,
      });
      setNotice({ type: 'ok', text: `Saved tool plan on ${planForm.machine_number}.` });
      setPlanForm((prev) => ({ ...prev, tool_number: '', plan_quantity: '', part_name: '', remarks: '' }));
      await loadPlans(selectedPlanMachine);
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Unable to save tool plan.' });
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (plan) => {
    if (!caps.canManagePlans || !plan?.id) return;
    try {
      await cloudApi.deletePlan(plan.id);
      setNotice({ type: 'ok', text: `Removed tool plan ${plan.tool_number} from ${plan.machine_number}.` });
      await loadPlans(selectedPlanMachine);
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Unable to remove plan.' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter Bar */}
      <section className="surface-card">
        <div className="filter-bar">
          <div className="field-group">
            <label className="field-label" htmlFor="prod-plant">Plant</label>
            <select
              id="prod-plant"
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
            <label className="field-label" htmlFor="prod-date">Date</label>
            <input
              id="prod-date"
              type="date"
              className="field-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="prod-shift">Shift</label>
            <select
              id="prod-shift"
              className="field-select"
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
            >
              <option value="ALL">All Shifts</option>
              {SHIFTS.map((s) => (
                <option key={s.id} value={s.id}>{s.id}</option>
              ))}
            </select>
          </div>

          <div className="field-group" style={{ justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={onRefresh}>
                <RefreshCw size={15} />
                Refresh
              </button>
              {caps.canSubmitProduction && (
                <button type="button" className="btn btn-primary" onClick={() => onNavigate('hourly-production')}>
                  Log Hourly Entry
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sub-navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="tablist" aria-label="Production views">
        {[
          { id: 'overview', label: 'All Units' },
          { id: 'nc', label: `NC Units (${ncMetrics.machineCounts.total})` },
          { id: 'tandem', label: `Tandem Lines (${tandemMetrics.machineCounts.total})` },
          { id: 'shifts', label: '3-Shift Comparison' },
          { id: 'plans', label: 'Tool Plans' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={subTab === t.id}
            className={`btn ${subTab === t.id ? 'btn-navy' : 'btn-secondary'}`}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className={`banner ${notice.type === 'ok' ? 'is-ok' : 'is-err'}`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {notice.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {notice.text}
          </span>
        </div>
      )}

      {/* Group Summary KPI Strip */}
      {subTab !== 'shifts' && subTab !== 'plans' && (
        <div className="kpi-grid-4">
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <div className="kpi-label">NC 16 Units Output</div>
            <div className="kpi-number tabular">{ncMetrics.totals.actual.toLocaleString()}</div>
            <div className="kpi-comparison">
              Target {ncMetrics.totals.target.toLocaleString()} ({ncMetrics.totals.achievementPct}%)
            </div>
          </div>
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <div className="kpi-label">Tandem 6 Lines Output</div>
            <div className="kpi-number tabular">{tandemMetrics.totals.actual.toLocaleString()}</div>
            <div className="kpi-comparison">
              Target {tandemMetrics.totals.target.toLocaleString()} ({tandemMetrics.totals.achievementPct}%)
            </div>
          </div>
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <div className="kpi-label">Combined Good Parts</div>
            <div className="kpi-number tabular">{metricsAll.totals.good.toLocaleString()}</div>
            <div className="kpi-comparison">
              Quality {metricsAll.totals.qualityPct}% | Scrap {metricsAll.totals.rejected.toLocaleString()}
            </div>
          </div>
          <div className="kpi-box" style={{ cursor: 'default' }}>
            <div className="kpi-label">Combined Downtime</div>
            <div className="kpi-number tabular">
              {metricsAll.totals.downtimeMinutes}
              <span className="kpi-unit">min</span>
            </div>
            <div className="kpi-comparison">
              Across {metricsAll.totals.machinesAffected} machine(s)
            </div>
          </div>
        </div>
      )}

      {/* Machines Performance Table */}
      {(subTab === 'overview' || subTab === 'nc' || subTab === 'tandem') && (
        <section className="surface-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                {subTab === 'nc' ? 'NC Press Units Output' : subTab === 'tandem' ? 'Tandem Press Lines Output' : 'All Press Shop Units'}
              </h2>
              <p className="section-subtitle">Calculated from confirmed production logs for {selectedDate} ({selectedShift})</p>
            </div>
          </div>

          <div className="desktop-table-only table-scroll-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Group</th>
                  <th>Status</th>
                  <th>Actual</th>
                  <th>Target</th>
                  <th>Achievement</th>
                  <th>Good / Scrap</th>
                  <th>Downtime</th>
                  <th>Operator</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((m) => (
                  <tr key={m.machine_number}>
                    <td className="mono" style={{ fontWeight: 700 }}>{m.machine_number}</td>
                    <td>{m.machine_type}</td>
                    <td>
                      <span className={`status-pill ${m.status === 'Running' ? 'is-ok' : m.status === 'Breakdown' ? 'is-err' : 'is-warn'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="tabular">{m.actual.toLocaleString()}</td>
                    <td className="tabular">{m.target.toLocaleString()}</td>
                    <td className="tabular">{m.achievement_pct}%</td>
                    <td className="tabular">{m.good.toLocaleString()} / {m.rejected.toLocaleString()}</td>
                    <td className="tabular">{m.downtime} min</td>
                    <td>{m.operator || 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-card-list">
            {displayedRows.map((m) => (
              <div key={m.machine_number} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong className="mono">{m.machine_number} ({m.machine_type})</strong>
                  <span className={`status-pill ${m.status === 'Running' ? 'is-ok' : m.status === 'Breakdown' ? 'is-err' : 'is-warn'}`}>
                    {m.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
                  Output: <strong className="tabular">{m.actual.toLocaleString()}</strong> / {m.target.toLocaleString()} ({m.achievement_pct}%) | DT: {m.downtime} min
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3-Shift Comparison */}
      {subTab === 'shifts' && (
        <section className="surface-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">3-Shift Production Comparison — {selectedDate}</h2>
              <p className="section-subtitle">Unified calculation across Shift A, Shift B, and Shift C</p>
            </div>
          </div>

          <div className="table-scroll-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shift</th>
                  <th>Schedule</th>
                  <th>Entries</th>
                  <th>Actual</th>
                  <th>Target</th>
                  <th>Achievement</th>
                  <th>Good</th>
                  <th>Scrap</th>
                  <th>Downtime</th>
                </tr>
              </thead>
              <tbody>
                {shiftBreakdown.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>{s.id}</td>
                    <td>{s.label.replace(`${s.id} `, '')}</td>
                    <td className="tabular">{s.recordCount}</td>
                    <td className="tabular">{s.actual.toLocaleString()}</td>
                    <td className="tabular">{s.target.toLocaleString()}</td>
                    <td className="tabular">{s.achievementPct}%</td>
                    <td className="tabular">{s.good.toLocaleString()}</td>
                    <td className="tabular">{s.rejected.toLocaleString()}</td>
                    <td className="tabular">{s.downtimeMinutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tool Plans */}
      {subTab === 'plans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {caps.canManagePlans && (
            <form className="surface-card" onSubmit={handleSavePlan}>
              <div className="section-header">
                <div>
                  <h2 className="section-title">Assign / Update Tool Plan</h2>
                  <p className="section-subtitle">Queue upcoming tool/die runs on press machines</p>
                </div>
              </div>

              <div className="filter-bar">
                <div className="field-group">
                  <label className="field-label" htmlFor="plan-machine">Machine</label>
                  <select
                    id="plan-machine"
                    className="field-select"
                    value={planForm.machine_number}
                    onChange={(e) => setPlanForm({ ...planForm, machine_number: e.target.value })}
                    required
                  >
                    <option value="">Select machine</option>
                    {machines.map((m) => (
                      <option key={m.machine_number} value={m.machine_number}>
                        {m.machine_number} ({m.machine_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="plan-slot">Queue Slot</label>
                  <select
                    id="plan-slot"
                    className="field-select"
                    value={planForm.plan_index}
                    onChange={(e) => setPlanForm({ ...planForm, plan_index: e.target.value })}
                  >
                    <option value="1">Plan #1 (Active)</option>
                    <option value="2">Plan #2 (Next)</option>
                    <option value="3">Plan #3 (Queued)</option>
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="plan-tool">Tool / Die Number</label>
                  <input
                    id="plan-tool"
                    type="text"
                    className="field-input"
                    value={planForm.tool_number}
                    onChange={(e) => setPlanForm({ ...planForm, tool_number: e.target.value })}
                    placeholder="e.g. DIE-402"
                    required
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="plan-qty">Plan Quantity</label>
                  <input
                    id="plan-qty"
                    type="text"
                    inputMode="numeric"
                    className="field-input"
                    value={planForm.plan_quantity}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v === '' || /^\d+$/.test(v)) {
                        setPlanForm({ ...planForm, plan_quantity: v });
                      }
                    }}
                    placeholder="0"
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="plan-part">Part Name</label>
                  <input
                    id="plan-part"
                    type="text"
                    className="field-input"
                    value={planForm.part_name}
                    onChange={(e) => setPlanForm({ ...planForm, part_name: e.target.value })}
                    placeholder="Optional part description"
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="plan-status">Plan Status</label>
                  <select
                    id="plan-status"
                    className="field-select"
                    value={planForm.status}
                    onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Queued">Queued</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={savingPlan}>
                  <Plus size={15} />
                  {savingPlan ? 'Saving...' : 'Save Tool Plan'}
                </button>
              </div>
            </form>
          )}

          <section className="surface-card">
            <div className="section-header">
              <div>
                <h2 className="section-title">Scheduled Tool Plans ({plans.length})</h2>
                <p className="section-subtitle">Active and queued dies across press lines</p>
              </div>
              <select
                className="field-select"
                style={{ width: 200 }}
                aria-label="Filter tool plans by machine"
                value={selectedPlanMachine}
                onChange={(e) => setSelectedPlanMachine(e.target.value)}
              >
                <option value="">All Machines</option>
                {machines.map((m) => (
                  <option key={m.machine_number} value={m.machine_number}>{m.machine_number}</option>
                ))}
              </select>
            </div>

            {plansLoading ? (
              <div className="skeleton-line" style={{ height: 100, width: '100%' }} />
            ) : plans.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.86rem' }}>No tool plans scheduled.</p>
            ) : (
              <div className="table-scroll-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Slot</th>
                      <th>Tool Number</th>
                      <th>Part</th>
                      <th>Plan Qty</th>
                      <th>Status</th>
                      {caps.canManagePlans && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.id || `${p.machine_number}-${p.plan_index}`}>
                        <td className="mono" style={{ fontWeight: 700 }}>{p.machine_number}</td>
                        <td className="tabular">#{p.plan_index}</td>
                        <td className="mono">{p.tool_number}</td>
                        <td>{p.part_name || '-'}</td>
                        <td className="tabular">{Number(p.plan_quantity || 0).toLocaleString()}</td>
                        <td>
                          <span className={`status-pill ${p.status === 'Active' ? 'is-ok' : 'is-warn'}`}>
                            {p.status}
                          </span>
                        </td>
                        {caps.canManagePlans && (
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDeletePlan(p)}
                              aria-label={`Delete plan ${p.tool_number}`}
                            >
                              <Trash2 size={14} />
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
