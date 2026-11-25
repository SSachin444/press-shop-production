import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Cpu,
  Monitor,
  ArrowRight,
  Download,
  Lock,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { ROLE_GATEWAY_OPTIONS, ROLES } from '../config/roles';
import { cloudApi } from '../services/cloudClient';
import LiveClock from './LiveClock';

const ROLE_ICONS = {
  [ROLES.ADMIN]: ShieldCheck,
  [ROLES.SUPERVISOR]: UserCheck,
  [ROLES.OPERATOR]: Cpu,
  [ROLES.DASHBOARD]: Monitor,
};

export default function RoleGateway({ onAuthenticated }) {
  const [selectedRole, setSelectedRole] = useState(ROLES.OPERATOR);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Recovery flow state
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState('request'); // 'request' | 'confirm'
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPw, setResetNewPw] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');

  const activeMeta = ROLE_GATEWAY_OPTIONS.find((r) => r.id === selectedRole) || ROLE_GATEWAY_OPTIONS[2];

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setError('');
    setRecoveryMode(false);
    setRecoveryMessage('');
    if (roleId === ROLES.ADMIN && !username) setUsername('admin');
    else if (roleId === ROLES.SUPERVISOR && !username) setUsername('supervisor');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      let session;
      if (activeMeta.requiresPassword) {
        session = await cloudApi.loginWithPassword({
          role: selectedRole,
          username,
          password,
        });
      } else {
        session = await cloudApi.enterUnauthenticatedRole({
          role: selectedRole,
          operatorName,
        });
      }
      onAuthenticated(session);
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setRecoveryMessage('');
    try {
      setLoading(true);
      const res = await cloudApi.requestPasswordReset({
        role: selectedRole,
        email: recoveryEmail,
      });
      setRecoveryMessage(res.message || 'If a verified recovery email matches, a short-lived reset code was sent.');
      setRecoveryStep('confirm');
    } catch (err) {
      setError(err.message || 'Unable to process recovery request.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setError('');
    setRecoveryMessage('');
    try {
      setLoading(true);
      const res = await cloudApi.confirmPasswordReset({
        role: selectedRole,
        email: recoveryEmail,
        code: resetCode,
        newPassword: resetNewPw,
      });
      setRecoveryMessage(res.message || 'Password reset complete. Sign in with your new password.');
      setRecoveryMode(false);
      setRecoveryStep('request');
      setPassword('');
    } catch (err) {
      setError(err.message || 'Invalid or expired reset code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="gateway-page">
      <div className="gateway-card">
        <div className="gateway-header">
          <div className="brand-lockup">
            <div className="brand-mark brand-mark-accent" aria-hidden="true">PHA</div>
            <div>
              <div className="brand-kicker">PHA INDIA PRIVATE LIMITED</div>
              <h1 className="brand-title">PRESS SHOP MFG-2 • Plant 1</h1>
            </div>
          </div>
          <LiveClock />
        </div>

        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>Select Access Role</h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
            Choose your shopfloor role to continue. Admin and Supervisor require verified credentials.
          </p>
        </div>

        <div className="role-grid" role="radiogroup" aria-label="Select access role">
          {ROLE_GATEWAY_OPTIONS.map((role) => {
            const Icon = ROLE_ICONS[role.id];
            const selected = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`role-option ${selected ? 'is-selected' : ''}`}
                onClick={() => handleRoleSelect(role.id)}
              >
                <div className="role-option-head">
                  <span className="role-option-title">
                    <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                    <span>{role.title}</span>
                  </span>
                  <span className={`status-pill ${role.requiresPassword ? 'is-warn' : 'is-ok'}`}>
                    {role.requiresPassword ? 'Password' : role.id === ROLES.DASHBOARD ? 'Read-Only' : 'Shopfloor'}
                  </span>
                </div>
                <span className="role-option-desc">{role.description}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="banner is-err" role="alert" style={{ marginBottom: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </span>
          </div>
        )}

        {recoveryMessage && (
          <div className="banner is-ok" role="status" style={{ marginBottom: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} aria-hidden="true" />
              {recoveryMessage}
            </span>
          </div>
        )}

        {!recoveryMode ? (
          <form onSubmit={handleSubmit} className="gateway-form-box">
            {activeMeta.requiresPassword ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="gw-username">
                    {selectedRole} Username or Email
                  </label>
                  <input
                    id="gw-username"
                    type="text"
                    className="field-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={selectedRole === ROLES.ADMIN ? 'admin' : 'supervisor'}
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="gw-password">
                    Password
                  </label>
                  <input
                    id="gw-password"
                    type="password"
                    className="field-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>
            ) : selectedRole === ROLES.OPERATOR ? (
              <div className="field-group">
                <label className="field-label" htmlFor="gw-operator-name">
                  Operator Name or ID (Optional)
                </label>
                <input
                  id="gw-operator-name"
                  type="text"
                  className="field-input"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="e.g. A20755 / Line Operator"
                />
              </div>
            ) : (
              <div style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
                Opens full-screen read-only Live Cell Status display for shopfloor monitors. No data entry or admin controls are available.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
              {activeMeta.requiresPassword ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setRecoveryMode(true);
                    setError('');
                    setRecoveryMessage('');
                  }}
                >
                  <KeyRound size={14} aria-hidden="true" />
                  <span>Forgot Password</span>
                </button>
              ) : (
                <span />
              )}

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {activeMeta.requiresPassword && <Lock size={15} aria-hidden="true" />}
                <span>{loading ? 'Signing in...' : `Continue as ${selectedRole}`}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </form>
        ) : (
          <div className="gateway-form-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.94rem', fontWeight: 700 }}>
                Password Recovery ({selectedRole})
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setRecoveryMode(false);
                  setError('');
                }}
              >
                <ArrowLeft size={14} aria-hidden="true" />
                <span>Back to Sign In</span>
              </button>
            </div>

            {recoveryStep === 'request' ? (
              <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="rec-email">
                    Verified Recovery Email Address
                  </label>
                  <input
                    id="rec-email"
                    type="email"
                    className="field-input"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="recovery@company.com"
                    required
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setRecoveryStep('confirm')}
                  >
                    Already have a reset code?
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Sending...' : 'Send Reset Code'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="rec-email-2">Recovery Email</label>
                  <input
                    id="rec-email-2"
                    type="email"
                    className="field-input"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field-group">
                    <label className="field-label" htmlFor="rec-code">Single-Use Reset Code</label>
                    <input
                      id="rec-code"
                      type="text"
                      inputMode="numeric"
                      className="field-input mono"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="rec-newpw">New Strong Password</label>
                    <input
                      id="rec-newpw"
                      type="password"
                      className="field-input"
                      value={resetNewPw}
                      onChange={(e) => setResetNewPw(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="gateway-footer">
          <span>Sriperumbudur Plant • Synchronized via Cloud</span>
          <a
            href="/PRESS_SHOP_MFG-2.apk"
            download="PRESS_SHOP_MFG-2.apk"
            className="btn btn-secondary btn-sm"
          >
            <Download size={14} aria-hidden="true" />
            <span>Download Android APK</span>
          </a>
        </div>
      </div>
    </main>
  );
}
