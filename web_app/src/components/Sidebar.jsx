import React from 'react';
import { 
  Home,
  LayoutDashboard, 
  Activity, 
  Factory,
  ClipboardList, 
  Timer, 
  Layers, 
  GitBranch, 
  Repeat, 
  Users, 
  CalendarCheck, 
  Cpu, 
  MessageSquare, 
  FileSpreadsheet, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  UserCheck, 
  MapPin, 
  Wifi, 
  Clock, 
  Download, 
  Smartphone,
  X,
  BarChart3,
  SplitSquareHorizontal
} from 'lucide-react';
import { getServerUrl } from '../api';
import LiveClock from './LiveClock';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  currentUser, 
  onLogout, 
  onOpenLogin, 
  onOpenWifiModal,
  isOpen,
  onClose
}) {
  const navItems = [
    { id: 'dashboard', label: 'Home Screen', icon: Home, section: 'Main Screens' },
    { id: 'employees', label: 'Manpower Directory', icon: Users, section: 'Main Screens' },
    { id: 'attendance', label: 'Daily Attendance', icon: CalendarCheck, section: 'Main Screens' },
    { id: 'reports', label: 'Reports & Analytics', icon: FileSpreadsheet, section: 'Main Screens' },

    // ── NEW PRODUCTION PAGES ──
    { id: 'standard-production', label: 'Production Workspace', icon: SplitSquareHorizontal, section: 'Production Pages', badge: 'P1+P2', badgeBg: '#1e40af', badgeColor: '#fff' },
    { id: 'production-dashboard', label: 'Production Dashboard', icon: BarChart3, section: 'Production Pages', badge: 'P3', badgeBg: '#059669', badgeColor: '#fff' },
    { id: 'analytics', label: 'Plant Analytics & Trends', icon: TrendingUp, section: 'Production Pages', badge: 'KPI', badgeBg: '#7c3aed', badgeColor: '#fff' },

    // ── SHOPFLOOR TOOLS ──
    { id: 'hourly-production', label: '⚡ Hourly Production Entry', icon: Timer, section: 'Shopfloor Entry' },
    { id: 'cell-status', label: 'Live Cell Status (OEE %)', icon: Activity, section: 'Shopfloor Entry' },
    { id: 'plans', label: 'Tool Plans (Max 5 Plans)', icon: ClipboardList, section: 'Shopfloor Entry' },
    { id: 'nc-production', label: 'NC Presses (16 Units)', icon: Layers, section: 'Shopfloor Entry' },
    { id: 'tandem-production', label: 'Tandem Lines (6 Lines)', icon: GitBranch, section: 'Shopfloor Entry' },
    { id: 'three-shifts', label: '3-Shift Comparison', icon: Repeat, section: 'Shopfloor Entry' },
    { id: 'production-hub', label: 'Production Hub', icon: Factory, section: 'Shopfloor Entry' },

    { id: 'machines', label: 'Machine Directory & QR', icon: Cpu, section: 'Plant Assets & System' },
    { id: 'handovers', label: 'Shift Handover Log', icon: MessageSquare, section: 'Plant Assets & System' },
    { id: 'activity-logs', label: 'Audit Activity Log', icon: ShieldCheck, section: 'Plant Assets & System' },
    { id: 'settings', label: 'System Settings', icon: Settings, section: 'Plant Assets & System' },
  ];

  const userRole = (currentUser?.role || 'Supervisor').toLowerCase();
  
  const rolePermissions = {
    admin: ['dashboard', 'employees', 'attendance', 'reports', 'standard-production', 'production-dashboard', 'analytics', 'hourly-production', 'cell-status', 'plans', 'nc-production', 'tandem-production', 'three-shifts', 'production-hub', 'machines', 'handovers', 'activity-logs', 'settings'],
    'production manager': ['dashboard', 'reports', 'standard-production', 'production-dashboard', 'analytics', 'hourly-production', 'cell-status', 'plans', 'nc-production', 'tandem-production', 'three-shifts', 'production-hub', 'machines', 'activity-logs'],
    supervisor: ['dashboard', 'attendance', 'reports', 'standard-production', 'production-dashboard', 'hourly-production', 'cell-status', 'plans', 'nc-production', 'tandem-production', 'machines', 'handovers'],
    management: ['dashboard', 'reports', 'production-dashboard', 'analytics', 'three-shifts', 'cell-status', 'nc-production', 'tandem-production', 'activity-logs'],
    operator: ['dashboard', 'hourly-production', 'cell-status', 'plans', 'machines']
  };

  const allowedIds = rolePermissions[userRole] || rolePermissions.supervisor;
  const filteredNavItems = navItems.filter(item => allowedIds.includes(item.id));

  let currentSection = '';

  const handleSelect = (id) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop when Left Sidebar is Open */}
      {isOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            zIndex: 1050,
            backdropFilter: 'blur(3px)'
          }}
        />
      )}

      {/* Left Navigation Sidebar Drawer */}
      <aside 
        className={`sidebar ${isOpen ? 'sidebar-mobile-open' : ''}`}
        style={{
          zIndex: 1100,
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Sidebar Header with Corporate Branding */}
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="pha-logo-badge">PHA</div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-company-logo-text">PHA INDIA PRIVATE LIMITED</div>
              <div className="sidebar-press-shop-title">PRESS SHOP MFG-2</div>
            </div>
          </div>

          {/* Close button for mobile */}
          {isOpen && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                borderRadius: 8,
                padding: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Live Digital Clock in Sidebar */}
        <div style={{ padding: '8px 14px', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <LiveClock showDate={true} />
        </div>

        {/* Navigation List */}
        <div className="sidebar-nav">
          {filteredNavItems.map((item) => {
            const showSection = item.section !== currentSection;
            if (showSection) currentSection = item.section;

            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <React.Fragment key={item.id}>
                {showSection && <div className="nav-section-label">{item.section}</div>}
                <button
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelect(item.id)}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {/* Custom badge support (for new Production Pages) */}
                  {item.badge && (
                    <span style={{
                      background: item.badgeBg || '#1E88E5',
                      color: item.badgeColor || '#fff',
                      fontSize: '0.6rem',
                      fontWeight: 900,
                      padding: '1px 5px',
                      borderRadius: 5,
                      marginLeft: 'auto',
                      letterSpacing: '0.03em'
                    }}>
                      {item.badge}
                    </span>
                  )}
                  {item.id === 'cell-status' && (
                    <span className="nav-tag-live">LIVE</span>
                  )}
                  {item.id === 'hourly-production' && !item.badge && (
                    <span style={{
                      background: '#1E88E5',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: 6,
                      marginLeft: 'auto'
                    }}>
                      ENTRY
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Sidebar Footer with Active Role & WiFi Indicator */}
        <div className="sidebar-footer">
          {/* WiFi quick indicator */}
          <div 
            onClick={() => {
              if (onClose) onClose();
              if (onOpenWifiModal) onOpenWifiModal();
            }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '6px 10px', 
              borderRadius: 6, 
              marginBottom: 8,
              cursor: 'pointer',
              fontSize: '0.72rem',
              color: '#38bdf8'
            }}
            title="Click to view or edit WiFi backend server IP"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wifi size={13} color="#00B074" />
              <span>Server: {getServerUrl().replace(/^https?:\/\//, '')}</span>
            </div>
            <span style={{ fontSize: '0.66rem', color: '#00B074', fontWeight: 800 }}>LIVE</span>
          </div>

          {/* Current User Card */}
          <div className="user-profile-widget">
            <div className="user-avatar-badge">
              <ShieldCheck size={16} color="#38bdf8" />
            </div>
            <div className="user-info-text">
              <div className="user-name-label">{currentUser?.full_name || 'SACHIN S'}</div>
              <div className="user-role-label">Role: {currentUser?.role || 'Operator'}</div>
            </div>
            <button
              className="btn-icon-subtle"
              title="Logout / Switch User"
              onClick={onLogout}
            >
              <LogOut size={13} />
            </button>
          </div>

          {/* Download Android APK Button */}
          <a 
            href="/download-apk" 
            download="PRESS_SHOP_MFG-2.apk"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #00B074 0%, #00704A 100%)',
              color: '#ffffff',
              padding: '7px 10px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: '0.74rem',
              fontWeight: 800,
              marginTop: 8
            }}
            title="Download the Android APK file directly"
          >
            <Smartphone size={14} />
            <span>Download Android APK</span>
            <Download size={12} />
          </a>
        </div>
      </aside>
    </>
  );
}
