import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  GitBranch, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  Activity, 
  X, 
  Search,
  Filter,
  RefreshCw,
  Cpu,
  User,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';

export default function StandardProductionEntry({ selectedDate, selectedShift, onSync, onSwitchToHourly }) {
  const [ncData, setNcData] = useState(null);
  const [tandemData, setTandemData] = useState(null);
  const [operatorsList, setOperatorsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Filters
  const [viewFilter, setViewFilter] = useState('ALL'); // 'ALL', 'NC', 'TANDEM'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Log Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalForm, setModalForm] = useState({
    production_type: 'NC',
    machine_or_line: 'NC-01',
    date: selectedDate || new Date().toISOString().split('T')[0],
    shift: selectedShift || 'Shift A',
    hour_interval: 'Hour 1 (06:00-07:00)',
    operator_name: '',
    tonnage: 1000,
    target_qty: 75,
    actual_qty: 70,
    good_qty: 68,
    rejected_qty: 2,
    downtime_minutes: 0,
    downtime_reason: '',
    remarks: ''
  });

  useEffect(() => {
    loadData();
    loadOperators();
  }, [selectedDate, selectedShift]);

  const loadOperators = async () => {
    try {
      const res = await api.getEmployees();
      const emps = res.employees || [];
      if (emps.length > 0) {
        setOperatorsList(emps.map(e => ({ id: e.emp_id, name: e.name, display: `${e.name} (${e.emp_id})` })));
      }
    } catch (e) {
      console.warn('Operator list fetch notice:', e);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [ncRes, tanRes] = await Promise.all([
        api.getNcProduction(selectedDate, selectedShift),
        api.getTandemProduction(selectedDate, selectedShift)
      ]);
      setNcData(ncRes);
      setTandemData(tanRes);
    } catch (err) {
      showNotice('error', err.message || 'Failed to load production records');
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenModal = (m, type) => {
    const isNC = type === 'NC';
    const defaultTarget = isNC ? 75 : 125;
    setModalForm({
      production_type: type,
      machine_or_line: m.machine_number || m.line_id,
      date: selectedDate,
      shift: selectedShift,
      hour_interval: 'Hour 1 (06:00-07:00)',
      operator_name: m.operator || (operatorsList[0]?.display || ''),
      tonnage: m.tonnage || (isNC ? 1000 : 1200),
      target_qty: m.hourly_target || defaultTarget,
      actual_qty: m.hourly_target || defaultTarget,
      good_qty: m.hourly_target || defaultTarget,
      rejected_qty: 0,
      downtime_minutes: 0,
      downtime_reason: '',
      remarks: ''
    });
    setShowModal(true);
  };

  const handleSaveProduction = async (e) => {
    e.preventDefault();
    try {
      if (modalForm.production_type === 'NC') {
        await api.saveNcProduction(modalForm);
      } else {
        await api.saveTandemProduction(modalForm);
      }
      showNotice('success', `Saved output for ${modalForm.machine_or_line} [${modalForm.hour_interval}]`);
      setShowModal(false);
      loadData();
      if (onSync) onSync();
    } catch (err) {
      showNotice('error', err.message || 'Failed to record production');
    }
  };

  const ncMatrix = ncData?.machine_matrix || [];
  const tandemMatrix = tandemData?.line_matrix || [];

  const combinedTarget = (ncData?.total_target || 0) + (tandemData?.total_target || 0);
  const combinedActual = (ncData?.total_actual || 0) + (tandemData?.total_actual || 0);
  const combinedGood = (ncData?.total_good || 0) + (tandemData?.total_good || 0);
  const combinedRej = (ncData?.total_rejected || 0) + (tandemData?.total_rejected || 0);
  const combinedDowntime = (ncData?.total_downtime || 0) + (tandemData?.total_downtime || 0);
  const combinedAchieve = combinedTarget > 0 ? Math.round((combinedActual / combinedTarget) * 100) : 0;

  // Filter machines
  const filteredNC = ncMatrix.filter(m => {
    if (viewFilter === 'TANDEM') return false;
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    if (searchQuery && !m.machine_number.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredTandem = tandemMatrix.filter(m => {
    if (viewFilter === 'NC') return false;
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    if (searchQuery && !m.line_id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ padding: '16px', background: '#f8fafc', minHeight: '100%' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 14,
          background: notification.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${notification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: notification.type === 'success' ? '#065f46' : '#991b1b',
          fontWeight: 700,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
        }}>
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Banner / Summary Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '16px 20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ 
                background: '#eff6ff', 
                color: '#1d4ed8', 
                padding: '4px 10px', 
                borderRadius: 6, 
                fontWeight: 800, 
                fontSize: '0.72rem',
                border: '1px solid #bfdbfe'
              }}>
                PAGE 1 • UNIFIED PRODUCTION
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Standard Production Entry (NC Presses & Tandem Lines)
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 3 }}>
              Unified shopfloor control for 16 NC Presses and 6 Tandem Lines • Shift: <strong>{selectedShift}</strong> • Date: <strong>{selectedDate}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={loadData}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            {onSwitchToHourly && (
              <button
                onClick={onSwitchToHourly}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: '#1e40af',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(30,64,175,0.2)'
                }}
              >
                <span>⚡ Hourly Entry</span>
              </button>
            )}
          </div>
        </div>

        {/* Plant KPI Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12
        }}>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Factory Target</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>{combinedTarget.toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>NC + Tandem</div>
          </div>

          <div style={{ background: '#eff6ff', padding: '10px 14px', borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Actual Output</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e40af' }}>{combinedActual.toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 700 }}>{combinedAchieve}% Achieved</div>
          </div>

          <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>NC Subtotal</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#166534' }}>{(ncData?.total_actual || 0).toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: '#15803d' }}>of {(ncData?.total_target || 0).toLocaleString()} target</div>
          </div>

          <div style={{ background: '#faf5ff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e9d5ff' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase' }}>Tandem Subtotal</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#6b21a8' }}>{(tandemData?.total_actual || 0).toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: '#7e22ce' }}>of {(tandemData?.total_target || 0).toLocaleString()} target</div>
          </div>

          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Quality Output</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>{combinedGood.toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: combinedRej > 0 ? '#dc2626' : '#16a34a' }}>
              {combinedRej} Rejects ({combinedActual > 0 ? ((combinedRej / combinedActual) * 100).toFixed(1) : 0}%)
            </div>
          </div>

          <div style={{ background: '#fffbeb', padding: '10px 14px', borderRadius: 8, border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Total Downtime</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#92400e' }}>{combinedDowntime} <span style={{ fontSize: '0.85rem' }}>min</span></div>
            <div style={{ fontSize: '0.7rem', color: '#b45309' }}>Logged events</div>
          </div>
        </div>
      </div>

      {/* Filter and View Control Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16
      }}>
        {/* Unit Type Switcher */}
        <div style={{ display: 'flex', background: '#e2e8f0', padding: 3, borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => setViewFilter('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: viewFilter === 'ALL' ? '#ffffff' : 'transparent',
              color: viewFilter === 'ALL' ? '#0f172a' : '#64748b',
              boxShadow: viewFilter === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            All 22 Machines
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('NC')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: viewFilter === 'NC' ? '#ffffff' : 'transparent',
              color: viewFilter === 'NC' ? '#1e40af' : '#64748b',
              boxShadow: viewFilter === 'NC' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            16 NC Presses
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('TANDEM')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: viewFilter === 'TANDEM' ? '#ffffff' : 'transparent',
              color: viewFilter === 'TANDEM' ? '#7e22ce' : '#64748b',
              boxShadow: viewFilter === 'TANDEM' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            6 Tandem Lines
          </button>
        </div>

        {/* Status Filter & Search */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#334155',
              background: '#ffffff'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="Running">Running</option>
            <option value="Idle">Idle</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Breakdown">Breakdown</option>
          </select>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search machine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px 6px 30px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                width: 150
              }}
            />
          </div>
        </div>
      </div>

      {/* SECTION 1: NC PRESS PRODUCTION (16 MACHINES) */}
      {(viewFilter === 'ALL' || viewFilter === 'NC') && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} color="#1e40af" />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                NC Machine Presses (16 Dedicated Positions)
              </h3>
              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 800 }}>
                {filteredNC.length} Units
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Standard stroke rate: 75 pcs/hr
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12
          }}>
            {filteredNC.map((m) => {
              const target = m.hourly_target || 75;
              const actual = m.total_actual || 0;
              const achieve = target > 0 ? Math.round((actual / target) * 100) : 0;
              const statusColor = m.status === 'Running' ? '#10b981' : m.status === 'Breakdown' ? '#ef4444' : m.status === 'Maintenance' ? '#f59e0b' : '#64748b';

              return (
                <div 
                  key={m.machine_number}
                  style={{
                    background: '#ffffff',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    padding: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{m.machine_number}</span>
                        <span style={{ fontSize: '0.7rem', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          {m.tonnage}T
                        </span>
                      </div>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: statusColor,
                        background: `${statusColor}15`,
                        padding: '2px 8px',
                        borderRadius: 12
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }}></span>
                        {m.status || 'Idle'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <User size={12} />
                      <span>{m.operator || 'Unassigned'}</span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, marginBottom: 3 }}>
                        <span style={{ color: '#64748b' }}>Actual: {actual} / {target}</span>
                        <span style={{ color: achieve >= 95 ? '#16a34a' : achieve >= 80 ? '#ca8a04' : '#dc2626' }}>{achieve}%</span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, achieve)}%`,
                          height: '100%',
                          background: achieve >= 95 ? '#10b981' : achieve >= 80 ? '#f59e0b' : '#ef4444',
                          borderRadius: 3
                        }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', background: '#f8fafc', padding: '6px 8px', borderRadius: 6, marginBottom: 10 }}>
                      <span>Good: <strong style={{ color: '#0f172a' }}>{m.total_good || 0}</strong></span>
                      <span>Scrap: <strong style={{ color: '#ef4444' }}>{m.total_rejected || 0}</strong></span>
                      <span>Downtime: <strong style={{ color: '#d97706' }}>{m.total_downtime || 0}m</strong></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenModal(m, 'NC')}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: 6,
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <Plus size={14} />
                    <span>Log Production</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: TANDEM PRODUCTION LINES (6 LINES) */}
      {(viewFilter === 'ALL' || viewFilter === 'TANDEM') && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitBranch size={18} color="#7e22ce" />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                Tandem Production (6 Dedicated Heavy Lines)
              </h3>
              <span style={{ background: '#f3e8ff', color: '#7e22ce', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 800 }}>
                {filteredTandem.length} Lines
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              LP-1, LP-2, HP-1, HP-2, HP-3, HP-4
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12
          }}>
            {filteredTandem.map((t) => {
              const target = t.hourly_target || 125;
              const actual = t.total_actual || 0;
              const achieve = target > 0 ? Math.round((actual / target) * 100) : 0;
              const statusColor = t.status === 'Running' ? '#10b981' : t.status === 'Breakdown' ? '#ef4444' : t.status === 'Maintenance' ? '#f59e0b' : '#64748b';

              return (
                <div 
                  key={t.line_id}
                  style={{
                    background: '#ffffff',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    padding: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#7e22ce' }}>{t.line_id}</span>
                        <span style={{ fontSize: '0.7rem', background: '#f5f3ff', color: '#6b21a8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          {t.tonnage}T
                        </span>
                      </div>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: statusColor,
                        background: `${statusColor}15`,
                        padding: '2px 8px',
                        borderRadius: 12
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }}></span>
                        {t.status || 'Idle'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <User size={12} />
                      <span>Line Lead: {t.line_lead || 'Assigned Lead'}</span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, marginBottom: 3 }}>
                        <span style={{ color: '#64748b' }}>Actual: {actual} / {target}</span>
                        <span style={{ color: achieve >= 95 ? '#16a34a' : achieve >= 80 ? '#ca8a04' : '#dc2626' }}>{achieve}%</span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, achieve)}%`,
                          height: '100%',
                          background: achieve >= 95 ? '#10b981' : achieve >= 80 ? '#f59e0b' : '#ef4444',
                          borderRadius: 3
                        }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', background: '#faf5ff', padding: '6px 8px', borderRadius: 6, marginBottom: 10 }}>
                      <span>Good: <strong style={{ color: '#0f172a' }}>{t.total_good || 0}</strong></span>
                      <span>Scrap: <strong style={{ color: '#ef4444' }}>{t.total_rejected || 0}</strong></span>
                      <span>Downtime: <strong style={{ color: '#d97706' }}>{t.total_downtime || 0}m</strong></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenModal(t, 'Tandem')}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: 6,
                      background: '#faf5ff',
                      color: '#7e22ce',
                      border: '1px solid #e9d5ff',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <Plus size={14} />
                    <span>Log Line Output</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Production Entry Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15,23,42,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: 16
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            width: '100%',
            maxWidth: 520,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '14px 18px',
              background: modalForm.production_type === 'NC' ? '#1e40af' : '#7e22ce',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={18} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>
                  Log Production — {modalForm.machine_or_line} ({modalForm.production_type})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduction} style={{ padding: '16px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Hour Interval
                  </label>
                  <select
                    value={modalForm.hour_interval}
                    onChange={(e) => setModalForm({ ...modalForm, hour_interval: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(h => (
                      <option key={h} value={`Hour ${h}`}>Hour {h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Operator Assigned
                  </label>
                  <select
                    value={modalForm.operator_name}
                    onChange={(e) => setModalForm({ ...modalForm, operator_name: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  >
                    {operatorsList.map(op => (
                      <option key={op.id} value={op.display}>{op.display}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Target Qty
                  </label>
                  <input
                    type="number"
                    value={modalForm.target_qty}
                    onChange={(e) => setModalForm({ ...modalForm, target_qty: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', display: 'block', marginBottom: 4 }}>
                    Actual Output
                  </label>
                  <input
                    type="number"
                    value={modalForm.actual_qty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setModalForm({ 
                        ...modalForm, 
                        actual_qty: val,
                        good_qty: Math.max(0, val - modalForm.rejected_qty)
                      });
                    }}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #3b82f6', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: 4 }}>
                    Rejections
                  </label>
                  <input
                    type="number"
                    value={modalForm.rejected_qty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setModalForm({ 
                        ...modalForm, 
                        rejected_qty: val,
                        good_qty: Math.max(0, modalForm.actual_qty - val)
                      });
                    }}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', display: 'block', marginBottom: 4 }}>
                    Downtime (min)
                  </label>
                  <input
                    type="number"
                    value={modalForm.downtime_minutes}
                    onChange={(e) => setModalForm({ ...modalForm, downtime_minutes: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Downtime Reason
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Die change, sensor fault"
                    value={modalForm.downtime_reason}
                    onChange={(e) => setModalForm({ ...modalForm, downtime_reason: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: 'none',
                    background: modalForm.production_type === 'NC' ? '#1e40af' : '#7e22ce',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  Save Output
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
