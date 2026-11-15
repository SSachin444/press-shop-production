import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Layers,
  GitBranch,
  Timer,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Target,
  Cpu,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight
} from 'lucide-react';
import { api } from '../api';

export default function ProductionDashboardPage({ selectedDate, selectedShift, setActiveTab }) {
  const [kpis, setKpis] = useState(null);
  const [ncData, setNcData] = useState(null);
  const [tandemData, setTandemData] = useState(null);
  const [hourlyData, setHourlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [activeSection, setActiveSection] = useState('overview'); // overview | nc | tandem | hourly | shifts | machines

  const activeDate = selectedDate || new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadAll();
  }, [activeDate, selectedShift]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [kRes, ncRes, tanRes] = await Promise.all([
        api.getKpis(activeDate, selectedShift),
        api.getNcProduction(activeDate, selectedShift),
        api.getTandemProduction(activeDate, selectedShift)
      ]);
      setKpis(kRes);
      setNcData(ncRes);
      setTandemData(tanRes);

      // Load hourly for all machines combined
      try {
        const hRes = await api.getHourlyProduction({ date: activeDate, shift: selectedShift });
        setHourlyData(hRes.records || []);
      } catch (e) {
        setHourlyData([]);
      }
    } catch (err) {
      showNotice('error', 'Failed to load dashboard data: ' + (err.message || 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Derived data
  const sp = kpis?.shift_production || {};
  const nc = kpis?.nc_summary || {};
  const tan = kpis?.tandem_summary || {};
  const shiftBreakdown = kpis?.shift_breakdown || {};
  const hourlyBreakdown = kpis?.hourly_breakdown || [];
  const ncMatrix = ncData?.machine_matrix || [];
  const tandemMatrix = tandemData?.line_matrix || [];

  const overallTarget = sp.target || 0;
  const overallActual = sp.actual || 0;
  const overallGood = sp.good || 0;
  const overallRej = sp.rejected || 0;
  const overallDowntime = sp.downtime_minutes || 0;
  const overallAchieve = sp.achievement_pct || 0;

  // Hourly grouped by machine
  const hourlyByMachine = {};
  hourlyData.forEach(r => {
    const key = r.machine_or_line;
    if (!hourlyByMachine[key]) hourlyByMachine[key] = { machine: key, records: [], total_actual: 0, total_target: 0 };
    hourlyByMachine[key].records.push(r);
    hourlyByMachine[key].total_actual += r.actual_qty || 0;
    hourlyByMachine[key].total_target += r.target_qty || 0;
  });
  const hourlyMachineList = Object.values(hourlyByMachine).sort((a, b) => b.total_actual - a.total_actual);

  const kpiCard = (label, value, sub, bg, color, border) => (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 10,
      padding: '14px 16px',
      minWidth: 0
    }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color, margin: '4px 0 2px' }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color, opacity: 0.75 }}>{sub}</div>
    </div>
  );

  const pctBar = (pct, good = true) => (
    <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <div style={{
        width: `${Math.min(100, pct || 0)}%`,
        height: '100%',
        background: pct >= 95 ? '#10b981' : pct >= 80 ? '#f59e0b' : '#ef4444',
        borderRadius: 3
      }} />
    </div>
  );

  const sections = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'nc', label: 'NC Production', icon: Layers },
    { key: 'tandem', label: 'Tandem', icon: GitBranch },
    { key: 'hourly', label: 'Hourly', icon: Timer },
    { key: 'shifts', label: 'Shift-wise', icon: Gauge },
    { key: 'machines', label: 'Machine-wise', icon: Cpu },
  ];

  return (
    <div style={{ padding: '16px', background: '#f8fafc', minHeight: '100%' }}>
      {notification && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 12,
          background: notification.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${notification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: notification.type === 'success' ? '#065f46' : '#991b1b',
          fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8
        }}>
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {notification.message}
        </div>
      )}

      {/* PAGE HEADER */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        borderRadius: 12,
        padding: '18px 22px',
        marginBottom: 16,
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              background: '#1e40af', color: '#93c5fd',
              padding: '3px 8px', borderRadius: 5,
              fontWeight: 800, fontSize: '0.68rem', letterSpacing: '0.05em'
            }}>PAGE 3 • PRODUCTION DASHBOARD</span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>Production Intelligence Dashboard</h2>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 3 }}>
            {activeDate} &nbsp;•&nbsp; {selectedShift} &nbsp;•&nbsp; NC + Tandem + Hourly Data
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={loadAll}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* SECTION NAVIGATION PILLS */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap'
      }}>
        {sections.map(s => {
          const Icon = s.icon;
          const isActive = activeSection === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 20,
                background: isActive ? '#1e40af' : '#ffffff',
                color: isActive ? '#ffffff' : '#475569',
                border: isActive ? 'none' : '1px solid #e2e8f0',
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: isActive ? '0 2px 8px rgba(30,64,175,0.3)' : 'none'
              }}
            >
              <Icon size={13} />
              {s.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }} />
          <div style={{ fontWeight: 700 }}>Loading production data...</div>
        </div>
      )}

      {!loading && (
        <>
          {/* ===== OVERVIEW SECTION ===== */}
          {activeSection === 'overview' && (
            <div>
              {/* Primary KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                {kpiCard('Overall Target', overallTarget.toLocaleString(), 'NC + Tandem combined', '#f8fafc', '#475569', '#e2e8f0')}
                {kpiCard('Actual Output', overallActual.toLocaleString(), `${overallAchieve}% Achieved`, '#eff6ff', '#1e40af', '#bfdbfe')}
                {kpiCard('Good Parts', overallGood.toLocaleString(), `Quality pass rate`, '#f0fdf4', '#15803d', '#bbf7d0')}
                {kpiCard('Rejections', overallRej.toLocaleString(), `${overallActual > 0 ? ((overallRej / overallActual) * 100).toFixed(1) : 0}% scrap rate`, '#fef2f2', '#dc2626', '#fecaca')}
                {kpiCard('NC Actual', (nc.actual || 0).toLocaleString(), `${nc.achievement_pct || 0}% of target`, '#f0fdf4', '#059669', '#a7f3d0')}
                {kpiCard('Tandem Actual', (tan.actual || 0).toLocaleString(), `${tan.achievement_pct || 0}% of target`, '#faf5ff', '#7c3aed', '#e9d5ff')}
              </div>

              {/* Target vs Actual Summary Card */}
              <div style={{
                background: '#fff', borderRadius: 12, padding: '18px 20px',
                border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Target size={17} color="#1e40af" />
                    Target vs Actual — {selectedShift}
                  </h3>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800,
                    background: overallAchieve >= 95 ? '#dcfce7' : overallAchieve >= 80 ? '#fef3c7' : '#fee2e2',
                    color: overallAchieve >= 95 ? '#15803d' : overallAchieve >= 80 ? '#b45309' : '#b91c1c'
                  }}>
                    {overallAchieve}% Overall
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {/* NC */}
                  <div style={{ background: '#f0fdf4', padding: '12px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', marginBottom: 4 }}>NC PRODUCTION</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#064e3b' }}>{(nc.actual || 0).toLocaleString()}</div>
                    <div style={{ fontSize: '0.72rem', color: '#047857' }}>of {(nc.target || 0).toLocaleString()} target</div>
                    {pctBar(nc.achievement_pct || 0)}
                    <div style={{ fontSize: '0.68rem', color: '#059669', marginTop: 4, fontWeight: 700 }}>{nc.achievement_pct || 0}% achieved</div>
                  </div>

                  {/* Tandem */}
                  <div style={{ background: '#faf5ff', padding: '12px 14px', borderRadius: 8, border: '1px solid #e9d5ff' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>TANDEM PRODUCTION</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#4c1d95' }}>{(tan.actual || 0).toLocaleString()}</div>
                    <div style={{ fontSize: '0.72rem', color: '#6d28d9' }}>of {(tan.target || 0).toLocaleString()} target</div>
                    {pctBar(tan.achievement_pct || 0)}
                    <div style={{ fontSize: '0.68rem', color: '#7c3aed', marginTop: 4, fontWeight: 700 }}>{tan.achievement_pct || 0}% achieved</div>
                  </div>
                </div>

                {/* Overall progress bar */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: 5 }}>
                    <span style={{ color: '#475569' }}>Factory Combined: {overallActual.toLocaleString()} / {overallTarget.toLocaleString()}</span>
                    <span style={{ color: overallAchieve >= 95 ? '#16a34a' : overallAchieve >= 80 ? '#d97706' : '#dc2626' }}>{overallAchieve}%</span>
                  </div>
                  <div style={{ width: '100%', height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, overallAchieve)}%`,
                      height: '100%',
                      background: overallAchieve >= 95 ? '#10b981' : overallAchieve >= 80 ? '#f59e0b' : '#ef4444',
                      borderRadius: 5,
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
              </div>

              {/* Quick action links */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {[
                  { label: '📋 Standard Production Entry', desc: 'NC + Tandem combined entry', tab: 'standard-production', color: '#1e40af' },
                  { label: '⚡ Hourly Production Entry', desc: 'Per-hour per-machine logging', tab: 'hourly-production', color: '#059669' },
                  { label: '📊 Reports & Exports', desc: 'Download CSV reports', tab: 'reports', color: '#7c3aed' },
                ].map(item => (
                  <button key={item.tab} onClick={() => setActiveTab && setActiveTab(item.tab)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 10,
                      background: '#fff', border: `1px solid ${item.color}20`,
                      cursor: 'pointer', textAlign: 'left', gap: 8
                    }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: item.color }}>{item.label}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.desc}</div>
                    </div>
                    <ChevronRight size={16} color={item.color} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== NC PRODUCTION SECTION ===== */}
          {activeSection === 'nc' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                {kpiCard('NC Target', (nc.target || 0).toLocaleString(), `${selectedShift}`, '#f8fafc', '#475569', '#e2e8f0')}
                {kpiCard('NC Actual', (nc.actual || 0).toLocaleString(), `${nc.achievement_pct || 0}% achieved`, '#eff6ff', '#1e40af', '#bfdbfe')}
                {kpiCard('Good Parts', (nc.good || 0).toLocaleString(), 'Quality passed', '#f0fdf4', '#059669', '#a7f3d0')}
                {kpiCard('Rejections', (nc.rejected || 0).toLocaleString(), 'Scrapped parts', '#fef2f2', '#dc2626', '#fecaca')}
                {kpiCard('Downtime', `${nc.downtime || 0}m`, 'NC machines total', '#fffbeb', '#b45309', '#fde68a')}
              </div>

              <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Layers size={17} color="#1e40af" /> NC Machine Performance ({ncMatrix.length} machines)
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        {['Machine', 'Status', 'Operator', 'Target', 'Actual', 'Good', 'Scrap', 'Downtime', '%'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Machine' || h === 'Status' || h === 'Operator' ? 'left' : 'right', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ncMatrix.length === 0 ? (
                        <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No NC production records for this date/shift.</td></tr>
                      ) : ncMatrix.map(m => {
                        const target = m.hourly_target || 75;
                        const actual = m.total_actual || 0;
                        const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
                        return (
                          <tr key={m.machine_number} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0f172a' }}>{m.machine_number}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{
                                padding: '2px 7px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700,
                                background: m.status === 'Running' ? '#dcfce7' : m.status === 'Breakdown' ? '#fee2e2' : '#f1f5f9',
                                color: m.status === 'Running' ? '#15803d' : m.status === 'Breakdown' ? '#b91c1c' : '#475569'
                              }}>{m.status || 'Idle'}</span>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.operator || '—'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>{target}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#1e40af' }}>{actual}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669', fontWeight: 700 }}>{m.total_good || 0}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: (m.total_rejected || 0) > 0 ? '#dc2626' : '#94a3b8' }}>{m.total_rejected || 0}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#b45309' }}>{(m.total_downtime || 0) > 0 ? `${m.total_downtime}m` : '0'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <span style={{
                                padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 800,
                                background: pct >= 95 ? '#dcfce7' : pct >= 80 ? '#fef3c7' : '#fee2e2',
                                color: pct >= 95 ? '#15803d' : pct >= 80 ? '#b45309' : '#b91c1c'
                              }}>{pct}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {ncMatrix.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                          <td colSpan={3} style={{ padding: '10px', color: '#0f172a' }}>NC Totals:</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#64748b' }}>{ncMatrix.reduce((s, m) => s + (m.hourly_target || 75), 0)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#1e40af' }}>{ncMatrix.reduce((s, m) => s + (m.total_actual || 0), 0)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#059669' }}>{ncMatrix.reduce((s, m) => s + (m.total_good || 0), 0)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>{ncMatrix.reduce((s, m) => s + (m.total_rejected || 0), 0)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#b45309' }}>{ncMatrix.reduce((s, m) => s + (m.total_downtime || 0), 0)}m</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#1e40af', fontWeight: 900 }}>{nc.achievement_pct || 0}%</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===== TANDEM PRODUCTION SECTION ===== */}
          {activeSection === 'tandem' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                {kpiCard('Tandem Target', (tan.target || 0).toLocaleString(), `${selectedShift}`, '#f8fafc', '#475569', '#e2e8f0')}
                {kpiCard('Tandem Actual', (tan.actual || 0).toLocaleString(), `${tan.achievement_pct || 0}% achieved`, '#faf5ff', '#7c3aed', '#e9d5ff')}
                {kpiCard('Good Parts', (tan.good || 0).toLocaleString(), 'Quality passed', '#f0fdf4', '#059669', '#a7f3d0')}
                {kpiCard('Rejections', (tan.rejected || 0).toLocaleString(), 'Scrapped parts', '#fef2f2', '#dc2626', '#fecaca')}
                {kpiCard('Downtime', `${tan.downtime || 0}m`, 'Tandem lines total', '#fffbeb', '#b45309', '#fde68a')}
              </div>

              <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <GitBranch size={17} color="#7c3aed" /> Tandem Line Performance ({tandemMatrix.length} lines)
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f5f3ff', borderBottom: '2px solid #ddd6fe' }}>
                        {['Line', 'Status', 'Line Lead', 'Target', 'Actual', 'Good', 'Scrap', 'Downtime', '%'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Line' || h === 'Status' || h === 'Line Lead' ? 'left' : 'right', fontWeight: 800, color: '#5b21b6', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tandemMatrix.length === 0 ? (
                        <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No Tandem production records for this date/shift.</td></tr>
                      ) : tandemMatrix.map(t => {
                        const target = t.hourly_target || 125;
                        const actual = t.total_actual || 0;
                        const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
                        return (
                          <tr key={t.line_id} style={{ borderBottom: '1px solid #f5f3ff' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 800, color: '#7c3aed' }}>{t.line_id}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{
                                padding: '2px 7px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700,
                                background: t.status === 'Running' ? '#dcfce7' : t.status === 'Breakdown' ? '#fee2e2' : '#f5f3ff',
                                color: t.status === 'Running' ? '#15803d' : t.status === 'Breakdown' ? '#b91c1c' : '#7c3aed'
                              }}>{t.status || 'Idle'}</span>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>{t.line_lead || '—'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>{target}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#7c3aed' }}>{actual}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669', fontWeight: 700 }}>{t.total_good || 0}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: (t.total_rejected || 0) > 0 ? '#dc2626' : '#94a3b8' }}>{t.total_rejected || 0}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#b45309' }}>{(t.total_downtime || 0) > 0 ? `${t.total_downtime}m` : '0'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <span style={{
                                padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 800,
                                background: pct >= 95 ? '#dcfce7' : pct >= 80 ? '#fef3c7' : '#fee2e2',
                                color: pct >= 95 ? '#15803d' : pct >= 80 ? '#b45309' : '#b91c1c'
                              }}>{pct}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===== HOURLY PRODUCTION SECTION ===== */}
          {activeSection === 'hourly' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                {kpiCard('Hourly Records', hourlyData.length, 'Entries this shift', '#f8fafc', '#475569', '#e2e8f0')}
                {kpiCard('Total Actual', hourlyData.reduce((s, r) => s + (r.actual_qty || 0), 0).toLocaleString(), 'All machines combined', '#eff6ff', '#1e40af', '#bfdbfe')}
                {kpiCard('Total Target', hourlyData.reduce((s, r) => s + (r.target_qty || 0), 0).toLocaleString(), 'Sum of all targets', '#f0fdf4', '#059669', '#a7f3d0')}
                {kpiCard('Machines Active', hourlyMachineList.length, 'With hourly entries', '#faf5ff', '#7c3aed', '#e9d5ff')}
              </div>

              {/* Machine-wise hourly breakdown */}
              {hourlyMachineList.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 12, padding: '32px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#94a3b8' }}>
                  <Timer size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
                  <div style={{ fontWeight: 700 }}>No hourly entries found</div>
                  <div style={{ fontSize: '0.78rem', marginTop: 4 }}>Use Hourly Production Entry to log per-hour data</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                  {hourlyMachineList.map(m => {
                    const pct = m.total_target > 0 ? Math.round((m.total_actual / m.total_target) * 100) : 0;
                    return (
                      <div key={m.machine} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{m.machine}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 800,
                            background: pct >= 95 ? '#dcfce7' : pct >= 80 ? '#fef3c7' : '#fee2e2',
                            color: pct >= 95 ? '#15803d' : pct >= 80 ? '#b45309' : '#b91c1c'
                          }}>{pct}%</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem', marginBottom: 8 }}>
                          <span>Target: <strong style={{ color: '#475569' }}>{m.total_target}</strong></span>
                          <span>Actual: <strong style={{ color: '#1e40af' }}>{m.total_actual}</strong></span>
                          <span>{m.records.length} hrs logged</span>
                        </div>
                        {pctBar(pct)}
                        <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {m.records.map(r => {
                            const rPct = r.target_qty > 0 ? Math.round((r.actual_qty / r.target_qty) * 100) : 0;
                            return (
                              <span key={r.id || r.hour_interval} style={{
                                padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700,
                                background: rPct >= 95 ? '#dcfce7' : rPct >= 80 ? '#fef3c7' : '#fee2e2',
                                color: rPct >= 95 ? '#15803d' : rPct >= 80 ? '#b45309' : '#b91c1c'
                              }}>
                                H{r.hour_interval?.replace(/\D/g, '')?.[0] || '?'}: {r.actual_qty}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== SHIFT-WISE SECTION ===== */}
          {activeSection === 'shifts' && (
            <div>
              <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Gauge size={17} color="#1e40af" /> Shift-wise Production Report — {activeDate}
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        {['Shift', 'Target', 'Actual', 'Good', 'Rejected', 'Downtime', 'Achievement'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Shift' ? 'left' : 'right', fontWeight: 800, color: '#334155' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {['Shift A', 'Shift B', 'Shift C'].map(shift => {
                        const s = shiftBreakdown[shift] || {};
                        const pct = s.achievement_pct || 0;
                        const isCurrentShift = shift === selectedShift;
                        return (
                          <tr key={shift} style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isCurrentShift ? '#eff6ff' : 'transparent'
                          }}>
                            <td style={{ padding: '10px 12px', fontWeight: 800, color: isCurrentShift ? '#1e40af' : '#0f172a' }}>
                              {shift} {isCurrentShift && <span style={{ fontSize: '0.68rem', background: '#1e40af', color: '#fff', padding: '1px 5px', borderRadius: 4, marginLeft: 4 }}>CURRENT</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>{(s.target || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#1e40af' }}>{(s.actual || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669', fontWeight: 700 }}>{(s.good || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: (s.rejected || 0) > 0 ? '#dc2626' : '#94a3b8' }}>{(s.rejected || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#b45309' }}>{(s.downtime || 0) > 0 ? `${s.downtime}m` : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                <div style={{ width: 60, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pct >= 95 ? '#10b981' : pct >= 80 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                                </div>
                                <span style={{ fontWeight: 800, color: pct >= 95 ? '#059669' : pct >= 80 ? '#d97706' : '#dc2626', fontSize: '0.82rem' }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                        <td style={{ padding: '10px 12px', color: '#0f172a' }}>Day Total</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>{(kpis?.day_production?.target || 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1e40af', fontSize: '0.9rem' }}>{(kpis?.day_production?.actual || 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669' }}>{(kpis?.day_production?.good || 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#dc2626' }}>{(kpis?.day_production?.rejected || 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#b45309' }}>{(kpis?.day_production?.downtime_minutes || 0)}m</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1e40af', fontWeight: 900 }}>{kpis?.day_production?.achievement_pct || 0}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Hourly Breakdown Table */}
                {hourlyBreakdown.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Timer size={15} color="#1e40af" /> Hourly Breakdown — {selectedShift}
                    </h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                          {['Hour', 'Target', 'Actual', 'Good', 'Rejected', 'Downtime'].map(h => (
                            <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Hour' ? 'left' : 'right', fontWeight: 700, color: '#475569' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hourlyBreakdown.map((h, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '7px 10px', fontWeight: 700, color: '#0f172a' }}>{h.hour_interval}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#64748b' }}>{h.target}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>{h.actual}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#059669' }}>{h.good}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: h.rejected > 0 ? '#dc2626' : '#94a3b8' }}>{h.rejected}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#b45309' }}>{h.downtime > 0 ? `${h.downtime}m` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== MACHINE-WISE SECTION ===== */}
          {activeSection === 'machines' && (
            <div>
              <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Cpu size={17} color="#1e40af" /> Machine-wise Production Report — {selectedShift}
                </h3>

                {/* NC Machines */}
                {ncMatrix.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e40af', marginBottom: 8, padding: '6px 10px', background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                      NC Machine Presses
                    </div>
                    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            {['Machine', 'Tonnage', 'Target', 'Actual', 'Good', 'Rejected', 'DT', 'Achievement'].map(h => (
                              <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Machine' ? 'left' : 'right', fontWeight: 700, color: '#475569' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ncMatrix.map(m => {
                            const pct = (m.hourly_target || 75) > 0 ? Math.round(((m.total_actual || 0) / (m.hourly_target || 75)) * 100) : 0;
                            return (
                              <tr key={m.machine_number} style={{ borderBottom: '1px solid #f8fafc' }}>
                                <td style={{ padding: '7px 10px', fontWeight: 700, color: '#0f172a' }}>{m.machine_number}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#64748b' }}>{m.tonnage}T</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#64748b' }}>{m.hourly_target || 75}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>{m.total_actual || 0}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#059669' }}>{m.total_good || 0}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', color: (m.total_rejected || 0) > 0 ? '#dc2626' : '#94a3b8' }}>{m.total_rejected || 0}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#b45309' }}>{m.total_downtime || 0}m</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                                  <span style={{
                                    padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800,
                                    background: pct >= 95 ? '#dcfce7' : pct >= 80 ? '#fef3c7' : '#fee2e2',
                                    color: pct >= 95 ? '#15803d' : pct >= 80 ? '#b45309' : '#b91c1c'
                                  }}>{pct}%</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Tandem Lines */}
                {tandemMatrix.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#7c3aed', marginBottom: 8, padding: '6px 10px', background: '#faf5ff', borderRadius: 6, border: '1px solid #e9d5ff' }}>
                      Tandem Production Lines
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e9d5ff' }}>
                            {['Line', 'Tonnage', 'Target', 'Actual', 'Good', 'Rejected', 'DT', 'Achievement'].map(h => (
                              <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Line' ? 'left' : 'right', fontWeight: 700, color: '#6d28d9' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tandemMatrix.map(t => {
                            const pct = (t.hourly_target || 125) > 0 ? Math.round(((t.total_actual || 0) / (t.hourly_target || 125)) * 100) : 0;
                            return (
                              <tr key={t.line_id} style={{ borderBottom: '1px solid #faf5ff' }}>
                                <td style={{ padding: '7px 10px', fontWeight: 700, color: '#7c3aed' }}>{t.line_id}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#64748b' }}>{t.tonnage}T</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#64748b' }}>{t.hourly_target || 125}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>{t.total_actual || 0}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#059669' }}>{t.total_good || 0}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', color: (t.total_rejected || 0) > 0 ? '#dc2626' : '#94a3b8' }}>{t.total_rejected || 0}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#b45309' }}>{t.total_downtime || 0}m</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                                  <span style={{
                                    padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800,
                                    background: pct >= 95 ? '#dcfce7' : pct >= 80 ? '#fef3c7' : '#fee2e2',
                                    color: pct >= 95 ? '#15803d' : pct >= 80 ? '#b45309' : '#b91c1c'
                                  }}>{pct}%</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {ncMatrix.length === 0 && tandemMatrix.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                    <Cpu size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
                    <div style={{ fontWeight: 700 }}>No machine production records found</div>
                    <div style={{ fontSize: '0.78rem', marginTop: 4 }}>Log production in Standard or Hourly Entry pages</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Spin animation style */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
