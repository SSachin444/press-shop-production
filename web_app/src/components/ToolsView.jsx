import React, { useEffect, useMemo, useState } from 'react';
import {
  Wrench,
  Plus,
  Edit3,
  Trash2,
  Search,
  History,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldAlert,
} from 'lucide-react';
import { getCapabilities } from '../config/roles';
import { cloudApi } from '../services/cloudClient';
import { computeProductionMetrics, getHourSortOrder, normalizeRecord } from '../services/metrics';
import CircularGauge from './CircularGauge';

const TOOL_STATUSES = ['Active', 'In Maintenance', 'Trial', 'Retired'];

export default function ToolsView({
  tools = [],
  machines = [],
  records = [],
  currentUser,
  onReload,
}) {
  const caps = getCapabilities(currentUser?.role);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [notice, setNotice] = useState(null);

  // Full production history across all dates for accurate tool traceability
  const [allHistoryRecords, setAllHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedToolNumber, setSelectedToolNumber] = useState('');

  // Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tool_number: '',
    part_name: '',
    description: '',
    customer: '',
    compatible_type: 'Both',
    compatible_machines: '',
    standard_uph: '',
    tonnage_required: '',
    status: 'Active',
    notes: '',
  });

  // Delete Confirm Dialog
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadFullToolHistory = async () => {
    setHistoryLoading(true);
    try {
      const recs = await cloudApi.getProductionRecords({});
      setAllHistoryRecords(recs || []);
    } catch {
      setAllHistoryRecords(records || []);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadFullToolHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const historySource = allHistoryRecords.length > 0 ? allHistoryRecords : records;

  const toolUsageMap = useMemo(() => {
    const metrics = computeProductionMetrics(historySource, machines, [], {
      plant: 'ALL',
      shift: 'ALL',
      machineGroup: 'ALL',
    });
    const map = new Map();
    metrics.toolSummary.forEach((t) => map.set(t.tool_number, t));
    return map;
  }, [historySource, machines]);

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tools || []).filter((t) => {
      if (statusFilter !== 'ALL' && (t.status || 'Active') !== statusFilter) return false;
      if (typeFilter !== 'ALL' && (t.compatible_type || 'Both') !== typeFilter) return false;
      if (q) {
        const usage = toolUsageMap.get(String(t.tool_number || '').toUpperCase());
        const usedMachines = usage ? [...usage.ncMachines, ...usage.tandemLines].join(' ') : '';
        return (
          String(t.tool_number || '').toLowerCase().includes(q) ||
          String(t.part_name || '').toLowerCase().includes(q) ||
          String(t.description || '').toLowerCase().includes(q) ||
          String(t.customer || '').toLowerCase().includes(q) ||
          usedMachines.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tools, statusFilter, typeFilter, search, toolUsageMap]);

  // Also allow searching any tool found only in historical production records (e.g. deleted from catalog)
  const selectedToolHistory = useMemo(() => {
    const q = (selectedToolNumber || '').trim().toUpperCase();
    if (!q) return null;
    const normalized = (historySource || [])
      .map(normalizeRecord)
      .filter((r) => String(r.tool_number || '').trim().toUpperCase() === q)
      .sort(
        (a, b) =>
          String(b.date || '').localeCompare(String(a.date || '')) ||
          String(a.shift || '').localeCompare(String(b.shift || '')) ||
          getHourSortOrder(a.hour_interval) - getHourSortOrder(b.hour_interval)
      );

    const ncMachines = Array.from(new Set(normalized.filter((r) => r.production_type === 'NC').map((r) => r.machine_or_line)));
    const tandemLines = Array.from(new Set(normalized.filter((r) => r.production_type === 'Tandem').map((r) => r.machine_or_line)));
    const totalActual = normalized.reduce((s, r) => s + r.actual_qty, 0);
    const totalTarget = normalized.reduce((s, r) => s + r.target_qty, 0);
    const totalScrap = normalized.reduce((s, r) => s + r.rejected_qty, 0);
    const totalDowntime = normalized.reduce((s, r) => s + r.downtime_minutes, 0);
    const catalogTool = (tools || []).find((t) => String(t.tool_number || '').toUpperCase() === q);

    return {
      tool_number: q,
      catalogTool,
      records: normalized,
      ncMachines,
      tandemLines,
      totalActual,
      totalTarget,
      totalScrap,
      totalDowntime,
      achievementPct: totalTarget > 0 ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : 0,
    };
  }, [selectedToolNumber, historySource, tools]);

  const openAddModal = () => {
    setIsEdit(false);
    setForm({
      tool_number: '',
      part_name: '',
      description: '',
      customer: '',
      compatible_type: 'Both',
      compatible_machines: '',
      standard_uph: '',
      tonnage_required: '',
      status: 'Active',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (t) => {
    setIsEdit(true);
    setForm({
      tool_number: t.tool_number || '',
      part_name: t.part_name || '',
      description: t.description || '',
      customer: t.customer || '',
      compatible_type: t.compatible_type || 'Both',
      compatible_machines: t.compatible_machines || '',
      standard_uph: t.standard_uph ? String(t.standard_uph) : '',
      tonnage_required: t.tonnage_required ? String(t.tonnage_required) : '',
      status: t.status || 'Active',
      notes: t.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.tool_number.trim()) {
      setNotice({ type: 'err', message: 'Tool Number is required.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await cloudApi.saveTool(
        {
          ...form,
          standard_uph: form.standard_uph ? Number(form.standard_uph) : 0,
          tonnage_required: form.tonnage_required ? Number(form.tonnage_required) : 0,
        },
        isEdit
      );
      setModalOpen(false);
      setNotice({
        type: 'ok',
        message: `${isEdit ? 'Updated' : 'Added'} tool ${form.tool_number.trim().toUpperCase()} cleanly.`,
      });
      if (onReload) await onReload();
    } catch (err) {
      setNotice({ type: 'err', message: err?.message || 'Failed to save tool.' });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await cloudApi.deleteTool(deleteTarget.tool_number);
      setNotice({
        type: 'ok',
        message: `Removed tool ${deleteTarget.tool_number} from directory. ${res.preservedHistoryCount || 0} historical production record(s) preserved safely.`,
      });
      setDeleteTarget(null);
      if (onReload) await onReload();
    } catch (err) {
      setNotice({ type: 'err', message: err?.message || 'Unable to delete tool.' });
    } finally {
      setDeleting(false);
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tool Summary KPIs */}
      <div className="kpi-grid-4">
        <div className="kpi-box" onClick={() => setStatusFilter('ALL')}>
          <span className="kpi-label">Registered Tools</span>
          <div className="kpi-number tabular">{tools.length}</div>
          <span className="kpi-comparison">Active: {tools.filter((t) => t.status === 'Active').length}</span>
        </div>
        <div className="kpi-box is-green-accent" style={{ cursor: 'default' }}>
          <span className="kpi-label">NC Compatible</span>
          <div className="kpi-number tabular" style={{ color: 'var(--status-ok)' }}>
            {tools.filter((t) => t.compatible_type === 'NC' || t.compatible_type === 'Both').length}
          </div>
          <span className="kpi-comparison">Selectable in NC Hourly Entry</span>
        </div>
        <div className="kpi-box is-orange-accent" style={{ cursor: 'default' }}>
          <span className="kpi-label">Tandem Compatible</span>
          <div className="kpi-number tabular" style={{ color: 'var(--accent)' }}>
            {tools.filter((t) => t.compatible_type === 'Tandem' || t.compatible_type === 'Both').length}
          </div>
          <span className="kpi-comparison">Selectable in Tandem Lines</span>
        </div>
        <div className="kpi-box" onClick={() => setStatusFilter('In Maintenance')}>
          <span className="kpi-label">In Maintenance / Trial</span>
          <div className="kpi-number tabular">
            {tools.filter((t) => t.status === 'In Maintenance' || t.status === 'Trial').length}
          </div>
          <span className="kpi-comparison">Click to inspect tool status</span>
        </div>
      </div>

      {/* Tool Directory Table */}
      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Wrench size={17} style={{ color: 'var(--accent)' }} />
              Tool &amp; Die Management ({filteredTools.length})
            </h2>
            <p className="section-subtitle">
              Traceable across all NC machines and Tandem lines. Deleting a tool preserves all historical production records.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadFullToolHistory} disabled={historyLoading}>
              <History size={14} />
              <span>{historyLoading ? 'Syncing History...' : 'Refresh History'}</span>
            </button>
            {caps.canManageTools && (
              <button type="button" className="btn btn-primary btn-sm" onClick={openAddModal}>
                <Plus size={14} />
                <span>Add Tool</span>
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 13, color: 'var(--ink-muted)' }} />
            <input
              type="text"
              className="field-input"
              style={{ paddingLeft: 30 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tool number, part name, customer, machine..."
              aria-label="Search tools"
            />
          </div>

          <select
            className="field-select"
            style={{ width: 165 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter tools by status"
          >
            <option value="ALL">All Statuses</option>
            {TOOL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            className="field-select"
            style={{ width: 165 }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter tools by line compatibility"
          >
            <option value="ALL">All Machine Types</option>
            <option value="Both">Both (NC &amp; Tandem)</option>
            <option value="NC">NC Only</option>
            <option value="Tandem">Tandem Only</option>
          </select>
        </div>

        <div className="table-scroll-wrap desktop-table-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tool Number</th>
                <th>Part Name / Description</th>
                <th>Compatibility</th>
                <th>Std UPH</th>
                <th>Status</th>
                <th>Machines &amp; Lines Used</th>
                <th>Total Production</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTools.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: 24 }}>
                    No tools match your current filter. Click &ldquo;Add Tool&rdquo; to register a new die or tool.
                  </td>
                </tr>
              ) : (
                filteredTools.map((t) => {
                  const usage = toolUsageMap.get(String(t.tool_number || '').toUpperCase());
                  const pill =
                    t.status === 'Active' ? 'is-ok' : t.status === 'Retired' ? 'is-err' : 'is-warn';
                  return (
                    <tr key={t.tool_number}>
                      <td>
                        <button
                          type="button"
                          className="mono"
                          onClick={() => setSelectedToolNumber(t.tool_number)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontWeight: 700,
                            color: 'var(--accent-hover)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          {t.tool_number}
                        </button>
                      </td>
                      <td>
                        <div><strong>{t.part_name || '—'}</strong></div>
                        {t.description && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>{t.description}</div>
                        )}
                      </td>
                      <td>{t.compatible_type || 'Both'}</td>
                      <td className="tabular">{t.standard_uph > 0 ? t.standard_uph : '—'}</td>
                      <td><span className={`status-pill ${pill}`}>{t.status || 'Active'}</span></td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {usage ? (
                          <>
                            {usage.ncMachines.length > 0 && <div>NC: {usage.ncMachines.join(', ')}</div>}
                            {usage.tandemLines.length > 0 && <div>Tandem: {usage.tandemLines.join(', ')}</div>}
                            {usage.ncMachines.length === 0 && usage.tandemLines.length === 0 && '—'}
                          </>
                        ) : (
                          'Not run yet'
                        )}
                      </td>
                      <td className="tabular">
                        <strong>{usage ? `${usage.actual.toLocaleString()} pcs` : '0 pcs'}</strong>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedToolNumber(t.tool_number)}
                          >
                            <History size={13} />
                            <span>History</span>
                          </button>
                          {caps.canManageTools && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditModal(t)}
                            >
                              <Edit3 size={13} />
                              <span>Edit</span>
                            </button>
                          )}
                          {(caps.canDeleteTools || caps.canManageTools) && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => setDeleteTarget(t)}
                              aria-label={`Delete tool ${t.tool_number}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-card-list">
          {filteredTools.map((t) => {
            const usage = toolUsageMap.get(String(t.tool_number || '').toUpperCase());
            const pill = t.status === 'Active' ? 'is-ok' : t.status === 'Retired' ? 'is-err' : 'is-warn';
            return (
              <div key={t.tool_number} className="mobile-entity-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong className="mono">{t.tool_number}</strong>
                  <span className={`status-pill ${pill}`}>{t.status || 'Active'}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
                  {t.part_name || t.description || 'No part description'} • {t.compatible_type}
                </div>
                <div className="tabular" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                  Total Output: <strong>{usage ? usage.actual.toLocaleString() : 0} pcs</strong>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedToolNumber(t.tool_number)}>
                    History
                  </button>
                  {caps.canManageTools && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditModal(t)}>
                      Edit
                    </button>
                  )}
                  {(caps.canDeleteTools || caps.canManageTools) && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(t)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tool Production History Traceability Panel */}
      <section className="surface-card" aria-labelledby="tool-history-heading">
        <div className="section-header">
          <div>
            <h2 id="tool-history-heading" className="section-title">Tool Production History &amp; Traceability</h2>
            <p className="section-subtitle">
              Search or click any tool number above to view all NC machines, Tandem lines, dates, shifts, operators, output, scrap, and downtime.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="field-input mono"
              style={{ width: 220 }}
              value={selectedToolNumber}
              onChange={(e) => setSelectedToolNumber(e.target.value.toUpperCase())}
              placeholder="Enter Tool # (e.g. HDB16)"
              list="all-historical-tools-list"
              aria-label="Inspect tool production history"
            />
            <datalist id="all-historical-tools-list">
              {Array.from(
                new Set([
                  ...(tools || []).map((t) => String(t.tool_number || '').toUpperCase()),
                  ...Array.from(toolUsageMap.keys()),
                ])
              )
                .filter(Boolean)
                .sort()
                .map((tn) => (
                  <option key={tn} value={tn} />
                ))}
            </datalist>
          </div>
        </div>

        {!selectedToolHistory ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.84rem' }}>
            Select a tool from the directory or enter a Tool Number above to inspect its full production history across NC and Tandem lines.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' }}>
              <CircularGauge
                value={selectedToolHistory.achievementPct}
                target={selectedToolHistory.totalTarget}
                label={`Tool ${selectedToolHistory.tool_number}`}
                sublabel={selectedToolHistory.catalogTool?.part_name || 'Historical Part'}
              />
              <div className="kpi-box" style={{ cursor: 'default' }}>
                <span className="kpi-label">Total Production</span>
                <div className="kpi-number tabular">{selectedToolHistory.totalActual.toLocaleString()} <span className="kpi-unit">pcs</span></div>
                <span className="kpi-comparison">Target: {selectedToolHistory.totalTarget.toLocaleString()} pcs</span>
              </div>
              <div className="kpi-box" style={{ cursor: 'default' }}>
                <span className="kpi-label">NC Machines Used</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: 4 }} className="mono">
                  {selectedToolHistory.ncMachines.length > 0 ? selectedToolHistory.ncMachines.join(', ') : 'None'}
                </div>
                <span className="kpi-comparison">Tandem: {selectedToolHistory.tandemLines.length > 0 ? selectedToolHistory.tandemLines.join(', ') : 'None'}</span>
              </div>
              <div className="kpi-box" style={{ cursor: 'default' }}>
                <span className="kpi-label">Scrap &amp; Downtime</span>
                <div className="kpi-number tabular">{selectedToolHistory.totalScrap.toLocaleString()} <span className="kpi-unit">scrap</span></div>
                <span className="kpi-comparison">Downtime: {selectedToolHistory.totalDowntime} min</span>
              </div>
            </div>

            {selectedToolHistory.records.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.84rem' }}>
                No production runs logged yet for tool <strong className="mono">{selectedToolHistory.tool_number}</strong>.
              </p>
            ) : (
              <div className="table-scroll-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Shift</th>
                      <th>Type</th>
                      <th>Machine / Line</th>
                      <th>Hour</th>
                      <th>Operator</th>
                      <th>Target</th>
                      <th>Actual Production</th>
                      <th>Scrap</th>
                      <th>Downtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedToolHistory.records.map((r, i) => (
                      <tr key={r.id || i}>
                        <td className="tabular">{r.date}</td>
                        <td>{r.shift}</td>
                        <td>
                          <span className={`status-pill ${r.production_type === 'Tandem' ? 'is-orange' : 'is-ok'}`}>
                            {r.production_type}
                          </span>
                        </td>
                        <td><strong className="mono">{r.machine_or_line}</strong></td>
                        <td>{r.hour_interval}</td>
                        <td>{r.operator_name || '—'}</td>
                        <td className="tabular">{r.target_qty.toLocaleString()}</td>
                        <td className="tabular"><strong>{r.actual_qty.toLocaleString()}</strong></td>
                        <td className="tabular">{r.rejected_qty.toLocaleString()}</td>
                        <td className="tabular">{r.downtime_minutes}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Add / Edit Tool Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Tool' : 'Add Tool'}>
          <form className="modal-dialog" style={{ maxWidth: 600 }} onSubmit={handleSave}>
            <div className="modal-head">
              <h3 className="section-title">{isEdit ? `Edit Tool ${form.tool_number}` : 'Register New Tool / Die'}</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              <div className="field-group">
                <label className="field-label" htmlFor="tl-num">Tool Number *</label>
                <input
                  id="tl-num"
                  className="field-input mono"
                  value={form.tool_number}
                  disabled={isEdit}
                  onChange={(e) => setForm({ ...form, tool_number: e.target.value.toUpperCase() })}
                  placeholder="e.g. T001 or HDB16"
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="tl-part">Part Name *</label>
                <input
                  id="tl-part"
                  className="field-input"
                  value={form.part_name}
                  onChange={(e) => setForm({ ...form, part_name: e.target.value })}
                  placeholder="e.g. Center Pillar LH"
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="tl-type">Machine Compatibility</label>
                <select
                  id="tl-type"
                  className="field-select"
                  value={form.compatible_type}
                  onChange={(e) => setForm({ ...form, compatible_type: e.target.value })}
                >
                  <option value="Both">Both (NC &amp; Tandem)</option>
                  <option value="NC">NC Presses</option>
                  <option value="Tandem">Tandem Lines</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="tl-status">Tool Status</label>
                <select
                  id="tl-status"
                  className="field-select"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {TOOL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="tl-uph">Standard UPH</label>
                <input
                  id="tl-uph"
                  type="text"
                  inputMode="decimal"
                  className="field-input tabular"
                  value={form.standard_uph}
                  onChange={(e) => {
                    if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setForm({ ...form, standard_uph: e.target.value });
                  }}
                  placeholder="e.g. 1200"
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="tl-ton">Required Tonnage (T)</label>
                <input
                  id="tl-ton"
                  type="text"
                  inputMode="numeric"
                  className="field-input tabular"
                  value={form.tonnage_required}
                  onChange={(e) => {
                    if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setForm({ ...form, tonnage_required: e.target.value });
                  }}
                  placeholder="e.g. 800"
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="tl-cust">Customer / Vehicle Model</label>
                <input
                  id="tl-cust"
                  className="field-input"
                  value={form.customer}
                  onChange={(e) => setForm({ ...form, customer: e.target.value })}
                  placeholder="e.g. Hyundai / Kia"
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="tl-machs">Preferred Machines / Lines</label>
                <input
                  id="tl-machs"
                  className="field-input mono"
                  value={form.compatible_machines}
                  onChange={(e) => setForm({ ...form, compatible_machines: e.target.value.toUpperCase() })}
                  placeholder="e.g. P01075, LP-1"
                />
              </div>
              <div className="field-group" style={{ gridColumn: '1 / -1' }}>
                <label className="field-label" htmlFor="tl-desc">Part Description &amp; Tool Notes</label>
                <textarea
                  id="tl-desc"
                  rows={2}
                  className="field-textarea"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Die specification, cavity count, maintenance intervals..."
                />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Tool'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Safe Tool Delete Confirmation */}
      {deleteTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm tool deletion">
          <div className="modal-dialog" style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-err-ink)' }}>
                <ShieldAlert size={18} />
                Confirm Tool Deletion
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p>
                Delete tool <strong className="mono">{deleteTarget.tool_number}</strong> ({deleteTarget.part_name || 'No part name'}) from the Tool Directory?
              </p>
              <div className="banner is-ok" style={{ fontSize: '0.8rem' }}>
                <span>Historical production records and scrap reports using {deleteTarget.tool_number} will NOT be erased.</span>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : `Delete ${deleteTarget.tool_number}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
