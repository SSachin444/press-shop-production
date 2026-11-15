import React, { useState, useEffect } from 'react';
import { 
  Layers, 
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
  BarChart2
} from 'lucide-react';
import { api } from '../api';

export default function NCProductionPage({ selectedDate, selectedShift = 'Shift A', setActiveTab }) {
  const [data, setData] = useState(null);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Filters
  const [activeDate, setActiveDate] = useState(selectedDate || new Date().toISOString().split('T')[0]);
  const [activeShift, setActiveShift] = useState(selectedShift);
  const [selectedMachineFilter, setSelectedMachineFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('machines'); // 'machines' | 'tools' | 'operators' | 'shifts' | 'hourly'
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Log Modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [modalForm, setModalForm] = useState({
    machine_or_line: 'NC-01',
    production_type: 'NC',
    date: activeDate,
    shift: activeShift,
    hour_interval: 'Hour 1 (08:00 - 09:00)',
    tool_number: '',
    operator_name: '',
    target_qty: 75,
    actual_qty: 70,
    good_qty: 68,
    rejected_qty: 2,
    downtime_minutes: 0,
    downtime_reason: '',
    remarks: ''
  });

  const ncMachines = Array.from({ length: 16 }, (_, i) => `NC-${String(i + 1).padStart(2, '0')}`);

  useEffect(() => {
    loadData();
  }, [activeDate, activeShift]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ncRes, recRes] = await Promise.all([
        api.getNcProduction(activeDate, activeShift),
        api.getProductionRecords({ date: activeDate, shift: activeShift, type: 'NC' })
      ]);
      setData(ncRes);
      setAllRecords(recRes.records || []);
    } catch (err) {
      showNotice('error', err.message || 'Failed to load NC production');
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenLog = (mNumber) => {
    setModalForm({
      machine_or_line: mNumber,
      production_type: 'NC',
      date: activeDate,
      shift: activeShift,
      hour_interval: 'Hour 1 (08:00 - 09:00)',
      tool_number: '',
      operator_name: '',
      target_qty: 75,
      actual_qty: 75,
      good_qty: 75,
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
      showNotice('error', err.message || 'Failed to save NC entry');
    }
  };

  const machineMatrix = data?.machine_matrix || [];
  const totalTarget = data?.total_target || 0;
  const totalActual = data?.total_actual || 0;
  const totalGood = data?.total_good || 0;
  const totalRej = data?.total_rejected || 0;
  const totalDowntime = data?.total_downtime || 0;
  const achievePct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  // Filtered machine cards
  const filteredMachines = machineMatrix.filter(m => {
    if (selectedMachineFilter !== 'ALL' && m.machine_number !== selectedMachineFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchNum = m.machine_number?.toLowerCase().includes(q);
      const matchOp = m.operator?.toLowerCase().includes(q);
      if (!matchNum && !matchOp) return false;
    }
    return true;
  });

  // Group by Tool Number
  const toolAgg = {};
  allRecords.forEach(r => {
    const t = r.tool_number || 'Unspecified Tool';
    if (!toolAgg[t]) toolAgg[t] = { tool: t, actual: 0, target: 0, good: 0, rejected: 0, machines: new Set() };
    toolAgg[t].actual += r.actual_qty || 0;
    toolAgg[t].target += r.target_qty || 0;
    toolAgg[t].good += r.good_qty || 0;
    toolAgg[t].rejected += r.rejected_qty || 0;
    toolAgg[t].machines.add(r.machine_or_line);
  });
  const toolList = Object.values(toolAgg).map(t => ({
    ...t,
    machineList: Array.from(t.machines).join(', '),
    achievePct: t.target > 0 ? Math.round((t.actual / t.target) * 100) : 0
  }));

  // Group by Operator
  const opAgg = {};
  allRecords.forEach(r => {
    const op = r.operator_name || 'Unassigned';
    if (!opAgg[op]) opAgg[op] = { operator: op, actual: 0, target: 0, machines: new Set() };
    opAgg[op].actual += r.actual_qty || 0;
    opAgg[op].target += r.target_qty || 0;
    opAgg[op].machines.add(r.machine_or_line);
  });
  const opList = Object.values(opAgg).map(o => ({
    ...o,
    machineList: Array.from(o.machines).join(', '),
    achievePct: o.target > 0 ? Math.round((o.actual / o.target) * 100) : 0
  }));

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
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>
                  NC FLEET
                </span>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  16 ADVANCED PRESS UNITS (NC-01 TO NC-16)
                </span>
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '2px 0 0' }}>
                NC Press Production Management
              </h1>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
            {[
              { id: 'machines', label: '16 Machines' },
              { id: 'tools', label: 'Tool-Wise' },
              { id: 'operators', label: 'Operator-Wise' },
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
                  color: viewMode === tab.id ? '#1e40af' : '#64748b',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b' }}>Machine:</span>
            <select
              value={selectedMachineFilter}
              onChange={(e) => setSelectedMachineFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#fff' }}
            >
              <option value="ALL">All 16 NC Units</option>
              {ncMachines.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search NC machine or operator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
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

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>NC Fleet Target</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px' }}>{totalTarget.toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Combined shift quota</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Actual Production</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e40af', margin: '4px 0 2px' }}>{totalActual.toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700 }}>{achievePct}% Fleet Achievement</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Good Parts</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#059669', margin: '4px 0 2px' }}>{totalGood.toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: '#059669' }}>Passed quality inspection</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>NC Scrap</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#dc2626', margin: '4px 0 2px' }}>{totalRej.toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: '#dc2626' }}>Defects recorded</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>NC Downtime</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ea580c', margin: '4px 0 2px' }}>{totalDowntime}m</div>
          <div style={{ fontSize: '0.72rem', color: '#ea580c' }}>Lost machine minutes</div>
        </div>
      </div>

      {/* ── VIEW 1: 16 NC MACHINE CARDS & TABLE ── */}
      {viewMode === 'machines' && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 24
          }}>
            {filteredMachines.map(m => {
              const ach = m.production_target > 0 ? Math.round((m.actual_production / m.production_target) * 100) : 0;
              return (
                <div
                  key={m.machine_number}
                  style={{
                    background: '#ffffff',
                    borderRadius: 12,
                    padding: '16px 18px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a' }}>{m.machine_number}</span>
                      {getStatusBadge(m.status)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 10 }}>
                      Tonnage: <strong>{m.tonnage}T</strong> • Operator: <strong>{m.operator || 'Unassigned'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1e40af' }}>
                        {m.actual_production} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>/ {m.production_target}</span>
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: ach >= 95 ? '#ecfdf5' : '#fffbeb',
                        color: ach >= 95 ? '#059669' : '#d97706'
                      }}>
                        {ach}% Target
                      </span>
                    </div>

                    <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, ach)}%`, height: '100%', background: '#2563eb' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Downtime: {m.downtime || 0}m</span>
                    <button
                      type="button"
                      onClick={() => handleOpenLog(m.machine_number)}
                      style={{
                        background: '#eff6ff',
                        color: '#1e40af',
                        border: '1px solid #bfdbfe',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      + Log Output
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── VIEW 2: TOOL-WISE PRODUCTION ── */}
      {viewMode === 'tools' && (
        <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>NC Tool / Die Production Matrix</h3>
            <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0' }}>Output aggregated per active tool die for {activeDate} ({activeShift})</p>
          </div>
          {toolList.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>No tool-specific output logged for this date.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Tool / Die #</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Assigned Machines</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Target</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Actual Output</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Good</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Scrap</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Achievement</th>
                  </tr>
                </thead>
                <tbody>
                  {toolList.map(t => (
                    <tr key={t.tool} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#1e40af' }}>{t.tool}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{t.machineList}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.target}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>{t.actual}</td>
                      <td style={{ padding: '10px 14px', color: '#059669' }}>{t.good}</td>
                      <td style={{ padding: '10px 14px', color: '#dc2626' }}>{t.rejected}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontWeight: 800, fontSize: '0.72rem', background: t.achievePct >= 95 ? '#ecfdf5' : '#fffbeb', color: t.achievePct >= 95 ? '#059669' : '#d97706' }}>
                          {t.achievePct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 3: OPERATOR-WISE PRODUCTION ── */}
      {viewMode === 'operators' && (
        <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>NC Operator Allocation & Output</h3>
            <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0' }}>Operator performance across 16 NC units for {activeDate} ({activeShift})</p>
          </div>
          {opList.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>No operator production logged yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Operator Name</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Machines Manned</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Total Target</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Total Output</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Achievement</th>
                  </tr>
                </thead>
                <tbody>
                  {opList.map(o => (
                    <tr key={o.operator} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>{o.operator}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{o.machineList}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{o.target}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#1e40af' }}>{o.actual}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontWeight: 800, fontSize: '0.72rem', background: o.achievePct >= 95 ? '#ecfdf5' : '#fffbeb', color: o.achievePct >= 95 ? '#059669' : '#d97706' }}>
                          {o.achievePct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 4: HOURLY STREAM ── */}
      {viewMode === 'hourly' && (
        <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>NC Hourly Stream Records</h3>
          </div>
          {allRecords.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>No hourly production records for NC machines on this date.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>ID</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>NC Machine</th>
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
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#1e40af' }}>{r.machine_or_line}</td>
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
            <div style={{ background: '#1e40af', padding: '16px 20px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Log NC Output — {modalForm.machine_or_line}</div>
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
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1e40af', display: 'block', marginBottom: 4 }}>Actual Output</label>
                  <input
                    type="number"
                    value={modalForm.actual_qty}
                    onChange={(e) => setModalForm({ ...modalForm, actual_qty: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '2px solid #2563eb', fontSize: '0.85rem', fontWeight: 800 }}
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
                <button type="submit" style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#1e40af', color: '#fff', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>Save Output</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
