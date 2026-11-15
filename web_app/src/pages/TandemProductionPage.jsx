import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  Activity, 
  X,
  Cpu
} from 'lucide-react';
import { api } from '../api';

export default function TandemProductionPage({ selectedDate, selectedShift, setActiveTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [form, setForm] = useState({
    machine_or_line: 'LP-1',
    date: selectedDate,
    shift: selectedShift,
    hour_interval: 'Hour 1 (06:00-07:00)',
    operator_name: '',
    tonnage: 1200,
    target_qty: 100,
    actual_qty: 95,
    good_qty: 92,
    rejected_qty: 3,
    downtime_minutes: 0,
    downtime_reason: '',
    remarks: ''
  });

  useEffect(() => {
    loadTandemData();
  }, [selectedDate, selectedShift]);

  const loadTandemData = async () => {
    try {
      setLoading(true);
      const res = await api.getTandemProduction(selectedDate, selectedShift);
      setData(res);
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

  const handleSaveOutput = async (e) => {
    e.preventDefault();
    try {
      await api.saveTandemProduction(form);
      showNotice('success', `Tandem production logged for ${form.machine_or_line} at ${form.hour_interval}`);
      setShowLogModal(false);
      loadTandemData();
    } catch (err) {
      showNotice('error', err.message || 'Failed to save Tandem production');
    }
  };

  const openLogForLine = (line) => {
    setForm({
      machine_or_line: line.line_number,
      date: selectedDate,
      shift: selectedShift,
      hour_interval: 'Hour 1 (06:00-07:00)',
      operator_name: line.operator || '',
      tonnage: line.tonnage || 1200,
      target_qty: 100,
      actual_qty: 95,
      good_qty: 92,
      rejected_qty: 3,
      downtime_minutes: 0,
      downtime_reason: '',
      remarks: ''
    });
    setShowLogModal(true);
  };

  const lineMatrix = data?.line_matrix || [];
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

      {/* Header and Aggregate KPIs */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#0891b2' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Tandem Production Management (6 Dedicated Lines)</h2>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.84rem', marginTop: 2 }}>
              Independent performance tracking for: <strong>LP-1, LP-2, HP-1, HP-2, HP-3, HP-4</strong> • Date: <strong style={{ color: '#1e40af' }}>{selectedDate}</strong> • Shift: <strong style={{ color: '#1e40af' }}>{selectedShift}</strong>
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
              <span>Log Tandem Output</span>
            </button>
          </div>
        </div>

        {/* Aggregates */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginTop: 18 }}>
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>TANDEM TARGET</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>{data?.total_target?.toLocaleString() || 0}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Scheduled pieces</div>
          </div>

          <div style={{ background: '#ecfeff', padding: '12px 14px', borderRadius: 8, border: '1px solid #a5f3fc' }}>
            <div style={{ fontSize: '0.72rem', color: '#0891b2', fontWeight: 600 }}>TANDEM ACTUAL OUTPUT</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0e7490' }}>{data?.total_actual?.toLocaleString() || 0}</div>
            <div style={{ fontSize: '0.72rem', color: '#0891b2', fontWeight: 600 }}>{data?.achievement_pct || 0}% Achievement</div>
          </div>

          <div style={{ background: '#ecfdf5', padding: '12px 14px', borderRadius: 8, border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>GOOD PARTS</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669' }}>{data?.total_good?.toLocaleString() || 0}</div>
            <div style={{ fontSize: '0.72rem', color: '#047857' }}>Quality Passed</div>
          </div>

          <div style={{ background: '#fef2f2', padding: '12px 14px', borderRadius: 8, border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600 }}>REJECTED</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#dc2626' }}>{data?.total_rejected?.toLocaleString() || 0}</div>
            <div style={{ fontSize: '0.72rem', color: '#b91c1c' }}>{data?.rejection_pct || 0}% Rejection Rate</div>
          </div>

          <div style={{ background: '#fffbeb', padding: '12px 14px', borderRadius: 8, border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>TANDEM DOWNTIME</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706' }}>{data?.total_downtime || 0}m</div>
            <div style={{ fontSize: '0.72rem', color: '#b45309' }}>Total lost minutes</div>
          </div>
        </div>
      </div>

      {/* 6 INDIVIDUAL TANDEM LINES DISPLAY */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Cpu size={20} color="#0891b2" />
              <span>All 6 Tandem Lines Performance Cards</span>
            </div>
            <div className="panel-subtitle">Individual performance metrics for each designated tandem line</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          {lineMatrix.map((line) => {
            const isHighTonnage = line.line_number.startsWith('HP');
            return (
              <div 
                key={line.line_number} 
                className="machine-card"
                style={{
                  borderTop: `4px solid ${line.achievement_pct >= 90 ? '#10b981' : line.achievement_pct > 0 ? '#0891b2' : '#cbd5e1'}`
                }}
              >
                <div className="machine-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="machine-title" style={{ fontSize: '1.3rem' }}>{line.line_number}</span>
                      <span className="machine-tonnage" style={{ background: isHighTonnage ? '#e0f2fe' : '#f1f5f9', color: isHighTonnage ? '#0369a1' : '#334155' }}>
                        {line.tonnage} Tons {isHighTonnage ? '(Heavy Press)' : '(Low Press)'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                      Assigned Operator / Team: <strong>{line.operator || 'Assigned Crew'}</strong>
                    </div>
                  </div>
                  <span className={`status-badge ${line.status.toLowerCase()}`}>{line.status}</span>
                </div>

                {/* Performance stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>ACTUAL</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0891b2' }}>{line.actual}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>TARGET</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{line.target}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>ACHIEVE</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: line.achievement_pct >= 85 ? '#059669' : line.achievement_pct > 0 ? '#0284c7' : '#64748b' }}>
                      {line.achievement_pct}%
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="machine-progress-bar">
                  <div 
                    className="machine-progress-fill" 
                    style={{ 
                      width: `${Math.min(100, line.achievement_pct)}%`,
                      backgroundColor: line.achievement_pct >= 90 ? '#10b981' : '#0891b2'
                    }}
                  />
                </div>

                {/* Good / Reject / Downtime */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569' }}>
                  <span>Good: <strong style={{ color: '#059669' }}>{line.good}</strong> | Rej: <strong style={{ color: line.rejected > 0 ? '#dc2626' : '#64748b' }}>{line.rejected}</strong></span>
                  <span>Downtime: <strong style={{ color: line.downtime_minutes > 0 ? '#dc2626' : '#64748b' }}>{line.downtime_minutes}m</strong></span>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    {line.recorded_hours > 0 ? `${line.recorded_hours} hourly cycles logged` : 'No production logged yet'}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => openLogForLine(line)}>
                    Log Line Output
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hourly Entry Audit Table */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Clock size={20} color="#0891b2" />
              <span>Tandem Line Hourly Production Log ({selectedShift})</span>
            </div>
            <div className="panel-subtitle">Audited shopfloor entries from database</div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Tandem Line</th>
                <th>Time Interval</th>
                <th>Crew / Operator</th>
                <th>Tonnage</th>
                <th>Target</th>
                <th>Actual</th>
                <th>Good</th>
                <th>Reject</th>
                <th>Downtime</th>
                <th>Downtime Reason / Remarks</th>
              </tr>
            </thead>
            <tbody>
              {hourlyEntries.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-state">
                    No hourly Tandem records logged yet for {selectedDate} ({selectedShift}).
                  </td>
                </tr>
              ) : (
                hourlyEntries.map((rec) => (
                  <tr key={rec.id}>
                    <td><strong className="mono" style={{ color: '#0891b2', fontSize: '0.95rem' }}>{rec.machine_or_line}</strong></td>
                    <td style={{ fontWeight: 600 }}>{rec.hour_interval}</td>
                    <td>{rec.operator_name || '--'}</td>
                    <td>{rec.tonnage}T</td>
                    <td>{rec.target_qty}</td>
                    <td><strong style={{ color: '#0891b2' }}>{rec.actual_qty}</strong></td>
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

      {/* LOG TANDEM MODAL */}
      {showLogModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Record Tandem Line Production</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowLogModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveOutput}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Tandem Line Number *</label>
                    <select
                      className="form-select"
                      value={form.machine_or_line}
                      onChange={(e) => setForm({ ...form, machine_or_line: e.target.value })}
                    >
                      {lineMatrix.map((l) => (
                        <option key={l.line_number} value={l.line_number}>
                          {l.line_number} ({l.tonnage}T)
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
                    <label className="form-label">Operator / Line Crew Lead</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. K. Selvam"
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
                      placeholder="e.g. Robot transfer feeder sensor error"
                      value={form.downtime_reason}
                      onChange={(e) => setForm({ ...form, downtime_reason: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Remarks</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. HP-1 running door outer panel batch"
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
