import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Cpu, 
  TrendingUp, 
  TrendingDown,
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
  Factory, 
  Clock, 
  Layers, 
  GitBranch,
  Activity, 
  AlertTriangle, 
  Target,
  Sparkles,
  ShieldCheck,
  Check,
  X,
  Gauge,
  ArrowRight
} from 'lucide-react';
import { api } from '../api';
import NotificationModal from '../components/NotificationModal';

export default function Dashboard({ selectedDate, selectedShift = 'Shift A', setActiveTab }) {
  const [kpis, setKpis] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState('hourly'); // 'hourly' | 'shift' | 'nc-tandem' | 'machines' | 'weekly' | 'monthly'

  const activeDate = selectedDate || new Date().toISOString().split('T')[0];

  // User info from local storage or defaults
  const [userInfo, setUserInfo] = useState(() => {
    try {
      const stored = localStorage.getItem('pha_user');
      if (stored) {
        const u = JSON.parse(stored);
        return {
          name: u.full_name || 'Shift Supervisor',
          role: u.role || 'Supervisor',
          department: u.department || 'Press Shop MFG-2'
        };
      }
    } catch (e) {}
    return { name: 'Shift Supervisor', role: 'Supervisor', department: 'Press Shop MFG-2' };
  });

  useEffect(() => {
    loadAllDashboardData();
  }, [activeDate, selectedShift]);

  const loadAllDashboardData = async () => {
    try {
      setLoading(true);
      const [kRes, nRes] = await Promise.all([
        api.getKpis(activeDate, selectedShift),
        api.getNotifications().catch(() => ({ notifications: [] }))
      ]);
      setKpis(kRes);
      setNotifications(nRes.notifications || []);
    } catch (err) {
      console.warn('Dashboard live sync note:', err);
    } finally {
      setLoading(false);
    }
  };

  // Safe data extractions from SQLite response
  const kpiCards = kpis?.kpi_cards || {};
  const sp = kpis?.shift_production || {};
  const dp = kpis?.day_production || {};
  const nc = kpis?.nc_summary || {};
  const tan = kpis?.tandem_summary || {};
  const shiftBreakdown = kpis?.shift_breakdown || {};
  const hourlyBreakdown = kpis?.hourly_breakdown || [];
  const weeklyTrend = kpis?.weekly_trend || [];
  const monthlyTrend = kpis?.monthly_trend || [];
  const machinePerf = kpis?.machine_performance || [];
  const bestMach = kpis?.best_machine;
  const lowestMach = kpis?.lowest_machine;
  const recentProd = kpis?.recent_production || [];

  // 12 Mandatory KPI values directly from real database
  const kpiList = [
    {
      id: 1,
      title: "Today's Total Production",
      value: (kpiCards.today_total_production ?? dp.actual ?? 0).toLocaleString(),
      subtext: `${(dp.good ?? 0).toLocaleString()} good parts produced today`,
      icon: Factory,
      color: '#1e40af',
      bg: '#eff6ff',
      border: '#bfdbfe',
      targetTab: 'standard-production'
    },
    {
      id: 2,
      title: "NC Production",
      value: (kpiCards.nc_production ?? nc.actual ?? 0).toLocaleString(),
      subtext: `Target: ${(nc.target ?? 0).toLocaleString()} (${nc.achievement_pct ?? 0}%)`,
      icon: Layers,
      color: '#0369a1',
      bg: '#f0f9ff',
      border: '#bae6fd',
      targetTab: 'nc-production'
    },
    {
      id: 3,
      title: "Tandem Production",
      value: (kpiCards.tandem_production ?? tan.actual ?? 0).toLocaleString(),
      subtext: `Target: ${(tan.target ?? 0).toLocaleString()} (${tan.achievement_pct ?? 0}%)`,
      icon: GitBranch,
      color: '#7c3aed',
      bg: '#f5f3ff',
      border: '#ddd6fe',
      targetTab: 'tandem-production'
    },
    {
      id: 4,
      title: "Total Production Target",
      value: (kpiCards.total_production_target ?? sp.target ?? 0).toLocaleString(),
      subtext: `Shift goal across active lines`,
      icon: Target,
      color: '#0f766e',
      bg: '#f0fdfa',
      border: '#99f6e4',
      targetTab: 'standard-production'
    },
    {
      id: 5,
      title: "Actual Production",
      value: (kpiCards.actual_production ?? sp.actual ?? 0).toLocaleString(),
      subtext: `Variance: ${((sp.actual ?? 0) - (sp.target ?? 0)).toLocaleString()} units`,
      icon: TrendingUp,
      color: '#2563eb',
      bg: '#eff6ff',
      border: '#bfdbfe',
      targetTab: 'hourly-production'
    },
    {
      id: 6,
      title: "Achievement Rate",
      value: `${kpiCards.achievement_pct ?? sp.achievement_pct ?? 0}%`,
      subtext: (kpiCards.achievement_pct ?? sp.achievement_pct ?? 0) >= 95 ? 'Target Exceeded' : 'Below Target Rate',
      icon: Gauge,
      color: (kpiCards.achievement_pct ?? sp.achievement_pct ?? 0) >= 95 ? '#059669' : '#d97706',
      bg: (kpiCards.achievement_pct ?? sp.achievement_pct ?? 0) >= 95 ? '#ecfdf5' : '#fffbeb',
      border: (kpiCards.achievement_pct ?? sp.achievement_pct ?? 0) >= 95 ? '#a7f3d0' : '#fde68a',
      targetTab: 'production-dashboard'
    },
    {
      id: 7,
      title: "Total Manpower",
      value: (kpiCards.total_manpower ?? kpis?.total_employees ?? 0).toLocaleString(),
      subtext: 'Registered plant employees',
      icon: Users,
      color: '#334155',
      bg: '#f8fafc',
      border: '#e2e8f0',
      targetTab: 'employees'
    },
    {
      id: 8,
      title: "Present Employees",
      value: (kpiCards.present_employees ?? kpis?.employees_present ?? 0).toLocaleString(),
      subtext: `On duty for ${selectedShift}`,
      icon: CheckCircle2,
      color: '#15803d',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      targetTab: 'attendance'
    },
    {
      id: 9,
      title: "Absent Employees",
      value: (kpiCards.absent_employees ?? kpis?.employees_absent ?? 0).toLocaleString(),
      subtext: `${kpis?.employees_on_leave ?? 0} on authorized leave`,
      icon: AlertTriangle,
      color: (kpiCards.absent_employees ?? 0) > 0 ? '#b91c1c' : '#64748b',
      bg: (kpiCards.absent_employees ?? 0) > 0 ? '#fef2f2' : '#f8fafc',
      border: (kpiCards.absent_employees ?? 0) > 0 ? '#fecaca' : '#e2e8f0',
      targetTab: 'attendance'
    },
    {
      id: 10,
      title: "Running Machines",
      value: `${kpiCards.running_machines ?? ((kpis?.active_nc_machines ?? 0) + (kpis?.active_tandem_lines ?? 0))}`,
      subtext: `Active out of 22 machines`,
      icon: Cpu,
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      targetTab: 'machines'
    },
    {
      id: 11,
      title: "Stopped Machines",
      value: `${kpiCards.stopped_machines ?? 0}`,
      subtext: 'Idle or under maintenance',
      icon: AlertTriangle,
      color: (kpiCards.stopped_machines ?? 0) > 0 ? '#ea580c' : '#64748b',
      bg: (kpiCards.stopped_machines ?? 0) > 0 ? '#fff7ed' : '#f8fafc',
      border: (kpiCards.stopped_machines ?? 0) > 0 ? '#fed7aa' : '#e2e8f0',
      targetTab: 'machines'
    },
    {
      id: 12,
      title: "Total Downtime",
      value: `${kpiCards.total_downtime ?? sp.downtime_minutes ?? 0}m`,
      subtext: 'Cumulative lost minutes',
      icon: Clock,
      color: (kpiCards.total_downtime ?? 0) > 30 ? '#dc2626' : '#64748b',
      bg: (kpiCards.total_downtime ?? 0) > 30 ? '#fef2f2' : '#f8fafc',
      border: (kpiCards.total_downtime ?? 0) > 30 ? '#fecaca' : '#e2e8f0',
      targetTab: 'machines'
    }
  ];

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '20px 24px 80px', background: '#f8fafc' }}>
      
      {/* ── TOP EXECUTIVE BANNER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #1e3a8a 100%)',
        borderRadius: 16,
        padding: '22px 28px',
        color: '#ffffff',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        marginBottom: 22,
        boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
            color: '#fff',
            fontWeight: 900,
            fontSize: '1.2rem'
          }}>
            PHA
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: '0.72rem', background: '#2563eb', color: '#fff', fontWeight: 800, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                {userInfo.role}
              </span>
              <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                PHA INDIA PRIVATE LIMITED • PRESS SHOP MFG-2
              </span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, letterSpacing: -0.3 }}>
              Manufacturing Command Center
            </h1>
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>Operator: <strong style={{ color: '#93c5fd' }}>{userInfo.name}</strong></span>
              <span>•</span>
              <span>Active Date: <strong style={{ color: '#6ee7b7' }}>{activeDate}</strong></span>
              <span>•</span>
              <span>Shift: <strong style={{ color: '#fde047' }}>{selectedShift}</strong></span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Notifications Button */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowNotificationModal(true)}
              title="Factory Notifications"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 10,
                width: 42,
                height: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <Bell size={18} />
            </button>
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.66rem',
                fontWeight: 900,
                width: 18,
                height: 18,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #0f172a'
              }}>
                {notifications.length}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('standard-production')}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37,99,235,0.35)'
            }}
          >
            <Factory size={16} />
            <span>Production Entry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hourly-production')}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            <Clock size={16} />
            <span>Hourly Log</span>
          </button>

          <button
            type="button"
            onClick={loadAllDashboardData}
            title="Refresh Live Data"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 10,
              width: 42,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── 12 MANDATORY EXECUTIVE KPI CARDS ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Executive KPI Indicators (Real-Time Database Telemetry)
          </div>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            12 Metrics across Manpower, Machines & Output
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: 14
        }}>
          {kpiList.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.id}
                onClick={() => setActiveTab(kpi.targetTab)}
                style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '16px 18px',
                  border: `1px solid ${kpi.border || '#e2e8f0'}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                    {kpi.title}
                  </span>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: kpi.bg, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={17} />
                  </div>
                </div>

                <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', letterSpacing: -0.5, margin: '2px 0 4px' }}>
                  {kpi.value}
                </div>

                <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{kpi.subtext}</span>
                  <ArrowRight size={12} color="#94a3b8" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── TOP & LOWEST PERFORMING MACHINES SPOTLIGHT ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 14,
        marginBottom: 24
      }}>
        {/* Best Performing Machine */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '16px 20px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} />
            <span>Top Performing Machine Today</span>
          </div>
          {bestMach && bestMach.actual > 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                  {bestMach.machine_or_line || bestMach.machine}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 900, background: '#ecfdf5', padding: '3px 8px', borderRadius: 6 }}>
                  {bestMach.achievement_pct ?? bestMach.pct ?? 0}% Output
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                {bestMach.actual.toLocaleString()} produced / {bestMach.target.toLocaleString()} target • {bestMach.downtime || 0}m downtime
              </div>
              <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, bestMach.achievement_pct ?? bestMach.pct ?? 0)}%`, height: '100%', background: '#059669' }} />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
              No machine output recorded yet today.
            </div>
          )}
        </div>

        {/* Lowest Performing Machine */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '16px 20px', border: '1px solid #fed7aa', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingDown size={14} />
            <span>Bottleneck / Low Output Alert</span>
          </div>
          {lowestMach && lowestMach.actual > 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                  {lowestMach.machine_or_line || lowestMach.machine}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#ea580c', fontWeight: 900, background: '#fff7ed', padding: '3px 8px', borderRadius: 6 }}>
                  {lowestMach.achievement_pct ?? lowestMach.pct ?? 0}% Output
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                {lowestMach.actual.toLocaleString()} produced / {lowestMach.target.toLocaleString()} target • {lowestMach.downtime || 0}m downtime
              </div>
              <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, lowestMach.achievement_pct ?? lowestMach.pct ?? 0)}%`, height: '100%', background: '#ea580c' }} />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
              All machines operating within normal limits.
            </div>
          )}
        </div>
      </div>

      {/* ── 7 INTERACTIVE CHARTS & VISUALIZATIONS ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        padding: '20px 24px',
        marginBottom: 24
      }}>
        {/* Chart Tab Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Production Intelligence & Visual Analytics
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
              Select a view to analyze hourly curves, shift comparisons, machine outputs, and multi-day trends
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
            {[
              { id: 'hourly', label: 'Hourly Curve' },
              { id: 'shift', label: 'Shift Comparison' },
              { id: 'nc-tandem', label: 'NC vs Tandem' },
              { id: 'machines', label: 'Machine-Wise' },
              { id: 'weekly', label: '7-Day Weekly' },
              { id: 'monthly', label: '30-Day Monthly' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveChartTab(tab.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeChartTab === tab.id ? '#ffffff' : 'transparent',
                  color: activeChartTab === tab.id ? '#1e40af' : '#64748b',
                  fontWeight: activeChartTab === tab.id ? 800 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: activeChartTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 1. HOURLY PRODUCTION CHART */}
        {activeChartTab === 'hourly' && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 14 }}>
              Hour-by-Hour Actual Output vs Target for {selectedShift} on {activeDate}
            </div>

            {hourlyBreakdown.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <Clock size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 700, color: '#475569' }}>No hourly records submitted yet for this shift.</div>
                <div style={{ fontSize: '0.76rem', marginTop: 4 }}>Go to Hourly Production Entry to record Hour 1 to Hour 8 output.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${hourlyBreakdown.length}, 1fr)`, gap: 10, alignItems: 'flex-end', minHeight: 200, padding: '20px 0 10px' }}>
                {hourlyBreakdown.map((h, i) => {
                  const maxVal = Math.max(...hourlyBreakdown.map(x => Math.max(x.target, x.actual)), 100);
                  const actH = Math.max(8, Math.round((h.actual / maxVal) * 160));
                  const tgtH = Math.max(8, Math.round((h.target / maxVal) * 160));
                  const belowTarget = h.actual < h.target;

                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: belowTarget ? '#dc2626' : '#10b981' }}>
                        {h.actual}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
                        {/* Target Bar */}
                        <div
                          title={`Target: ${h.target}`}
                          style={{
                            width: 12,
                            height: tgtH,
                            background: '#e2e8f0',
                            borderRadius: '3px 3px 0 0'
                          }}
                        />
                        {/* Actual Bar */}
                        <div
                          title={`Actual: ${h.actual}`}
                          style={{
                            width: 18,
                            height: actH,
                            background: belowTarget ? '#f59e0b' : '#2563eb',
                            borderRadius: '4px 4px 0 0'
                          }}
                        />
                      </div>

                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {h.hour_interval}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 14, fontSize: '0.74rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#2563eb', borderRadius: 2 }} /> Actual Output</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: 2 }} /> Output Below Target</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#e2e8f0', borderRadius: 2 }} /> Target Benchmark</span>
            </div>
          </div>
        )}

        {/* 2. SHIFT-WISE PRODUCTION COMPARISON */}
        {activeChartTab === 'shift' && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 14 }}>
              Three-Shift Performance Comparison (Shift A vs Shift B vs Shift C)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {['Shift A', 'Shift B', 'Shift C'].map((sName) => {
                const sData = shiftBreakdown[sName] || { target: 0, actual: 0, good: 0, rejected: 0, achievement_pct: 0 };
                return (
                  <div key={sName} style={{ background: '#f8fafc', padding: '16px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{sName}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: sData.achievement_pct >= 95 ? '#059669' : '#d97706', background: sData.achievement_pct >= 95 ? '#ecfdf5' : '#fffbeb', padding: '2px 8px', borderRadius: 6 }}>
                        {sData.achievement_pct}% Target
                      </span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e40af', marginBottom: 4 }}>
                      {(sData.actual || 0).toLocaleString()} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>/ {(sData.target || 0).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      Good: {(sData.good || 0).toLocaleString()} • Scrap: {(sData.rejected || 0).toLocaleString()}
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, sData.achievement_pct || 0)}%`, height: '100%', background: '#2563eb' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. NC VS TANDEM COMPARISON */}
        {activeChartTab === 'nc-tandem' && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 14 }}>
              Production Division: NC Press Fleet (16 Units) vs Tandem Lines (6 Units)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* NC Box */}
              <div style={{ background: '#f0f9ff', padding: '18px', borderRadius: 12, border: '1px solid #bae6fd' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Layers size={18} color="#0369a1" />
                  <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#0369a1' }}>NC Press Fleet (16 Machines)</span>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
                  {(nc.actual || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>units</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 4 }}>
                  Target: {(nc.target || 0).toLocaleString()} ({nc.achievement_pct || 0}% Achievement)
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                  Good: {(nc.good || 0).toLocaleString()} • Downtime: {nc.downtime || 0}m
                </div>
              </div>

              {/* Tandem Box */}
              <div style={{ background: '#f5f3ff', padding: '18px', borderRadius: 12, border: '1px solid #ddd6fe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <GitBranch size={18} color="#7c3aed" />
                  <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#7c3aed' }}>Tandem Lines (6 Lines)</span>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
                  {(tan.actual || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>units</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 4 }}>
                  Target: {(tan.target || 0).toLocaleString()} ({tan.achievement_pct || 0}% Achievement)
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                  Good: {(tan.good || 0).toLocaleString()} • Downtime: {tan.downtime || 0}m
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. MACHINE-WISE PRODUCTION */}
        {activeChartTab === 'machines' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                All 22 Shopfloor Machines — Live Output Percentages & Targets
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                16 NC Presses • 6 Tandem Lines
              </span>
            </div>
            {machinePerf.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94a3b8' }}>
                No machines configured yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
                {machinePerf.map((m, i) => {
                  const mName = m.machine_or_line || m.machine || m.machine_number;
                  const pct = m.achievement_pct ?? m.pct ?? (m.target > 0 ? Math.round((m.actual / m.target) * 100) : 0);
                  const isNc = mName.startsWith('NC') || m.type === 'NC';
                  const pctColor = pct >= 90 ? '#059669' : pct >= 70 ? '#d97706' : pct > 0 ? '#dc2626' : '#64748b';
                  const pctBg = pct >= 90 ? '#ecfdf5' : pct >= 70 ? '#fffbeb' : pct > 0 ? '#fef2f2' : '#f1f5f9';

                  return (
                    <div key={i} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0f172a' }}>{mName}</span>
                          <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: isNc ? '#e0f2fe' : '#f3e8ff', color: isNc ? '#0369a1' : '#6b21a8' }}>
                            {isNc ? 'NC' : 'TANDEM'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 900, color: pctColor, background: pctBg, padding: '2px 7px', borderRadius: 6 }}>
                          {pct}%
                        </span>
                      </div>

                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e40af', margin: '4px 0 2px' }}>
                        {(m.actual || 0).toLocaleString()} <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>/ {(m.target || 500).toLocaleString()}</span>
                      </div>

                      {/* Visual Output % Progress Bar */}
                      <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, margin: '6px 0', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pctColor }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b' }}>
                        <span>Status: <strong style={{ color: m.status === 'Running' ? '#059669' : '#dc2626' }}>{m.status || 'Running'}</strong></span>
                        <span>Downtime: {m.downtime || 0}m</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 5. 7-DAY WEEKLY PRODUCTION TREND */}
        {activeChartTab === 'weekly' && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 14 }}>
              Past 7-Day Factory Production Trend (Actual Output vs Target)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, alignItems: 'flex-end', minHeight: 180 }}>
              {weeklyTrend.map((d, i) => {
                const maxVal = Math.max(...weeklyTrend.map(x => Math.max(x.target, x.actual)), 100);
                const actH = Math.max(8, Math.round((d.actual / maxVal) * 140));
                const tgtH = Math.max(8, Math.round((d.target / maxVal) * 140));

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af' }}>{d.actual}</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140 }}>
                      <div style={{ width: 10, height: tgtH, background: '#e2e8f0', borderRadius: '2px 2px 0 0' }} />
                      <div style={{ width: 18, height: actH, background: '#2563eb', borderRadius: '3px 3px 0 0' }} />
                    </div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>{d.day}</div>
                    <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>{d.date.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. 30-DAY MONTHLY TREND */}
        {activeChartTab === 'monthly' && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 14 }}>
              30-Day Monthly Output Progression
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(30, 1fr)', gap: 3, alignItems: 'flex-end', minHeight: 140 }}>
              {monthlyTrend.map((d, i) => {
                const maxVal = Math.max(...monthlyTrend.map(x => Math.max(x.target, x.actual)), 100);
                const actH = Math.max(4, Math.round((d.actual / maxVal) * 110));

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div
                      title={`${d.date}: ${d.actual} pcs (Target: ${d.target})`}
                      style={{
                        width: '100%',
                        height: actH,
                        background: d.actual > 0 ? '#2563eb' : '#e2e8f0',
                        borderRadius: '2px 2px 0 0'
                      }}
                    />
                    <div style={{ fontSize: '0.55rem', color: '#94a3b8' }}>{d.day}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── RECENT PRODUCTION ENTRIES TABLE ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Recent Production Entries (Audit Feed)
            </h3>
            <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0' }}>
              Live stream of newly recorded outputs from shopfloor operators & supervisors
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('standard-production')}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#1e40af',
              cursor: 'pointer'
            }}
          >
            View All Records →
          </button>
        </div>

        {recentProd.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <FileText size={32} color="#cbd5e1" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 700, color: '#475569' }}>No production records entered yet.</div>
            <div style={{ fontSize: '0.76rem', marginTop: 2 }}>Use Standard Production Entry or Hourly Production to record output.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 800 }}>ID</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800 }}>Date & Shift</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800 }}>Line / Machine</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800 }}>Interval</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800 }}>Operator</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800 }}>Target</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800 }}>Actual Output</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800 }}>Achievement</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800 }}>Downtime</th>
                </tr>
              </thead>
              <tbody>
                {recentProd.map((r) => {
                  const ach = r.target_qty > 0 ? Math.round((r.actual_qty / r.target_qty) * 100) : 0;
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 16px', color: '#64748b' }}>#{r.id}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0f172a' }}>{r.date} ({r.shift})</td>
                      <td style={{ padding: '10px 16px', fontWeight: 800, color: '#1e40af' }}>{r.machine_or_line}</td>
                      <td style={{ padding: '10px 16px', color: '#475569' }}>{r.hour_interval}</td>
                      <td style={{ padding: '10px 16px', color: '#334155' }}>{r.operator_name || '—'}</td>
                      <td style={{ padding: '10px 16px', color: '#64748b' }}>{r.target_qty}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 800, color: '#0f172a' }}>{r.actual_qty}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          background: ach >= 95 ? '#ecfdf5' : '#fffbeb',
                          color: ach >= 95 ? '#059669' : '#d97706'
                        }}>
                          {ach}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: r.downtime_minutes > 0 ? '#dc2626' : '#64748b' }}>
                        {r.downtime_minutes > 0 ? `${r.downtime_minutes}m` : '0m'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* In-App Notifications Modal */}
      <NotificationModal 
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        notifications={notifications}
        onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
        onClearAll={() => setNotifications([])}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}
