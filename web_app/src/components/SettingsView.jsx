import React, { useEffect, useState } from 'react';
import { Save, Mail, ShieldCheck, Activity, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getCapabilities } from '../config/roles';
import { cloudApi, getCloudEnvironmentInfo } from '../services/cloudClient';

export default function SettingsView({ currentUser, onOpenChangePassword }) {
  const caps = getCapabilities(currentUser?.role);
  const envInfo = getCloudEnvironmentInfo();

  const [settings, setSettings] = useState({
    company_name: 'PHA INDIA PVT. LTD.',
    plant_location: 'Plant 1 — Press Shop MFG-2',
    shift_a_start: '08:00',
    shift_a_end: '16:30',
    shift_b_start: '16:30',
    shift_b_end: '01:00',
    shift_c_start: '01:00',
    shift_c_end: '08:00',
    hours_per_shift: '8',
    target_efficiency_threshold: '85',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Recovery Email State (Admin Only)
  const [recoveryEmail, setRecoveryEmail] = useState(currentUser?.recovery_email || '');
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  // Diagnostics State (Admin Only)
  const [diagResult, setDiagResult] = useState(null);
  const [diagBusy, setDiagBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!caps.canViewSettings) {
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await cloudApi.getSettings();
        if (mounted && res) {
          setSettings((prev) => ({ ...prev, ...res }));
        }
      } catch (err) {
        if (mounted) setNotice({ type: 'err', text: err?.message || 'Unable to load system settings.' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [caps.canViewSettings]);

  if (!caps.canViewSettings) {
    return (
      <div className="banner is-err">
        <span>Access restricted. Settings, recovery configuration, and diagnostics are Admin-only.</span>
      </div>
    );
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await cloudApi.saveSettings(settings);
      setNotice({ type: 'ok', text: 'Plant and shift configuration saved.' });
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSetRecoveryEmail = async (e) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    setRecoveryBusy(true);
    setNotice(null);
    try {
      const res = await cloudApi.setAdminRecoveryEmail(recoveryEmail.trim());
      setRecoveryPending(true);
      setNotice({ type: 'ok', text: res?.message || 'Verification code sent to recovery email.' });
    } catch (err) {
      setRecoveryPending(Boolean(err?.payload?.pending_verification));
      setNotice({ type: 'err', text: err?.message || 'Unable to send verification code.' });
    } finally {
      setRecoveryBusy(false);
    }
  };

  const handleVerifyRecoveryEmail = async (e) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;
    setRecoveryBusy(true);
    setNotice(null);
    try {
      await cloudApi.verifyAdminRecoveryEmail(verifyCode.trim());
      setRecoveryPending(false);
      setVerifyCode('');
      setNotice({ type: 'ok', text: 'Admin recovery email verified and active.' });
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Invalid verification code.' });
    } finally {
      setRecoveryBusy(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setDiagBusy(true);
    try {
      const res = await cloudApi.testConnection();
      setDiagResult(res);
    } catch (err) {
      setDiagResult({ ok: false, mode: envInfo.mode, detail: err?.message || 'Connection test failed.' });
    } finally {
      setDiagBusy(false);
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

      {/* 1. Plant & Shift Settings */}
      <form className="surface-card" onSubmit={handleSaveSettings}>
        <div className="section-header">
          <div>
            <h2 className="section-title">Plant & Shift Configuration</h2>
            <p className="section-subtitle">Standard schedules and production KPI thresholds</p>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving || loading}>
            <Save size={15} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="filter-bar">
          <div className="field-group">
            <label className="field-label" htmlFor="set-company">Company Identity</label>
            <input
              id="set-company"
              className="field-input"
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="set-plant">Plant Name / Location</label>
            <input
              id="set-plant"
              className="field-input"
              value={settings.plant_location}
              onChange={(e) => setSettings({ ...settings, plant_location: e.target.value })}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="set-eff">Target Efficiency (%)</label>
            <input
              id="set-eff"
              type="text"
              inputMode="numeric"
              className="field-input"
              value={settings.target_efficiency_threshold}
              onChange={(e) => {
                if (/^\d*$/.test(e.target.value)) {
                  setSettings({ ...settings, target_efficiency_threshold: e.target.value });
                }
              }}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="set-hours">Hours per Shift</label>
            <input
              id="set-hours"
              type="text"
              inputMode="numeric"
              className="field-input"
              value={settings.hours_per_shift}
              onChange={(e) => {
                if (/^\d*$/.test(e.target.value)) {
                  setSettings({ ...settings, hours_per_shift: e.target.value });
                }
              }}
            />
          </div>
        </div>
      </form>

      {/* 2. Security & Verified Recovery Email */}
      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Admin Security & Password Recovery Email</h2>
            <p className="section-subtitle">
              Recovery codes are sent only after email ownership is verified via single-use code.
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onOpenChangePassword}>
            <ShieldCheck size={15} />
            Change Admin Password
          </button>
        </div>

        <form onSubmit={handleSetRecoveryEmail} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field-group" style={{ flex: '1 1 280px' }}>
            <label className="field-label" htmlFor="set-rec-email">
              Verified Recovery Email{' '}
              {currentUser?.recovery_email_verified ? (
                <span className="status-pill is-ok" style={{ marginLeft: 6 }}>Verified</span>
              ) : (
                <span className="status-pill is-warn" style={{ marginLeft: 6 }}>Unverified</span>
              )}
            </label>
            <input
              id="set-rec-email"
              type="email"
              className="field-input"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="admin-recovery@company.com"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={recoveryBusy}>
            <Mail size={15} />
            Send Verification Code
          </button>
        </form>

        {(recoveryPending || (recoveryEmail && !currentUser?.recovery_email_verified)) && (
          <form onSubmit={handleVerifyRecoveryEmail} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
            <div className="field-group" style={{ width: 220 }}>
              <label className="field-label" htmlFor="set-rec-code">6-Digit Verification Code</label>
              <input
                id="set-rec-code"
                type="text"
                inputMode="numeric"
                className="field-input mono"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="6-digit code"
              />
            </div>
            <button type="submit" className="btn btn-navy" disabled={recoveryBusy}>
              Confirm Verification Code
            </button>
          </form>
        )}
      </section>

      {/* 3. Connection Diagnostics & Android APK Distribution */}
      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Cloud Sync Diagnostics & Shopfloor Companion</h2>
            <p className="section-subtitle">
              Diagnostics are restricted to Admin Settings; configuration comes strictly from environment variables.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/PRESS_SHOP_MFG-2.apk" className="btn btn-secondary" download>
              <Download size={15} />
              Download Android APK
            </a>
            <button type="button" className="btn btn-navy" onClick={handleRunDiagnostics} disabled={diagBusy}>
              <Activity size={15} />
              {diagBusy ? 'Testing...' : 'Test Cloud Connection'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <div className="kpi-label">Active Data Mode</div>
            <div className="mono" style={{ fontWeight: 700, marginTop: 4 }}>{envInfo.mode}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <div className="kpi-label">Cloud Host</div>
            <div className="mono" style={{ fontWeight: 600, marginTop: 4, fontSize: '0.82rem', wordBreak: 'break-all' }}>
              {envInfo.supabaseHost}
            </div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <div className="kpi-label">Supabase Env Provisioned</div>
            <div style={{ marginTop: 4 }}>
              <span className={`status-pill ${envInfo.supabaseConfigured ? 'is-ok' : 'is-warn'}`}>
                {envInfo.supabaseConfigured ? 'Configured' : 'Not Configured'}
              </span>
            </div>
          </div>
        </div>

        {diagResult && (
          <div className={`banner ${diagResult.ok ? 'is-ok' : 'is-err'}`} style={{ marginTop: 12 }}>
            <span>{diagResult.detail}</span>
          </div>
        )}
      </section>
    </div>
  );
}
