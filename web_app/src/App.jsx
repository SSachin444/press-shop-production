import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginScreen from './components/LoginScreen';
import WiFiServerModal from './components/WiFiServerModal';
import NotificationModal from './components/NotificationModal';
import MobileNavBar from './components/MobileNavBar';

// Pages
import CellStatusPage from './pages/CellStatusPage';
import PlanDetailsPage from './pages/PlanDetailsPage';
import Dashboard from './pages/Dashboard';
import ProductionHubPage from './pages/ProductionHubPage';
import EmployeeManagement from './pages/EmployeeManagement';
import AttendanceManagement from './pages/AttendanceManagement';
import MachineManagement from './pages/MachineManagement';
import NCProductionPage from './pages/NCProductionPage';
import TandemProductionPage from './pages/TandemProductionPage';
import HourlyProductionPage from './pages/HourlyProductionPage';
import ThreeShiftManagement from './pages/ThreeShiftManagement';
import ShiftHandoverPage from './pages/ShiftHandoverPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

// New Production Pages (Phase 2 Upgrade)
import ProductionWorkspacePage from './pages/ProductionWorkspacePage';
import ProductionDashboardPage from './pages/ProductionDashboardPage';
import ProductionAnalyticsPage from './pages/ProductionAnalyticsPage';
import ActivityLogPage from './pages/ActivityLogPage';

import { api, getServerUrl } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // Default to the Home screen matching image
  const [selectedMachineForHourly, setSelectedMachineForHourly] = useState({ machine: 'NC-01', type: 'NC' });
  const [sidebarOpen, setSidebarOpen] = useState(false); // Left Sidebar Drawer state

  // Plant Date and Shift State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedShift, setSelectedShift] = useState('Shift A');
  const [currentShift, setCurrentShift] = useState('Shift A');
  const [syncKey, setSyncKey] = useState(0);
  const [loading, setLoading] = useState(false);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('pha_logged_in') === 'true';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('pha_user');
      return stored ? JSON.parse(stored) : { username: 'supervisor', full_name: 'Shift Supervisor', role: 'Supervisor', department: 'Press Shop MFG-2' };
    } catch (e) {
      return { username: 'supervisor', full_name: 'Shift Supervisor', role: 'Supervisor', department: 'Press Shop MFG-2' };
    }
  });

  const [showWifiModal, setShowWifiModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadInitialState();
  }, [syncKey]);

  useEffect(() => {
    loadNotifications();
  }, [selectedDate, selectedShift, syncKey]);

  const loadNotifications = async () => {
    try {
      const res = await api.getNotifications(selectedDate, selectedShift);
      if (res && res.notifications) {
        setNotifications(res.notifications);
      }
    } catch (e) {
      console.warn('Notification sync notice:', e);
    }
  };

  const loadInitialState = async () => {
    try {
      setLoading(true);
      const state = await api.getState();
      if (state.current_shift) {
        setCurrentShift(state.current_shift);
        if (syncKey === 0) setSelectedShift(state.current_shift);
      }
    } catch (err) {
      console.warn('Initial state sync notice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setSyncKey((prev) => prev + 1);
  };

  const handleLogout = () => {
    localStorage.removeItem('pha_token');
    localStorage.removeItem('pha_logged_in');
    setIsLoggedIn(false);
  };

  const handleSwitchRole = () => {
    setIsLoggedIn(false);
  };

  const handleLogHourlyForMachine = (machineNumber, machineType) => {
    setSelectedMachineForHourly({ machine: machineNumber, type: machineType });
    setActiveTab('hourly-production');
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'cell-status': return 'Live Cell Status & Output %';
      case 'production-hub': return 'Production Hub & Hourly Output';
      case 'plans': return 'Machine Tool Plans (Max 5 Plans)';
      case 'dashboard': return 'Plant Executive Dashboard';
      case 'employees': return 'Employee Directory';
      case 'attendance': return 'Daily Shift Attendance';
      case 'machines': return 'Machine Directory';
      case 'nc-production': return 'NC Press Production (16 Units)';
      case 'tandem-production': return 'Tandem Production (6 Lines)';
      case 'hourly-production': return 'Hourly Production Entry';
      case 'three-shifts': return 'Three-Shift Performance';
      case 'handovers': return 'Shift Handover Log';
      case 'reports': return 'Reports & CSV Exports';
      case 'settings': return 'System Settings';
      // New Production Pages
      case 'standard-production': return 'Production Workspace (Standard + Hourly)';
      case 'production-dashboard': return 'Production Intelligence Dashboard';
      case 'analytics': return 'Plant Production Analytics & Trends';
      case 'activity-logs': return 'System Audit Activity Log';
      default: return 'PRESS SHOP MFG-2';
    }
  };

  // If not logged in, show the full-screen passwordless role selector login page
  if (!isLoggedIn) {
    return (
      <>
        <LoginScreen 
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setIsLoggedIn(true);
          }}
          onOpenWifiSettings={() => setShowWifiModal(true)}
        />
        <WiFiServerModal 
          isOpen={showWifiModal}
          onClose={() => setShowWifiModal(false)}
        />
      </>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation (Accessible from the Left Side) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={handleSwitchRole}
        onOpenWifiModal={() => setShowWifiModal(true)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header 
          pageTitle={getPageTitle()}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedShift={selectedShift}
          setSelectedShift={setSelectedShift}
          currentShift={currentShift}
          onRefresh={handleRefresh}
          loading={loading}
          currentUser={currentUser}
          onOpenLogin={handleSwitchRole}
          onOpenWifiModal={() => setShowWifiModal(true)}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          notificationCount={notifications.length}
          onOpenNotifications={() => setShowNotificationModal(true)}
        />

        <main className="content-area" style={{ 
          flex: 1, 
          paddingBottom: activeTab === 'standard-production' ? 0 : 72,
          display: 'flex',
          flexDirection: 'column',
          overflow: activeTab === 'standard-production' ? 'hidden' : 'auto'
        }}>
          {/* 0. Production Hub (Hourly output, cell status %, NC, Tandem, plans) */}
          {activeTab === 'production-hub' && (
            <ProductionHubPage 
              key={`prod-hub-${syncKey}-${selectedMachineForHourly.machine}`}
              selectedDate={selectedDate} 
              selectedShift={selectedShift}
              initialSubTab="hourly"
              selectedMachineForHourly={selectedMachineForHourly}
              onLogHourlyForMachine={handleLogHourlyForMachine}
            />
          )}

          {/* 1. Live Cell Status Page (Matching uploaded photo) */}
          {activeTab === 'cell-status' && (
            <CellStatusPage 
              key={`cell-${syncKey}`}
              selectedDate={selectedDate} 
              selectedShift={selectedShift}
              onLogHourlyForMachine={handleLogHourlyForMachine}
            />
          )}

          {/* 2. Plan Details Page (Max 5 plans per machine by tool number) */}
          {activeTab === 'plans' && (
            <PlanDetailsPage 
              key={`plan-${syncKey}`}
              selectedDate={selectedDate} 
              selectedShift={selectedShift}
            />
          )}

          {/* 3. Plant Dashboard */}
          {activeTab === 'dashboard' && (
            <Dashboard 
              key={`dash-${syncKey}`}
              selectedDate={selectedDate} 
              selectedShift={selectedShift} 
              setActiveTab={setActiveTab} 
            />
          )}

          {/* 4. Hourly Production Page (Single fixed output, editable targets/actuals) */}
          {activeTab === 'hourly-production' && (
            <HourlyProductionPage 
              key={`hour-${syncKey}-${selectedMachineForHourly.machine}`}
              selectedDate={selectedDate} 
              selectedShift={selectedShift}
              initialMachine={selectedMachineForHourly.machine}
              initialType={selectedMachineForHourly.type}
            />
          )}

          {/* 5. NC Press Production */}
          {activeTab === 'nc-production' && (
            <NCProductionPage 
              key={`nc-${syncKey}`}
              selectedDate={selectedDate} 
              selectedShift={selectedShift}
              setActiveTab={setActiveTab} 
            />
          )}

          {/* 6. Tandem Production */}
          {activeTab === 'tandem-production' && (
            <TandemProductionPage 
              key={`tan-${syncKey}`}
              selectedDate={selectedDate} 
              selectedShift={selectedShift}
              setActiveTab={setActiveTab} 
            />
          )}

          {/* 7. Three-Shift Comparison */}
          {activeTab === 'three-shifts' && (
            <ThreeShiftManagement 
              key={`shift-${syncKey}`}
              selectedDate={selectedDate}
            />
          )}

          {/* 8. Daily Attendance */}
          {activeTab === 'attendance' && (
            <AttendanceManagement 
              key={`att-${syncKey}`}
              selectedDate={selectedDate} 
              selectedShift={selectedShift} 
            />
          )}

          {/* 9. Employee Management */}
          {activeTab === 'employees' && (
            <EmployeeManagement key={`emp-${syncKey}`} />
          )}

          {/* 10. Machine Directory */}
          {activeTab === 'machines' && (
            <MachineManagement key={`mach-${syncKey}`} />
          )}

          {/* 11. Shift Handover Log */}
          {activeTab === 'handovers' && (
            <ShiftHandoverPage 
              key={`han-${syncKey}`}
              selectedDate={selectedDate} 
              selectedShift={selectedShift}
              currentUser={currentUser}
            />
          )}

          {/* 12. Reports & Exports */}
          {activeTab === 'reports' && (
            <ReportsPage 
              key={`rep-${syncKey}`}
              selectedDate={selectedDate} 
              selectedShift={selectedShift}
            />
          )}

          {/* 13. System Settings */}
          {activeTab === 'settings' && (
            <SettingsPage 
              key={`set-${syncKey}`}
              currentUser={currentUser}
            />
          )}

          {/* 14. NEW: Production Workspace (Page 1 Standard + Page 2 Hourly side-by-side) */}
          {activeTab === 'standard-production' && (
            <ProductionWorkspacePage
              key={`pws-${syncKey}`}
              selectedDate={selectedDate}
              selectedShift={selectedShift}
              onSync={handleRefresh}
              initialMachine={selectedMachineForHourly.machine}
            />
          )}

          {/* 15. NEW: Production Dashboard (Page 3) */}
          {activeTab === 'production-dashboard' && (
            <ProductionDashboardPage
              key={`pdash-${syncKey}`}
              selectedDate={selectedDate}
              selectedShift={selectedShift}
              setActiveTab={setActiveTab}
            />
          )}

          {/* 16. Plant Analytics & Trends */}
          {activeTab === 'analytics' && (
            <ProductionAnalyticsPage
              key={`analytics-${syncKey}`}
              selectedDate={selectedDate}
              selectedShift={selectedShift}
            />
          )}

          {/* 17. System Activity Logs */}
          {activeTab === 'activity-logs' && (
            <ActivityLogPage
              key={`actlog-${syncKey}`}
            />
          )}
        </main>
      </div>

      {/* NATIVE MOBILE BOTTOM NAVIGATION BAR */}
      <MobileNavBar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={handleSwitchRole}
        onOpenWifiModal={() => setShowWifiModal(true)}
        onOpenLeftSidebar={() => setSidebarOpen(true)}
      />

      {/* WiFi Backend Server Connection Modal */}
      <WiFiServerModal 
        isOpen={showWifiModal} 
        onClose={() => setShowWifiModal(false)}
        onServerChanged={() => setSyncKey(k => k + 1)}
      />

      {/* Plant Notifications & Alerts Modal */}
      <NotificationModal 
        isOpen={showNotificationModal} 
        onClose={() => setShowNotificationModal(false)}
        notifications={notifications}
        onClearAll={() => setNotifications([])}
        onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
      />
    </div>
  );
}
