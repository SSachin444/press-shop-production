import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Cpu, 
  Calendar, 
  Clock, 
  User, 
  Filter, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Plus, 
  RefreshCw, 
  Check, 
  X,
  ArrowRight,
  ShieldAlert,
  BarChart2,
  Gauge
} from 'lucide-react';
import { api } from '../api';

export default function TandemProductionPage({ selectedDate, selectedShift = 'Shift A', setActiveTab }) {
  const [data, setData] = useState(null);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Filters
  const [activeDate, setActiveDate] = useState(selectedDate || new Date().toISOString().split('T')[0]);
  const [activeShift, setActiveShift] = useState(selectedShift);
  const [selectedLineFilter, setSelectedLineFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('lines'); // 'lines' | 'hourly' | 'shifts' | 'operators' | 'performance'
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Log Modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [modalForm, setModalForm] = useState({
    machine_or_line: 'LP-1',
    production_type: 'Tandem',
    date: activeDate,
    shift: activeShift,
    hour_interval: 'Hour 1 (08:00 - 09:00)',
    tool_number: '',
    operator_name: '',
    target_qty: 125,
    actual_qty: 120,
    good_qty: 118,
    rejected_qty: 2,
    downtime_minutes: 0,
    downtime_reason: '',
    remarks: ''
  });

  const tandemLines = [
    { id: 'LP-1', name: 'LP-1 Line', tonnage: 1200, defaultTarget: 800, category: 'Low Pressure' },
    { id: 'LP-2', name: 'LP-2 Line', tonnage: 1200, defaultTarget: 800, category: 'Low Pressure' },
    { id: 'HP-1', name: 'HP-1 Line', tonnage: 1600, defaultTarget: 1000, category: 'High Pressure' },
    { id: 'HP-2', name: 'HP-2 Line', tonnage: 1600, defaultTarget: 1000, category: 'High Pressure' },
    { id: 'HP-3', name: 'HP-3 Line', tonnage: 2000, defaultTarget: 1200, category: 'Heavy Stamping' },
    { id: 'HP-4', name: 'HP-4 Line', tonnage: 2000, defaultTarget: 1200, category: 'Heavy Stamping' }
  ];

  useEffect(() => {
    loadData();
  }, [activeDate, activeShift]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tanRes, recRes] = await Promise.all([
        api.getTandemProduction(activeDate, activeShift),
        api.getProductionRecords({ date: activeDate, shift: activeShift, type: 'Tandem' })
      ]);
      setData(tanRes);
      setAllRecords(recRes.records || []);
    } catch (err) {
      showNotice('error', err.message || 'Failed to load Tandem production');
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenLog = (lineId) => {
    const lineConf = tandemLines.find(l => l.id === lineId) || tandemLines[0];
    setModalForm({
      machine_or_line: lineId,
      production_type: 'Tandem',
      date: activeDate,
      shift: activeShift,
      hour_interval: 'Hour 1 (08:00 - 09:00)',
      tool_number: '',
      operator_name: '',
      target_qty: Math.round(lineConf.defaultTarget / 8),
      actual_qty: Math.round(lineConf.defaultTarget / 8),
      good_qty: Math.round(lineConf.defaultTarget / 8),
      rejected_qty: 0,
      downtime_minutes: 0,
      downtime_reason: '',
      remarks: ''
    });
    setShowLogModal(true);
  };

  const handleSaveLog = async (e) => {
    e.preventDefault();
    try {
      await api.saveProductionRecord(modalForm);
      showNotice('success', `Logged output for ${modalForm.machine_or_line}`);
      setShowLogModal(false);
      loadData();
    } catch (err) {
      showNotice('error', err.message || 'Failed to save Tandem entry');
    }
  };

  const lineMatrix = data?.line_matrix || [];
  const totalTarget = data?.total_target || 0;
  const totalActual = data?.total_actual || 0;
  const totalGood = data?.total_good || 0;
  const totalRej = data?.total_rejected || 0;
  const totalDowntime = data?.total_downtime || 0;
  const achievePct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  // Map 6 Lines with live database values
  const sixLinesData = tandemLines.map(def => {
    const live = lineMatrix.find(m => m.line_id === def.id || m.machine_number === def.id) || {};
    const actual = live.actual_production || 0;
    const target = live.production_target || def.defaultTarget;
    const ach = target > 0 ? Math.round((actual / target) * 100) : 0;
    return {
      ...def,
      actual,
      target,
      achievePct: ach,
      operator: live.operator || 'Unassigned',
      status: live.status || 'Idle',
      downtime: live.downtime || 0
    };
  });

  const getStatusBadge = (status) => {
    const s = (status || 'Idle').toUpperCase();
    if (s === 'RUNNING') {
      return <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800 }}>RUNNING</span>;
    }
    if (s === 'BREAKDOWN') {
      return <span style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800 }}>BREAKDOWN</span>;
    }
    if (s === 'MAINTENANCE') {
      return <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800 }}>MAINTENANCE</span>;
    }
    return <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800 }}>IDLE</span>;
  };

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '20px 24px 80px', background: '#f8fafc' }}>
      
      {/* Toast Notice */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 16,
          background: notification.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${notification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: notification.type === 'success' ? '#065f46' : '#991b1b',
          fontWeight: 700,
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
        }}>
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        padding: '20px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GitBranch size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>
                  TANDEM LINES
                </span>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  LP-1, LP-2, HP-1, HP-2, HP-3, HP-4 INDEPENDENT MANAGEMENT
                </span>
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '2px 0 0' }}>
                Tandem Line Production Management
              </h1>
            </div>
          </div>

          {/* Sub Navigation */}
          <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
            {[
              { id: 'lines', label: '6 Line Cards' },
              { id: 'performance', label: 'Performance Comparison' },
              { id: 'hourly', label: 'Hourly Stream' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: viewMode === tab.id ? '#ffffff' : 'transparent',
                  color: viewMode === tab.id ? '#7c3aed' : '#64748b',
                  fontWeight: viewMode === tab.id ? 800 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b' }}>Date:</span>
            <input
              type="date"
              value={activeDate}
              onChange={(e) => setActiveDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b' }}>Shift:</span>
            <select
              value={activeShift}
              onChange={(e) => setActiveShift(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#fff' }}
            >
              <option value="Shift A">Shift A (08:00 - 16:30)</option>
              <option value="Shift B">Shift B (16:30 - 01:00)</option>
              <option value="Shift C">Shift C (01:00 - 08:00)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={loadData}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Tandem Target</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px' }}>{totalTarget.toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>6 Lines combined quota</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Actual Output</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7c3aed', margin: '4px 0 2px' }}>{totalActual.toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700 }}>{achievePct}% Fleet Achievement</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Quality Good</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#059669', margin: '4px 0 2px' }}>{totalGood.toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: '#059669' }}>Passed QA standards</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Scrap Units</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#dc2626', margin: '4px 0 2px' }}>{totalRej.toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: '#dc2626' }}>Total defective parts</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Downtime</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ea580c', margin: '4px 0 2px' }}>{totalDowntime}m</div>
          <div style={{ fontSize: '0.72rem', color: '#ea580c' }}>Lost line minutes</div>
        </div>
      </div>

      {/* ── 6 ATTRACTIVE PRODUCTION CARDS (LP-1 to HP-4) ── */}
      {viewMode === 'lines' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 18,
          marginBottom: 24
        }}>
          {sixLinesData.map(line => (
            <div
              key={line.id}
              style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: '20px 22px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.9rem' }}>
                      {line.id}
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a' }}>{line.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{line.category} • {line.tonnage} Tons</div>
                    </div>
                  </div>
                  {getStatusBadge(line.status)}
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, margin: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b' }}>PRODUCTION OUTPUT</span>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: line.achievePct >= 95 ? '#ecfdf5' : '#fffbeb',
                      color: line.achievePct >= 95 ? '#059669' : '#d97706'
                    }}>
                      {line.achievePct}% Target
                    </span>
                  </div>

                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#7c3aed', letterSpacing: -0.5 }}>
                    {line.actual.toLocaleString()} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>/ {line.target.toLocaleString()} pcs</span>
                  </div>

                  <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, line.achievePct)}%`, height: '100%', background: '#7c3aed' }} />
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                  <span>Assigned Operator: <strong>{line.operator}</strong></span>
                  <span>Downtime: <strong>{line.downtime}m</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => handleOpenLog(line.id)}
                  style={{
                    background: '#7c3aed',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Plus size={14} />
                  <span>Log {line.id} Output</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── VIEW 2: LINE PERFORMANCE COMPARISON ── */}
      {viewMode === 'performance' && (
        <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              6 Tandem Lines Performance Benchmarking ({activeShift} on {activeDate})
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Line ID</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Line Name</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Tonnage</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Operator</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Target</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Actual Output</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Achievement</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sixLinesData.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#7c3aed' }}>{l.id}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{l.name}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{l.tonnage} T</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>{l.operator}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{l.target}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>{l.actual}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontWeight: 800, fontSize: '0.72rem', background: l.achievePct >= 95 ? '#ecfdf5' : '#fffbeb', color: l.achievePct >= 95 ? '#059669' : '#d97706' }}>
                        {l.achievePct}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{getStatusBadge(l.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VIEW 3: HOURLY STREAM ── */}
      {viewMode === 'hourly' && (
        <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Tandem Hourly Production Stream</h3>
          </div>
          {allRecords.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>No hourly records for Tandem lines on this date.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>ID</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Tandem Line</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Interval</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Tool #</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Operator</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Target</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Actual</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Downtime</th>
                  </tr>
                </thead>
                <tbody>
                  {allRecords.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>#{r.id}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#7c3aed' }}>{r.machine_or_line}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{r.hour_interval}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.tool_number || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>{r.operator_name || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.target_qty}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>{r.actual_qty}</td>
                      <td style={{ padding: '10px 14px', color: r.downtime_minutes > 0 ? '#dc2626' : '#64748b' }}>{r.downtime_minutes}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quick Log Modal */}
      {showLogModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: 16
        }}>
          <div style={{ background: '#ffffff', borderRadius: 12, width: '100%', maxWidth: 460, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#7c3aed', padding: '16px 20px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Log Tandem Output — {modalForm.machine_or_line}</div>
              <button type="button" onClick={() => setShowLogModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveLog} style={{ padding: '18px 20px' }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Hour Interval</label>
                <select
                  value={modalForm.hour_interval}
                  onChange={(e) => setModalForm({ ...modalForm, hour_interval: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(h => (
                    <option key={h} value={`Hour ${h}`}>Hour {h}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Target Qty</label>
                  <input
                    type="number"
                    value={modalForm.target_qty}
                    onChange={(e) => setModalForm({ ...modalForm, target_qty: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#7c3aed', display: 'block', marginBottom: 4 }}>Actual Output</label>
                  <input
                    type="number"
                    value={modalForm.actual_qty}
                    onChange={(e) => setModalForm({ ...modalForm, actual_qty: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '2px solid #7c3aed', fontSize: '0.85rem', fontWeight: 800 }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Operator Name</label>
                <input
                  type="text"
                  placeholder="Operator name"
                  value={modalForm.operator_name}
                  onChange={(e) => setModalForm({ ...modalForm, operator_name: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setShowLogModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>Save Output</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
