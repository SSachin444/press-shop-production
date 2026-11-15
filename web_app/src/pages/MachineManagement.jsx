import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Layers, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Wrench, 
  Activity, 
  ShieldCheck,
  Search
} from 'lucide-react';
import { api } from '../api';

export default function MachineManagement() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);

  const [formData, setFormData] = useState({
    machine_number: '',
    machine_type: 'NC',
    tonnage: 1000,
    production_target: 600,
    status: 'Idle',
    assigned_operator: '',
    assigned_shift: 'Shift A',
    maintenance_notes: ''
  });

  useEffect(() => {
    loadMachines();
  }, [filterType]);

  const loadMachines = async () => {
    try {
      setLoading(true);
      const res = await api.getMachines(filterType);
      setMachines(res.machines || []);
    } catch (err) {
      showNotice('error', err.message || 'Failed to load machines');
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
      await api.createMachine(formData);
      showNotice('success', `Machine ${formData.machine_number} registered successfully!`);
      setShowAddModal(false);
      resetForm();
      loadMachines();
    } catch (err) {
      showNotice('error', err.message || 'Error creating machine');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.updateMachine(selectedMachine.machine_number, formData);
      showNotice('success', `Machine ${selectedMachine.machine_number} updated!`);
      setShowEditModal(false);
      loadMachines();
    } catch (err) {
      showNotice('error', err.message || 'Error updating machine');
    }
  };

  const handleDelete = async (machineNum) => {
    if (window.confirm(`Are you sure you want to remove machine ${machineNum}?`)) {
      try {
        await api.deleteMachine(machineNum);
        showNotice('success', `Machine ${machineNum} deleted.`);
        loadMachines();
      } catch (err) {
        showNotice('error', err.message);
      }
    }
  };

  const openEdit = (m) => {
    setSelectedMachine(m);
    setFormData({ ...m });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      machine_number: '',
      machine_type: 'NC',
      tonnage: 1000,
      production_target: 600,
      status: 'Idle',
      assigned_operator: '',
      assigned_shift: 'Shift A',
      maintenance_notes: ''
    });
  };

  const filteredMachines = machines.filter((m) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return m.machine_number.toLowerCase().includes(term) || (m.assigned_operator && m.assigned_operator.toLowerCase().includes(term));
  });

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

      {/* Header Panel */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Press & Production Machine Directory</h2>
            <p style={{ color: '#64748b', fontSize: '0.84rem' }}>
              Individual registries for all 16 NC Machines, 6 Tandem Lines, and custom stamping units
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}>
            <Plus size={16} />
            <span>Add Press / Line</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search machine number (e.g. NC-01, LP-1, N0160)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 34 }}
            />
            <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
          </div>

          <select 
            className="form-select" 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="">All Types (NC & Tandem)</option>
            <option value="NC">NC Presses Only</option>
            <option value="Tandem">Tandem Lines Only</option>
          </select>
        </div>
      </div>

      {/* Machines Grid */}
      <div className="card-panel">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 18 }}>
          {loading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>Loading machines...</div>
          ) : filteredMachines.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              No machines match the criteria.
            </div>
          ) : (
            filteredMachines.map((m) => (
              <div key={m.machine_number} className="machine-card">
                <div className="machine-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.machine_type === 'NC' ? <Layers size={20} color="#7c3aed" /> : <Cpu size={20} color="#0891b2" />}
                    <span className="machine-title">{m.machine_number}</span>
                  </div>
                  <span className={`status-badge ${m.status.toLowerCase()}`}>{m.status}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  <span className="machine-tonnage">{m.tonnage} Tonnage</span>
                  <span style={{ color: '#64748b' }}>Shift Target: <strong>{m.production_target} pcs</strong></span>
                </div>

                <div style={{ fontSize: '0.82rem', background: '#f8fafc', padding: '8px 10px', borderRadius: 6 }}>
                  <div style={{ color: '#475569', marginBottom: 2 }}>
                    Operator: <strong>{m.assigned_operator || 'Unassigned'}</strong>
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    Shift: {m.assigned_shift} • Type: {m.machine_type}
                  </div>
                </div>

                {m.maintenance_notes && (
                  <div style={{ fontSize: '0.76rem', color: '#b45309', background: '#fffbeb', padding: '6px 8px', borderRadius: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Wrench size={13} />
                    <span>{m.maintenance_notes}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(m)}>
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.machine_number)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ADD MACHINE MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Register Press / Line</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Machine Number (Unique) *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. N0160 or NC-17"
                      required
                      value={formData.machine_number}
                      onChange={(e) => setFormData({ ...formData, machine_number: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Machine Type *</label>
                    <select
                      className="form-select"
                      value={formData.machine_type}
                      onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })}
                    >
                      <option value="NC">NC Press</option>
                      <option value="Tandem">Tandem Stamping Line</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Tonnage Rating (Tons) *</label>
                    <input
                      type="number"
                      className="form-input"
                      required
                      value={formData.tonnage}
                      onChange={(e) => setFormData({ ...formData, tonnage: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Default Shift Target (Qty)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.production_target}
                      onChange={(e) => setFormData({ ...formData, production_target: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Assigned Operator</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. M. Kumar"
                      value={formData.assigned_operator}
                      onChange={(e) => setFormData({ ...formData, assigned_operator: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Operational Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Idle">Idle</option>
                      <option value="Running">Running</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Breakdown">Breakdown</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Maintenance Notes / Tooling Details</label>
                  <textarea
                    rows="2"
                    className="form-textarea"
                    placeholder="e.g. Preventive maintenance scheduled for Friday"
                    value={formData.maintenance_notes}
                    onChange={(e) => setFormData({ ...formData, maintenance_notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Machine</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MACHINE MODAL */}
      {showEditModal && selectedMachine && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Edit: {selectedMachine.machine_number}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Machine Type</label>
                    <select
                      className="form-select"
                      value={formData.machine_type}
                      onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })}
                    >
                      <option value="NC">NC Press</option>
                      <option value="Tandem">Tandem Stamping Line</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tonnage Rating (Tons)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.tonnage}
                      onChange={(e) => setFormData({ ...formData, tonnage: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Default Shift Target</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.production_target}
                      onChange={(e) => setFormData({ ...formData, production_target: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Operational Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Idle">Idle</option>
                      <option value="Running">Running</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Breakdown">Breakdown</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Operator</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.assigned_operator}
                    onChange={(e) => setFormData({ ...formData, assigned_operator: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Maintenance Notes</label>
                  <textarea
                    rows="2"
                    className="form-textarea"
                    value={formData.maintenance_notes}
                    onChange={(e) => setFormData({ ...formData, maintenance_notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
