import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ROLES,
  canAccessTab,
  getDefaultTabForRole,
  getRouteByTab,
  getTabFromPath,
} from './config/roles';
import { PLANTS, getCurrentShiftName } from './services/metrics';
import { purgeLegacyLocalStorage } from './services/authSession';
import { cloudApi } from './services/cloudClient';
import { flushSyncQueue, getSyncQueue } from './services/syncQueue';

import MechanicalPressBackground from './components/MechanicalPressBackground';
import RoleGateway from './components/RoleGateway';
import PasswordModal from './components/PasswordModal';
import NotificationModal from './components/NotificationModal';
import AppShell from './components/AppShell';
import DashboardView from './components/DashboardView';
import LiveCellStatusView from './components/LiveCellStatusView';
import HourlyEntryView from './components/HourlyEntryView';
import TandemProductionView from './components/TandemProductionView';
import ProductionOverviewView from './components/ProductionOverviewView';
import ToolsView from './components/ToolsView';
import ProductionSummaryView from './components/ProductionSummaryView';
import MachinesView from './components/MachinesView';
import ReportsView from './components/ReportsView';
import EmployeesView from './components/EmployeesView';
import AttendanceView from './components/AttendanceView';
import HandoversView from './components/HandoversView';
import UsersView from './components/UsersView';
import AuditLogView from './components/AuditLogView';
import SettingsView from './components/SettingsView';

function getTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [routeNotice, setRouteNotice] = useState('');

  // Shared context filters
  const [selectedPlant, setSelectedPlant] = useState(PLANTS[0]);
  const [selectedDate, setSelectedDate] = useState(() => getTodayIso());
  const [selectedShift, setSelectedShift] = useState(() => getCurrentShiftName());
  const [machineGroup, setMachineGroup] = useState('ALL');

  // Core cloud state
  const [machines, setMachines] = useState([]);
  const [tools, setTools] = useState([]);
  const [records, setRecords] = useState([]);
  const [reportRecords, setReportRecords] = useState(null);
  const [downtimes, setDowntimes] = useState([]);
  const [downtimeCodes, setDowntimeCodes] = useState([]);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [dataState, setDataState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState('');
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getSyncQueue().length);

  // Prevents overlapping 5-second background refresh requests
  const syncInFlightRef = useRef(false);

  // Modals & Alerts
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState([]);

  const currentUser = session?.user || null;
  const mustChangePassword = Boolean(currentUser?.must_change_password);

  // Sync URL cleanly while enforcing strict role access
  const navigateToTab = useCallback(
    (requestedTab, { replace = false } = {}) => {
      if (!currentUser?.role) return;
      if (!canAccessTab(currentUser.role, requestedTab)) {
        const fallback = getDefaultTabForRole(currentUser.role);
        setActiveTab(fallback);
        setRouteNotice(`Access restricted: "${requestedTab}" is not permitted for the ${currentUser.role} role.`);
        const fallbackRoute = getRouteByTab(fallback);
        window.history.replaceState({}, '', fallbackRoute.path);
        return;
      }
      setRouteNotice('');
      setActiveTab(requestedTab);
      const route = getRouteByTab(requestedTab);
      if (window.location.pathname !== route.path) {
        if (replace) window.history.replaceState({}, '', route.path);
        else window.history.pushState({}, '', route.path);
      }
    },
    [currentUser?.role]
  );

  // Initial purge of insecure legacy localStorage & session verification
  useEffect(() => {
    purgeLegacyLocalStorage();
    let mounted = true;
    (async () => {
      try {
        const verified = await cloudApi.verifyExistingSession();
        if (!mounted) return;
        if (verified?.user?.role) {
          setSession(verified);
          const urlTab = getTabFromPath(window.location.pathname);
          if (urlTab && canAccessTab(verified.user.role, urlTab)) {
            setActiveTab(urlTab);
          } else {
            const defTab = getDefaultTabForRole(verified.user.role);
            setActiveTab(defTab);
            if (urlTab) {
              setRouteNotice(`Redirected: ${verified.user.role} cannot access "${urlTab}".`);
            }
            window.history.replaceState({}, '', getRouteByTab(defTab).path);
          }
        }
      } finally {
        if (mounted) setBooting(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Browser Back/Forward URL enforcement
  useEffect(() => {
    if (!currentUser?.role) return undefined;
    const onPopState = () => {
      const urlTab = getTabFromPath(window.location.pathname);
      if (!urlTab) {
        navigateToTab(getDefaultTabForRole(currentUser.role), { replace: true });
      } else {
        navigateToTab(urlTab, { replace: true });
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentUser?.role, navigateToTab]);

  // Core data loader (with in-flight mutex so 5s refreshes never overlap)
  const loadOperationalData = useCallback(
    async ({ silent = false } = {}) => {
      if (!currentUser || mustChangePassword) return;
      if (syncInFlightRef.current && silent) return;
      syncInFlightRef.current = true;
      if (!silent) {
        setDataState((prev) => (prev === 'ready' ? 'ready' : 'loading'));
      }
      setErrorMessage('');
      try {
        const [mList, rList, dtList, codesList, toolList, rosterList] = await Promise.all([
          cloudApi.getMachines(),
          cloudApi.getProductionRecords({ date: selectedDate }),
          cloudApi.getMachineDowntime(),
          cloudApi.getDowntimeCodes(),
          cloudApi.getTools().catch(() => []),
          cloudApi.getOperationalRoster().catch(() => []),
        ]);
        setMachines(mList || []);
        setRecords(rList || []);
        setDowntimes(dtList || []);
        setDowntimeCodes(codesList || []);
        setTools(toolList || []);
        setEmployeesCount((rosterList || []).length);
        setDataState('ready');
        setLastSyncedAt(new Date().toISOString());
      } catch (err) {
        if (!silent) {
          setDataState('error');
          setErrorMessage(err?.message || 'Unable to synchronize shopfloor data from cloud backend.');
        }
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [currentUser, mustChangePassword, selectedDate]
  );

  // Load multi-day records when viewing Reports
  useEffect(() => {
    if (!currentUser || mustChangePassword || activeTab !== 'reports') return;
    let mounted = true;
    (async () => {
      try {
        const allRecs = await cloudApi.getProductionRecords({});
        if (mounted) setReportRecords(allRecs || []);
      } catch {
        // Keep date records
      }
    })();
    return () => {
      mounted = false;
    };
  }, [currentUser, mustChangePassword, activeTab]);

  useEffect(() => {
    loadOperationalData();
  }, [loadOperationalData]);

  // Cloud Realtime Subscription + Mandatory 5-Second Live Auto-Refresh
  useEffect(() => {
    if (!currentUser || mustChangePassword) return undefined;
    const unsubscribe = cloudApi.subscribeToChanges(() => {
      loadOperationalData({ silent: true });
    });

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadOperationalData({ silent: true });
    }, 5000);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        loadOperationalData({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [currentUser, mustChangePassword, loadOperationalData]);

  // Offline Queue Flush & Online Listeners
  const handleFlushPendingQueue = useCallback(async () => {
    const queue = getSyncQueue();
    if (queue.length === 0) {
      setPendingSyncCount(0);
      return;
    }
    const result = await flushSyncQueue((item) =>
      cloudApi.submitProductionEntry(item.payload, { fromQueue: true })
    );
    setPendingSyncCount(result.remaining);
    if (result.synced > 0) {
      loadOperationalData({ silent: true });
    }
  }, [loadOperationalData]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      handleFlushPendingQueue();
    };
    const onOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [handleFlushPendingQueue]);

  // Live Operational Notifications
  const notifications = useMemo(() => {
    const list = [];
    (downtimes || [])
      .filter((d) => d.status === 'Open')
      .forEach((d) => {
        const id = `dt-${d.id || d.machine_number}`;
        if (!dismissedNotifications.includes(id)) {
          list.push({
            id,
            type: 'warning',
            category: 'Downtime Alert',
            title: `${d.machine_number} Breakdown Open`,
            message: d.reason || d.breakdown_reason || 'Active breakdown reported',
            time: d.shift || '',
          });
        }
      });
    if (pendingSyncCount > 0 && !dismissedNotifications.includes('pending-sync')) {
      list.push({
        id: 'pending-sync',
        type: 'info',
        category: 'Offline Queue',
        title: `${pendingSyncCount} Unsynced Entry Waiting`,
        message: 'Queued hourly production records will automatically sync once cloud connection is online.',
        time: 'Queued',
      });
    }
    return list;
  }, [downtimes, pendingSyncCount, dismissedNotifications]);

  const handleAuthenticated = (nextSession) => {
    setSession(nextSession);
    const role = nextSession?.user?.role;
    const urlTab = getTabFromPath(window.location.pathname);
    const targetTab = urlTab && canAccessTab(role, urlTab) ? urlTab : getDefaultTabForRole(role);
    setActiveTab(targetTab);
    setRouteNotice('');
    window.history.replaceState({}, '', getRouteByTab(targetTab).path);
  };

  const handleSignOut = async () => {
    await cloudApi.signOut();
    setSession(null);
    setMachines([]);
    setTools([]);
    setRecords([]);
    setReportRecords(null);
    setRouteNotice('');
    window.history.replaceState({}, '', '/');
  };

  if (booting) {
    return (
      <>
        <MechanicalPressBackground />
        <div className="gateway-page app-foreground">
          <div className="gateway-card" style={{ maxWidth: 420, textAlign: 'center' }}>
            <div className="skeleton-line" style={{ height: 22, width: '60%', margin: '0 auto 12px' }} />
            <div className="skeleton-line" style={{ height: 14, width: '80%', margin: '0 auto' }} />
          </div>
        </div>
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <MechanicalPressBackground />
        <div className="app-foreground">
          <RoleGateway onAuthenticated={handleAuthenticated} />
        </div>
      </>
    );
  }

  if (mustChangePassword) {
    return (
      <>
        <MechanicalPressBackground />
        <div className="gateway-page app-foreground">
          <div className="gateway-card" style={{ maxWidth: 520 }}>
            <div className="banner is-warn" style={{ marginBottom: 16 }}>
              <span>
                Security policy: your account is using an initial temporary password and must be replaced before entering the workspace.
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{currentUser.full_name || currentUser.username}</strong> ({currentUser.role})
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </div>
          <PasswordModal
            isOpen={true}
            forced={true}
            onCompleted={() => {
              setSession((prev) =>
                prev ? { ...prev, user: { ...prev.user, must_change_password: false } } : prev
              );
            }}
          />
        </div>
      </>
    );
  }

  // Full-screen Read-Only Shopfloor Monitor for Dashboard role
  if (currentUser.role === ROLES.DASHBOARD) {
    return (
      <>
        <MechanicalPressBackground />
        <div className="app-foreground">
          <LiveCellStatusView
            kioskMode={true}
            selectedPlant={selectedPlant}
            selectedDate={selectedDate}
            selectedShift={selectedShift}
            machines={machines}
            records={records}
            downtimes={downtimes}
            dataState={dataState}
            lastSyncedAt={lastSyncedAt}
            isOnline={isOnline}
            onRefresh={() => loadOperationalData()}
            onExitKiosk={handleSignOut}
          />
        </div>
      </>
    );
  }

  const renderActiveView = () => {
    if (!canAccessTab(currentUser.role, activeTab)) {
      return (
        <div className="banner is-err">
          <span>Access restricted for current role ({currentUser.role}).</span>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            selectedPlant={selectedPlant}
            setSelectedPlant={setSelectedPlant}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedShift={selectedShift}
            setSelectedShift={setSelectedShift}
            machineGroup={machineGroup}
            setMachineGroup={setMachineGroup}
            machines={machines}
            records={records}
            downtimes={downtimes}
            employeesCount={employeesCount}
            dataState={dataState}
            errorMessage={errorMessage}
            lastSyncedAt={lastSyncedAt}
            isStale={Boolean(lastSyncedAt && !isOnline)}
            onRetry={() => loadOperationalData()}
            onNavigate={navigateToTab}
          />
        );
      case 'hourly-production':
        return (
          <HourlyEntryView
            selectedPlant={selectedPlant}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedShift={selectedShift}
            setSelectedShift={setSelectedShift}
            machines={machines}
            tools={tools}
            records={records}
            downtimeCodes={downtimeCodes}
            currentUser={currentUser}
            onEntrySaved={() => {
              setPendingSyncCount(getSyncQueue().length);
              loadOperationalData({ silent: true });
            }}
          />
        );
      case 'tandem-production':
        return (
          <TandemProductionView
            selectedPlant={selectedPlant}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedShift={selectedShift}
            setSelectedShift={setSelectedShift}
            machines={machines}
            tools={tools}
            records={records}
            downtimes={downtimes}
            downtimeCodes={downtimeCodes}
            currentUser={currentUser}
            onEntrySaved={() => {
              setPendingSyncCount(getSyncQueue().length);
              loadOperationalData({ silent: true });
            }}
          />
        );
      case 'tools':
        return (
          <ToolsView
            tools={tools}
            machines={machines}
            records={records}
            currentUser={currentUser}
            onReload={() => loadOperationalData({ silent: true })}
          />
        );
      case 'production-summary':
        return (
          <ProductionSummaryView
            selectedDate={selectedDate}
            selectedShift={selectedShift}
            machines={machines}
            tools={tools}
            records={records}
            downtimes={downtimes}
          />
        );
      case 'cell-status':
        return (
          <LiveCellStatusView
            kioskMode={false}
            selectedPlant={selectedPlant}
            selectedDate={selectedDate}
            selectedShift={selectedShift}
            machines={machines}
            records={records}
            downtimes={downtimes}
            dataState={dataState}
            lastSyncedAt={lastSyncedAt}
            isOnline={isOnline}
            onRefresh={() => loadOperationalData()}
          />
        );
      case 'production':
        return (
          <ProductionOverviewView
            selectedPlant={selectedPlant}
            setSelectedPlant={setSelectedPlant}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedShift={selectedShift}
            setSelectedShift={setSelectedShift}
            machines={machines}
            records={records}
            downtimes={downtimes}
            currentUser={currentUser}
            onNavigate={navigateToTab}
            onRefresh={() => loadOperationalData()}
          />
        );
      case 'employees':
        return <EmployeesView machines={machines} currentUser={currentUser} />;
      case 'attendance':
        return (
          <AttendanceView
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedShift={selectedShift}
            setSelectedShift={setSelectedShift}
            currentUser={currentUser}
          />
        );
      case 'machines':
        return (
          <MachinesView
            machines={machines}
            downtimes={downtimes}
            downtimeCodes={downtimeCodes}
            currentUser={currentUser}
            onReload={() => loadOperationalData({ silent: true })}
          />
        );
      case 'handovers':
        return (
          <HandoversView
            selectedDate={selectedDate}
            selectedShift={selectedShift}
            currentUser={currentUser}
          />
        );
      case 'reports':
        return (
          <ReportsView
            selectedPlant={selectedPlant}
            selectedDate={selectedDate}
            machines={machines}
            records={reportRecords || records}
            onRefresh={async () => {
              await loadOperationalData();
              try {
                const allRecs = await cloudApi.getProductionRecords({});
                setReportRecords(allRecs || []);
              } catch {
                // Keep existing date records
              }
            }}
          />
        );
      case 'users':
        return <UsersView currentUser={currentUser} />;
      case 'activity-logs':
        return <AuditLogView currentUser={currentUser} />;
      case 'settings':
        return (
          <SettingsView
            currentUser={currentUser}
            onOpenChangePassword={() => setPasswordModalOpen(true)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <MechanicalPressBackground />
      <div className="app-foreground">
        <AppShell
          activeTab={activeTab}
          onSelectTab={navigateToTab}
          currentUser={currentUser}
          selectedPlant={selectedPlant}
          selectedDate={selectedDate}
          selectedShift={selectedShift}
          isOnline={isOnline}
          pendingSyncCount={pendingSyncCount}
          onRetryPendingSync={handleFlushPendingQueue}
          notifications={notifications}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenChangePassword={() => setPasswordModalOpen(true)}
          onSignOut={handleSignOut}
        >
          {routeNotice && (
            <div className="banner is-warn" style={{ marginBottom: 14 }}>
              <span>{routeNotice}</span>
            </div>
          )}
          {renderActiveView()}
        </AppShell>

        <PasswordModal
          isOpen={passwordModalOpen}
          forced={false}
          onClose={() => setPasswordModalOpen(false)}
          onCompleted={() => {
            setSession((prev) =>
              prev ? { ...prev, user: { ...prev.user, must_change_password: false } } : prev
            );
          }}
        />

        <NotificationModal
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          notifications={notifications}
          onDismiss={(id) => setDismissedNotifications((prev) => [...prev, id])}
          onClearAll={() =>
            setDismissedNotifications((prev) => [...prev, ...notifications.map((n) => n.id)])
          }
        />
      </div>
    </>
  );
}
