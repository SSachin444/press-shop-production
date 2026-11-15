import React, { useState } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  Users, 
  ArrowRight, 
  Wifi, 
  CheckCircle2, 
  Sparkles, 
  MapPin, 
  Cpu, 
  Clock,
  Download,
  Smartphone
} from 'lucide-react';
import { api, getServerUrl } from '../api';
import LiveClock from './LiveClock';

export default function LoginScreen({ onLoginSuccess, onOpenWifiSettings }) {
  const [selectedRole, setSelectedRole] = useState('Supervisor'); // Default to Supervisor
  const [operatorName, setOperatorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const roles = [
    {
      id: 'Supervisor',
      title: 'Supervisor',
      subtitle: 'Shift In-Charge & Line Lead',
      description: 'Hourly Logging, Tool Plan Management, Shift Reports',
      icon: UserCheck,
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      borderActive: '#10b981',
      badge: 'Production Lead',
      badgeColor: '#ecfdf5',
      badgeText: '#047857'
    },
    {
      id: 'Admin',
      title: 'Admin',
      subtitle: 'Plant Management & Systems',
      description: 'Full Master Control, Settings, Employee & Machine Config',
      icon: ShieldCheck,
      gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      borderActive: '#6366f1',
      badge: 'Full Access',
      badgeColor: '#eef2ff',
      badgeText: '#4338ca'
    },
    {
      id: 'Others',
      title: 'Others',
      subtitle: 'Operator / Maintenance / QC',
      description: 'Shopfloor View, Machine Status, Downtime Tracking',
      icon: Users,
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      borderActive: '#0ea5e9',
      badge: 'Standard Access',
      badgeColor: '#f0f9ff',
      badgeText: '#0369a1'
    }
  ];

  const handleEnterApp = async (e) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const defaultNames = {
        Supervisor: 'Shift Supervisor',
        Admin: 'PHA Administrator',
        Others: 'Line Operator'
      };

      const finalName = operatorName.trim() || defaultNames[selectedRole] || selectedRole;

      // Call passwordless quick login
      const res = await api.login({
        role: selectedRole,
        username: selectedRole.toLowerCase(),
        full_name: finalName
      });

      const user = res.user || {
        username: selectedRole.toLowerCase(),
        full_name: finalName,
        role: selectedRole,
        department: selectedRole === 'Admin' ? 'Management' : 'Press Shop MFG-2'
      };

      localStorage.setItem('pha_token', res.token || `${selectedRole.toLowerCase()}:${selectedRole}`);
      localStorage.setItem('pha_user', JSON.stringify(user));
      localStorage.setItem('pha_logged_in', 'true');

      onLoginSuccess(user);
    } catch (err) {
      console.warn('Backend login fallback to local session:', err);
      // Offline fallback: enable immediate local app access
      const user = {
        username: selectedRole.toLowerCase(),
        full_name: operatorName.trim() || `${selectedRole} User`,
        role: selectedRole,
        department: selectedRole === 'Admin' ? 'Management' : 'Press Shop MFG-2'
      };
      localStorage.setItem('pha_token', `offline:${selectedRole}`);
      localStorage.setItem('pha_user', JSON.stringify(user));
      localStorage.setItem('pha_logged_in', 'true');
      onLoginSuccess(user);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-wrap">
      <div className="login-screen-card">
        {/* Top Company Branding */}
        <div className="login-header-branding">
          <div className="login-pha-logo-row">
            <div className="pha-logo-badge" style={{ fontSize: '0.9rem', padding: '4px 9px' }}>PHA</div>
            <div className="login-company-tag">PHA INDIA PRIVATE LIMITED</div>
          </div>
          <h1 className="login-app-main-title">PRESS SHOP MFG-2</h1>
          <div className="login-location-pill">
            <MapPin size={12} color="#38bdf8" />
            <span>Plant 1 • Sriperumbudur</span>
          </div>

          {/* Live 12-Hour Clock on Login Screen */}
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
            <LiveClock showDate={true} />
          </div>
        </div>

        {/* Form Container */}
        <div className="login-role-selection-box">
          <div className="login-role-prompt">
            <h2 className="login-prompt-title">Who is using the application?</h2>
            <p className="login-prompt-subtitle">Select your role to access the shopfloor dashboard</p>
          </div>

          {error && (
            <div className="login-error-alert">
              <span>{error}</span>
            </div>
          )}

          {/* Three Role Cards */}
          <div className="login-role-cards-grid">
            {roles.map((r) => {
              const Icon = r.icon;
              const isSelected = selectedRole === r.id;

              return (
                <div
                  key={r.id}
                  className={`login-role-card ${isSelected ? 'role-selected' : ''}`}
                  onClick={() => setSelectedRole(r.id)}
                  style={{
                    borderColor: isSelected ? r.borderActive : 'rgba(255, 255, 255, 0.12)',
                    boxShadow: isSelected ? `0 8px 24px -4px ${r.borderActive}40` : 'none'
                  }}
                >
                  <div className="role-card-top">
                    <div 
                      className="role-card-icon"
                      style={{ background: r.gradient }}
                    >
                      <Icon size={22} color="#ffffff" />
                    </div>
                    <span 
                      className="role-card-badge"
                      style={{ background: r.badgeColor, color: r.badgeText }}
                    >
                      {r.badge}
                    </span>
                  </div>

                  <div className="role-card-info">
                    <div className="role-card-title">{r.title}</div>
                    <div className="role-card-subtitle">{r.subtitle}</div>
                    <div className="role-card-desc">{r.description}</div>
                  </div>

                  <div className="role-card-radio">
                    <div className={`radio-dot ${isSelected ? 'radio-dot-checked' : ''}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Optional Name / Operator ID Input */}
          <div className="login-input-group">
            <label className="login-input-label">
              Your Name or Operator ID (Optional)
            </label>
            <input
              type="text"
              className="login-text-input"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder={`e.g. ${selectedRole === 'Supervisor' ? 'Shift In-Charge / Mani' : selectedRole === 'Admin' ? 'Plant Manager' : 'NC Operator / Line 2'}`}
            />
          </div>

          {/* Big Action Button */}
          <button
            type="button"
            className="login-enter-btn"
            onClick={handleEnterApp}
            disabled={loading}
          >
            <span>{loading ? 'Opening Application...' : `Enter PRESS SHOP MFG-2 as ${selectedRole}`}</span>
            <ArrowRight size={18} />
          </button>

          {/* Download Android APK Button */}
          <a
            href="/download-apk"
            download="PRESS_SHOP_MFG-2.apk"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#ffffff',
              padding: '11px 16px',
              borderRadius: 12,
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '0.88rem',
              marginTop: 10,
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
              transition: 'all 0.2s ease'
            }}
            title="Download the Android APK file directly to your phone or computer"
          >
            <Smartphone size={16} />
            <span>Download Android App (APK)</span>
            <Download size={15} style={{ opacity: 0.85 }} />
          </a>

          {/* WiFi Server Connection Indicator */}
          <div className="login-wifi-footer">
            <div className="login-wifi-status">
              <Wifi size={14} color="#10b981" />
              <span>WiFi Server: <strong>{getServerUrl().replace(/^https?:\/\//, '')}</strong></span>
            </div>
            <button
              type="button"
              className="login-wifi-settings-btn"
              onClick={onOpenWifiSettings}
            >
              WiFi Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
