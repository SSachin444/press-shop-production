import React, { useState } from 'react';
import { Lock, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cloudApi } from '../services/cloudClient';

export default function PasswordModal({ isOpen, onClose, forced = false, onCompleted }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 10 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('New password must be at least 10 characters with uppercase, lowercase, and a number.');
      return;
    }

    try {
      setLoading(true);
      await cloudApi.changePassword({ currentPassword, newPassword });
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onCompleted) onCompleted();
      if (!forced && onClose) {
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      setError(err.message || 'Unable to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pw-modal-title">
      <div className="modal-dialog">
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={18} strokeWidth={1.75} />
            <h2 id="pw-modal-title" style={{ fontSize: '1rem', fontWeight: 700 }}>
              {forced ? 'Replace Temporary Password' : 'Change Password'}
            </h2>
          </div>
          {!forced && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close password modal">
              <X size={16} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          </div>

          <div className="modal-foot">
            {!forced && (
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
