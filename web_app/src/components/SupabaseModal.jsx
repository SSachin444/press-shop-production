import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertCircle, X, RefreshCw, Key, Link2, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection, 
  isSupabaseConfigured 
} from '../supabase';

export default function SupabaseModal({ isOpen, onClose, onConnectionChanged }) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testState, setTestState] = useState({ loading: false, success: null, message: '' });
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url || '');
      setAnonKey(config.anonKey || '');
      setTestState({ loading: false, success: null, message: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  const handleTest = async (testUrl, testKey) => {
    const targetUrl = (testUrl ?? url).trim();
    const targetKey = (testKey ?? anonKey).trim();

    if (!targetUrl || !targetKey) {
      setTestState({
        loading: false,
        success: false,
        message: 'Please provide both the Supabase Project URL and Anon Public Key.'
      });
      return;
    }

    setTestState({ loading: true, success: null, message: 'Testing Supabase connection...' });
    try {
      const res = await testSupabaseConnection(targetUrl, targetKey);
      setTestState({
        loading: false,
        success: true,
        message: 'Successfully connected to Supabase! Your data will now persist across page refreshes and devices.'
      });
    } catch (err) {
      setTestState({
        loading: false,
        success: false,
        message: `Connection failed: ${err.message}`
      });
    }
  };

  const handleSave = async () => {
    const trimmedUrl = url.trim();
    const trimmedKey = anonKey.trim();

    if (trimmedUrl && trimmedKey) {
      setTestState({ loading: true, success: null, message: 'Validating and saving connection...' });
      try {
        await testSupabaseConnection(trimmedUrl, trimmedKey);
        saveSupabaseConfig(trimmedUrl, trimmedKey);
        setTestState({
          loading: false,
          success: true,
          message: 'Connected & saved successfully!'
        });
        if (onConnectionChanged) onConnectionChanged(true);
        setTimeout(() => onClose(), 800);
      } catch (err) {
        // Save anyway if user insists, but warn
        saveSupabaseConfig(trimmedUrl, trimmedKey);
        if (onConnectionChanged) onConnectionChanged(true);
        setTestState({
          loading: false,
          success: false,
          message: `Saved, but connection test failed: ${err.message}. Ensure tables are created.`
        });
      }
    } else {
      saveSupabaseConfig('', '');
      if (onConnectionChanged) onConnectionChanged(false);
      onClose();
    }
  };

  const handleDisconnect = () => {
    saveSupabaseConfig('', '');
    setUrl('');
    setAnonKey('');
    setTestState({
      loading: false,
      success: null,
      message: 'Supabase disconnected. The app will use LocalStorage fallback.'
    });
    if (onConnectionChanged) onConnectionChanged(false);
  };

  const handleCopySql = () => {
    const sqlScript = `-- Run this in your Supabase SQL Editor:
create table if not exists app_state (
    id integer primary key default 1,
    state_json jsonb not null default '{}'::jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now())
);
insert into app_state (id, state_json) values (1, '{}'::jsonb) on conflict (id) do nothing;
alter table app_state enable row level security;
create policy "Allow anon full access to app_state" on app_state for all using (true) with check (true);
`;
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: 520, borderRadius: 16, overflow: 'hidden' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: '#0f172a', color: '#fff', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#3ecf8e', color: '#0f172a', padding: 8, borderRadius: 10, display: 'flex' }}>
              <Database size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Supabase Cloud Database
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Prevent data loss on page refresh with cloud persistence
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={onClose} 
            style={{ color: '#94a3b8', background: 'transparent', border: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '20px' }}>
          {/* Status Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: 10,
            marginBottom: 16,
            background: isConfigured ? '#ecfdf5' : '#fffbeb',
            border: `1px solid ${isConfigured ? '#a7f3d0' : '#fde68a'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isConfigured ? (
                <CheckCircle2 size={16} color="#059669" />
              ) : (
                <AlertCircle size={16} color="#d97706" />
              )}
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isConfigured ? '#065f46' : '#92400e' }}>
                {isConfigured ? 'Connected to Supabase Cloud' : 'Using Temporary Local Cache (Not Connected)'}
              </span>
            </div>
            {isConfigured && (
              <button 
                type="button" 
                onClick={handleDisconnect} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: '#dc2626', 
                  fontSize: '0.74rem', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                <Link2 size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                Supabase Project URL
              </label>
              <input
                type="text"
                placeholder="https://xxxxxxxxxxxxxxxx.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  fontFamily: 'monospace',
                  background: '#f8fafc',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Found in Supabase Dashboard &gt; Project Settings &gt; API
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                <Key size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                Supabase Anon / Public API Key
              </label>
              <textarea
                rows={3}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  background: '#f8fafc',
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Public safe key: 'anon' 'public' (never share your service_role secret key)
              </span>
            </div>

            {/* Test result message */}
            {testState.message && (
              <div style={{
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: testState.success ? '#f0fdf4' : (testState.loading ? '#f8fafc' : '#fef2f2'),
                border: `1px solid ${testState.success ? '#bbf7d0' : (testState.loading ? '#e2e8f0' : '#fecaca')}`,
                color: testState.success ? '#15803d' : (testState.loading ? '#475569' : '#b91c1c')
              }}>
                {testState.loading && <RefreshCw size={14} className="spin" />}
                {testState.success && <CheckCircle2 size={14} />}
                {testState.success === false && <AlertCircle size={14} />}
                <span>{testState.message}</span>
              </div>
            )}

            {/* SQL Setup Helper */}
            <div style={{
              background: '#f1f5f9',
              borderRadius: 8,
              padding: '10px 12px',
              border: '1px dashed #cbd5e1'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                  Database Tables Setup
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#334155'
                  }}
                >
                  {copiedSql ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                  <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Script'}</span>
                </button>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                Run the bundled <code>supabase_schema.sql</code> in your Supabase SQL editor to create all 11 tables with 1 click.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0'
        }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleTest()}
            disabled={testState.loading || !url || !anonKey}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={testState.loading ? 'spin' : ''} />
            <span>Test Connection</span>
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={testState.loading}
              style={{
                background: '#059669',
                borderColor: '#059669',
                color: '#fff',
                fontWeight: 700,
                padding: '7px 16px',
                borderRadius: 8
              }}
            >
              Save &amp; Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
