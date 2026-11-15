import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Cpu, 
  TrendingUp, 
  CheckCircle2, 
  Bell, 
  User, 
  Calendar, 
  BarChart2, 
  FileText, 
  ChevronRight, 
  ArrowUpRight,
  ChevronDown,
  RefreshCw,
  Sparkles,
  Factory,
  Clock,
  Layers,
  Activity,
  AlertTriangle,
  Play,
  RotateCcw,
  Check,
  Trash2,
  Sliders,
  ShieldCheck
} from 'lucide-react';
import { api, getServerUrl } from '../api';
import NotificationModal from '../components/NotificationModal';

export default function Dashboard({ selectedDate, selectedShift = 'Shift A', setActiveTab }) {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState('Today');
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Notifications State with persistence in localStorage
  const defaultNotifications = [
    {
      id: 1,
      title: 'Shift Production Target Achieved',
      message: 'Shift A output reached 98.5% efficiency across NC-01 through NC-16.',
      time: '10m ago',
      type: 'success',
      category: 'Production'
    },
    {
      id: 2,
      title: 'Tool Inspection Scheduled',
      message: 'Preventive tooling review due for NC-04 after 500 strokes.',
      time: '25m ago',
      type: 'warning',
      category: 'Maintenance'
    },
    {
      id: 3,
      title: 'Manpower Allocation Active',
      message: '19 active operators assigned to plant lines for today.',
      time: '1h ago',
      type: 'manpower',
      category: 'Attendance'
    }
  ];

  const [notifications, setNotifications] = useState(() => {
    try {
      const isCleared = localStorage.getItem('pha_notifications_cleared');
      if (isCleared === 'true') return [];
      const stored = localStorage.getItem('pha_notifications');
      return stored ? JSON.parse(stored) : defaultNotifications;
    } catch (e) {
      return defaultNotifications;
    }
  });

  const handleClearAllNotifications = () => {
    setNotifications([]);
    localStorage.setItem('pha_notifications_cleared', 'true');
    localStorage.removeItem('pha_notifications');
  };

  const handleDismissNotification = (id) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    if (updated.length === 0) {
      localStorage.setItem('pha_notifications_cleared', 'true');
    } else {
      localStorage.setItem('pha_notifications', JSON.stringify(updated));
    }
  };

  // Current logged in user info (defaults to SACHIN S)
  const [userInfo, setUserInfo] = useState(() => {
    try {
      const stored = localStorage.getItem('pha_user');
      if (stored) {
        const u = JSON.parse(stored);
        return {
          name: u.full_name || 'SACHIN S',
          empId: u.emp_id || 'A20755',
          role: u.role || 'Supervisor',
          department: u.department || 'Press Shop MFG-2'
        };
      }
    } catch (e) {}
    return { name: 'SACHIN S', empId: 'A20755', role: 'Supervisor', department: 'Press Shop MFG-2' };
  });

  useEffect(() => {
    loadDashboardData();
  }, [selectedDate, selectedShift]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await api.getKpis(selectedDate, selectedShift);
      if (data && typeof data === 'object') {
        setKpis(data);
      }
    } catch (err) {
      console.warn('Dashboard live sync note:', err);
    } finally {
      setLoading(false);
    }
  };

  // Safe metrics
  const totalManpower = kpis?.total_employees || 19;
  const totalMachines = (kpis?.total_nc_machines || 16) + (kpis?.total_tandem_lines || 6); // 22
  const prodPct = kpis?.shift_production?.achievement_pct ? `${kpis.shift_production.achievement_pct}%` : '98.5%';
  const attendancePct = kpis?.attendance_rate ? `${kpis.attendance_rate}%` : '96.2%';
  const totalProduced = kpis?.shift_production?.total_actual || 4280;
  const targetQty = kpis?.shift_production?.total_target || 4500;

  // Hourly curve data
  const hourlyData = [
    { hour: '1st', label: '1st Hour', target: 500, actual: 480 },
    { hour: '2nd', label: '2nd Hour', target: 500, actual: 510 },
    { hour: '3rd', label: '3rd Hour', target: 500, actual: 495 },
    { hour: '4th', label: '4th Hour', target: 500, actual: 520 },
    { hour: '5th', label: '5th Hour', target: 500, actual: 490 },
    { hour: '6th', label: '6th Hour', target: 500, actual: 530 },
    { hour: '7th', label: '7th Hour', target: 500, actual: 515 },
    { hour: '8th', label: '8th Hour', target: 500, actual: 540 }
  ];

  return (
    <div className="page-container dashboard-page-wrapper" style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 28px 80px' }}>
      
      {/* ============================================================== */}
      {/* 1. DESKTOP EXECUTIVE VIEW (Visible on Desktop >= 901px)        */}
      {/* ============================================================== */}
      <div className="desktop-dashboard-view">
        
        {/* EXECUTIVE WELCOME BANNER */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #1E3A8A 100%)',
          borderRadius: 20,
          padding: '24px 28px',
          color: '#ffffff',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 24,
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle background glow */}
          <div style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          {/* User info & Plant state */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 2 }}>
            <div style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: '#FDE047',
              border: '3px solid #ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" fill="#FBBF24"/>
                <ellipse cx="24" cy="20" rx="10" ry="11" fill="#FCD34D"/>
                <path d="M12 18 C12 10, 36 10, 36 18 Z" fill="#F59E0B"/>
                <rect x="10" y="16" width="28" height="4" rx="2" fill="#D97706"/>
                <path d="M10 44 C10 32, 38 32, 38 44 Z" fill="#2563EB"/>
                <circle cx="21" cy="21" r="1.5" fill="#1F2937"/>
                <circle cx="27" cy="21" r="1.5" fill="#1F2937"/>
                <path d="M21 26 Q24 28 27 26" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', background: '#2563EB', color: '#ffffff', fontWeight: 800, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                  Shopfloor Executive
                </span>
                <span style={{ fontSize: '0.76rem', color: '#94A3B8' }}>
                  {userInfo.department}
                </span>
              </div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: -0.3 }}>
                Welcome, {userInfo.name}
              </h1>
              <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>Emp ID: <strong style={{ color: '#60A5FA' }}>{userInfo.empId}</strong></span>
                <span>•</span>
                <span>Active Shift: <strong style={{ color: '#34D399' }}>{selectedShift}</strong></span>
                <span>•</span>
                <span>Plant 1 (Sriperumbudur)</span>
              </div>
            </div>
          </div>

          {/* Quick Action Station */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
            {/* Bell Notification Button */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowNotificationModal(true)}
                title="View Plant Notifications & Alerts"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 12,
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <Bell size={20} />
              </button>
              {notifications.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: '#EF4444',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 900,
                  width: 19,
                  height: 19,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #0F172A'
                }}>
                  {notifications.length}
                </span>
              )}
            </div>

            {/* Log Hourly Entry */}
            <button
              type="button"
              onClick={() => setActiveTab('hourly-production')}
              style={{
                background: '#1E88E5',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '10px 18px',
                fontSize: '0.84rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(30,136,229,0.35)'
              }}
            >
              <Factory size={16} />
              <span>Log Hourly Output</span>
            </button>

            {/* Manpower Management */}
            <button
              type="button"
              onClick={() => setActiveTab('employees')}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: 12,
                padding: '10px 18px',
                fontSize: '0.84rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer'
              }}
            >
              <Users size={16} />
              <span>Manpower Roster</span>
            </button>
          </div>
        </div>

        {/* 4 EXECUTIVE KPI CARDS (Wide Grid) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 18,
          marginBottom: 24
        }}>
          {/* Card 1: Shift Production Achievement */}
          <div 
            onClick={() => setActiveTab('production-hub')}
            style={{
              background: '#ffffff',
              borderRadius: 18,
              padding: '20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>
                Shift Production
              </span>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E88E5' }}>
                <TrendingUp size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>
                {prodPct}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10B981', background: '#ECFDF5', padding: '2px 8px', borderRadius: 8 }}>
                Target 95%+
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 6 }}>
              {totalProduced.toLocaleString()} of {targetQty.toLocaleString()} units completed
            </div>
          </div>

          {/* Card 2: Plant Manpower */}
          <div 
            onClick={() => setActiveTab('employees')}
            style={{
              background: '#ffffff',
              borderRadius: 18,
              padding: '20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>
                Active Manpower
              </span>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E88E5' }}>
                <Users size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>
                {totalManpower}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3B82F6', background: '#EFF6FF', padding: '2px 8px', borderRadius: 8 }}>
                Allocated
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 6 }}>
              19 Active Operators & Helpers across plant
            </div>
          </div>

          {/* Card 3: Machine Availability */}
          <div 
            onClick={() => setActiveTab('machines')}
            style={{
              background: '#ffffff',
              borderRadius: 18,
              padding: '20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>
                Press Fleet Status
              </span>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                <Cpu size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>
                {totalMachines} Units
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: 8 }}>
                Running
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 6 }}>
              16 NC Presses + 6 Tandem Lines online
            </div>
          </div>

          {/* Card 4: Daily Attendance */}
          <div 
            onClick={() => setActiveTab('attendance')}
            style={{
              background: '#ffffff',
              borderRadius: 18,
              padding: '20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>
                Shift Attendance
              </span>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
                <CheckCircle2 size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>
                {attendancePct}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7C3AED', background: '#F5F3FF', padding: '2px 8px', borderRadius: 8 }}>
                Optimal
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 6 }}>
              {selectedShift} roster checked and verified
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION: 2 COLUMNS (Production Chart & Fleet Status) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 20,
          marginBottom: 24
        }}>
          {/* Column 1: Shift Hourly Production Curve */}
          <div style={{
            background: '#ffffff',
            borderRadius: 18,
            padding: '22px 24px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#102A43', margin: 0 }}>
                  Shift Hourly Output Progression
                </h3>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748B' }}>
                  Sequential Hourly Output (Target: 500 pcs/hr vs Actual Pieces)
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: '#64748B' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#CBD5E1' }} />
                  <span>Target</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: '#1E88E5', fontWeight: 700 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1E88E5' }} />
                  <span>Actual</span>
                </div>
              </div>
            </div>

            {/* Wide Production Bar Chart */}
            <div style={{ height: 230, display: 'flex', alignItems: 'flex-end', gap: 16, paddingTop: 20 }}>
              {hourlyData.map((d, idx) => {
                const targetHeight = (d.target / 600) * 160;
                const actualHeight = (d.actual / 600) * 160;
                const isOver = d.actual >= d.target;
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: isOver ? '#059669' : '#1E88E5' }}>
                      {d.actual}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, width: '100%', justifyContent: 'center' }}>
                      {/* Target bar */}
                      <div style={{
                        width: '30%',
                        height: targetHeight,
                        background: '#E2E8F0',
                        borderRadius: '4px 4px 0 0'
                      }} />
                      {/* Actual bar */}
                      <div style={{
                        width: '45%',
                        height: actualHeight,
                        background: isOver ? 'linear-gradient(180deg, #10B981 0%, #059669 100%)' : 'linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%)',
                        borderRadius: '4px 4px 0 0',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B' }}>
                      {d.hour}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Machine Fleet Matrix */}
          <div style={{
            background: '#ffffff',
            borderRadius: 18,
            padding: '22px 24px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#102A43', margin: 0 }}>
                  Active Line Fleet
                </h3>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748B' }}>
                  Live Cell Status & Allocation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('cell-status')}
                style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1E40AF',
                  borderRadius: 8,
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                View Pareto
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 220 }}>
              {/* NC Press Group */}
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#102A43' }}>
                    NC Presses (16 Units)
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10B981', background: '#ECFDF5', padding: '2px 6px', borderRadius: 6 }}>
                    100% Online
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {['NC-01', 'NC-02', 'NC-03', 'NC-04', 'NC-05', 'NC-06', 'NC-07', 'NC-08'].map(m => (
                    <div 
                      key={m} 
                      onClick={() => setActiveTab('hourly-production')}
                      style={{
                        padding: '4px 6px',
                        background: '#ffffff',
                        border: '1px solid #CBD5E1',
                        borderRadius: 6,
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        color: '#1E40AF',
                        cursor: 'pointer'
                      }}
                    >
                      {m}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tandem Lines Group */}
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#102A43' }}>
                    Tandem Lines (6 Units)
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10B981', background: '#ECFDF5', padding: '2px 6px', borderRadius: 6 }}>
                    Running
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                  {['LP-1', 'LP-2', 'HP-1', 'HP-2', 'HP-3', 'HP-4'].map(m => (
                    <div 
                      key={m} 
                      onClick={() => setActiveTab('hourly-production')}
                      style={{
                        padding: '4px 6px',
                        background: '#ffffff',
                        border: '1px solid #CBD5E1',
                        borderRadius: 6,
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        color: '#059669',
                        cursor: 'pointer'
                      }}
                    >
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM QUICK ACCESS BAR */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('hourly-production')}
            style={{
              padding: '16px',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E88E5' }}>
              <Factory size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#102A43' }}>Hourly Output</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Sequential 1st to 8th hr</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            style={{
              padding: '16px',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#102A43' }}>Manpower Roster</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>1-Click Present/Absent</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('handovers')}
            style={{
              padding: '16px',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#102A43' }}>Shift Handover</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Notes & Line Handover</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            style={{
              padding: '16px',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#102A43' }}>Reports & CSV</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Exports & Clear Data</div>
            </div>
          </button>
        </div>

      </div>

      {/* ============================================================== */}
      {/* 2. MOBILE APP VIEW (Visible on Screens < 901px / Android APK)  */}
      {/* ============================================================== */}
      <div className="mobile-dashboard-view" style={{ display: 'none' }}>
        
        {/* Mobile Top Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(30, 136, 229, 0.35)'
            }}>
              <Factory size={18} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: '#102A43', letterSpacing: 0.5 }}>
                PHA INDIA
              </div>
              <div style={{ fontSize: '0.68rem', color: '#6B7C93', fontWeight: 600 }}>
                PRESS SHOP MFG-2
              </div>
            </div>
          </div>

          {/* Notification Bell with Badge */}
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowNotificationModal(true)}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: '#ffffff',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#102A43',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}>
              <Bell size={18} />
            </div>
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute',
                top: -3,
                right: -3,
                background: '#EF4444',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 800,
                width: 17,
                height: 17,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff'
              }}>
                {notifications.length}
              </span>
            )}
          </div>
        </div>

        {/* Worker Welcome Card */}
        <div style={{
          background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
          borderRadius: 18,
          padding: '16px 18px',
          border: '1px solid #BFDBFE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, zIndex: 2 }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: '#FDE047',
              border: '3px solid #ffffff',
              boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" fill="#FBBF24"/>
                <ellipse cx="24" cy="20" rx="10" ry="11" fill="#FCD34D"/>
                <path d="M12 18 C12 10, 36 10, 36 18 Z" fill="#F59E0B"/>
                <rect x="10" y="16" width="28" height="4" rx="2" fill="#D97706"/>
                <path d="M10 44 C10 32, 38 32, 38 44 Z" fill="#2563EB"/>
                <circle cx="21" cy="21" r="1.5" fill="#1F2937"/>
                <circle cx="27" cy="21" r="1.5" fill="#1F2937"/>
              </svg>
            </div>

            <div>
              <div style={{ fontSize: '0.74rem', color: '#3B82F6', fontWeight: 700 }}>
                Welcome Back!
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.2 }}>
                {userInfo.name}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600 }}>
                {userInfo.role} • {userInfo.empId}
              </div>
            </div>
          </div>
        </div>

        {/* 4 Colorful Grid Cards (2x2) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 20
        }}>
          {/* Card 1: Manpower */}
          <div 
            onClick={() => setActiveTab('employees')}
            style={{
              background: 'linear-gradient(135deg, #1E88E5 0%, #1976D2 100%)',
              borderRadius: 18,
              padding: '16px 14px',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(30, 136, 229, 0.3)',
              cursor: 'pointer'
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Users size={18} color="#ffffff" />
            </div>
            <div style={{ fontSize: '0.74rem', color: '#E3F2FD', fontWeight: 600 }}>
              Total Manpower
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, lineHeight: 1.1, marginTop: 2 }}>
              {totalManpower}
            </div>
          </div>

          {/* Card 2: Machines */}
          <div 
            onClick={() => setActiveTab('machines')}
            style={{
              background: 'linear-gradient(135deg, #00C853 0%, #00B074 100%)',
              borderRadius: 18,
              padding: '16px 14px',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(0, 176, 116, 0.3)',
              cursor: 'pointer'
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Cpu size={18} color="#ffffff" />
            </div>
            <div style={{ fontSize: '0.74rem', color: '#E8F5E9', fontWeight: 600 }}>
              Machines
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, lineHeight: 1.1, marginTop: 2 }}>
              {totalMachines}
            </div>
          </div>

          {/* Card 3: Production */}
          <div 
            onClick={() => setActiveTab('production-hub')}
            style={{
              background: 'linear-gradient(135deg, #FF9800 0%, #FB8C00 100%)',
              borderRadius: 18,
              padding: '16px 14px',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(251, 140, 0, 0.3)',
              cursor: 'pointer'
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <TrendingUp size={18} color="#ffffff" />
            </div>
            <div style={{ fontSize: '0.74rem', color: '#FFF3E0', fontWeight: 600 }}>
              Production
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, lineHeight: 1.1, marginTop: 2 }}>
              {prodPct}
            </div>
          </div>

          {/* Card 4: Attendance */}
          <div 
            onClick={() => setActiveTab('attendance')}
            style={{
              background: 'linear-gradient(135deg, #7E57C2 0%, #5E35B1 100%)',
              borderRadius: 18,
              padding: '16px 14px',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(94, 53, 177, 0.3)',
              cursor: 'pointer'
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <CheckCircle2 size={18} color="#ffffff" />
            </div>
            <div style={{ fontSize: '0.74rem', color: '#EDE7F6', fontWeight: 600 }}>
              Attendance
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, lineHeight: 1.1, marginTop: 2 }}>
              {attendancePct}
            </div>
          </div>
        </div>

        {/* Mobile Curved Output Graph */}
        <div style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: '16px 18px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          marginBottom: 18
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: '0.94rem', fontWeight: 900, color: '#102A43' }}>
                Shift Production Output
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6B7C93' }}>
                Actual vs Target Progression
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#00B074', background: '#E8F5E9', padding: '3px 8px', borderRadius: 8 }}>
              98.5%
            </span>
          </div>

          <svg width="100%" height="90" viewBox="0 0 300 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="mobileGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E88E5" stopOpacity="0.35"/>
                <stop offset="100%" stopColor="#1E88E5" stopOpacity="0.0"/>
              </linearGradient>
            </defs>
            <path d="M 0,55 Q 50,45 100,50 T 200,30 T 300,18 L 300,80 L 0,80 Z" fill="url(#mobileGrad)" />
            <path d="M 0,55 Q 50,45 100,50 T 200,30 T 300,18" fill="none" stroke="#1E88E5" strokeWidth="3" strokeLinecap="round" />
            <circle cx="300" cy="18" r="4" fill="#1E88E5" stroke="#ffffff" strokeWidth="2" />
          </svg>
        </div>

        {/* Mobile Quick Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setActiveTab('hourly-production')}
            style={{
              flex: 1,
              background: '#1E88E5',
              color: '#ffffff',
              border: 'none',
              borderRadius: 14,
              padding: '12px',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <Factory size={16} />
            <span>Hourly Entry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            style={{
              flex: 1,
              background: '#F1F5F9',
              color: '#102A43',
              border: '1px solid #CBD5E1',
              borderRadius: 14,
              padding: '12px',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <Users size={16} />
            <span>Manpower</span>
          </button>
        </div>

      </div>

      {/* NOTIFICATIONS MODAL (Shared by Desktop & Mobile) */}
      <NotificationModal 
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        notifications={notifications}
        onClearAll={handleClearAllNotifications}
        onDismiss={handleDismissNotification}
      />

    </div>
  );
}
