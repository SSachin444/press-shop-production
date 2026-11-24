import React, { useState, useEffect } from 'react';
import { 
  Factory, 
  Layers, 
  GitBranch, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  TrendingUp,
  Percent,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  Calculator,
  Cpu,
  Wrench
} from 'lucide-react';
import { api } from '../api';

export default function StandardProductionEntry({ selectedDate, selectedShift = 'Shift A', onSync, onSelectMachineSummary }) {
  const activeDate = selectedDate || new Date().toISOString().split('T')[0];

  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterShift, setFilterShift] = useState(selectedShift || 'ALL');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'NC' | 'Tandem'
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadOverallProduction();
  }, [activeDate, filterShift]);

  const loadOverallProduction = async () => {
    try {
      setLoading(true);
      const res = await api.getOverallProductionSummary(activeDate, filterShift);
      setSummaryData(res);
    } catch (err) {
      console.warn('Failed to calculate overall production:', err);
      showNotice('error', 'Failed to load automatic overall production records.');
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const shifts = summaryData?.shifts || {
    'Shift A': { actual: 0, target: 0, achievement_pct: 0, downtime_minutes: 0 },
    'Shift B': { actual: 0, target: 0, achievement_pct: 0, downtime_minutes: 0 },
    'Shift C': { actual: 0, target: 0, achievement_pct: 0, downtime_minutes: 0 }
  };

  const rawMachines = summaryData?.machines || [];
  const filteredMachines = rawMachines.filter(m => {
    const matchesType = filterType === 'ALL' || m.machine_type === filterType;
    const matchesSearch = !searchQuery || 
      m.machine_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.operator && m.operator.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.tool_number && m.tool_number.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const totalActual = summaryData?.total_actual || 0;
  const totalTarget = summaryData?.total_target || 0;
  const totalDowntime = summaryData?.total_downtime_minutes || 0;
  const overallPct = summaryData?.achievement_pct || 0;

  return (
    <div style={{ padding: '16px', background: '#f8fafc', minHeight: '100%', color: '#0f172a' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 14,
          background: notification.type === 'success' ? '#f0fdf4' : '#fff7ed',
          border: `1px solid ${notification.type === 'success' ? '#bbf7d0' : '#fed7aa'}`,
          color: notification.type === 'success' ? '#15803d' : '#c2410c',
          fontWeight: 700,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
        }}>
          {notification.type === 'success' ? <CheckCircle2 size={18} color="#16a34a" /> : <AlertTriangle size={18} color="#ea580c" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '16px 20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ 
                background: '#16a34a', 
                color: '#ffffff', 
                padding: '4px 10px', 
                borderRadius: 6, 
                fontWeight: 900, 
                fontSize: '0.72rem',
                letterSpacing: '0.05em'
              }}>
                AUTOMATIC AGGREGATION
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Overall Production Dashboard
              </h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
              Zero manual overall inputs. All shift-wise, daily, and plant totals are calculated dynamically from verified hourly entries.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#0f172a', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 6, fontWeight: 700 }}>
              📅 {activeDate}
            </span>
            <button
              onClick={loadOverallProduction}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 6,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Calculation</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3-SHIFT PERFORMANCE COMPARISON CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14,
        marginBottom: 18
      }}>
        {['Shift A', 'Shift B', 'Shift C'].map(s => {
          const shiftData = shifts[s] || { actual: 0, target: 0, achievement_pct: 0, downtime_minutes: 0 };
          const isCurrentSelected = filterShift === s;
          const pct = shiftData.achievement_pct;
          const pctColor = pct >= 85 ? '#16a34a' : (pct > 0 ? '#ea580c' : '#64748b');

          return (
            <div
              key={s}
              onClick={() => setFilterShift(filterShift === s ? 'ALL' : s)}
              style={{
                background: '#ffffff',
                padding: '16px 18px',
                borderRadius: 12,
                border: isCurrentSelected ? '2px solid #ea580c' : '1px solid #e2e8f0',
                boxShadow: isCurrentSelected ? '0 4px 12px rgba(234, 88, 12, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0f172a' }}>{s} Production</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  background: isCurrentSelected ? '#ea580c' : '#f1f5f9',
                  color: isCurrentSelected ? '#ffffff' : '#64748b'
                }}>
                  {isCurrentSelected ? 'FILTERED' : 'CLICK TO FILTER'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>
                  {shiftData.actual.toLocaleString()}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  / {shiftData.target.toLocaleString()} pcs
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                <span style={{ color: '#64748b' }}>Achievement:</span>
                <strong style={{ color: pctColor, fontSize: '0.9rem' }}>{pct}%</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: '0.74rem', color: '#64748b' }}>
                <span>Downtime Recorded:</span>
                <span style={{ color: shiftData.downtime_minutes > 0 ? '#ea580c' : '#16a34a', fontWeight: 700 }}>
                  {shiftData.downtime_minutes} min
                </span>
              </div>
            </div>
          );
        })}

        {/* Total Daily Card */}
        <div style={{
          background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
          color: '#ffffff',
          padding: '16px 18px',
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
              Total Daily Production (All Machines)
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: 4 }}>
              {totalActual.toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.85, fontWeight: 600 }}>pcs</span>
            </div>
            <div style={{ fontSize: '0.76rem', opacity: 0.9, marginTop: 2 }}>
              Target: {totalTarget.toLocaleString()} units • Downtime: {totalDowntime} min
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <span style={{ fontSize: '0.76rem', opacity: 0.9 }}>Total Achievement:</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, background: 'rgba(255,255,255,0.25)', padding: '2px 10px', borderRadius: 6 }}>
              {overallPct}%
            </span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH STRIP */}
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '14px 18px',
        border: '1px solid #e2e8f0',
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>Filter Shift:</span>
          {['ALL', 'Shift A', 'Shift B', 'Shift C'].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterShift(s)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: filterShift === s ? '2px solid #ea580c' : '1px solid #cbd5e1',
                background: filterShift === s ? '#fff7ed' : '#ffffff',
                color: filterShift === s ? '#ea580c' : '#475569',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {s}
            </button>
          ))}

          <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />

          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>Type:</span>
          {['ALL', 'NC', 'Tandem'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: filterType === t ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: filterType === t ? '#f0fdf4' : '#ffffff',
                color: filterType === t ? '#16a34a' : '#475569',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search machine, tool, operator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px 7px 32px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem'
            }}
          />
        </div>
      </div>

      {/* MACHINE-WISE OVERALL PRODUCTION TABLE */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Machine-wise Production Consolidation ({filteredMachines.length} Units)
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
              Aggregated directly from saved hourly records for {activeDate} ({filterShift}). No duplicate counts.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '12px 14px', fontWeight: 800 }}>Machine Number</th>
                <th style={{ padding: '12px 14px', fontWeight: 800 }}>Type & Tonnage</th>
                <th style={{ padding: '12px 14px', fontWeight: 800 }}>Operator Assigned</th>
                <th style={{ padding: '12px 14px', fontWeight: 800 }}>Active Tool</th>
                <th style={{ padding: '12px 14px', fontWeight: 800 }}>Target Output</th>
                <th style={{ padding: '12px 14px', fontWeight: 800 }}>Actual Produced</th>
                <th style={{ padding: '12px 14px', fontWeight: 800 }}>Achievement %</th>
                <th style={{ padding: '12px 14px', fontWeight: 800 }}>Downtime</th>
                <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredMachines.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    No machines match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredMachines.map(m => {
                  const pct = m.achievement_pct;
                  const pctColor = pct >= 85 ? '#16a34a' : (pct > 0 ? '#ea580c' : '#64748b');

                  return (
                    <tr key={m.machine_number} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 14px', fontWeight: 900, color: '#0f172a' }}>
                        {m.machine_number}
                      </td>
                      <td style={{ padding: '11px 14px', color: '#475569' }}>
                        {m.machine_type} • {m.tonnage}T
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={13} color="#ea580c" />
                          <span style={{ fontWeight: 600 }}>{m.operator || 'Line Operator'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', fontFamily: 'monospace', color: '#475569' }}>
                        {m.tool_number || 'TL-1001'}
                      </td>
                      <td style={{ padding: '11px 14px', fontWeight: 800, color: '#475569' }}>
                        {m.target.toLocaleString()} pcs
                      </td>
                      <td style={{ padding: '11px 14px', fontWeight: 900, color: m.actual > 0 ? '#16a34a' : '#64748b' }}>
                        {m.actual.toLocaleString()} pcs
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: 6,
                          fontWeight: 900,
                          fontSize: '0.78rem',
                          background: pct >= 85 ? '#dcfce7' : (pct > 0 ? '#ffedd5' : '#f1f5f9'),
                          color: pctColor
                        }}>
                          {pct}%
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: m.downtime_minutes > 0 ? '#ea580c' : '#16a34a', fontWeight: 700 }}>
                        {m.downtime_minutes} min
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => onSelectMachineSummary && onSelectMachineSummary(m.machine_number)}
                          style={{
                            background: '#fff7ed',
                            border: '1px solid #fed7aa',
                            color: '#c2410c',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span>Summary</span>
                          <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
