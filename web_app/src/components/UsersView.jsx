import React, { useEffect, useState } from 'react';
import { UserPlus, ShieldCheck, AlertCircle, RefreshCw, Edit3, X } from 'lucide-react';
import { ROLES, getCapabilities } from '../config/roles';
import { cloudApi } from '../services/cloudClient';

export default function UsersView({ currentUser }) {
  const caps = getCapabilities(currentUser?.role);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState(null);

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', full_name: '', role: ROLES.SUPERVISOR, temp_password: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const [form, setForm] = useState({
    username: '',
    full_name: '',
    role: ROLES.SUPERVISOR,
    department: 'Press Shop MFG-2',
    password: '',
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await cloudApi.getUsers();
      setUsers(list || []);
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Unable to load user accounts.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caps.canManageUsers) {
      loadUsers();
    } else {
      setLoading(false);
    }
  }, [caps.canManageUsers]);

  if (!caps.canManageUsers) {
    return (
      <div className="banner is-err">
        <span>Access restricted. User & Role administration is reserved for Admin accounts.</span>
      </div>
    );
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setNotice({ type: 'err', text: 'Username and initial temporary password are required.' });
      return;
    }
    if (form.password.length < 10) {
      setNotice({ type: 'err', text: 'Initial temporary password must be at least 10 characters with letters and numbers.' });
      return;
    }
    setCreating(true);
    setNotice(null);
    try {
      await cloudApi.createUserAccount({
        ...form,
        must_change_password: true,
      });
      setNotice({
        type: 'ok',
        text: `Provisioned ${form.role} account "${form.username}". First sign-in will require setting a permanent password.`,
      });
      setForm({
        username: '',
        full_name: '',
        role: ROLES.SUPERVISOR,
        department: 'Press Shop MFG-2',
        password: '',
      });
      await loadUsers();
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Unable to create user account.' });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (u) => {
    if (u.username === currentUser?.username) {
      setNotice({ type: 'err', text: 'You cannot deactivate your own currently signed-in account.' });
      return;
    }
    try {
      await cloudApi.toggleUserActive(u.id, !u.is_active);
      setNotice({ type: 'ok', text: `${u.username} marked ${!u.is_active ? 'Active' : 'Disabled'}.` });
      await loadUsers();
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Unable to update user account.' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {notice && (
        <div className={`banner ${notice.type === 'ok' ? 'is-ok' : 'is-err'}`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {notice.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {notice.text}
          </span>
        </div>
      )}

      <form className="surface-card" onSubmit={handleCreate}>
        <div className="section-header">
          <div>
            <h2 className="section-title">Provision Admin / Supervisor Account</h2>
            <p className="section-subtitle">
              Operator and Dashboard modes are passwordless and do not require individual accounts.
            </p>
          </div>
        </div>

        <div className="filter-bar">
          <div className="field-group">
            <label className="field-label" htmlFor="u-name">Username</label>
            <input
              id="u-name"
              type="text"
              className="field-input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().trim() })}
              placeholder="e.g. supervisor_b"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="u-full">Full Name</label>
            <input
              id="u-full"
              type="text"
              className="field-input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Shift B Supervisor"
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="u-role">Role</label>
            <select
              id="u-role"
              className="field-select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value={ROLES.SUPERVISOR}>Supervisor</option>
              <option value={ROLES.ADMIN}>Admin</option>
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="u-pass">Temporary Password</label>
            <input
              id="u-pass"
              type="password"
              className="field-input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min 10 chars, mixed case + number"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            <UserPlus size={15} />
            {creating ? 'Provisioning...' : 'Create Account'}
          </button>
        </div>
      </form>

      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Registered Accounts ({users.length})</h2>
            <p className="section-subtitle">Manage active access and password reset status</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadUsers}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="skeleton-line" style={{ height: 120, width: '100%' }} />
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.86rem' }}>No accounts returned from backend.</p>
        ) : (
          <div className="table-scroll-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Password Policy</th>
                  <th>Recovery Email</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id || u.username}>
                    <td className="mono" style={{ fontWeight: 700 }}>{u.username}</td>
                    <td>{u.full_name || '-'}</td>
                    <td>
                      <span className="status-pill">
                        <ShieldCheck size={12} />
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {u.must_change_password ? (
                        <span className="status-pill is-warn">Temp (Reset Required)</span>
                      ) : (
                        <span className="status-pill is-ok">Compliant</span>
                      )}
                    </td>
                    <td>
                      {u.recovery_email ? (
                        <span>
                          {u.recovery_email}{' '}
                          <span className={`status-pill ${u.recovery_email_verified ? 'is-ok' : 'is-warn'}`}>
                            {u.recovery_email_verified ? 'Verified' : 'Unverified'}
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-muted)' }}>Not set</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${u.is_active ? 'is-ok' : 'is-err'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditUser(u);
                            setEditForm({
                              username: u.username || '',
                              full_name: u.full_name || '',
                              role: u.role || ROLES.SUPERVISOR,
                              temp_password: '',
                            });
                          }}
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={u.username === currentUser?.username}
                          onClick={() => handleToggle(u)}
                        >
                          {u.is_active ? 'Disable' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editUser && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
          <div className="modal-dialog" style={{ maxWidth: 460 }}>
            <div className="modal-head">
              <h3 id="edit-user-title" style={{ fontSize: '1rem', fontWeight: 700 }}>
                Edit Account — {editUser.username}
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditUser(null)}>
                <X size={15} />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingEdit(true);
                setNotice(null);
                try {
                  await cloudApi.updateUserAccount(editUser.id, {
                    username: editForm.username.trim().toLowerCase(),
                    full_name: editForm.full_name.trim(),
                    role: editForm.role,
                    ...(editForm.temp_password.trim()
                      ? { temp_password: editForm.temp_password.trim(), must_change_password: true }
                      : {}),
                  });
                  setNotice({ type: 'ok', text: `Updated account ${editForm.username.trim().toLowerCase()}.` });
                  setEditUser(null);
                  await loadUsers();
                } catch (err) {
                  setNotice({ type: 'err', text: err.message || 'Unable to update user account.' });
                } finally {
                  setSavingEdit(false);
                }
              }}
            >
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="eu-username">User ID / Username</label>
                  <input
                    id="eu-username"
                    type="text"
                    className="field-input"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    required
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="eu-name">Full Name</label>
                  <input
                    id="eu-name"
                    type="text"
                    className="field-input"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="eu-role">Role</label>
                  <select
                    id="eu-role"
                    className="field-select"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value={ROLES.SUPERVISOR}>Supervisor</option>
                    <option value={ROLES.ADMIN}>Admin</option>
                  </select>
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="eu-pw">Reset Temporary Password (Optional)</label>
                  <input
                    id="eu-pw"
                    type="password"
                    className="field-input"
                    value={editForm.temp_password}
                    onChange={(e) => setEditForm({ ...editForm, temp_password: e.target.value })}
                    placeholder="Leave blank to keep existing password"
                  />
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
