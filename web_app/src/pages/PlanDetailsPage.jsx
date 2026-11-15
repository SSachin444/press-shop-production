import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  Edit3, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Layers, 
  Cpu, 
  Wrench, 
  ArrowUp, 
  ArrowDown, 
  X, 
  Save, 
  Search, 
  Filter,
  Clock,
  Sparkles
} from 'lucide-react';
import { api } from '../api';

export default function PlanDetailsPage({ selectedDate, selectedShift }) {
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState('NC-01');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [department, setDepartment] = useState('ALL'); // ALL, NC, TANDEM

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    machine_number: 'NC-01',
    plan_index: 1,
    tool_number: '',
    plan_quantity: 1000,
    part_name: '',
    status: 'Queued',
    remarks: ''
  });

  useEffect(() => {
    loadMachinesAndPlans();
  }, [department]);

  useEffect(() => {
    if (selectedMachine) {
      loadPlansForMachine(selectedMachine);
    }
  }, [selectedMachine]);

  const showToast = (type, message) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadMachinesAndPlans = async () => {
    try {
      setLoading(true);
      const res = await api.getMachines(department === 'ALL' ? '' : department);
      const list = res.machines || [];
      setMachines(list);
      if (list.length > 0) {
        const found = list.some(m => m.machine_number === selectedMachine);
        if (!found) setSelectedMachine(list[0].machine_number);
      }
      await loadPlansForMachine(selectedMachine || (list[0]?.machine_number ?? 'NC-01'));
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to load machines: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPlansForMachine = async (machNum) => {
    try {
      const res = await api.getPlans(machNum);
      setPlans(res.plans || []);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to load plans: ' + err.message);
    }
  };

  const openAddModal = () => {
    const nextIdx = plans.length >= 5 ? null : (plans.length + 1);
    if (!nextIdx) {
      showToast('error', `Machine ${selectedMachine} already has maximum 5 plans. Please edit or delete an existing plan.`);
      return;
    }
    setEditingPlan(null);
    setFormData({
      machine_number: selectedMachine,
      plan_index: nextIdx,
      tool_number: '',
      plan_quantity: 1000,
      part_name: '',
      status: nextIdx === 1 ? 'In Setup' : 'Queued',
      remarks: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingPlan(p);
    setFormData({
      id: p.id,
      machine_number: p.machine_number,
      plan_index: p.plan_index,
      tool_number: p.tool_number,
      plan_quantity: p.plan_quantity,
      part_name: p.part_name || '',
      status: p.status,
      remarks: p.remarks || ''
    });
    setModalOpen(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!formData.tool_number.trim()) {
      showToast('error', 'Tool Number is required');
      return;
    }
    if (formData.plan_quantity <= 0) {
      showToast('error', 'Plan Quantity must be greater than 0');
      return;
    }

    try {
      setSaving(true);
      await api.savePlan({
        ...formData,
        target_date: selectedDate,
        target_shift: selectedShift
      });

      showToast('success', `Saved Plan #${formData.plan_index} for ${selectedMachine}!`);
      setModalOpen(false);
      loadPlansForMachine(selectedMachine);
    } catch (err) {
      showToast('error', err.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planId, index) => {
    if (!window.confirm(`Delete Plan #${index} for ${selectedMachine}?`)) return;
    try {
      await api.deletePlan(planId);
      showToast('success', `Deleted Plan #${index}`);
      loadPlansForMachine(selectedMachine);
    } catch (err) {
      showToast('error', err.message || 'Failed to delete plan');
    }
  };

  const handleStartPlan = async (plan) => {
    try {
      await api.savePlan({
        ...plan,
        status: 'In Progress'
      });
      showToast('success', `Plan #${plan.plan_index} with Tool ${plan.tool_number} marked In Progress!`);
      loadPlansForMachine(selectedMachine);
    } catch (err) {
      showToast('error', err.message || 'Failed to start plan');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'In Progress':
        return { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe', label: 'In Progress' };
      case 'Ready':
        return { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0', label: 'Tool Ready' };
      case 'In Setup':
        return { bg: '#fef3c7', color: '#92400e', border: '#fde68a', label: 'Tool In Setup' };
      case 'Completed':
        return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: 'Completed' };
      default:
        return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', label: 'Queued' };
    }
  };

  const currentUnit = machines.find(m => m.machine_number === selectedMachine);
  const totalPlannedQty = plans.reduce((acc, p) => acc + (p.plan_quantity || 0), 0);

  return (
    <div className="page-container" style={{ padding: '16px 20px' }}>
      {/* Toast Notice */}
      {notice && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 14,
          background: notice.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${notice.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: notice.type === 'success' ? '#065f46' : '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.86rem',
          fontWeight: 600
        }}>
          {notice.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Top Banner / Heading */}
      <div className="card-panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: '#6366f1', color: '#fff', padding: 7, borderRadius: 8, display: 'flex' }}>
                <ClipboardList size={22} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Production Plan Details (Tool Scheduling)
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>
                  Maximum 5 Next Plans for every machine • Organized & covered by Tool Number
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Filter Toggle */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
              <button
                type="button"
                className={`cell-filter-btn ${department === 'ALL' ? 'active' : ''}`}
                onClick={() => setDepartment('ALL')}
              >
                All
              </button>
              <button
                type="button"
                className={`cell-filter-btn ${department === 'NC' ? 'active' : ''}`}
                onClick={() => setDepartment('NC')}
              >
                NC (16)
              </button>
              <button
                type="button"
                className={`cell-filter-btn ${department === 'Tandem' ? 'active' : ''}`}
                onClick={() => setDepartment('Tandem')}
              >
                Tandem (6)
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={openAddModal}
              disabled={plans.length >= 5}
              style={{
                background: plans.length >= 5 ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 700,
                gap: 6
              }}
            >
              <Plus size={16} />
              <span>{plans.length >= 5 ? 'Max 5 Plans Reached' : 'Add Next Plan'}</span>
            </button>
          </div>
        </div>

        {/* Machine Pill Selector Bar */}
        <div className="plan-machine-scroll-strip" style={{ marginTop: 14, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
          {machines.map((m) => {
            const isSel = m.machine_number === selectedMachine;
            return (
              <button
                key={m.machine_number}
                type="button"
                onClick={() => setSelectedMachine(m.machine_number)}
                className={`plan-machine-pill ${isSel ? 'pill-active' : ''}`}
                style={{
                  padding: '7px 14px',
                  borderRadius: 20,
                  border: isSel ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                  background: isSel ? '#eef2ff' : '#ffffff',
                  color: isSel ? '#4338ca' : '#334155',
                  fontWeight: isSel ? 700 : 500,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <span>{m.machine_number}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>({m.tonnage}T)</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MACHINE OVERVIEW CARD */}
      <div className="card-panel" style={{ marginBottom: 16, background: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#0f172a', color: '#38bdf8', padding: '8px 12px', borderRadius: 8, fontWeight: 800, fontSize: '1rem' }}>
              {selectedMachine}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.96rem' }}>
                {currentUnit?.machine_type === 'Tandem' ? `Tandem Press Line (${currentUnit.tonnage} Ton)` : `NC Single Press (${currentUnit?.tonnage || 600} Ton)`}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Scheduled Tool Plans: <strong>{plans.length} / 5 Maximum</strong> • Total Planned Output: <strong style={{ color: '#4f46e5' }}>{totalPlannedQty.toLocaleString()} pcs</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 600, padding: '4px 10px', borderRadius: 6, fontSize: '0.78rem' }}>
              Shift Target: {currentUnit?.production_target || 600} pcs
            </span>
          </div>
        </div>
      </div>

      {/* 5 NEXT PLANS LIST (Cards / Table) */}
      <div className="card-panel">
        <div className="panel-header">
          <div className="panel-title" style={{ fontSize: '1rem', fontWeight: 700 }}>
            <Wrench size={18} color="#4f46e5" />
            <span>Next 5 Plans for {selectedMachine} (Covered by Tool Number)</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Priority sequence 1 to 5 (Plan 1 is next in line)
          </span>
        </div>

        {plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <ClipboardList size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#475569' }}>No Next Plans Entered Yet for {selectedMachine}</div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
              Click "Add Next Plan" above to schedule up to 5 tool-based production runs.
            </p>
            <button className="btn btn-primary btn-sm" onClick={openAddModal} style={{ marginTop: 10 }}>
              <Plus size={14} />
              <span>Create Plan #1</span>
            </button>
          </div>
        ) : (
          <div className="plans-cards-grid">
            {plans.map((p) => {
              const b = getStatusBadge(p.status);
              const isFirst = p.plan_index === 1;

              return (
                <div 
                  key={p.id || p.plan_index} 
                  className={`plan-item-card ${isFirst ? 'plan-item-first' : ''}`}
                  style={{
                    border: isFirst ? '2px solid #6366f1' : '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 16,
                    background: isFirst ? '#fbfcfe' : '#ffffff',
                    position: 'relative',
                    boxShadow: isFirst ? '0 4px 14px rgba(99, 102, 241, 0.12)' : '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* Priority Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span 
                        style={{
                          background: isFirst ? '#4f46e5' : '#0f172a',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          borderRadius: 6
                        }}
                      >
                        {isFirst ? 'NEXT PLAN #1 (ACTIVE)' : `NEXT PLAN #${p.plan_index}`}
                      </span>

                      <span 
                        style={{
                          background: b.bg,
                          color: b.color,
                          border: `1px solid ${b.border}`,
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: 12
                        }}
                      >
                        {b.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {p.status !== 'In Progress' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.72rem', color: '#047857', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                          title="Start this plan"
                          onClick={() => handleStartPlan(p)}
                        >
                          <Play size={11} />
                          <span>Start</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px' }}
                        title="Edit Plan"
                        onClick={() => openEditModal(p)}
                      >
                        <Edit3 size={13} color="#475569" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ padding: '3px 8px' }}
                        title="Delete Plan"
                        onClick={() => handleDeletePlan(p.id, p.plan_index)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Tool Number & Part Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 10 }}>
                    <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        TOOL NUMBER
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e40af', marginTop: 2, fontFamily: 'monospace' }}>
                        {p.tool_number}
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        PLAN QUANTITY
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669', marginTop: 2 }}>
                        {p.plan_quantity.toLocaleString()} <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>pcs</span>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        PART NAME
                      </div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.part_name || 'Standard Component'}
                      </div>
                    </div>
                  </div>

                  {/* Remarks */}
                  {p.remarks && (
                    <div style={{ fontSize: '0.76rem', color: '#64748b', background: '#f1f5f9', padding: '6px 10px', borderRadius: 6 }}>
                      <strong>Note:</strong> {p.remarks}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD / EDIT PLAN MODAL */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#4f46e5', color: '#fff', padding: 6, borderRadius: 6, display: 'flex' }}>
                  <Wrench size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                    {editingPlan ? `Edit Next Plan #${formData.plan_index}` : `Add Next Plan #${formData.plan_index}`}
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Machine: <strong>{selectedMachine}</strong> (Priority {formData.plan_index} of 5)
                  </div>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleSavePlan}>
              <div className="modal-body" style={{ padding: '16px 20px' }}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Plan Priority Sequence (1 to 5)
                  </label>
                  <select
                    className="form-input"
                    value={formData.plan_index}
                    onChange={(e) => setFormData({ ...formData, plan_index: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  >
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <option key={idx} value={idx}>
                        {idx === 1 ? 'Next Plan 1 (Immediate / Active)' : `Next Plan ${idx}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Tool Number / Die Code *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. TL-1001-CTR, DIE-P10-DOOR"
                    value={formData.tool_number}
                    onChange={(e) => setFormData({ ...formData, tool_number: e.target.value.toUpperCase() })}
                    style={{ width: '100%', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Plan Quantity (Target Pieces) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="form-input"
                    placeholder="e.g. 1500"
                    value={formData.plan_quantity}
                    onChange={(e) => setFormData({ ...formData, plan_quantity: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', fontWeight: 700 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Part Name / Description
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Center Pillar Inner RH"
                    value={formData.part_name}
                    onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Tool Status
                  </label>
                  <select
                    className="form-input"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="Queued">Queued (In Backlog)</option>
                    <option value="In Setup">Tool In Setup / Staging</option>
                    <option value="Ready">Tool Ready on Bolster</option>
                    <option value="In Progress">In Progress (Running)</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Remarks / Setup Instructions
                  </label>
                  <textarea
                    rows={2}
                    className="form-input"
                    placeholder="e.g. Check die clearance, coil gauge 1.2mm"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: '#4f46e5', color: '#fff' }}>
                    <Save size={15} />
                    <span>{saving ? 'Saving...' : 'Save Plan'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
