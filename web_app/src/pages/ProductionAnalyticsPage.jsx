import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Cpu, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  Award, 
  CheckCircle, 
  Activity, 
  RefreshCw, 
  Zap, 
  Flame, 
  Sliders,
  Filter
} from 'lucide-react';
import { api } from '../api';

export default function ProductionAnalyticsPage({ selectedDate, selectedShift }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendView, setTrendView] = useState('weekly'); // 'weekly' or 'monthly'

  useEffect(() => {
    loadAnalytics();
  }, [selectedDate, selectedShift]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getAnalytics(selectedDate, selectedShift);
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="page-container" style={{ padding: 40, textAlign: 'center' }}>
        <RefreshCw size={32} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: '#1E88E5' }} />
        <div style={{ fontWeight: 700, color: '#475569' }}>Loading Plant Production Analytics...</div>
      </div>
    );
  }

  const shiftTot = data?.shift_totals || { target: 0, actual: 0, good: 0, rejected: 0, downtime: 0, active_machines: 0 };
  const dayTot = data?.day_totals || { target: 0, actual: 0, good: 0, rejected: 0, downtime: 0 };
  const nc = data?.nc_data || { target: 0, actual: 0, good: 0, rejected: 0, downtime: 0 };
  const tandem = data?.tandem_data || { target: 0, actual: 0, good: 0, rejected: 0, downtime: 0 };
  const rankings = data?.machine_rankings || [];
  const weekly = data?.weekly_trend || [];
  const monthly = data?.monthly_trend || [];
  const lossAnalysis = data?.loss_analysis || [];
  const bestMachine = data?.best_machine;
  const lowestMachine = data?.lowest_machine;
  const bestShift = data?.best_shift;

  // Calculate Average Daily Production
  const weeklyActuals = weekly.map(w => w.actual).filter(a => a > 0);
  const avgDaily = weeklyActuals.length > 0 
    ? Math.round(weeklyActuals.reduce((a, b) => a + b, 0) / weeklyActuals.length) 
    : dayTot.actual;

  // Max value for weekly bar scaling
  const maxWeeklyVal = Math.max(...weekly.map(w => Math.max(w.target, w.actual, 100)), 500);

  // Max value for monthly bar scaling
  const maxMonthlyVal = Math.max(...monthly.map(m => Math.max(m.actual, 100)), 500);

  // Loss analysis total minutes
  const totalLossMinutes = lossAnalysis.reduce((acc, l) => acc + (l.total_minutes || 0), 0);

  return (
    <div className="page-container" style={{ padding: '20px', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* Top Header Panel */}
      <div className="card-panel" style={{ background: '#ffffff', borderRadius: 12, padding: '20px', border: '1px solid #E2E8F0', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 12, 
              background: '#EFF6FF', 
              color: '#1E88E5', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(30,136,229,0.15)'
            }}>
              <Activity size={26} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Factory Production Analytics & Intelligence
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
                PHA INDIA PRIVATE LIMITED • Date: <strong style={{ color: '#1E88E5' }}>{selectedDate}</strong> • Shift: <strong style={{ color: '#1E88E5' }}>{selectedShift}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={loadAnalytics}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#F8FAFC',
              fontWeight: 700,
              cursor: 'pointer',
              color: '#334155'
            }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh Analytics</span>
          </button>
        </div>
      </div>

      {/* 1. TOP 4 KEY INDUSTRIAL METRICS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: 16, 
        marginBottom: 20 
      }}>
        {/* Metric 1: Production Efficiency */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #E2E8F0', borderLeft: '4px solid #1E88E5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Production Efficiency</span>
            <Zap size={18} color="#1E88E5" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A' }}>
            {data?.efficiency_pct || 0}%
          </div>
          <div style={{ fontSize: '0.75rem', color: data?.efficiency_pct >= 85 ? '#059669' : '#D97706', fontWeight: 700, marginTop: 4 }}>
            {data?.efficiency_pct >= 85 ? 'Optimal Plant Operating Rate' : 'Below Target Efficiency Threshold'}
          </div>
        </div>

        {/* Metric 2: Target Achievement */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #E2E8F0', borderLeft: '4px solid #00B074' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Target Achievement</span>
            <CheckCircle size={18} color="#00B074" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#059669' }}>
            {shiftTot.target > 0 ? Math.round((shiftTot.actual / shiftTot.target) * 100) : 0}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 4 }}>
            Actual <strong>{shiftTot.actual.toLocaleString()}</strong> of <strong>{shiftTot.target.toLocaleString()}</strong> pcs
          </div>
        </div>

        {/* Metric 3: Average Hourly Production */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #E2E8F0', borderLeft: '4px solid #7C4DFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Avg Hourly Production</span>
            <Clock size={18} color="#7C4DFF" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#7C4DFF' }}>
            {data?.avg_hourly_production || 0} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748B' }}>pcs/hr</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 4 }}>
            Active across running presses
          </div>
        </div>

        {/* Metric 4: Average Daily Production */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #E2E8F0', borderLeft: '4px solid #0891B2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Avg Daily Output</span>
            <Calendar size={18} color="#0891B2" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0891B2' }}>
            {avgDaily.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748B' }}>pcs/day</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 4 }}>
            7-day rolling daily output average
          </div>
        </div>
      </div>

      {/* 2. THREE HIGHLIGHT CARDS: BEST MACHINE, LOWEST MACHINE, BEST SHIFT */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: 16, 
        marginBottom: 20 
      }}>
        {/* Best Performing Machine */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #A7F3D0', background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ background: '#DCFCE7', color: '#16A34A', padding: 8, borderRadius: 10 }}>
              <Award size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#16A34A', textTransform: 'uppercase' }}>Best Performing Machine</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                {bestMachine?.machine_or_line || 'No Data'}
              </h3>
            </div>
          </div>
          {bestMachine ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#334155' }}>
              <div>Actual Output: <strong style={{ color: '#059669' }}>{bestMachine.actual.toLocaleString()}</strong> pcs</div>
              <div>Achievement: <strong style={{ color: '#059669' }}>{bestMachine.achievement_pct}%</strong></div>
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Awaiting production logs for today</div>
          )}
        </div>

        {/* Lowest Performing Machine */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #FECACA', background: 'linear-gradient(180deg, #FEF2F2 0%, #FFFFFF 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ background: '#FEE2E2', color: '#DC2626', padding: 8, borderRadius: 10 }}>
              <TrendingDown size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase' }}>Lowest Performing Machine</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                {lowestMachine?.machine_or_line || 'No Data'}
              </h3>
            </div>
          </div>
          {lowestMachine ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#334155' }}>
              <div>Actual Output: <strong style={{ color: '#DC2626' }}>{lowestMachine.actual.toLocaleString()}</strong> pcs</div>
              <div>Downtime: <strong style={{ color: '#DC2626' }}>{lowestMachine.downtime}m</strong></div>
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Awaiting production logs for today</div>
          )}
        </div>

        {/* Best Performing Shift */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #BFDBFE', background: 'linear-gradient(180deg, #EFF6FF 0%, #FFFFFF 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ background: '#DBEAFE', color: '#1E40AF', padding: 8, borderRadius: 10 }}>
              <Flame size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase' }}>Best Performing Shift</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                {bestShift?.shift || 'No Data'}
              </h3>
            </div>
          </div>
          {bestShift ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#334155' }}>
              <div>Shift Output: <strong style={{ color: '#1E40AF' }}>{bestShift.actual.toLocaleString()}</strong> pcs</div>
              <div>Target: <strong>{bestShift.target.toLocaleString()}</strong> pcs</div>
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Awaiting shift production logs</div>
          )}
        </div>
      </div>

      {/* 3. NC PRESS VS TANDEM PRODUCTION COMPARISON */}
      <div className="card-panel" style={{ background: '#ffffff', borderRadius: 12, padding: '20px', border: '1px solid #E2E8F0', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart3 size={20} color="#1E88E5" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              NC Press vs Tandem Production Comparison ({selectedShift})
            </h3>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* NC Press Stats */}
          <div style={{ background: '#F8FAFC', padding: 18, borderRadius: 10, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Layers size={18} color="#2563EB" />
              <strong style={{ fontSize: '1rem', color: '#1E293B' }}>NC Presses (16 Units)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.84rem' }}>
              <span style={{ color: '#64748B' }}>Actual Output:</span>
              <strong style={{ color: '#2563EB', fontSize: '1.1rem' }}>{nc.actual.toLocaleString()} pcs</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.84rem' }}>
              <span style={{ color: '#64748B' }}>Shift Target:</span>
              <strong style={{ color: '#0F172A' }}>{nc.target.toLocaleString()} pcs</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.84rem' }}>
              <span style={{ color: '#64748B' }}>Achievement:</span>
              <strong style={{ color: nc.target > 0 && (nc.actual / nc.target) >= 0.85 ? '#059669' : '#D97706' }}>
                {nc.target > 0 ? Math.round((nc.actual / nc.target) * 100) : 0}%
              </strong>
            </div>
            <div style={{ height: 10, background: '#E2E8F0', borderRadius: 5, overflow: 'hidden', marginTop: 10 }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${nc.target > 0 ? Math.min(100, Math.round((nc.actual / nc.target) * 100)) : 0}%`, 
                  background: '#2563EB',
                  borderRadius: 5,
                  transition: 'width 0.4s'
                }} 
              />
            </div>
          </div>

          {/* Tandem Lines Stats */}
          <div style={{ background: '#F8FAFC', padding: 18, borderRadius: 10, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Cpu size={18} color="#059669" />
              <strong style={{ fontSize: '1rem', color: '#1E293B' }}>Tandem Lines (LP-1..2, HP-1..4)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.84rem' }}>
              <span style={{ color: '#64748B' }}>Actual Output:</span>
              <strong style={{ color: '#059669', fontSize: '1.1rem' }}>{tandem.actual.toLocaleString()} pcs</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.84rem' }}>
              <span style={{ color: '#64748B' }}>Shift Target:</span>
              <strong style={{ color: '#0F172A' }}>{tandem.target.toLocaleString()} pcs</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.84rem' }}>
              <span style={{ color: '#64748B' }}>Achievement:</span>
              <strong style={{ color: tandem.target > 0 && (tandem.actual / tandem.target) >= 0.85 ? '#059669' : '#D97706' }}>
                {tandem.target > 0 ? Math.round((tandem.actual / tandem.target) * 100) : 0}%
              </strong>
            </div>
            <div style={{ height: 10, background: '#E2E8F0', borderRadius: 5, overflow: 'hidden', marginTop: 10 }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${tandem.target > 0 ? Math.min(100, Math.round((tandem.actual / tandem.target) * 100)) : 0}%`, 
                  background: '#059669',
                  borderRadius: 5,
                  transition: 'width 0.4s'
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. HISTORICAL PRODUCTION TRENDS (WEEKLY & MONTHLY) */}
      <div className="card-panel" style={{ background: '#ffffff', borderRadius: 12, padding: '20px', border: '1px solid #E2E8F0', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={20} color="#1E88E5" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Plant Production Volume Trends
            </h3>
          </div>

          <div style={{ display: 'flex', background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
            <button
              onClick={() => setTrendView('weekly')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: trendView === 'weekly' ? '#ffffff' : 'transparent',
                color: trendView === 'weekly' ? '#0F172A' : '#64748B',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                boxShadow: trendView === 'weekly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Weekly Trend (7 Days)
            </button>
            <button
              onClick={() => setTrendView('monthly')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: trendView === 'monthly' ? '#ffffff' : 'transparent',
                color: trendView === 'monthly' ? '#0F172A' : '#64748B',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                boxShadow: trendView === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Monthly Trend (30 Days)
            </button>
          </div>
        </div>

        {trendView === 'weekly' ? (
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 14 }}>
              Blue bars represent Actual Output; Grey markers represent Production Target.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weekly.length || 7}, 1fr)`, gap: 12, alignItems: 'flex-end', height: 200, paddingBottom: 24, borderBottom: '1px solid #E2E8F0' }}>
              {weekly.map((w, idx) => {
                const actHeight = Math.round((w.actual / maxWeeklyVal) * 160);
                const tgtHeight = Math.round((w.target / maxWeeklyVal) * 160);
                const isSelected = w.date === selectedDate;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1E88E5', marginBottom: 4 }}>
                      {w.actual > 0 ? w.actual : ''}
                    </div>
                    <div style={{ width: '100%', maxWidth: 36, display: 'flex', gap: 3, alignItems: 'flex-end', justifyContent: 'center' }}>
                      {/* Target bar */}
                      <div 
                        title={`Target: ${w.target}`}
                        style={{ 
                          width: 8, 
                          height: `${Math.max(4, tgtHeight)}px`, 
                          background: '#CBD5E1', 
                          borderRadius: '3px 3px 0 0' 
                        }} 
                      />
                      {/* Actual bar */}
                      <div 
                        title={`Actual: ${w.actual}`}
                        style={{ 
                          width: 20, 
                          height: `${Math.max(4, actHeight)}px`, 
                          background: isSelected ? 'linear-gradient(180deg, #1E88E5 0%, #1565C0 100%)' : '#60A5FA', 
                          borderRadius: '4px 4px 0 0' 
                        }} 
                      />
                    </div>
                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: isSelected ? 800 : 600, color: isSelected ? '#1E88E5' : '#475569' }}>
                        {w.day}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: '#94A3B8' }}>{w.date.slice(5)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 14 }}>
              Daily production volume recorded across the past 30 operating days.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${monthly.length || 30}, 1fr)`, gap: 3, alignItems: 'flex-end', height: 180, paddingBottom: 20, borderBottom: '1px solid #E2E8F0' }}>
              {monthly.map((m, idx) => {
                const actHeight = Math.round((m.actual / maxMonthlyVal) * 140);
                const isSelected = m.date === selectedDate;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div 
                      title={`${m.date}: ${m.actual} pcs`}
                      style={{ 
                        width: '100%', 
                        height: `${Math.max(3, actHeight)}px`, 
                        background: isSelected ? '#1E88E5' : m.actual > 0 ? '#38BDF8' : '#F1F5F9', 
                        borderRadius: '2px 2px 0 0' 
                      }} 
                    />
                    <div style={{ marginTop: 6, fontSize: '0.62rem', color: isSelected ? '#1E88E5' : '#94A3B8' }}>
                      {m.day}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. PRODUCTION LOSS ANALYSIS (PARETO BREAKDOWN) */}
      <div className="card-panel" style={{ background: '#ffffff', borderRadius: 12, padding: '20px', border: '1px solid #E2E8F0', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={20} color="#DC2626" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Production Loss Analysis (Downtime Root Causes)
            </h3>
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#DC2626', background: '#FEE2E2', padding: '4px 10px', borderRadius: 20 }}>
            {totalLossMinutes} Total Lost Minutes Today
          </span>
        </div>

        {lossAnalysis.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', background: '#F8FAFC', borderRadius: 8, color: '#64748B', fontSize: '0.86rem' }}>
            No recorded downtime incidents for the selected date. Factory operating at zero recorded lost hours.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lossAnalysis.map((loss, idx) => {
              const pctOfLoss = totalLossMinutes > 0 ? Math.round((loss.total_minutes / totalLossMinutes) * 100) : 0;
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 100px 70px', alignItems: 'center', gap: 14, fontSize: '0.84rem' }}>
                  <div style={{ fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loss.downtime_reason}
                  </div>
                  <div style={{ height: 16, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${pctOfLoss}%`, 
                        background: 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)', 
                        borderRadius: 4 
                      }} 
                    />
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>
                    {loss.total_minutes} mins
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 800, color: '#64748B', fontSize: '0.78rem' }}>
                    {pctOfLoss}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. MACHINE UTILIZATION & RANKINGS TABLE */}
      <div className="card-panel" style={{ background: '#ffffff', borderRadius: 12, padding: '20px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sliders size={20} color="#0891B2" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Equipment Performance & Output Rankings
            </h3>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A', background: '#F1F5F9', padding: '4px 10px', borderRadius: 20 }}>
            {rankings.length} Machines Recorded
          </span>
        </div>

        {rankings.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', background: '#F8FAFC', borderRadius: 8, color: '#64748B', fontSize: '0.86rem' }}>
            No machine production records logged for the selected date.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Rank</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Machine / Line</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Type</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Actual Output</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Target</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Achievement %</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Downtime</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, idx) => {
                  const pct = r.achievement_pct || 0;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: idx === 0 ? '#16A34A' : '#64748B' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0F172A' }}>
                        {r.machine_or_line}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748B' }}>
                        {r.production_type}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#059669' }}>
                        {Number(r.actual).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        {Number(r.target).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          background: pct >= 90 ? '#ECFDF5' : pct >= 70 ? '#EFF6FF' : '#FEF2F2',
                          color: pct >= 90 ? '#065F46' : pct >= 70 ? '#1E40AF' : '#991B1B'
                        }}>
                          {pct}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: r.downtime > 0 ? 700 : 400, color: r.downtime > 0 ? '#DC2626' : '#64748B' }}>
                        {r.downtime > 0 ? `${r.downtime}m` : '0m'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
