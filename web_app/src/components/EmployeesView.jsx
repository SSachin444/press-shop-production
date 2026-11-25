import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit3, Trash2, Search, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { getCapabilities } from '../config/roles';
import { cloudApi } from '../services/cloudClient';
import { SHIFTS } from '../services/metrics';

export default function EmployeesView({ machines, currentUser }) {
  const caps = getCapabilities(currentUser?.role);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({
    emp_id: '',
    name: '',
    department: 'NC Production',
    designation: 'Operator',
    phone: '',
    email: '',
    shift: 'Shift A',
    assigned_machine: '',
    status: 'Active',
  });

  const loadEmployees = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await cloudApi.getEmployees();
      setEmployees(list || []);
    } catch (err) {
      setError(err?.message || 'Unable to load manpower directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caps.canManageEmployees) {
      loadEmployees();
    } else {
      setLoading(false);
    }
  }, [caps.canManageEmployees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (shiftFilter !== 'ALL' && e.shift !== shiftFilter) return false;
      if (q) {
        return (
          String(e.emp_id || '').toLowerCase().includes(q) ||
          String(e.name || '').toLowerCase().includes(q) ||
          String(e.assigned_machine || '').toLowerCase().includes(q) ||
          String(e.department || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, search, shiftFilter]);

  if (!caps.canManageEmployees) {
    return (
      <div className="banner is-err">
        <span>Access restricted. Operator and Dashboard roles cannot view manpower records.</span>
      </div>
    );
  }

  const openAdd = () => {
    setIsEdit(false);
    setForm({
      emp_id: '',
      name: '',
      department: 'NC Production',
      designation: 'Operator',
      phone: '',
      email: '',
      shift: 'Shift A',
      assigned_machine: '',
      status: 'Active',
    });
    setModalOpen(true);
  };

  const openEdit = (emp) => {
    setIsEdit(true);
    setForm({
      emp_id: emp.emp_id || '',
      name: emp.name || '',
      department: emp.department || 'NC Production',
      designation: emp.designation || 'Operator',
      phone: caps.canViewPersonalEmployeeFields ? emp.phone || '' : '',
      email: caps.canViewPersonalEmployeeFields ? emp.email || '' : '',
      shift: emp.shift || 'Shift A',
      assigned_machine: emp.assigned_machine || '',
      status: emp.status || 'Active',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.emp_id.trim() || !form.name.trim()) {
      setNotice({ type: 'err', text: 'Employee ID and Full Name are required.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await cloudApi.saveEmployee(form, isEdit);
      setModalOpen(false);
      setNotice({ type: 'ok', text: `${isEdit ? 'Updated' : 'Added'} worker ${form.emp_id.toUpperCase()}.` });
      await loadEmployees();
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Unable to save employee record.' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!caps.canDeleteEmployees || !deleteTarget) return;
    try {
      await cloudApi.deleteEmployee(deleteTarget.emp_id);
      setDeleteTarget(null);
      setNotice({ type: 'ok', text: `Removed employee ${deleteTarget.emp_id}.` });
      await loadEmployees();
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Unable to delete employee.' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!caps.canViewPersonalEmployeeFields && (
        <div className="banner is-warn">
          <span>
            Operational roster view: personal contact details and employee deletion require Admin role.
          </span>
        </div>
      )}

      {notice && (
        <div className={`banner ${notice.type === 'ok' ? 'is-ok' : 'is-err'}`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {notice.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {notice.text}
          </span>
        </div>
      )}

      {error && (
        <div className="banner is-err">
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadEmployees}>Retry</button>
        </div>
      )}

      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Manpower Roster ({filtered.length})</h2>
            <p className="section-subtitle">
              {caps.canViewPersonalEmployeeFields ? 'Full employee directory & shift allocation' : 'Operational shift & machine allocation'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 13, color: 'var(--ink-muted)' }} />
              <input
                type="text"
                className="field-input"
                style={{ paddingLeft: 30, minWidth: 200 }}
                placeholder="Search ID, name, machine..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="field-select"
              style={{ width: 150 }}
              aria-label="Filter by shift"
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
            >
              <option value="ALL">All Shifts</option>
              {SHIFTS.map((s) => (
                <option key={s.id} value={s.id}>{s.id}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              <Plus size={15} />
              Add Operator
            </button>
          </div>
        </div>

        {loading ? (
          <div className="skeleton-line" style={{ height: 140, width: '100%' }} />
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.86rem' }}>No matching operators found.</p>
        ) : (
          <>
            <div className="desktop-table-only table-scroll-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Shift</th>
                    <th>Assigned Machine</th>
                    {caps.canViewPersonalEmployeeFields && <th>Phone</th>}
                    {caps.canViewPersonalEmployeeFields && <th>Email</th>}
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => (
                    <tr key={emp.emp_id}>
                      <td className="mono" style={{ fontWeight: 700 }}>{emp.emp_id}</td>
                      <td>{emp.name}</td>
                      <td>{emp.department}</td>
                      <td>{emp.designation}</td>
                      <td>{emp.shift}</td>
                      <td className="mono">{emp.assigned_machine || '-'}</td>
                      {caps.canViewPersonalEmployeeFields && <td className="tabular">{emp.phone || '-'}</td>}
                      {caps.canViewPersonalEmployeeFields && <td>{emp.email || '-'}</td>}
                      <td>
                        <span className={`status-pill ${emp.status === 'Active' ? 'is-ok' : 'is-warn'}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(emp)}>
                            <Edit3 size={14} />
                            Edit
                          </button>
                          {caps.canDeleteEmployees && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setDeleteTarget(emp)}
                              aria-label={`Delete ${emp.emp_id}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-card-list">
              {filtered.map((emp) => (
                <div key={emp.emp_id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <strong className="mono">{emp.emp_id}</strong> — {emp.name}
                    </div>
                    <span className={`status-pill ${emp.status === 'Active' ? 'is-ok' : 'is-warn'}`}>
                      {emp.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)', marginBottom: 8 }}>
                    {emp.department} • {emp.shift} • Machine: {emp.assigned_machine || 'Unassigned'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(emp)}>
                      Edit Assignment
                    </button>
                    {caps.canDeleteEmployees && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(emp)}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit operator' : 'Add operator'}>
          <form className="modal-dialog" onSubmit={handleSubmit}>
            <div className="modal-head">
              <h3 className="section-title">{isEdit ? `Edit ${form.emp_id}` : 'Add Operator / Staff'}</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div className="field-group">
                <label className="field-label" htmlFor="emp-id">Employee ID</label>
                <input
                  id="emp-id"
                  className="field-input"
                  value={form.emp_id}
                  disabled={isEdit}
                  onChange={(e) => setForm({ ...form, emp_id: e.target.value.toUpperCase() })}
                  placeholder="PHA023"
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="emp-name">Full Name</label>
                <input
                  id="emp-name"
                  className="field-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="emp-dept">Department</label>
                <select
                  id="emp-dept"
                  className="field-select"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                >
                  <option value="NC Production">NC Production</option>
                  <option value="Tandem Lines">Tandem Lines</option>
                  <option value="Tool Room">Tool Room</option>
                  <option value="Quality">Quality</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="emp-desig">Designation</label>
                <input
                  id="emp-desig"
                  className="field-input"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="emp-shift">Shift</label>
                <select
                  id="emp-shift"
                  className="field-select"
                  value={form.shift}
                  onChange={(e) => setForm({ ...form, shift: e.target.value })}
                >
                  {SHIFTS.map((s) => (
                    <option key={s.id} value={s.id}>{s.id}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="emp-machine">Assigned Machine</label>
                <select
                  id="emp-machine"
                  className="field-select"
                  value={form.assigned_machine}
                  onChange={(e) => setForm({ ...form, assigned_machine: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {machines.map((m) => (
                    <option key={m.machine_number} value={m.machine_number}>{m.machine_number}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="emp-status">Status</label>
                <select
                  id="emp-status"
                  className="field-select"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              {caps.canViewPersonalEmployeeFields && (
                <>
                  <div className="field-group">
                    <label className="field-label" htmlFor="emp-phone">Phone (Admin Only)</label>
                    <input
                      id="emp-phone"
                      className="field-input"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="emp-email">Email (Admin Only)</label>
                    <input
                      id="emp-email"
                      type="email"
                      className="field-input"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirm Modal (Admin only) */}
      {deleteTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm employee removal">
          <div className="modal-dialog" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 className="section-title">Confirm Removal</h3>
            </div>
            <div className="modal-body">
              <p>
                Remove employee <strong className="mono">{deleteTarget.emp_id}</strong> ({deleteTarget.name})?
                Historical production records will retain their name.
              </p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>Delete Employee</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
