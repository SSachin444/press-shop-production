import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Filter, 
  User, 
  Wrench,
  CheckCircle2,
  Hourglass
} from 'lucide-react';
import { api } from '../api';

export default function ShiftHandoverPage({ selectedDate, selectedShift, currentUser }) {
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [notification, setNotification] = useState(null);

  // Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedHandover, setSelectedHandover] = useState(null);

  const [form, setForm] = useState({
    date: selectedDate,
    outgoing_shift: selectedShift || 'Shift A',
    incoming_shift: selectedShift === 'Shift A' ? 'Shift B' : selectedShift === 'Shift B' ? 'Shift C' : 'Shift A',
    department_or_machine: 'NC Press Line (NC-01 to NC-08)',
    handover_notes: '',
    production_status: 'Scheduled quota 90% completed',
    pending_work: 'Die inspection for next shift batch',
    machine_problems: 'No major mechanical alarms',
    downtime_info: '10 min coil feed sensor cleaning',
    quality_issues: 'All sample parts cleared QA gauge test',
    follow_up_actions: 'Check hydraulic oil pressure at start of shift',
    responsible_person: currentUser?.full_name || 'Shift Supervisor',
    completion_status: 'Open'
  });

  const [statusUpdateForm, setStatusUpdateForm] = useState({
    completion_status: 'Resolved',
    follow_up_actions: '',
    responsible_person: ''
  });

  useEffect(() => {
    loadHandovers();
  }, [selectedDate, statusFilter]);

  const loadHandovers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.getHandovers(params);
      setHandovers(res.handovers || []);
    } catch (err) {
      showNotice('error', err.message || 'Failed to load shift handovers');
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createHandover(form);
      showNotice('success', 'Shift handover note recorded in persistent database!');
      setShowAddModal(false);
      resetForm();
      loadHandovers();
    } catch (err) {
      showNotice('error', err.message || 'Failed to create handover note');
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    try {
      await api.updateHandover(selectedHandover.id, statusUpdateForm);
      showNotice('success', `Handover #${selectedHandover.id} status updated to ${statusUpdateForm.completion_status}`);
      setShowStatusModal(false);
      loadHandovers();
    } catch (err) {
      showNotice('error', err.message);
    }
  };

  const openStatusUpdate = (h) => {
    setSelectedHandover(h);
    setStatusUpdateForm({
      completion_status: h.completion_status,
      follow_up_actions: h.follow_up_actions || '',
      responsible_person: currentUser?.full_name || h.responsible_person
    });
    setShowStatusModal(true);
  };

  const resetForm = () => {
    setForm({
      date: selectedDate,
      outgoing_shift: selectedShift || 'Shift A',
      incoming_shift: selectedShift === 'Shift A' ? 'Shift B' : selectedShift === 'Shift B' ? 'Shift C' : 'Shift A',
      department_or_machine: 'NC Press Line (NC-01 to NC-08)',
      handover_notes: '',
      production_status: '',
      pending_work: '',
      machine_problems: '',
      downtime_info: '',
      quality_issues: '',
      follow_up_actions: '',
      responsible_person: currentUser?.full_name || 'Shift Supervisor',
      completion_status: 'Open'
    });
  };

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
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MessageSquare size={22} color="#ea580c" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Shift Handover & Operations Communication</h2>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.84rem', marginTop: 2 }}>
              Permanent cross-shift notes, machine issues, pending work orders, and action item resolution
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 150 }}
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In-Progress">In-Progress</option>
              <option value="Resolved">Resolved</option>
            </select>

            <button 
              className="btn btn-primary"
              onClick={() => { resetForm(); setShowAddModal(true); }}
            >
              <Plus size={16} />
              <span>Record Shift Handover</span>
            </button>
          </div>
        </div>
      </div>

      {/* Handover Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div className="card-panel" style={{ textAlign: 'center', padding: 40 }}>Loading handovers...</div>
        ) : handovers.length === 0 ? (
          <div className="card-panel empty-state">No shift handovers logged for this filter.</div>
        ) : (
          handovers.map((h) => (
            <div 
              key={h.id} 
              className="card-panel" 
              style={{
                borderLeft: `5px solid ${h.completion_status === 'Resolved' ? '#10b981' : h.completion_status === 'In-Progress' ? '#f59e0b' : '#ea580c'}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    {h.department_or_machine}
                  </span>
                  <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1e40af', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>
                    {h.outgoing_shift} ➔ {h.incoming_shift}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Date: {h.date}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`status-badge ${h.completion_status === 'Resolved' ? 'running' : h.completion_status === 'In-Progress' ? 'maintenance' : 'breakdown'}`}>
                    {h.completion_status}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => openStatusUpdate(h)}>
                    Update Status
                  </button>
                </div>
              </div>

              {/* Handover note */}
              <div style={{ fontSize: '0.92rem', color: '#1e293b', marginBottom: 14, fontWeight: 500, lineHeight: 1.6 }}>
                "{h.handover_notes}"
              </div>

              {/* Detail Items Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Production Status</span>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{h.production_status || '--'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Pending Work</span>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{h.pending_work || '--'}</div>
                </div>
                <div>
                  <span style={{ color: '#b91c1c', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Machine Issues / Downtime</span>
                  <div style={{ fontWeight: 600, color: '#b91c1c', marginTop: 2 }}>{h.machine_problems || h.downtime_info || 'None'}</div>
                </div>
                <div>
                  <span style={{ color: '#047857', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Follow-up Action / Person</span>
                  <div style={{ fontWeight: 600, color: '#047857', marginTop: 2 }}>{h.follow_up_actions || '--'} ({h.responsible_person})</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE HANDOVER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Record Shift Handover Note</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Outgoing Shift *</label>
                    <select
                      className="form-select"
                      value={form.outgoing_shift}
                      onChange={(e) => setForm({ ...form, outgoing_shift: e.target.value })}
                    >
                      <option value="Shift A">Shift A</option>
                      <option value="Shift B">Shift B</option>
                      <option value="Shift C">Shift C</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Incoming Shift *</label>
                    <select
                      className="form-select"
                      value={form.incoming_shift}
                      onChange={(e) => setForm({ ...form, incoming_shift: e.target.value })}
                    >
                      <option value="Shift A">Shift A</option>
                      <option value="Shift B">Shift B</option>
                      <option value="Shift C">Shift C</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Department / Unit *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. NC Press Line (NC-01 to NC-16) or Tandem LP-1"
                    value={form.department_or_machine}
                    onChange={(e) => setForm({ ...form, department_or_machine: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Handover Notes *</label>
                  <textarea
                    rows="3"
                    className="form-textarea"
                    required
                    placeholder="Key operational details for the incoming shift supervisor..."
                    value={form.handover_notes}
                    onChange={(e) => setForm({ ...form, handover_notes: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Production Status</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 850 pcs completed against 900 target"
                      value={form.production_status}
                      onChange={(e) => setForm({ ...form, production_status: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pending Work / Orders</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Die swap for Part #PA-9021"
                      value={form.pending_work}
                      onChange={(e) => setForm({ ...form, pending_work: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Machine Problems / Downtime</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. NC-03 feeder sensor checked"
                      value={form.machine_problems}
                      onChange={(e) => setForm({ ...form, machine_problems: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quality Issues</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Burr check performed on samples"
                      value={form.quality_issues}
                      onChange={(e) => setForm({ ...form, quality_issues: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Follow-Up Action Required</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Verify hydraulic pressure after warm-up"
                      value={form.follow_up_actions}
                      onChange={(e) => setForm({ ...form, follow_up_actions: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Responsible Person</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.responsible_person}
                      onChange={(e) => setForm({ ...form, responsible_person: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Handover</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      {showStatusModal && selectedHandover && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Update Handover #{selectedHandover.id}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowStatusModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleUpdateStatus}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Completion Status</label>
                  <select
                    className="form-select"
                    value={statusUpdateForm.completion_status}
                    onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, completion_status: e.target.value })}
                  >
                    <option value="Open">Open</option>
                    <option value="In-Progress">In-Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Follow-up Notes / Resolution Actions</label>
                  <textarea
                    rows="3"
                    className="form-textarea"
                    placeholder="Describe actions taken to address handover points..."
                    value={statusUpdateForm.follow_up_actions}
                    onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, follow_up_actions: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Responsible Sign-off Person</label>
                  <input
                    type="text"
                    className="form-input"
                    value={statusUpdateForm.responsible_person}
                    onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, responsible_person: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Handover</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
