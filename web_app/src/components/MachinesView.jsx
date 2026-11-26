import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit3, Trash2, AlertCircle, CheckCircle2, X, Search, ShieldAlert, Settings2 } from 'lucide-react';
import { getCapabilities } from '../config/roles';
import { cloudApi } from '../services/cloudClient';
import { DEFAULT_DOWNTIME_CODES } from '../services/metrics';

const STATUS_OPTIONS = ['Running', 'Idle', 'Maintenance', 'Breakdown'];

export default function MachinesView({
  machines,
  downtimes,
  downtimeCodes,
  currentUser,
  onReload,
}) {
  const caps = getCapabilities(currentUser?.role);
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [subTab, setSubTab] = useState('directory'); // 'directory' | 'downtime' | 'codes'
  const [notice, setNotice] = useState(null);

  // Admin Machine Add/Edit State
  const [editingMachine, setEditingMachine] = useState(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    machine_number: '',
    machine_type: 'NC',
    tonnage: '500',
    production_target: '500',
    status: 'Idle',
    assigned_operator: '',
    maintenance_notes: '',
    version: 1,
  });

  // Safe Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Downtime Codes State (Admin only, up to 10 options)
  const [codesDraft, setCodesDraft] = useState(() =>
    downtimeCodes && downtimeCodes.length > 0 ? downtimeCodes : DEFAULT_DOWNTIME_CODES
  );

  useEffect(() => {
    if (downtimeCodes && downtimeCodes.length > 0) {
      setCodesDraft(downtimeCodes);
    }
  }, [downtimeCodes]);

  const filteredMachines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (machines || []).filter((m) => {
      if (groupFilter !== 'ALL' && m.machine_type !== groupFilter) return false;
      if (statusFilter !== 'ALL' && (m.status || 'Idle') !== statusFilter) return false;
      if (q) {
        return (
          String(m.machine_number).toLowerCase().includes(q) ||
          String(m.machine_type || '').toLowerCase().includes(q) ||
          String(m.assigned_operator || '').toLowerCase().includes(q) ||
          String(m.status || '').toLowerCase().includes(q) ||
          String(m.maintenance_notes || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [machines, groupFilter, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const counts = { Running: 0, Idle: 0, Maintenance: 0, Breakdown: 0 };
    (machines || []).forEach((m) => {
      const s = m.status || 'Idle';
      if (counts[s] !== undefined) counts[s] += 1;
    });
    return counts;
  }, [machines]);

  const openEditModal = (m) => {
    if (!caps.canEditMachines) return;
    setIsAddMode(false);
    setEditingMachine(m);
    setForm({
      machine_number: m.machine_number,
      machine_type: m.machine_type || 'NC',
      tonnage: String(m.tonnage ?? ''),
      production_target: String(m.production_target ?? ''),
      status: m.status || 'Idle',
      assigned_operator: m.assigned_operator || '',
      maintenance_notes: m.maintenance_notes || '',
      version: m.version ?? 1,
    });
    setConfirmOpen(false);
  };

  const openAddModal = () => {
    if (!caps.canEditMachines) return;
    setIsAddMode(true);
    setEditingMachine({});
    setForm({
      machine_number: '',
      machine_type: 'NC',
      tonnage: '500',
      production_target: '500',
      status: 'Idle',
      assigned_operator: '',
      maintenance_notes: '',
      version: 1,
    });
    setConfirmOpen(false);
  };

  const validateMachineForm = () => {
    if (!form.machine_number.trim()) return 'Machine number is required.';
    const t = Number(form.tonnage);
    const tgt = Number(form.production_target);
    if (!Number.isFinite(t) || t < 0 || t > 20000) return 'Tonnage must be between 0 and 20,000.';
    if (!Number.isInteger(tgt) || tgt < 0 || tgt > 100000) return 'Target must be a whole number between 0 and 100,000.';
    return null;
  };

  const handleConfirmSave = async () => {
    const err = validateMachineForm();
    if (err) {
      setNotice({ type: 'err', message: err });
      setConfirmOpen(false);
      return;
    }

    try {
      setSaving(true);
      if (isAddMode) {
        await cloudApi.createMachine({
          machine_number: form.machine_number.trim().toUpperCase(),
          machine_type: form.machine_type,
          tonnage: Number(form.tonnage),
          production_target: Number(form.production_target),
          status: form.status,
          assigned_operator: form.assigned_operator.trim(),
          maintenance_notes: form.maintenance_notes.trim(),
        });
        setNotice({ type: 'ok', message: `Machine ${form.machine_number.toUpperCase()} added and audited.` });
      } else {
        await cloudApi.updateMachineConfig(editingMachine.machine_number, {
          machine_number: form.machine_number.trim().toUpperCase(),
          machine_type: form.machine_type,
          tonnage: Number(form.tonnage),
          production_target: Number(form.production_target),
          status: form.status,
          assigned_operator: form.assigned_operator.trim(),
          maintenance_notes: form.maintenance_notes.trim(),
          version: form.version,
        });
        setNotice({ type: 'ok', message: `Machine ${form.machine_number.toUpperCase()} configuration saved and audited.` });
      }
      setEditingMachine(null);
      setConfirmOpen(false);
      if (onReload) onReload();
    } catch (e) {
      setNotice({ type: 'err', message: e.message || 'Unable to save machine configuration.' });
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (m) => {
    if (!caps.canDeleteMachines) return;
    setDeleteTarget(m);
    setDeleteConfirmText('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !caps.canDeleteMachines) return;
    const expected = String(deleteTarget.machine_number || '').trim().toUpperCase();
    if (deleteConfirmText.trim().toUpperCase() !== expected) {
      setNotice({ type: 'err', message: `Type "${expected}" exactly to confirm deletion.` });
      return;
    }
    try {
      setDeleting(true);
      const res = await cloudApi.deleteMachine(expected);
      setNotice({
        type: 'ok',
        message: `Machine ${expected} removed from directory. ${res.preservedHistoryCount || 0} historical production record(s) preserved safely.`,
      });
      setDeleteTarget(null);
      setDeleteConfirmText('');
      if (onReload) onReload();
    } catch (e) {
      setNotice({ type: 'err', message: e.message || 'Unable to delete machine.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleAddDowntimeCode = () => {
    if (codesDraft.length >= 10) return;
    const nextNum = codesDraft.length + 1;
    const code = `D${String(nextNum).padStart(2, '0')}`;
    const exists = new Set(codesDraft.map((c) => c.code));
    let candidate = code;
    let i = nextNum;
    while (exists.has(candidate) && i <= 99) {
      i += 1;
      candidate = `D${String(i).padStart(2, '0')}`;
    }
    setCodesDraft((prev) => [
      ...prev,
      { code: candidate, name: '', description: '', display_order: prev.length + 1, is_active: true },
    ]);
  };

  const handleRemoveDowntimeCode = (idx) => {
    if (codesDraft.length <= 1) return;
    setCodesDraft((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveCodes = async () => {
    if (!caps.canManageDowntimeCodes) return;
    try {
      setSaving(true);
      await cloudApi.saveDowntimeCodes(codesDraft);
      setNotice({ type: 'ok', message: `Saved ${codesDraft.length} configurable downtime reason option(s).` });
      if (onReload) onReload();
    } catch (e) {
      setNotice({ type: 'err', message: e.message || 'Unable to update downtime codes.' });
    } finally {
      setSaving(false);
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

      {/* Fleet Status Summary Strip */}
      <div className="kpi-grid-4">
        <div className="kpi-box" onClick={() => setStatusFilter('ALL')}>
          <span className="kpi-label">Total Machines</span>
          <div className="kpi-number tabular">{machines.length}</div>
          <span className="kpi-comparison">
            NC: {machines.filter((m) => m.machine_type === 'NC').length} • Tandem: {machines.filter((m) => m.machine_type === 'Tandem').length}
          </span>
        </div>
        <div className="kpi-box is-green-accent" onClick={() => setStatusFilter(statusFilter === 'Running' ? 'ALL' : 'Running')}>
          <span className="kpi-label">Running</span>
          <div className="kpi-number tabular" style={{ color: 'var(--status-ok)' }}>{statusCounts.Running}</div>
          <span className="kpi-comparison">Click to filter Running</span>
        </div>
        <div className="kpi-box is-orange-accent" onClick={() => setStatusFilter(statusFilter === 'Idle' ? 'ALL' : 'Idle')}>
          <span className="kpi-label">Idle / Maintenance</span>
          <div className="kpi-number tabular" style={{ color: 'var(--accent)' }}>{statusCounts.Idle + statusCounts.Maintenance}</div>
          <span className="kpi-comparison">Idle: {statusCounts.Idle} • Maint: {statusCounts.Maintenance}</span>
        </div>
        <div className="kpi-box" onClick={() => setStatusFilter(statusFilter === 'Breakdown' ? 'ALL' : 'Breakdown')}>
          <span className="kpi-label">Breakdown</span>
          <div className="kpi-number tabular" style={{ color: statusCounts.Breakdown > 0 ? 'var(--status-err)' : 'var(--ink-primary)' }}>
            {statusCounts.Breakdown}
          </div>
          <span className="kpi-comparison">Open downtimes: {downtimes.filter((d) => d.status === 'Open').length}</span>
        </div>
      </div>

      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Machine Directory &amp; Configuration</h2>
            <p className="section-subtitle">
              {caps.canEditMachines
                ? 'Admin mode: add, edit, or safely remove machines while preserving all historical production records.'
                : 'View-only mode: machine configuration changes are restricted to Admin.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`btn btn-sm ${subTab === 'directory' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubTab('directory')}>
              Machines ({machines.length})
            </button>
            <button type="button" className={`btn btn-sm ${subTab === 'downtime' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSubTab('downtime')}>
              Downtime Log ({downtimes.length})
            </button>
            {caps.canManageDowntimeCodes && (
              <button
                type="button"
                className={`btn btn-sm ${subTab === 'codes' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setCodesDraft(downtimeCodes && downtimeCodes.length > 0 ? downtimeCodes : DEFAULT_DOWNTIME_CODES);
                  setSubTab('codes');
                }}
              >
                <Settings2 size={14} aria-hidden="true" />
                <span>Downtime Reasons ({(downtimeCodes || []).length}/10)</span>
              </button>
            )}
            {caps.canEditMachines && subTab === 'directory' && (
              <button type="button" className="btn btn-green btn-sm" onClick={openAddModal}>
                <Plus size={14} aria-hidden="true" />
                <span>Add Machine</span>
              </button>
            )}
          </div>
        </div>

        {subTab === 'directory' && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['ALL', 'NC', 'Tandem'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`btn btn-sm ${groupFilter === g ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setGroupFilter(g)}
                  >
                    {g === 'ALL' ? 'All Types' : g}
                  </button>
                ))}
              </div>

              <select
                className="field-select"
                style={{ width: 170 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by machine status"
              >
                <option value="ALL">All Statuses</option>
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              <div style={{ position: 'relative', flex: 1, minWidth: 210 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 13, color: 'var(--ink-muted)' }} aria-hidden="true" />
                <input
                  type="text"
                  className="field-input"
                  style={{ paddingLeft: 30 }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search machine number, type, operator, status..."
                  aria-label="Search machines"
                />
              </div>
            </div>

            <div className="table-scroll-wrap desktop-table-only">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Machine #</th>
                    <th>Type</th>
                    <th>Tonnage</th>
                    <th>Shift Target</th>
                    <th>Status</th>
                    <th>Assigned Operator</th>
                    <th>Notes</th>
                    <th>Last Update</th>
                    {caps.canEditMachines && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredMachines.length === 0 ? (
                    <tr>
                      <td colSpan={caps.canEditMachines ? 9 : 8} style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: 24 }}>
                        No machines match your current search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMachines.map((m) => {
                      const pill =
                        m.status === 'Running' ? 'is-ok' : m.status === 'Breakdown' ? 'is-err' : 'is-warn';
                      return (
                        <tr key={m.machine_number}>
                          <td><strong className="mono">{m.machine_number}</strong></td>
                          <td>
                            <span className={`status-pill ${m.machine_type === 'Tandem' ? 'is-orange' : ''}`}>
                              {m.machine_type}
                            </span>
                          </td>
                          <td className="tabular">{m.tonnage} T</td>
                          <td className="tabular">{Number(m.production_target || 0).toLocaleString()} pcs</td>
                          <td><span className={`status-pill ${pill}`}>{m.status || 'Idle'}</span></td>
                          <td>{m.assigned_operator || '—'}</td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-secondary)' }}>
                            {m.maintenance_notes || '—'}
                          </td>
                          <td className="tabular" style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                            {m.updated_at ? new Date(m.updated_at).toLocaleString() : '—'}
                          </td>
                          {caps.canEditMachines && (
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditModal(m)}>
                                  <Edit3 size={14} aria-hidden="true" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => openDeleteDialog(m)}
                                  aria-label={`Delete machine ${m.machine_number}`}
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-card-list">
              {filteredMachines.map((m) => {
                const pill = m.status === 'Running' ? 'is-ok' : m.status === 'Breakdown' ? 'is-err' : 'is-warn';
                return (
                  <div key={m.machine_number} className="mobile-entity-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <strong className="mono">{m.machine_number} • {m.machine_type} ({m.tonnage}T)</strong>
                      <span className={`status-pill ${pill}`}>{m.status || 'Idle'}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
                      Target: {Number(m.production_target || 0).toLocaleString()} pcs • Operator: {m.assigned_operator || '—'}
                    </div>
                    {m.maintenance_notes && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                        Notes: {m.maintenance_notes}
                      </div>
                    )}
                    {caps.canEditMachines && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditModal(m)}>
                          <Edit3 size={14} />
                          <span>Edit</span>
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => openDeleteDialog(m)}>
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {subTab === 'downtime' && (
          <div className="table-scroll-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date &amp; Shift</th>
                  <th>Code</th>
                  <th>Machine</th>
                  <th>Start – End</th>
                  <th>Duration</th>
                  <th>Reason &amp; Problem</th>
                  <th>Operator</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {downtimes.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--ink-muted)' }}>No downtime records found.</td>
                  </tr>
                ) : (
                  downtimes.map((d) => (
                    <tr key={d.id}>
                      <td className="tabular">{d.date || '—'} • {d.shift || '—'}</td>
                      <td className="mono">{d.downtime_code || 'D01'}</td>
                      <td><strong>{d.machine_number}</strong></td>
                      <td className="tabular">{d.start_time && d.end_time ? `${d.start_time} – ${d.end_time}` : d.start_time || '—'}</td>
                      <td className="tabular">{d.duration_minutes || d.total_downtime_minutes || 0} min</td>
                      <td>
                        <div><strong>{d.reason || d.breakdown_reason}</strong></div>
                        {d.problem_description && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>{d.problem_description}</div>
                        )}
                      </td>
                      <td>{d.operator_name || '—'}</td>
                      <td><span className={`status-pill ${d.status === 'Open' ? 'is-err' : 'is-ok'}`}>{d.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {subTab === 'codes' && caps.canManageDowntimeCodes && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <p className="section-subtitle">
                Configure up to 10 standardized downtime reason options used across NC and Tandem hourly production entries.
              </p>
              <button
                type="button"
                className="btn btn-green btn-sm"
                onClick={handleAddDowntimeCode}
                disabled={codesDraft.length >= 10}
              >
                <Plus size={14} />
                <span>Add Option ({codesDraft.length}/10)</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {codesDraft.slice(0, 10).map((c, idx) => (
                <div key={`${c.code}-${idx}`} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <input
                      type="text"
                      className="field-input mono"
                      style={{ width: 90, fontWeight: 700, color: 'var(--accent)' }}
                      value={c.code}
                      aria-label={`Downtime code ${idx + 1}`}
                      onChange={(e) =>
                        setCodesDraft((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, code: e.target.value.toUpperCase() } : x))
                        )
                      }
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="checkbox"
                          checked={c.is_active !== false}
                          onChange={(e) =>
                            setCodesDraft((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, is_active: e.target.checked } : x))
                            )
                          }
                        />
                        Active
                      </label>
                      {codesDraft.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRemoveDowntimeCode(idx)}
                          aria-label={`Remove downtime option ${c.code}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="field-group" style={{ marginBottom: 8 }}>
                    <label className="field-label">Reason Name *</label>
                    <input
                      type="text"
                      className="field-input"
                      value={c.name}
                      placeholder="e.g. Die Changeover"
                      onChange={(e) => setCodesDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Description</label>
                    <input
                      type="text"
                      className="field-input"
                      value={c.description || ''}
                      placeholder="Details..."
                      onChange={(e) => setCodesDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={handleSaveCodes} disabled={saving}>
                {saving ? 'Saving...' : 'Save Downtime Reasons'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Admin Edit/Add Machine Modal with Confirmation */}
      {editingMachine && caps.canEditMachines && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="mach-modal-title">
          <div className="modal-dialog">
            <div className="modal-head">
              <h3 id="mach-modal-title" style={{ fontSize: '1rem', fontWeight: 700 }}>
                {isAddMode ? 'Register New Machine' : `Configure ${editingMachine.machine_number}`}
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingMachine(null)} aria-label="Close modal">
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!confirmOpen ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="field-group">
                      <label className="field-label" htmlFor="m-num">Machine Number / ID *</label>
                      <input
                        id="m-num"
                        type="text"
                        className="field-input mono"
                        value={form.machine_number}
                        onChange={(e) => setForm({ ...form, machine_number: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="m-group">Machine Type *</label>
                      <select
                        id="m-group"
                        className="field-select"
                        value={form.machine_type}
                        onChange={(e) => setForm({ ...form, machine_type: e.target.value })}
                      >
                        <option value="NC">NC</option>
                        <option value="Tandem">Tandem</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="field-group">
                      <label className="field-label" htmlFor="m-tonnage">Tonnage (T) *</label>
                      <input
                        id="m-tonnage"
                        type="text"
                        inputMode="numeric"
                        className="field-input tabular"
                        value={form.tonnage}
                        onChange={(e) => {
                          if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setForm({ ...form, tonnage: e.target.value });
                        }}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="m-target">Baseline Shift Target *</label>
                      <input
                        id="m-target"
                        type="text"
                        inputMode="numeric"
                        className="field-input tabular"
                        value={form.production_target}
                        onChange={(e) => {
                          if (e.target.value === '' || /^\d+$/.test(e.target.value)) setForm({ ...form, production_target: e.target.value });
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="field-group">
                      <label className="field-label" htmlFor="m-status">Machine Status</label>
                      <select
                        id="m-status"
                        className="field-select"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        {STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="m-op">Default Operator</label>
                      <input
                        id="m-op"
                        type="text"
                        className="field-input"
                        value={form.assigned_operator}
                        onChange={(e) => setForm({ ...form, assigned_operator: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="m-notes">Maintenance / Config Notes</label>
                    <textarea
                      id="m-notes"
                      rows={2}
                      className="field-textarea"
                      value={form.maintenance_notes}
                      onChange={(e) => setForm({ ...form, maintenance_notes: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <div className="banner is-warn" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <strong>Confirm Machine Configuration Change</strong>
                  <div style={{ fontSize: '0.82rem' }}>
                    Save changes to <strong>{form.machine_number}</strong> ({form.machine_type}, {form.tonnage}T, target {form.production_target} pcs, status {form.status})? This update will be logged in the audit trail and synchronized to all connected clients.
                  </div>
                </div>
              )}
            </div>

            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => (confirmOpen ? setConfirmOpen(false) : setEditingMachine(null))}>
                {confirmOpen ? 'Back' : 'Cancel'}
              </button>
              {!confirmOpen ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const err = validateMachineForm();
                    if (err) {
                      setNotice({ type: 'err', message: err });
                    } else {
                      setConfirmOpen(true);
                    }
                  }}
                >
                  Review &amp; Confirm
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={handleConfirmSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Confirm & Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Machine Confirmation Dialog */}
      {deleteTarget && caps.canDeleteMachines && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="del-mach-title">
          <div className="modal-dialog" style={{ maxWidth: 460 }}>
            <div className="modal-head">
              <h3 id="del-mach-title" className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-err-ink)' }}>
                <ShieldAlert size={18} />
                Confirm Machine Deletion
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)} aria-label="Close delete dialog">
                <X size={15} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="banner is-err" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div>
                  You are about to remove machine <strong className="mono" style={{ fontSize: '1rem' }}>{deleteTarget.machine_number}</strong> ({deleteTarget.machine_type}, {deleteTarget.tonnage}T) from the active Machine Directory.
                </div>
              </div>
              <div className="banner is-ok" style={{ fontSize: '0.8rem' }}>
                <span>
                  Historical production records, scrap logs, and downtime history for <strong>{deleteTarget.machine_number}</strong> will NEVER be deleted and remain fully searchable in Production Summary and Reports.
                </span>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="del-mach-confirm">
                  Type machine number <strong className="mono">{deleteTarget.machine_number}</strong> to confirm deletion:
                </label>
                <input
                  id="del-mach-confirm"
                  type="text"
                  className="field-input mono"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder={deleteTarget.machine_number}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleting || deleteConfirmText.trim().toUpperCase() !== String(deleteTarget.machine_number).toUpperCase()}
                onClick={handleConfirmDelete}
              >
                {deleting ? 'Deleting...' : `Delete ${deleteTarget.machine_number}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
