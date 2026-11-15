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
  Search,
  Filter,
  RefreshCw,
  QrCode,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  FileText
} from 'lucide-react';
import { api } from '../api';

export default function MachineManagement() {
  const [machines, setMachines] = useState([]);
  const [downtimes, setDowntimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'downtime' | 'qr-fleet'

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDowntimeModal, setShowDowntimeModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [qrMachine, setQrMachine] = useState(null);

  const [formData, setFormData] = useState({
    machine_number: '',
    machine_type: 'NC',
    location: 'Bay 1 - Press Shop MFG-2',
    tonnage: 1000,
    production_target: 600,
    status: 'Idle',
    assigned_operator: '',
    assigned_shift: 'Shift A',
    maintenance_notes: ''
  });

  const [downtimeForm, setDowntimeForm] = useState({
    machine_number: '',
    breakdown_start: new Date().toISOString().slice(0, 16).replace('T', ' '),
    breakdown_end: '',
    breakdown_reason: 'Mechanical jamming',
    total_downtime_minutes: 30,
    remarks: '',
    reported_by: 'Shift Supervisor'
  });

  useEffect(() => {
    loadMachines();
    loadDowntimes();
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

  const loadDowntimes = async () => {
    try {
      const res = await api.getMachineDowntime();
      setDowntimes(res.downtimes || []);
    } catch (e) {
      setDowntimes([]);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const resetForm = () => {
    setFormData({
      machine_number: '',
      machine_type: 'NC',
      location: 'Bay 1 - Press Shop MFG-2',
      tonnage: 1000,
      production_target: 600,
      status: 'Idle',
      assigned_operator: '',
      assigned_shift: 'Shift A',
      maintenance_notes: ''
    });
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

  const handleQuickStatusChange = async (machineNum, newStatus) => {
    try {
      await api.updateMachine(machineNum, { status: newStatus });
      setMachines(prev => prev.map(m => m.machine_number === machineNum ? { ...m, status: newStatus } : m));
      showNotice('success', `${machineNum} status changed to ${newStatus}`);
    } catch (err) {
      showNotice('error', 'Status update failed: ' + err.message);
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

  const handleLogDowntime = async (e) => {
    e.preventDefault();
    try {
      await api.saveMachineDowntime(downtimeForm);
      showNotice('success', `Downtime recorded for ${downtimeForm.machine_number}`);
      setShowDowntimeModal(false);
      loadMachines();
      loadDowntimes();
    } catch (err) {
      showNotice('error', 'Failed to log downtime: ' + err.message);
    }
  };

  const openEdit = (m) => {
    setSelectedMachine(m);
    setFormData({
      machine_number: m.machine_number,
      machine_type: m.machine_type || 'NC',
      location: m.location || 'Press Shop MFG-2',
      tonnage: m.tonnage || 1000,
      production_target: m.production_target || 600,
      status: m.status || 'Idle',
      assigned_operator: m.assigned_operator || '',
      assigned_shift: m.assigned_shift || 'Shift A',
      maintenance_notes: m.maintenance_notes || ''
    });
    setShowEditModal(true);
  };

  const openDowntimeForMachine = (m) => {
    setDowntimeForm({
      machine_number: m.machine_number,
      breakdown_start: new Date().toISOString().slice(0, 16).replace('T', ' '),
      breakdown_end: '',
      breakdown_reason: 'Unscheduled breakdown',
      total_downtime_minutes: 30,
      remarks: '',
      reported_by: 'Shift Supervisor'
    });
    setShowDowntimeModal(true);
  };

  const openQRForMachine = (m) => {
    setQrMachine(m);
    setShowQRModal(true);
  };

  const getStatusBadge = (status) => {
    const s = (status || 'Idle').toUpperCase();
    if (s === 'RUNNING') {
      return (
        <span style={{ background: '#ecfdf5', color: '#16a34a', border: '1px solid #a7f3d0', padding: '3px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
          Running
        </span>
      );
    }
    if (s === 'BREAKDOWN') {
      return (
        <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626' }} />
          Breakdown
        </span>
      );
    }
    if (s === 'MAINTENANCE') {
      return (
        <span style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', padding: '3px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ea580c' }} />
          Maintenance
        </span>
      );
    }
    return (
      <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '3px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#64748b' }} />
        Idle
      </span>
    );
  };

  const filteredMachines = machines.filter(m => {
    if (search) {
      const q = search.toLowerCase();
      const matchNum = m.machine_number?.toLowerCase().includes(q);
      const matchType = m.machine_type?.toLowerCase().includes(q);
      const matchOp = m.assigned_operator?.toLowerCase().includes(q);
      if (!matchNum && !matchType && !matchOp) return false;
    }
    return true;
  });

  const runningCount = machines.filter(m => m.status === 'Running').length;
  const breakdownCount = machines.filter(m => m.status === 'Breakdown').length;
  const maintenanceCount = machines.filter(m => m.status === 'Maintenance').length;
  const idleCount = machines.filter(m => m.status === 'Idle' || !m.status).length;

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
              <Cpu size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>
                  PLANT ASSETS
                </span>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  PRESS SHOP MFG-2 • 22 HEAVY ASSETS
                </span>
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '2px 0 0' }}>
                Machine Management & Downtime Tracker
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Tab switch */}
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setActiveTab('directory')}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'directory' ? '#ffffff' : 'transparent',
                  color: activeTab === 'directory' ? '#1e40af' : '#64748b',
                  fontWeight: activeTab === 'directory' ? 800 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Directory
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('downtime')}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'downtime' ? '#ffffff' : 'transparent',
                  color: activeTab === 'downtime' ? '#1e40af' : '#64748b',
                  fontWeight: activeTab === 'downtime' ? 800 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Downtime Log ({downtimes.length})
              </button>
            </div>

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
                gap: 6
              }}
            >
              <Plus size={16} />
              <span>Add Machine</span>
            </button>
          </div>
        </div>

        {/* Status Counter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#16a34a' }}>{runningCount} Running</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef2f2', border: '1px solid #fecaca', padding: '6px 12px', borderRadius: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#dc2626' }}>{breakdownCount} Breakdown</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff7ed', border: '1px solid #fed7aa', padding: '6px 12px', borderRadius: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea580c' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ea580c' }}>{maintenanceCount} Maintenance</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b' }}>{idleCount} Idle</span>
          </div>

          {/* Search & Type filter */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', background: '#fff' }}
            >
              <option value="">All Types (NC + Tandem)</option>
              <option value="NC">NC Only</option>
              <option value="Tandem">Tandem Only</option>
            </select>

            <div style={{ position: 'relative' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search machine..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '6px 10px 6px 28px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', width: 160 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── VIEW 1: MACHINE DIRECTORY ── */}
      {activeTab === 'directory' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16
        }}>
          {filteredMachines.map(m => (
            <div
              key={m.id || m.machine_number}
              style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: '18px 20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#0f172a' }}>{m.machine_number}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: m.machine_type === 'NC' ? '#eff6ff' : '#f5f3ff', color: m.machine_type === 'NC' ? '#1e40af' : '#7c3aed' }}>
                      {m.machine_type}
                    </span>
                  </div>
                  {getStatusBadge(m.status)}
                </div>

                <div style={{ fontSize: '0.76rem', color: '#64748b', marginBottom: 12 }}>
                  Location: <strong>{m.location || 'Bay 1 • Press Shop MFG-2'}</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', padding: '10px 12px', borderRadius: 8, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>TONNAGE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{m.tonnage} Tons</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>TARGET / SHIFT</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e40af' }}>{m.production_target} pcs</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>OPERATOR</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>{m.assigned_operator || 'Unassigned'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>SHIFT</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>{m.assigned_shift || 'Shift A'}</div>
                  </div>
                </div>

                {/* Quick Status Pill Actions */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, marginBottom: 4 }}>SET STATUS:</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['Running', 'Idle', 'Maintenance', 'Breakdown'].map(st => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleQuickStatusChange(m.machine_number, st)}
                        style={{
                          flex: 1,
                          padding: '4px 0',
                          borderRadius: 4,
                          border: m.status === st ? '1px solid #0f172a' : '1px solid #cbd5e1',
                          background: m.status === st ? '#0f172a' : '#ffffff',
                          color: m.status === st ? '#ffffff' : '#475569',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => openQRForMachine(m)}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <QrCode size={13} color="#2563eb" />
                  <span>QR Code</span>
                </button>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => openDowntimeForMachine(m)}
                    title="Log Breakdown / Downtime"
                    style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c', borderRadius: 6, padding: '5px 8px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    + Downtime
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(m)}
                    title="Edit machine"
                    style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(m.machine_number)}
                    title="Delete machine"
                    style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── VIEW 2: DOWNTIME TRACKING LOG ── */}
      {activeTab === 'downtime' && (
        <div style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Machine Downtime & Breakdown Log
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0' }}>
                Breakdown start time, end time, root causes and repair tracking
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDowntimeForm(prev => ({ ...prev, machine_number: machines[0]?.machine_number || 'NC-01' }));
                setShowDowntimeModal(true);
              }}
              style={{
                background: '#ea580c',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '7px 14px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              + Record Breakdown
            </button>
          </div>

          {downtimes.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <Clock size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 800, color: '#475569' }}>No machine breakdowns recorded.</div>
              <div style={{ fontSize: '0.76rem', marginTop: 2 }}>Click "+ Record Breakdown" to log an incident.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>ID</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Machine #</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Start Time</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>End Time</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Duration</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Breakdown Reason</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Reported By</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {downtimes.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>#{d.id}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#1e40af' }}>{d.machine_number}</td>
                      <td style={{ padding: '10px 14px', color: '#0f172a' }}>{d.breakdown_start}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{d.breakdown_end || 'In Progress'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#dc2626' }}>{d.total_downtime_minutes}m</td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>{d.breakdown_reason}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{d.reported_by}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: d.status === 'Resolved' ? '#ecfdf5' : '#fef2f2',
                          color: d.status === 'Resolved' ? '#047857' : '#b91c1c'
                        }}>
                          {d.status || 'Open'}
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

      {/* ── MODAL 1: ADD MACHINE ── */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 460, overflow: 'hidden' }}>
            <div style={{ background: '#1e40af', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Register New Machine Asset</div>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ padding: '18px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Machine # *</label>
                  <input
                    type="text"
                    placeholder="e.g. NC-17 or Tandem-07"
                    value={formData.machine_number}
                    onChange={(e) => setFormData({ ...formData, machine_number: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Type *</label>
                  <select
                    value={formData.machine_type}
                    onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                  >
                    <option value="NC">NC Press</option>
                    <option value="Tandem">Tandem Line</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Tonnage (T)</label>
                  <input
                    type="number"
                    value={formData.tonnage}
                    onChange={(e) => setFormData({ ...formData, tonnage: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Shift Target (pcs)</label>
                  <input
                    type="number"
                    value={formData.production_target}
                    onChange={(e) => setFormData({ ...formData, production_target: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Plant Location</label>
                <input
                  type="text"
                  placeholder="e.g. Bay 1 - Press Shop MFG-2"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>Register Machine</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EDIT MACHINE ── */}
      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 460, overflow: 'hidden' }}>
            <div style={{ background: '#0f766e', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Edit Machine {selectedMachine?.machine_number}</div>
              <button type="button" onClick={() => setShowEditModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleUpdate} style={{ padding: '18px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Tonnage (T)</label>
                  <input
                    type="number"
                    value={formData.tonnage}
                    onChange={(e) => setFormData({ ...formData, tonnage: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Shift Target (pcs)</label>
                  <input
                    type="number"
                    value={formData.production_target}
                    onChange={(e) => setFormData({ ...formData, production_target: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                >
                  <option value="Running">Running (Green)</option>
                  <option value="Idle">Idle (Grey)</option>
                  <option value="Maintenance">Maintenance (Orange)</option>
                  <option value="Breakdown">Breakdown (Red)</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Assigned Operator</label>
                <input
                  type="text"
                  value={formData.assigned_operator}
                  onChange={(e) => setFormData({ ...formData, assigned_operator: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#0f766e', color: '#fff', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: LOG DOWNTIME ── */}
      {showDowntimeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 460, overflow: 'hidden' }}>
            <div style={{ background: '#ea580c', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Log Breakdown for {downtimeForm.machine_number}</div>
              <button type="button" onClick={() => setShowDowntimeModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleLogDowntime} style={{ padding: '18px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Breakdown Start *</label>
                  <input
                    type="text"
                    value={downtimeForm.breakdown_start}
                    onChange={(e) => setDowntimeForm({ ...downtimeForm, breakdown_start: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Duration (Minutes) *</label>
                  <input
                    type="number"
                    min="1"
                    value={downtimeForm.total_downtime_minutes}
                    onChange={(e) => setDowntimeForm({ ...downtimeForm, total_downtime_minutes: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Breakdown Reason *</label>
                <select
                  value={downtimeForm.breakdown_reason}
                  onChange={(e) => setDowntimeForm({ ...downtimeForm, breakdown_reason: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                >
                  <option value="Mechanical jamming">Mechanical jamming</option>
                  <option value="Hydraulic pressure drop">Hydraulic pressure drop</option>
                  <option value="Electrical sensor fault">Electrical sensor fault</option>
                  <option value="Die changeover delay">Die changeover delay</option>
                  <option value="Coil de-reeler jam">Coil de-reeler jam</option>
                  <option value="Preventive maintenance">Preventive maintenance</option>
                  <option value="Operator shortage">Operator shortage</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Root cause & corrective action details..."
                  value={downtimeForm.remarks}
                  onChange={(e) => setDowntimeForm({ ...downtimeForm, remarks: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setShowDowntimeModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#ea580c', color: '#fff', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>Record Breakdown</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: QR CODE MACHINE IDENTIFIER ── */}
      {showQRModal && qrMachine && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)' }}>
            <div style={{ background: '#0f172a', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>QR Asset Tag — {qrMachine.machine_number}</div>
              <button type="button" onClick={() => setShowQRModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            
            <div style={{ padding: '24px 20px' }}>
              {/* Generated SVG QR Code representation */}
              <div style={{
                width: 180,
                height: 180,
                margin: '0 auto 16px',
                padding: 12,
                borderRadius: 12,
                background: '#ffffff',
                border: '2px solid #0f172a',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
              }}>
                <svg width="150" height="150" viewBox="0 0 100 100" fill="none">
                  <rect width="100" height="100" fill="#ffffff" />
                  {/* Outer Frame Corners */}
                  <rect x="5" y="5" width="28" height="28" stroke="#0f172a" strokeWidth="6" fill="none" />
                  <rect x="13" y="13" width="12" height="12" fill="#0f172a" />

                  <rect x="67" y="5" width="28" height="28" stroke="#0f172a" strokeWidth="6" fill="none" />
                  <rect x="75" y="13" width="12" height="12" fill="#0f172a" />

                  <rect x="5" y="67" width="28" height="28" stroke="#0f172a" strokeWidth="6" fill="none" />
                  <rect x="13" y="75" width="12" height="12" fill="#0f172a" />

                  {/* Machine Unique Pattern */}
                  <rect x="42" y="10" width="8" height="16" fill="#0f172a" />
                  <rect x="42" y="32" width="16" height="8" fill="#0f172a" />
                  <rect x="10" y="42" width="16" height="8" fill="#0f172a" />
                  <rect x="32" y="42" width="8" height="16" fill="#0f172a" />
                  <rect x="50" y="50" width="12" height="12" fill="#2563eb" />
                  <rect x="70" y="42" width="20" height="6" fill="#0f172a" />
                  <rect x="70" y="54" width="8" height="18" fill="#0f172a" />
                  <rect x="42" y="70" width="16" height="12" fill="#0f172a" />
                  <rect x="65" y="80" width="25" height="8" fill="#0f172a" />
                </svg>
                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#0f172a', marginTop: 4, letterSpacing: '0.05em' }}>
                  PHA-ID: {qrMachine.machine_number}
                </div>
              </div>

              {/* Machine Telemetry Details */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Asset:</span>
                  <strong style={{ color: '#0f172a' }}>{qrMachine.machine_number} ({qrMachine.machine_type})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Status:</span>
                  {getStatusBadge(qrMachine.status)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Assigned Operator:</span>
                  <strong style={{ color: '#334155' }}>{qrMachine.assigned_operator || 'None'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Shift Target:</span>
                  <strong style={{ color: '#1e40af' }}>{qrMachine.production_target} pcs</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  width: '100%',
                  marginTop: 16,
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Print Asset Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
