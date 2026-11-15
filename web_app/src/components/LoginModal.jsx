import React, { useState } from 'react';
import { ShieldCheck, Lock, User, X, AlertCircle } from 'lucide-react';
import { api } from '../api';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await api.login({ username, password });
      if (res.token) {
        localStorage.setItem('pha_token', res.token);
        localStorage.setItem('pha_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const setCredentials = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="pha-logo-badge" style={{ fontSize: '0.88rem', padding: '4px 8px' }}>PHA</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>User Authentication</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleLogin}>
          <div className="modal-body">
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: 6, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: '0.84rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Username</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ width: '100%', paddingLeft: 34 }}
                />
                <User size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', paddingLeft: 34 }}
                />
                <Lock size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
              </div>
            </div>

            {/* Quick Demo Switcher */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 14 }}>
              <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Quick Preset Accounts:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCredentials('admin', 'admin123')}
                  style={{ fontSize: '0.74rem' }}
                >
                  Admin
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCredentials('supervisor', 'super123')}
                  style={{ fontSize: '0.74rem' }}
                >
                  Supervisor
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCredentials('management', 'mgmt123')}
                  style={{ fontSize: '0.74rem' }}
                >
                  Management
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <ShieldCheck size={16} />
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
