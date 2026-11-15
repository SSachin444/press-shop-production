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
  Hourglass,
  RefreshCw,
  Search,
  Check,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { api } from '../api';

export default function ShiftHandoverPage({ selectedDate, selectedShift, currentUser }) {
  const activeDate = selectedDate || new Date().toISOString().split('T')[0];
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedHandover, setSelectedHandover] = useState(null);

  const [form, setForm] = useState({
    date: activeDate,
    outgoing_shift: selectedShift || 'Shift A',
    incoming_shift: selectedShift === 'Shift A' ? 'Shift B' : (selectedShift === 'Shift B' ? 'Shift C' : 'Shift A'),
    department_or_machine: 'Press Shop MFG-2 (NC + Tandem)',
    production_status: '',
    pending_work: '',
    machine_problems: '',
    downtime_info: '', // Tool Problems
    quality_issues: '',
    follow_up_actions: '', // Maintenance Requirements
    handover_notes: '', // Important Instructions
    responsible_person: currentUser?.full_name || 'Shift Supervisor',
    completion_status: 'Open'
  });

  const [statusUpdateForm, setStatusUpdateForm] = useState({
    completion_status: 'Resolved',
    follow_up_actions: '',
    responsible_person: currentUser?.full_name || 'Shift Supervisor'
  });

  useEffect(() => {
    loadHandovers();
  }, [selectedDate, statusFilter]);

  const loadHandovers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
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

  const resetForm = () => {
    setForm({
      date: activeDate,
      outgoing_shift: selectedShift || 'Shift A',
      incoming_shift: selectedShift === 'Shift A' ? 'Shift B' : (selectedShift === 'Shift B' ? 'Shift C' : 'Shift A'),
      department_or_machine: 'Press Shop MFG-2 (NC + Tandem)',
      production_status: '',
      pending_work: '',
      machine_problems: '',
      downtime_info: '',
      quality_issues: '',
      follow_up_actions: '',
      handover_notes: '',
      responsible_person: currentUser?.full_name || 'Shift Supervisor',
      completion_status: 'Open'
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createHandover(form);
      showNotice('success', 'Digital shift handover submitted successfully!');
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
      showNotice('success', `Handover #${selectedHandover.id} marked as ${statusUpdateForm.completion_status}`);
      setShowStatusModal(false);
      loadHandovers();
    } catch (err) {
      showNotice('error', err.message || 'Failed to update handover');
    }
  };

  const openStatusModal = (h) => {
    setSelectedHandover(h);
    setStatusUpdateForm({
      completion_status: h.completion_status === 'Open' ? 'In-Progress' : 'Resolved',
      follow_up_actions: h.follow_up_actions || '',
      responsible_person: currentUser?.full_name || h.responsible_person
    });
    setShowStatusModal(true);
  };

  const filteredHandovers = handovers.filter(h => {
    if (search) {
      const q = search.toLowerCase();
      const matchDep = h.department_or_machine?.toLowerCase().includes(q);
      const matchPerson = h.responsible_person?.toLowerCase().includes(q);
      const matchNotes = h.handover_notes?.toLowerCase().includes(q);
      if (!matchDep && !matchPerson && !matchNotes) return false;
    }
    return true;
  });

  const openCount = handovers.filter(h => h.completion_status === 'Open').length;
  const inProgressCount = handovers.filter(h => h.completion_status === 'In-Progress').length;
  const resolvedCount = handovers.filter(h => h.completion_status === 'Resolved').length;

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
              <MessageSquare size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>
                  SUPERVISOR LOG
                </span>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  DIGITAL INTER-SHIFT HANDOVER
                </span>
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '2px 0 0' }}>
                Shift Handover Management
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => { resetForm(); setShowAddModal(true); }}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
              }}
            >
              <Plus size={16} />
              <span>Submit Shift Handover</span>
            </button>
          </div>
        </div>

        {/* Counter Pills & Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fffbeb', border: '1px solid #fde68a', padding: '6px 12px', borderRadius: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#b45309' }}>{openCount} Open Action Items</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eff6ff', border: '1px solid #bfdbfe', padding: '6px 12px', borderRadius: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e40af' }}>{inProgressCount} In Progress</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 12px', borderRadius: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#047857' }}>{resolvedCount} Resolved</span>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', background: '#fff' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Open">Open Only</option>
              <option value="In-Progress">In-Progress Only</option>
              <option value="Resolved">Resolved Only</option>
            </select>

            <div style={{ position: 'relative' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search instructions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '6px 10px 6px 28px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', width: 170 }}
              />
            </div>

            <button
              type="button"
              onClick={loadHandovers}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Handover Cards List */}
      {filteredHandovers.length === 0 ? (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: '60px 20px', textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
          <MessageSquare size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
          <div style={{ fontWeight: 800, color: '#475569', fontSize: '1rem' }}>No Shift Handovers Found</div>
          <div style={{ fontSize: '0.76rem', marginTop: 4 }}>
            Click "Submit Shift Handover" to record instructions and pending tasks for the next incoming shift.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredHandovers.map(h => (
            <div
              key={h.id}
              style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: '20px 22px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                    {h.outgoing_shift} → {h.incoming_shift}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>• Date: {h.date}</span>
                  <span style={{ fontSize: '0.76rem', color: '#1e40af', fontWeight: 700 }}>• {h.department_or_machine}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    background: h.completion_status === 'Resolved' ? '#ecfdf5' : (h.completion_status === 'In-Progress' ? '#eff6ff' : '#fffbeb'),
                    color: h.completion_status === 'Resolved' ? '#047857' : (h.completion_status === 'In-Progress' ? '#1e40af' : '#b45309'),
                    border: `1px solid ${h.completion_status === 'Resolved' ? '#a7f3d0' : (h.completion_status === 'In-Progress' ? '#bfdbfe' : '#fde68a')}`
                  }}>
                    {h.completion_status || 'Open'}
                  </span>

                  <button
                    type="button"
                    onClick={() => openStatusModal(h)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    Update Status
                  </button>
                </div>
              </div>

              {/* Handover Details 4-Column Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, background: '#f8fafc', padding: '14px', borderRadius: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Production Completed</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{h.production_status || '—'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>Pending Production</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b45309', marginTop: 2 }}>{h.pending_work || '—'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>Machine / Tool Problems</div>
                  <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: 2 }}>{h.machine_problems || h.downtime_info || 'None reported'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Quality & Maintenance</div>
                  <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: 2 }}>{h.quality_issues || h.follow_up_actions || 'Normal'}</div>
                </div>
              </div>

              {/* Important Instructions Box */}
              {h.handover_notes && (
                <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: '0.8rem', color: '#1e3a8a', marginBottom: 8 }}>
                  <strong>Important Instructions:</strong> {h.handover_notes}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#64748b' }}>
                <span>Handover Supervisor: <strong style={{ color: '#0f172a' }}>{h.responsible_person}</strong></span>
                <span>Submitted at {h.created_at || 'Shift Change'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SUBMIT HANDOVER MODAL ── */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#1e40af', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Submit Shift Handover Form</div>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Outgoing Shift *</label>
                  <select
                    value={form.outgoing_shift}
                    onChange={(e) => setForm({ ...form, outgoing_shift: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#fff' }}
                  >
                    <option value="Shift A">Shift A</option>
                    <option value="Shift B">Shift B</option>
                    <option value="Shift C">Shift C</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Incoming Shift *</label>
                  <select
                    value={form.incoming_shift}
                    onChange={(e) => setForm({ ...form, incoming_shift: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#fff' }}
                  >
                    <option value="Shift A">Shift A</option>
                    <option value="Shift B">Shift B</option>
                    <option value="Shift C">Shift C</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Production Completed</label>
                <input
                  type="text"
                  placeholder="e.g. NC-01 reached 620 pcs, LP-1 reached 780 pcs"
                  value={form.production_status}
                  onChange={(e) => setForm({ ...form, production_status: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309', display: 'block', marginBottom: 4 }}>Pending Production to Hand Over</label>
                <input
                  type="text"
                  placeholder="e.g. 150 pcs pending on NC-04 batch"
                  value={form.pending_work}
                  onChange={(e) => setForm({ ...form, pending_work: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#dc2626', display: 'block', marginBottom: 4 }}>Machine Problems</label>
                  <input
                    type="text"
                    placeholder="e.g. Hydraulic pressure fluctuates on NC-02"
                    value={form.machine_problems}
                    onChange={(e) => setForm({ ...form, machine_problems: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#dc2626', display: 'block', marginBottom: 4 }}>Tool Problems</label>
                  <input
                    type="text"
                    placeholder="e.g. Tool TL-1002 burr on edge"
                    value={form.downtime_info}
                    onChange={(e) => setForm({ ...form, downtime_info: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Quality Issues</label>
                  <input
                    type="text"
                    placeholder="e.g. Check hole pitch on HP-1 samples"
                    value={form.quality_issues}
                    onChange={(e) => setForm({ ...form, quality_issues: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Maintenance Requirements</label>
                  <input
                    type="text"
                    placeholder="e.g. Greasing due for bolster slide"
                    value={form.follow_up_actions}
                    onChange={(e) => setForm({ ...form, follow_up_actions: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', display: 'block', marginBottom: 4 }}>Important Instructions / Remarks *</label>
                <textarea
                  rows={3}
                  placeholder="Instructions for incoming shift supervisor..."
                  value={form.handover_notes}
                  onChange={(e) => setForm({ ...form, handover_notes: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', resize: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>Submit Handover</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── UPDATE STATUS MODAL ── */}
      {showStatusModal && selectedHandover && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, overflow: 'hidden' }}>
            <div style={{ background: '#0f766e', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Update Handover #{selectedHandover.id} Status</div>
              <button type="button" onClick={() => setShowStatusModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleUpdateStatus} style={{ padding: '18px 20px' }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Completion Status</label>
                <select
                  value={statusUpdateForm.completion_status}
                  onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, completion_status: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                >
                  <option value="Open">Open</option>
                  <option value="In-Progress">In-Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Action Taken / Resolution Notes</label>
                <textarea
                  rows={3}
                  placeholder="Notes on resolution or follow-up status..."
                  value={statusUpdateForm.follow_up_actions}
                  onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, follow_up_actions: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowStatusModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#0f766e', color: '#fff', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>Update Status</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
