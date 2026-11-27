import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Timer,
  Activity,
  Factory,
  Users,
  CalendarCheck,
  Cpu,
  MessageSquare,
  FileSpreadsheet,
  UserCog,
  ShieldCheck,
  Settings,
  Menu,
  X,
  Bell,
  ChevronDown,
  Lock,
  LogOut,
  Download,
  WifiOff,
  RefreshCw,
  GitBranch,
  Wrench,
  BarChart3,
  Send,
  UserCog as UserAccountIcon,
} from 'lucide-react';
import { getAllowedRoutes, getCapabilities, getRouteByTab } from '../config/roles';
import LiveClock from './LiveClock';

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  'hourly-production': Timer,
  'tandem-production': GitBranch,
  'cell-status': Activity,
  production: Factory,
  tools: Wrench,
  'production-summary': BarChart3,
  employees: Users,
  attendance: CalendarCheck,
  machines: Cpu,
  handovers: MessageSquare,
  reports: FileSpreadsheet,
  'whatsapp-reports': Send,
  users: UserCog,
  'activity-logs': ShieldCheck,
  settings: Settings,
};

export default function AppShell({
  activeTab,
  onSelectTab,
  currentUser,
  selectedPlant,
  selectedDate,
  selectedShift,
  isOnline,
  pendingSyncCount,
  onRetryPendingSync,
  notifications = [],
  onOpenNotifications,
  onOpenChangePassword,
  onSignOut,
  children,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const role = currentUser?.role;
  const caps = getCapabilities(role);
  const allowedRoutes = getAllowedRoutes(role);
  const currentRoute = getRouteByTab(activeTab);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleNav = (tabId) => {
    onSelectTab(tabId);
    setDrawerOpen(false);
  };

  let lastSection = '';
  const mobileTabs = allowedRoutes.filter((r) => r.mobilePrimary).slice(0, 4);

  return (
    <div className="shell-root">
      {drawerOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar (Desktop static, Tablet/Mobile drawer) */}
      <aside className={`shell-sidebar ${drawerOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
        <div className="shell-sidebar-head">
          <div className="brand-lockup" style={{ gap: 10 }}>
            <div className="brand-mark brand-mark-accent" style={{ width: 32, height: 32, fontSize: '0.78rem' }} aria-hidden="true">
              PHA
            </div>
            <div>
              <div className="brand-kicker" style={{ fontSize: '0.62rem' }}>PHA INDIA</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                PRESS SHOP MFG-2
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm mobile-menu-trigger"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="shell-nav-scroll">
          {allowedRoutes.map((item) => {
            const showSection = item.section !== lastSection;
            lastSection = item.section;
            const Icon = NAV_ICONS[item.id] || LayoutDashboard;
            const active = activeTab === item.id;
            return (
              <React.Fragment key={item.id}>
                {showSection && <div className="nav-section-heading">{item.section}</div>}
                <button
                  type="button"
                  className={`nav-link-btn ${active ? 'is-active' : ''}`}
                  onClick={() => handleNav(item.id)}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="shell-sidebar-foot">
          <a
            href="/PRESS_SHOP_MFG-2.apk"
            download="PRESS_SHOP_MFG-2.apk"
            className="btn btn-secondary btn-sm"
            style={{ width: '100%' }}
          >
            <Download size={14} aria-hidden="true" />
            <span>Android APK</span>
          </a>
        </div>
      </aside>

      {/* Main Column */}
      <div className="shell-main-col">
        <header className="shell-header">
          <div className="shell-header-left">
            <button
              type="button"
              className="btn btn-secondary btn-sm mobile-menu-trigger"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={17} />
            </button>

            <h1 className="shell-page-title">{currentRoute.title}</h1>

            <div className="shell-context-strip" aria-label="Active operational context">
              <span className="context-chip">{selectedPlant}</span>
              <span className="context-chip tabular">{selectedDate}</span>
              <span className="context-chip">{selectedShift}</span>
            </div>
          </div>

          <div className="shell-header-right">
            <LiveClock />

            {(caps.isAdmin || caps.isSupervisor) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenNotifications}
                aria-label={`Notifications (${notifications.length})`}
                style={{ position: 'relative' }}
              >
                <Bell size={16} strokeWidth={1.75} />
                {notifications.length > 0 && (
                  <span className="status-pill is-err tabular" style={{ padding: '1px 6px', fontSize: '0.68rem' }}>
                    {notifications.length}
                  </span>
                )}
              </button>
            )}

            <div className="user-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span>{currentUser?.role}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>

              {userMenuOpen && (
                <div className="user-menu-popover" role="menu">
                  <div style={{ padding: '6px 10px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--ink-primary)' }}>
                      {currentUser?.full_name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                      User ID: <span className="mono">{currentUser?.username}</span> · {currentUser?.role}
                    </div>
                  </div>

                  {caps.canChangeOwnPassword && (
                    <>
                      <button
                        type="button"
                        className="popover-item"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenChangePassword('password');
                        }}
                      >
                        <Lock size={15} aria-hidden="true" />
                        <span>Change Password</span>
                      </button>
                      <button
                        type="button"
                        className="popover-item"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenChangePassword('username');
                        }}
                      >
                        <UserAccountIcon size={15} aria-hidden="true" />
                        <span>Change User ID</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="popover-item is-danger"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSignOut();
                    }}
                  >
                    <LogOut size={15} aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="shell-content">
          {(!isOnline || pendingSyncCount > 0) && (
            <div
              className={`banner ${!isOnline ? 'is-err' : 'is-warn'}`}
              role="status"
              aria-live="polite"
              style={{ marginBottom: 16 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WifiOff size={16} aria-hidden="true" />
                {!isOnline
                  ? `Offline mode — ${pendingSyncCount} entry(s) queued safely for cloud sync.`
                  : `${pendingSyncCount} queued production entry(s) pending cloud confirmation.`}
              </span>
              {isOnline && pendingSyncCount > 0 && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={onRetryPendingSync}>
                  <RefreshCw size={14} aria-hidden="true" />
                  <span>Retry Sync</span>
                </button>
              )}
            </div>
          )}

          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Strictly role-filtered) */}
      <nav className="mobile-bottom-bar" aria-label="Mobile navigation">
        {mobileTabs.map((item) => {
          const Icon = NAV_ICONS[item.id] || LayoutDashboard;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`mobile-bottom-btn ${active ? 'is-active' : ''}`}
              onClick={() => handleNav(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
        {allowedRoutes.length > mobileTabs.length && (
          <button
            type="button"
            className="mobile-bottom-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="More pages"
          >
            <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>More</span>
          </button>
        )}
      </nav>
    </div>
  );
}
