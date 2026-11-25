import React, { useState, useMemo } from 'react';
import { Plus, Edit3, AlertCircle, CheckCircle2, X, Search } from 'lucide-react';
import { getCapabilities } from '../config/roles';
import { cloudApi } from '../services/cloudClient';

export default function MachinesView({
  machines,
  downtimes,
  downtimeCodes,
  currentUser,
  onReload,
}) {
  const caps = getCapabilities(currentUser?.role);
  const [groupFilter, setGroupFilter] = useState('ALL');
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

  // Downtime Codes State (Admin only)
  const [codesDraft, setCodesDraft] = useState(() => downtimeCodes || []);

  const filteredMachines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (machines || []).filter((m) => {
      if (groupFilter !== 'ALL' && m.machine_type !== groupFilter) return false;
      if (q) {
        return (
          String(m.machine_number).toLowerCase().includes(q) ||
          String(m.assigned_operator || '').toLowerCase().includes(q) ||
          String(m.status || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [machines, groupFilter, search]);

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
    if (!form.machine_number.trim()) return 'Machine name/number is required.';
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

  const handleSaveCodes = async () => {
    if (!caps.canManageDowntimeCodes) return;
    try {
      setSaving(true);
      await cloudApi.saveDowntimeCodes(codesDraft);
      setNotice({ type: 'ok', message: 'Downtime codes updated.' });
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

      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Machine Directory &amp; Configuration</h2>
            <p className="section-subtitle">
              {caps.canEditMachines
                ? 'Admin mode: edits require confirmation, enforce version conflict checks, and write to the audit log.'
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
              <button type="button" className={`btn btn-sm ${subTab === 'codes' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setCodesDraft(downtimeCodes); setSubTab('codes'); }}>
                Downtime Codes
              </button>
            )}
            {caps.canEditMachines && subTab === 'directory' && (
              <button type="button" className="btn btn-navy btn-sm" onClick={openAddModal}>
                <Plus size={14} aria-hidden="true" />
                <span>Add Machine</span>
              </button>
            )}
          </div>
        </div>

        {subTab === 'directory' && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              {['ALL', 'NC', 'Tandem'].map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`btn btn-sm ${groupFilter === g ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setGroupFilter(g)}
                >
                  {g === 'ALL' ? 'All Groups' : g}
                </button>
              ))}
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 13, color: 'var(--ink-muted)' }} aria-hidden="true" />
                <input
                  type="text"
                  className="field-input"
                  style={{ paddingLeft: 30 }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search machine, operator, status..."
                  aria-label="Search machines"
                />
              </div>
            </div>

            <div className="table-scroll-wrap desktop-table-only">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>Group</th>
                    <th>Tonnage</th>
                    <th>Shift Target</th>
                    <th>State</th>
                    <th>Operator</th>
                    <th>Last Update</th>
                    {caps.canEditMachines && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredMachines.map((m) => {
                    const pill = m.status === 'Running' ? 'is-ok' : m.status === 'Breakdown' ? 'is-err' : 'is-warn';
                    return (
                      <tr key={m.machine_number}>
                        <td><strong>{m.machine_number}</strong></td>
                        <td>{m.machine_type}</td>
                        <td className="tabular">{m.tonnage} T</td>
                        <td className="tabular">{m.production_target} pcs</td>
                        <td><span className={`status-pill ${pill}`}>{m.status || 'Idle'}</span></td>
                        <td>{m.assigned_operator || '—'}</td>
                        <td className="tabular" style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                          {m.updated_at ? new Date(m.updated_at).toLocaleString() : '—'}
                        </td>
                        {caps.canEditMachines && (
                          <td>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditModal(m)}>
                              <Edit3 size={14} aria-hidden="true" />
                              <span>Configure</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-card-list">
              {filteredMachines.map((m) => {
                const pill = m.status === 'Running' ? 'is-ok' : m.status === 'Breakdown' ? 'is-err' : 'is-warn';
                return (
                  <div key={m.machine_number} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <strong>{m.machine_number} • {m.machine_type} ({m.tonnage}T)</strong>
                      <span className={`status-pill ${pill}`}>{m.status || 'Idle'}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
                      Target: {m.production_target} pcs • Operator: {m.assigned_operator || '—'}
                    </div>
                    {caps.canEditMachines && (
                      <div style={{ marginTop: 10 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditModal(m)}>
                          <Edit3 size={14} />
                          <span>Configure</span>
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
                  <th>Code</th>
                  <th>Machine</th>
                  <th>Reason</th>
                  <th>Operator</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {downtimes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-muted)' }}>No downtime records found.</td>
                  </tr>
                ) : (
                  downtimes.map((d) => (
                    <tr key={d.id}>
                      <td className="mono">{d.downtime_code || 'D01'}</td>
                      <td><strong>{d.machine_number}</strong></td>
                      <td>{d.reason || d.breakdown_reason}</td>
                      <td>{d.operator_name || '—'}</td>
                      <td className="tabular">{d.duration_minutes || d.total_downtime_minutes || 0} min</td>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {codesDraft.slice(0, 6).map((c, idx) => (
                <div key={c.code} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                  <div className="mono" style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>{c.code}</div>
                  <div className="field-group" style={{ marginBottom: 8 }}>
                    <label className="field-label">Reason Name</label>
                    <input
                      type="text"
                      className="field-input"
                      value={c.name}
                      onChange={(e) => setCodesDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Description</label>
                    <input
                      type="text"
                      className="field-input"
                      value={c.description || ''}
                      onChange={(e) => setCodesDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={handleSaveCodes} disabled={saving}>
                {saving ? 'Saving...' : 'Save Downtime Codes'}
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
                      <label className="field-label" htmlFor="m-num">Machine Name / ID *</label>
                      <input
                        id="m-num"
                        type="text"
                        className="field-input"
                        value={form.machine_number}
                        onChange={(e) => setForm({ ...form, machine_number: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="m-group">Group *</label>
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
                      <label className="field-label" htmlFor="m-status">Operational State</label>
                      <select
                        id="m-status"
                        className="field-select"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        <option value="Running">Running</option>
                        <option value="Idle">Idle</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Breakdown">Breakdown</option>
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
    </div>
  );
}
