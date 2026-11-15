import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Building2, 
  ShieldCheck, 
  Sliders
} from 'lucide-react';
import { api } from '../api';

export default function SettingsPage({ currentUser }) {
  const [settings, setSettings] = useState({
    company_name: 'PHA INDIA PRIVATE LIMITED',
    plant_location: 'Sriperumbudur, Tamil Nadu',
    shift_a_start: '08:00',
    shift_a_end: '16:30',
    shift_b_start: '16:30',
    shift_b_end: '01:00',
    shift_c_start: '01:00',
    shift_c_end: '08:00',
    target_efficiency_threshold: '85',
    hours_per_shift: '8'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const isAdmin = currentUser?.role === 'Admin';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      if (res.settings) {
        setSettings((prev) => ({ ...prev, ...res.settings }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      showNotice('error', 'Only Administrators can update system configurations');
      return;
    }

    try {
      setSaving(true);
      await api.saveSettings(settings);
      showNotice('success', 'Factory configurations and shift timings saved successfully!');
    } catch (err) {
      showNotice('error', err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          background: notification.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${notification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: notification.type === 'success' ? '#065f46' : '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 600
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Settings size={22} color="#1e40af" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Plant Operational Configurations & Shift Setup</h2>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.84rem', marginTop: 2 }}>
              Configure three-shift operational timings, plant parameters, and overtime multiplier rules
            </p>
          </div>

          {isAdmin && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Shift Timings Box */}
        <div className="card-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Clock size={18} color="#2563eb" />
              <span>Three-Shift Operational Timings</span>
            </div>
            <div className="panel-subtitle">Define shift start and handover boundaries</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            {/* Shift A */}
            <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', padding: 14, borderRadius: 8 }}>
              <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 10 }}>Shift A (Morning Shift)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    className="form-input"
                    disabled={!isAdmin}
                    value={settings.shift_a_start}
                    onChange={(e) => setSettings({ ...settings, shift_a_start: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    className="form-input"
                    disabled={!isAdmin}
                    value={settings.shift_a_end}
                    onChange={(e) => setSettings({ ...settings, shift_a_end: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Shift B */}
            <div style={{ border: '1px solid #a5f3fc', background: '#ecfeff', padding: 14, borderRadius: 8 }}>
              <div style={{ fontWeight: 700, color: '#0891b2', marginBottom: 10 }}>Shift B (Evening Shift)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    className="form-input"
                    disabled={!isAdmin}
                    value={settings.shift_b_start}
                    onChange={(e) => setSettings({ ...settings, shift_b_start: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    className="form-input"
                    disabled={!isAdmin}
                    value={settings.shift_b_end}
                    onChange={(e) => setSettings({ ...settings, shift_b_end: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Shift C */}
            <div style={{ border: '1px solid #ddd6fe', background: '#faf5ff', padding: 14, borderRadius: 8 }}>
              <div style={{ fontWeight: 700, color: '#7c3aed', marginBottom: 10 }}>Shift C (Night Shift)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    className="form-input"
                    disabled={!isAdmin}
                    value={settings.shift_c_start}
                    onChange={(e) => setSettings({ ...settings, shift_c_start: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    className="form-input"
                    disabled={!isAdmin}
                    value={settings.shift_c_end}
                    onChange={(e) => setSettings({ ...settings, shift_c_end: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Company & Plant Details */}
        <div className="card-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Building2 size={18} color="#059669" />
              <span>Plant & Company Metadata</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Company Legal Name</label>
              <input
                type="text"
                className="form-input"
                disabled={!isAdmin}
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Manufacturing Plant Location</label>
              <input
                type="text"
                className="form-input"
                disabled={!isAdmin}
                value={settings.plant_location}
                onChange={(e) => setSettings({ ...settings, plant_location: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 10 }}>
            <div className="form-group">
              <label className="form-label">Target Efficiency Threshold (%)</label>
              <input
                type="text"
                className="form-input"
                disabled={!isAdmin}
                value={settings.target_efficiency_threshold || '85'}
                onChange={(e) => setSettings({ ...settings, target_efficiency_threshold: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Standard Working Hours Per Shift</label>
              <input
                type="text"
                className="form-input"
                disabled={!isAdmin}
                value={settings.hours_per_shift}
                onChange={(e) => setSettings({ ...settings, hours_per_shift: e.target.value })}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
