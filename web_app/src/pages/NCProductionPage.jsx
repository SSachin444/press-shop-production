import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2, 
  X, 
  Activity,
  Filter
} from 'lucide-react';
import { api } from '../api';

export default function NCProductionPage({ selectedDate, selectedShift, setActiveTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedMachineNum, setSelectedMachineNum] = useState('NC-01');

  const [form, setForm] = useState({
    machine_or_line: 'NC-01',
    date: selectedDate,
    shift: selectedShift,
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
    loadNCData();
  }, [selectedDate, selectedShift]);

  const loadNCData = async () => {
    try {
      setLoading(true);
      const res = await api.getNcProduction(selectedDate, selectedShift);
      setData(res);
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

  const handleSaveOutput = async (e) => {
    e.preventDefault();
    try {
      await api.saveNcProduction(form);
      showNotice('success', `Production recorded for ${form.machine_or_line} at ${form.hour_interval}`);
      setShowLogModal(false);
      loadNCData();
    } catch (err) {
      showNotice('error', err.message || 'Failed to save production');
    }
  };

  const openLogForMachine = (m) => {
    setForm({
      machine_or_line: m.machine_number,
      date: selectedDate,
      shift: selectedShift,
      hour_interval: 'Hour 1 (06:00-07:00)',
      operator_name: m.operator || '',
      tonnage: m.tonnage || 1000,
      target_qty: 75,
      actual_qty: 70,
      good_qty: 68,
      rejected_qty: 2,
      downtime_minutes: 0,
      downtime_reason: '',
      remarks: ''
    });
    setShowLogModal(true);
  };

  const machineMatrix = data?.machine_matrix || [];
  const hourlyEntries = data?.hourly_entries || [];

  return (
    <div className="page-container">
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          background: notification.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${notification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: notification.type === 'success' ? '#065f46' : '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 600
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header and Summary KPIs */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#7c3aed' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>NC Production Management (16 Machines)</h2>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.84rem', marginTop: 2 }}>
              Dedicated shopfloor tracking for all 16 NC machine units • Date: <strong style={{ color: '#1e40af' }}>{selectedDate}</strong> • Shift: <strong style={{ color: '#1e40af' }}>{selectedShift}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setForm({ ...form, date: selectedDate, shift: selectedShift });
                setShowLogModal(true);
              }}
            >
              <Plus size={16} />
              <span>Log NC Output</span>
            </button>
          </div>
        </div>

        {/* Aggregates Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginTop: 18 }}>
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>NC TARGET</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>{data?.total_target?.toLocaleString() || 0}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Scheduled pieces</div>
          </div>

          <div style={{ background: '#f5f3ff', padding: '12px 14px', borderRadius: 8, border: '1px solid #ddd6fe' }}>
            <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 600 }}>NC ACTUAL OUTPUT</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#6d28d9' }}>{data?.total_actual?.toLocaleString() || 0}</div>
            <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 600 }}>{data?.achievement_pct || 0}% Achievement</div>
          </div>

          <div style={{ background: '#ecfdf5', padding: '12px 14px', borderRadius: 8, border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>GOOD PARTS</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669' }}>{data?.total_good?.toLocaleString() || 0}</div>
            <div style={{ fontSize: '0.72rem', color: '#047857' }}>Passed Inspection</div>
          </div>

          <div style={{ background: '#fef2f2', padding: '12px 14px', borderRadius: 8, border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600 }}>REJECTED</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#dc2626' }}>{data?.total_rejected?.toLocaleString() || 0}</div>
            <div style={{ fontSize: '0.72rem', color: '#b91c1c' }}>{data?.rejection_pct || 0}% Rejection Rate</div>
          </div>

          <div style={{ background: '#fffbeb', padding: '12px 14px', borderRadius: 8, border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>NC DOWNTIME</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706' }}>{data?.total_downtime || 0}m</div>
            <div style={{ fontSize: '0.72rem', color: '#b45309' }}>Total lost minutes</div>
          </div>
        </div>
      </div>

      {/* ALL 16 NC MACHINE POSITIONS GRID */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Layers size={20} color="#7c3aed" />
              <span>All 16 NC Machine Units Overview</span>
            </div>
            <div className="panel-subtitle">Individual outputs, targets, and achievement rates</div>
          </div>
        </div>

        <div className="nc-grid">
          {machineMatrix.map((m) => {
            const hasData = m.actual > 0 || m.downtime_minutes > 0;
            return (
              <div 
                key={m.machine_number} 
                className="machine-card"
                style={{
                  borderTop: `4px solid ${m.achievement_pct >= 90 ? '#10b981' : m.achievement_pct > 0 ? '#3b82f6' : '#cbd5e1'}`
                }}
              >
                <div className="machine-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="machine-title">{m.machine_number}</span>
                      <span className="machine-tonnage">{m.tonnage}T</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Operator: {m.operator || 'Not Assigned'}
                    </div>
                  </div>
                  <span className={`status-badge ${m.status.toLowerCase()}`}>{m.status}</span>
                </div>

                {/* Numbers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', background: '#f8fafc', padding: 10, borderRadius: 6 }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>ACTUAL</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e40af' }}>{m.actual}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>TARGET</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 600 }}>{m.target}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>ACHIEVE</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: m.achievement_pct >= 85 ? '#059669' : m.achievement_pct > 0 ? '#2563eb' : '#64748b' }}>
                      {m.achievement_pct}%
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="machine-progress-bar">
                  <div 
                    className="machine-progress-fill" 
                    style={{ 
                      width: `${Math.min(100, m.achievement_pct)}%`,
                      backgroundColor: m.achievement_pct >= 90 ? '#10b981' : '#3b82f6'
                    }}
                  />
                </div>

                {/* Downtime & Rejects */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
                  <span>Good: <strong style={{ color: '#059669' }}>{m.good}</strong> | Rej: <strong style={{ color: m.rejected > 0 ? '#dc2626' : '#64748b' }}>{m.rejected}</strong></span>
                  <span>Downtime: <strong style={{ color: m.downtime_minutes > 0 ? '#dc2626' : '#64748b' }}>{m.downtime_minutes}m</strong></span>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {m.recorded_hours > 0 ? `${m.recorded_hours} hours logged` : 'No production logged yet'}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => openLogForMachine(m)}>
                    Log Output
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hourly Entry Log Table */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Clock size={20} color="#2563eb" />
              <span>NC Hourly Production Entries ({selectedShift})</span>
            </div>
            <div className="panel-subtitle">Detailed audit records from SQLite database</div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Machine</th>
                <th>Time Interval</th>
                <th>Operator</th>
                <th>Tonnage</th>
                <th>Target</th>
                <th>Actual</th>
                <th>Good</th>
                <th>Reject</th>
                <th>Downtime</th>
                <th>Reason / Remarks</th>
              </tr>
            </thead>
            <tbody>
              {hourlyEntries.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-state">
                    No hourly NC records recorded yet for {selectedDate} ({selectedShift}).
                  </td>
                </tr>
              ) : (
                hourlyEntries.map((rec) => (
                  <tr key={rec.id}>
                    <td><strong className="mono" style={{ color: '#7c3aed' }}>{rec.machine_or_line}</strong></td>
                    <td style={{ fontWeight: 600 }}>{rec.hour_interval}</td>
                    <td>{rec.operator_name || '--'}</td>
                    <td>{rec.tonnage}T</td>
                    <td>{rec.target_qty}</td>
                    <td><strong style={{ color: '#1e40af' }}>{rec.actual_qty}</strong></td>
                    <td style={{ color: '#059669', fontWeight: 600 }}>{rec.good_qty}</td>
                    <td style={{ color: rec.rejected_qty > 0 ? '#dc2626' : '#64748b' }}>{rec.rejected_qty}</td>
                    <td>{rec.downtime_minutes > 0 ? <strong style={{ color: '#dc2626' }}>{rec.downtime_minutes}m</strong> : '0m'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#475569' }}>
                      {rec.downtime_reason ? <div>⚠️ {rec.downtime_reason}</div> : null}
                      {rec.remarks ? <div>💬 {rec.remarks}</div> : null}
                      {!rec.downtime_reason && !rec.remarks ? '--' : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOG OUTPUT MODAL */}
      {showLogModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Record NC Press Production</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowLogModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveOutput}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">NC Machine Position *</label>
                    <select
                      className="form-select"
                      value={form.machine_or_line}
                      onChange={(e) => setForm({ ...form, machine_or_line: e.target.value })}
                    >
                      {machineMatrix.map((m) => (
                        <option key={m.machine_number} value={m.machine_number}>
                          {m.machine_number} ({m.tonnage}T)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Production Shift</label>
                    <select
                      className="form-select"
                      value={form.shift}
                      onChange={(e) => setForm({ ...form, shift: e.target.value })}
                    >
                      <option value="Shift A">Shift A</option>
                      <option value="Shift B">Shift B</option>
                      <option value="Shift C">Shift C</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Hour Interval *</label>
                    <select
                      className="form-select"
                      value={form.hour_interval}
                      onChange={(e) => setForm({ ...form, hour_interval: e.target.value })}
                    >
                      <option value="Hour 1 (06:00-07:00)">Hour 1 (06:00 - 07:00 / 14:30 - 15:30 / 23:00 - 00:00)</option>
                      <option value="Hour 2 (07:00-08:00)">Hour 2 (07:00 - 08:00 / 15:30 - 16:30 / 00:00 - 01:00)</option>
                      <option value="Hour 3 (08:00-09:00)">Hour 3 (08:00 - 09:00 / 16:30 - 17:30 / 01:00 - 02:00)</option>
                      <option value="Hour 4 (09:00-10:00)">Hour 4 (09:00 - 10:00 / 17:30 - 18:30 / 02:00 - 03:00)</option>
                      <option value="Hour 5 (10:00-11:00)">Hour 5 (10:00 - 11:00 / 18:30 - 19:30 / 03:00 - 04:00)</option>
                      <option value="Hour 6 (11:00-12:00)">Hour 6 (11:00 - 12:00 / 19:30 - 20:30 / 04:00 - 05:00)</option>
                      <option value="Hour 7 (12:00-13:00)">Hour 7 (12:00 - 13:00 / 20:30 - 21:30 / 05:00 - 06:00)</option>
                      <option value="Hour 8 (13:00-14:00)">Hour 8 (13:00 - 14:00 / 21:30 - 22:30 / Final)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Operator Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. S. Ajaykumar"
                      value={form.operator_name}
                      onChange={(e) => setForm({ ...form, operator_name: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Target</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.target_qty}
                      onChange={(e) => setForm({ ...form, target_qty: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Actual Output *</label>
                    <input
                      type="number"
                      className="form-input"
                      required
                      value={form.actual_qty}
                      onChange={(e) => {
                        const act = parseInt(e.target.value) || 0;
                        setForm({ ...form, actual_qty: act, good_qty: Math.max(0, act - form.rejected_qty) });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Good Qty</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.good_qty}
                      onChange={(e) => setForm({ ...form, good_qty: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rejections</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.rejected_qty}
                      onChange={(e) => {
                        const rej = parseInt(e.target.value) || 0;
                        setForm({ ...form, rejected_qty: rej, good_qty: Math.max(0, form.actual_qty - rej) });
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Downtime (Mins)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.downtime_minutes}
                      onChange={(e) => setForm({ ...form, downtime_minutes: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Downtime Reason</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Die adjustment / Coil change"
                      value={form.downtime_reason}
                      onChange={(e) => setForm({ ...form, downtime_reason: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Remarks / Batch ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Part #PA-9021 batch complete"
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLogModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save to Database</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
