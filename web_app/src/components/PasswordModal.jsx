import React, { useEffect, useState } from 'react';
import { Lock, UserCog, X, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { cloudApi } from '../services/cloudClient';

export default function PasswordModal({
  isOpen,
  onClose,
  forced = false,
  currentUser = null,
  initialTab = 'password',
  onCompleted,
}) {
  const [tab, setTab] = useState(forced ? 'password' : initialTab);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [newUsername, setNewUsername] = useState('');
  const [confirmUsernamePassword, setConfirmUsernamePassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTab(forced ? 'password' : initialTab || 'password');
    setError('');
    setSuccess('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setNewUsername(currentUser?.username || '');
    setConfirmUsernamePassword('');
  }, [isOpen, forced, initialTab, currentUser?.username]);

  if (!isOpen) return null;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (
      newPassword.length < 10 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      setError('New password must be at least 10 characters with uppercase, lowercase, and a number.');
      return;
    }

    try {
      setLoading(true);
      await cloudApi.changePassword({ currentPassword, newPassword });
      setSuccess('Password updated securely. Use your new password on your next sign-in across any device.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onCompleted) onCompleted({ must_change_password: false });
      if (!forced && onClose) {
        setTimeout(() => onClose(), 900);
      }
    } catch (err) {
      setError(err.message || 'Unable to update password.');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmed = String(newUsername || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(trimmed)) {
      setError('User ID must be 3-32 characters (letters, digits, dot, underscore, or hyphen).');
      return;
    }
    if (trimmed === String(currentUser?.username || '').trim().toLowerCase()) {
      setError('Enter a new User ID different from your current one.');
      return;
    }
    if (!confirmUsernamePassword) {
      setError('Enter your current password to verify the User ID change.');
      return;
    }

    try {
      setLoading(true);
      const res = await cloudApi.changeUsername({
        newUsername: trimmed,
        currentPassword: confirmUsernamePassword,
      });
      const updatedName = res?.username || res?.user?.username || trimmed;
      setSuccess(`User ID changed to "${updatedName}". Your existing password, role (${currentUser?.role}), and permissions remain intact.`);
      setConfirmUsernamePassword('');
      if (onCompleted) onCompleted({ username: updatedName, ...(res?.user || {}) });
    } catch (err) {
      setError(err.message || 'Unable to update User ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pw-modal-title">
      <div className="modal-dialog" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {tab === 'username' ? <UserCog size={18} strokeWidth={1.75} /> : <Lock size={18} strokeWidth={1.75} />}
            <h2 id="pw-modal-title" style={{ fontSize: '1rem', fontWeight: 700 }}>
              {forced ? 'Replace Temporary Password' : 'Account & Password Settings'}
            </h2>
          </div>
          {!forced && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close account modal">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!forced && (
            <div className="tab-strip" role="tablist" aria-label="Account management sections">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'password'}
                className={`btn btn-sm ${tab === 'password' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setTab('password');
                  setError('');
                  setSuccess('');
                }}
              >
                <Lock size={14} /> Change Password
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'username'}
                className={`btn btn-sm ${tab === 'username' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setTab('username');
                  setError('');
                  setSuccess('');
                }}
              >
                <UserCog size={14} /> Change User ID / Username
              </button>
            </div>
          )}

          {currentUser && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                fontSize: '0.82rem',
              }}
            >
              <span>
                Signed in as <strong>{currentUser.username}</strong> ({currentUser.role})
              </span>
              <span className="status-pill is-info">
                <ShieldCheck size={12} /> Verified Session
              </span>
            </div>
          )}

          {forced && (
            <div className="banner is-warn">
              <span>Temporary credentials must be replaced with a strong password before accessing the system.</span>
            </div>
          )}

          {error && (
            <div className="banner is-err" role="alert">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={16} /> {error}
              </span>
            </div>
          )}

          {success && (
            <div className="banner is-ok" role="status">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> {success}
              </span>
            </div>
          )}

          {tab === 'password' ? (
            <form id="pw-change-form" onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field-group">
                <label className="field-label" htmlFor="pw-current">Current Password</label>
                <input
                  id="pw-current"
                  type="password"
                  className="field-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="pw-new">New Strong Password (min 10 chars, mixed case + digit)</label>
                <input
                  id="pw-new"
                  type="password"
                  className="field-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="pw-confirm">Confirm New Password</label>
                <input
                  id="pw-confirm"
                  type="password"
                  className="field-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </form>
          ) : (
            <form id="username-change-form" onSubmit={handleUsernameSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field-group">
                <label className="field-label" htmlFor="acct-current-username">Current User ID</label>
                <input
                  id="acct-current-username"
                  type="text"
                  className="field-input"
                  value={currentUser?.username || ''}
                  readOnly
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="acct-new-username">New User ID / Username</label>
                <input
                  id="acct-new-username"
                  type="text"
                  className="field-input"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. shift_lead_1 or A20302"
                  required
                  autoComplete="username"
                />
                <span className="field-help">
                  3-32 characters (letters, digits, ., _, -). Must be unique across all users. Your role and login link stay intact.
                </span>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="acct-confirm-pw">Confirm Current Password</label>
                <input
                  id="acct-confirm-pw"
                  type="password"
                  className="field-input"
                  value={confirmUsernamePassword}
                  onChange={(e) => setConfirmUsernamePassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </form>
          )}
        </div>

        <div className="modal-foot">
          {!forced && (
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          )}
          {tab === 'password' ? (
            <button type="submit" form="pw-change-form" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          ) : (
            <button type="submit" form="username-change-form" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Update User ID'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
