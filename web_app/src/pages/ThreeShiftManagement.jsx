import React, { useState, useEffect } from 'react';
import { 
  Repeat, 
  Calendar, 
  Users, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  BarChart, 
  Activity,
  Layers,
  Cpu
} from 'lucide-react';
import { api } from '../api';

export default function ThreeShiftManagement({ selectedDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadShiftComparison();
  }, [selectedDate]);

  const loadShiftComparison = async () => {
    try {
      setLoading(true);
      const res = await api.getShiftComparison(selectedDate);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load shift comparison data');
    } finally {
      setLoading(false);
    }
  };

  const shifts = data?.shifts || {};
  const dailyTotals = data?.daily_totals || { target: 0, actual: 0, good: 0, rejected: 0, downtime_minutes: 0, achievement_pct: 0, rejection_pct: 0 };

  const shiftInfo = {
    'Shift A': { 
      time: '08:00 AM - 04:30 PM', 
      breaks: 'Tea: 10:00-10:10 AM | Lunch: 12:00-12:30 PM | Tea: 03:00-03:10 PM',
      color: '#1e40af', 
      bg: '#eff6ff', 
      border: '#bfdbfe' 
    },
    'Shift B': { 
      time: '04:30 PM - 01:00 AM', 
      breaks: 'Tea: 06:30-06:40 PM | Dinner: 08:30-09:00 PM | Tea: 11:00-11:10 PM',
      color: '#0891b2', 
      bg: '#ecfeff', 
      border: '#a5f3fc' 
    },
    'Shift C': { 
      time: '01:00 AM - 08:00 AM', 
      breaks: 'Tea: 01:30-01:40 AM | Lunch: 03:00-03:30 AM | Tea: 06:00-06:10 AM',
      color: '#7c3aed', 
      bg: '#faf5ff', 
      border: '#ddd6fe' 
    }
  };

  return (
    <div className="page-container">
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: 8, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#059669' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Three-Shift Management & Cross-Shift Comparison</h2>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.84rem', marginTop: 2 }}>
              Independent data persistence for Shift A, Shift B, and Shift C • Date: <strong style={{ color: '#1e40af' }}>{selectedDate}</strong>
            </p>
          </div>
        </div>

        {/* Combined Daily Production Totals */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 18 }}>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>DAY TOTAL TARGET</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{dailyTotals.target.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Combined 3 shifts</div>
          </div>

          <div style={{ background: '#eff6ff', padding: '14px', borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 600 }}>DAY ACTUAL OUTPUT</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e40af' }}>{dailyTotals.actual.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 600 }}>{dailyTotals.achievement_pct}% Day Achievement</div>
          </div>

          <div style={{ background: '#ecfdf5', padding: '14px', borderRadius: 8, border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>GOOD PRODUCTION</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>{dailyTotals.good.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#047857' }}>Quality certified</div>
          </div>

          <div style={{ background: '#fef2f2', padding: '14px', borderRadius: 8, border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600 }}>DAY REJECTIONS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>{dailyTotals.rejected.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#b91c1c' }}>{dailyTotals.rejection_pct}% Scrap Rate</div>
          </div>

          <div style={{ background: '#fffbeb', padding: '14px', borderRadius: 8, border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>DAY TOTAL DOWNTIME</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>{dailyTotals.downtime_minutes}m</div>
            <div style={{ fontSize: '0.72rem', color: '#b45309' }}>Plant stoppages</div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Shift Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {['Shift A', 'Shift B', 'Shift C'].map((sName) => {
          const s = shifts[sName] || { target: 0, actual: 0, good: 0, rejected: 0, downtime: 0, achievement_pct: 0, rejection_pct: 0, manpower_present: 0, nc_actual: 0, tandem_actual: 0, active_machines_lines: 0 };
          const info = shiftInfo[sName];

          return (
            <div 
              key={sName} 
              className="card-panel" 
              style={{ 
                borderTop: `5px solid ${info.color}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 14 
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{sName}</h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={13} />
                    <span>{info.time}</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#047857', marginTop: 3, fontWeight: 600 }}>
                    {info.breaks}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>MANPOWER</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={16} />
                    <span>{s.manpower_present} present</span>
                  </div>
                </div>
              </div>

              {/* Main numbers */}
              <div style={{ background: info.bg, border: `1px solid ${info.border}`, borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 700 }}>SHIFT ACTUAL OUTPUT</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: info.color }}>
                  {s.actual.toLocaleString()} <span style={{ fontSize: '1rem', color: '#64748b' }}>/ {s.target.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: s.achievement_pct >= 85 ? '#059669' : '#d97706', marginTop: 2 }}>
                  {s.achievement_pct}% Target Achievement
                </div>
              </div>

              {/* NC vs Tandem Output in this Shift */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.84rem' }}>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.74rem' }}>NC Press Output</div>
                  <strong style={{ fontSize: '1.05rem', color: '#7c3aed' }}>{s.nc_actual.toLocaleString()}</strong> pcs
                </div>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.74rem' }}>Tandem Lines Output</div>
                  <strong style={{ fontSize: '1.05rem', color: '#0891b2' }}>{s.tandem_actual.toLocaleString()}</strong> pcs
                </div>
              </div>

              {/* Breakdown metrics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.84rem', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Good Production:</span>
                  <strong style={{ color: '#059669' }}>{s.good.toLocaleString()} pcs</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Rejections / Scrap:</span>
                  <strong style={{ color: s.rejected > 0 ? '#dc2626' : '#64748b' }}>{s.rejected.toLocaleString()} pcs ({s.rejection_pct}%)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Recorded Downtime:</span>
                  <strong style={{ color: s.downtime > 0 ? '#dc2626' : '#64748b' }}>{s.downtime} mins</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Active Units in Shift:</span>
                  <strong>{s.active_machines_lines} presses/lines</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cross-Shift Matrix Table */}
      <div className="card-panel">
        <div className="panel-header">
          <div className="panel-title">
            <Repeat size={18} color="#2563eb" />
            <span>Shift-to-Shift Comparative Analysis</span>
          </div>
          <div className="panel-subtitle">Audited side-by-side performance indicators</div>
        </div>

        <div className="table-responsive">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Shift Identifier</th>
                <th>Working Hours</th>
                <th>Manpower</th>
                <th>Target Output</th>
                <th>Actual Output</th>
                <th>NC Output</th>
                <th>Tandem Output</th>
                <th>Good Parts</th>
                <th>Rejection %</th>
                <th>Downtime (m)</th>
                <th>Achievement %</th>
              </tr>
            </thead>
            <tbody>
              {['Shift A', 'Shift B', 'Shift C'].map((sName) => {
                const s = shifts[sName] || { target: 0, actual: 0, good: 0, rejected: 0, downtime: 0, achievement_pct: 0, rejection_pct: 0, manpower_present: 0, nc_actual: 0, tandem_actual: 0 };
                const info = shiftInfo[sName];
                return (
                  <tr key={sName}>
                    <td><strong style={{ color: info.color }}>{sName}</strong></td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{info.time}</td>
                    <td><strong>{s.manpower_present}</strong></td>
                    <td>{s.target.toLocaleString()}</td>
                    <td><strong style={{ color: info.color }}>{s.actual.toLocaleString()}</strong></td>
                    <td>{s.nc_actual.toLocaleString()}</td>
                    <td>{s.tandem_actual.toLocaleString()}</td>
                    <td style={{ color: '#059669', fontWeight: 600 }}>{s.good.toLocaleString()}</td>
                    <td style={{ color: s.rejection_pct > 2 ? '#dc2626' : '#475569' }}>{s.rejection_pct}%</td>
                    <td style={{ color: s.downtime > 0 ? '#dc2626' : '#64748b' }}>{s.downtime}m</td>
                    <td>
                      <span className={`status-badge ${s.achievement_pct >= 90 ? 'running' : s.achievement_pct > 0 ? 'idle' : 'breakdown'}`}>
                        {s.achievement_pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Daily Total Row */}
              <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                <td>COMBINED DAY TOTAL</td>
                <td>24 Hours</td>
                <td>--</td>
                <td>{dailyTotals.target.toLocaleString()}</td>
                <td style={{ color: '#1e40af', fontSize: '1rem' }}>{dailyTotals.actual.toLocaleString()}</td>
                <td colSpan="2">Full Plant Output</td>
                <td style={{ color: '#059669' }}>{dailyTotals.good.toLocaleString()}</td>
                <td>{dailyTotals.rejection_pct}%</td>
                <td>{dailyTotals.downtime_minutes}m</td>
                <td>
                  <span className={`status-badge ${dailyTotals.achievement_pct >= 90 ? 'running' : 'idle'}`}>
                    {dailyTotals.achievement_pct}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
