import React, { useState } from 'react';
import { 
  Home, 
  Users, 
  Factory, 
  CalendarCheck, 
  BarChart2, 
  Menu, 
  X, 
  Layers, 
  GitBranch, 
  Repeat, 
  Activity, 
  Timer, 
  ClipboardList, 
  Cpu, 
  MessageSquare, 
  Settings, 
  Wifi, 
  LogOut,
  ShieldCheck,
  ChevronRight,
  Download,
  Smartphone
} from 'lucide-react';
import { getServerUrl } from '../api';

export default function MobileNavBar({ 
  activeTab, 
  setActiveTab, 
  currentUser, 
  onLogout, 
  onOpenLogin, 
  onOpenWifiModal,
  onOpenLeftSidebar
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 5 PRIMARY TABS MATCHING e:\ui1 MainActivity.kt:
  // Home, Manpower, Production, Attendance, Reports
  const mainTabs = [
    { id: 'dashboard', label: 'Home', icon: Home, matchTabs: ['dashboard'] },
    { id: 'employees', label: 'Manpower', icon: Users, matchTabs: ['employees'] },
    { 
      id: 'production-hub', 
      label: 'Production', 
      icon: Factory, 
      matchTabs: ['production-hub', 'cell-status', 'hourly-production', 'plans', 'nc-production', 'tandem-production'] 
    },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck, matchTabs: ['attendance'] },
    { id: 'reports', label: 'Reports', icon: BarChart2, matchTabs: ['reports', 'three-shifts', 'handovers', 'settings'] }
  ];

  const moreSections = [
    {
      category: 'Production & Shopfloor',
      items: [
        { id: 'hourly-production', label: 'Hourly Output Entry (Locked Target)', icon: Timer },
        { id: 'cell-status', label: 'Live Cell Status & Output %', icon: Activity },
        { id: 'machine-summary', label: 'Machine Summary & OEE', icon: Cpu },
        { id: 'plans', label: 'Tool Plans (Max 5 per Machine)', icon: ClipboardList },
        { id: 'nc-production', label: 'NC Presses (16 Units)', icon: Layers },
        { id: 'tandem-production', label: 'Tandem Lines (6 Lines)', icon: GitBranch },
        { id: 'three-shifts', label: '3-Shift Performance', icon: Repeat },
      ]
    },
    {
      category: 'Workforce & Assets',
      items: [
        { id: 'employees', label: 'Manpower & Employee Directory', icon: Users },
        { id: 'attendance', label: 'Daily Shift Attendance', icon: CalendarCheck },
        { id: 'machines', label: 'Machine Directory & Status', icon: Cpu },
        { id: 'handovers', label: 'Shift Handover Log', icon: MessageSquare },
      ]
    },
    {
      category: 'System & Reports',
      items: [
        { id: 'reports', label: 'Plant Reports & CSV Export', icon: BarChart2 },
        { id: 'settings', label: 'System Settings', icon: Settings },
      ]
    }
  ];

  const handleSelectTab = (id) => {
    setActiveTab(id);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* NATIVE BOTTOM NAVIGATION BAR (Visible on mobile screens) */}
      <nav className="mobile-bottom-nav">
        {mainTabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.matchTabs.includes(activeTab);

          return (
            <button
              key={t.id}
              type="button"
              className={`mobile-tab-btn ${isActive ? 'tab-active' : ''}`}
              onClick={() => handleSelectTab(t.id)}
            >
              <div className="tab-icon-wrap">
                <Icon size={20} />
                {isActive && <span className="tab-dot" />}
              </div>
              <span className="tab-label">{t.label}</span>
            </button>
          );
        })}

        {/* Left Sidebar / Menu Toggle */}
        <button
          type="button"
          className="mobile-tab-btn"
          onClick={() => {
            if (onOpenLeftSidebar) onOpenLeftSidebar();
            else setDrawerOpen(!drawerOpen);
          }}
          title="Open Left Sidebar Menu"
        >
          <div className="tab-icon-wrap">
            <Menu size={20} />
          </div>
          <span className="tab-label">Menu</span>
        </button>
      </nav>

      {/* MOBILE DRAWER / BOTTOM SHEET */}
      {drawerOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="pha-logo-badge" style={{ padding: '6px 10px', fontSize: '0.85rem' }}>
                  PHA
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>PHA INDIA PRIVATE LIMITED</div>
                  <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#fff' }}>PRESS SHOP MFG-2</div>
                </div>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => setDrawerOpen(false)}
                style={{ padding: '6px 10px', borderRadius: 8 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Current User Role Pill */}
            <div className="drawer-user-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#2563eb', padding: 8, borderRadius: 10, color: '#fff' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                    {currentUser?.full_name || 'Shift Supervisor'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Role: <strong style={{ color: '#2563eb' }}>{currentUser?.role || 'Supervisor'}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setDrawerOpen(false);
                  if (onOpenLogin) onOpenLogin();
                }}
                style={{ fontSize: '0.72rem' }}
              >
                Switch Role
              </button>
            </div>

            {/* Navigation Sections */}
            <div className="drawer-nav-list">
              {moreSections.map((sec) => (
                <div key={sec.category} className="drawer-section">
                  <div className="drawer-section-title">{sec.category}</div>
                  <div className="drawer-items-grid">
                    {sec.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isItemActive = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`drawer-nav-item ${isItemActive ? 'active' : ''}`}
                          onClick={() => handleSelectTab(item.id)}
                        >
                          <div className="drawer-item-left">
                            <div className="drawer-icon-wrap">
                              <ItemIcon size={18} />
                            </div>
                            <span className="drawer-item-title">{item.label}</span>
                          </div>
                          <ChevronRight size={15} color="#94a3b8" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions Footer */}
            <div className="drawer-footer">
              {/* Direct APK Download Button */}
              <a
                href="/download-apk"
                download="PRESS_SHOP_MFG-2.apk"
                className="drawer-apk-btn"
                style={{ textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Smartphone size={16} />
                  <span>Download APK (PRESS_SHOP_MFG-2.apk)</span>
                </div>
                <Download size={15} />
              </a>

              {/* WiFi Server Settings */}
              <button
                type="button"
                className="drawer-wifi-btn"
                onClick={() => {
                  setDrawerOpen(false);
                  if (onOpenWifiModal) onOpenWifiModal();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Wifi size={16} color="#10b981" />
                  <span>WiFi Server Connection Settings</span>
                </div>
                <ChevronRight size={16} color="#94a3b8" />
              </button>

              {/* Logout Button */}
              <button
                type="button"
                className="drawer-logout-btn"
                onClick={() => {
                  setDrawerOpen(false);
                  if (onLogout) onLogout();
                }}
              >
                <LogOut size={16} />
                <span>Log Out of Application</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
