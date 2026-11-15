import React, { useState } from 'react';
import { Wifi, CheckCircle2, AlertCircle, X, RefreshCw, Server, ArrowRight } from 'lucide-react';
import { getServerUrl, setServerUrl, testServerConnection, DEFAULT_SERVER_URL } from '../api';

export default function WiFiServerModal({ isOpen, onClose, onServerChanged }) {
  const [currentUrl, setCurrentUrl] = useState(() => getServerUrl());
  const [testState, setTestState] = useState({ loading: false, success: null, message: '' });

  if (!isOpen) return null;

  const handleTest = async (urlToTest) => {
    const target = urlToTest || currentUrl;
    setTestState({ loading: true, success: null, message: 'Connecting to backend over WiFi...' });
    try {
      const res = await testServerConnection(target);
      setTestState({ 
        loading: false, 
        success: true, 
        message: `Connected successfully! Plant: ${res.system || 'PHA INDIA PRIVATE LIMITED'}` 
      });
    } catch (err) {
      setTestState({ 
        loading: false, 
        success: false, 
        message: `Connection failed: ${err.message}. Make sure both PC and Android phone are on the same WiFi network.` 
      });
    }
  };

  const handleSave = () => {
    setServerUrl(currentUrl);
    if (onServerChanged) onServerChanged(currentUrl);
    onClose();
  };

  const handleResetDefault = () => {
    setCurrentUrl(DEFAULT_SERVER_URL);
    setServerUrl(DEFAULT_SERVER_URL);
    handleTest(DEFAULT_SERVER_URL);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#2563eb', padding: '6px', borderRadius: 8, color: '#fff', display: 'flex' }}>
              <Wifi size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>WiFi Server Connection</h3>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>Connect Android App & Web over same WiFi</p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
            <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 6 }}>
              <strong>Host Computer WiFi IP Address:</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <code style={{ background: '#0f172a', color: '#38bdf8', padding: '6px 10px', borderRadius: 6, fontSize: '0.86rem', fontWeight: 700, flex: 1 }}>
                http://10.50.67.50:5000
              </code>
            </div>
            {/* Quick Preset Buttons for Same IP or Different IP */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={() => {
                  setCurrentUrl('http://10.50.67.50:5000');
                  handleTest('http://10.50.67.50:5000');
                }}
                style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}
              >
                Use Wi-Fi IP (10.50.67.50)
              </button>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={() => {
                  setCurrentUrl('http://127.0.0.1:5000');
                  handleTest('http://127.0.0.1:5000');
                }}
                style={{ fontSize: '0.72rem' }}
              >
                Use Localhost (127.0.0.1)
              </button>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 8, marginBottom: 0 }}>
              Connect Android and Web app on the same IP address or specify any different IP address.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Backend Server URL</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                placeholder="http://10.71.103.50:5000"
                style={{ width: '100%', paddingLeft: 34, fontFamily: 'monospace' }}
              />
              <Server size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
            </div>
          </div>

          {testState.message && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              background: testState.success === true ? '#ecfdf5' : testState.success === false ? '#fef2f2' : '#f0f9ff',
              border: `1px solid ${testState.success === true ? '#a7f3d0' : testState.success === false ? '#fecaca' : '#bae6fd'}`,
              color: testState.success === true ? '#065f46' : testState.success === false ? '#991b1b' : '#0369a1'
            }}>
              {testState.loading ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : testState.success ? (
                <CheckCircle2 size={16} color="#10b981" />
              ) : (
                <AlertCircle size={16} color="#ef4444" />
              )}
              <span>{testState.message}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onClick={() => handleTest()}
              disabled={testState.loading}
            >
              <RefreshCw size={14} className={testState.loading ? 'animate-spin' : ''} />
              <span>Test WiFi Connection</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onClick={handleSave}
            >
              <span>Save & Connect</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
