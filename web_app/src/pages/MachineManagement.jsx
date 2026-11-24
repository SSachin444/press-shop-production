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
  FileText,
  Play,
  Square,
  ShieldAlert,
  Save,
  User
} from 'lucide-react';
import { api, DEFAULT_DOWNTIME_CODES } from '../api';

export default function MachineManagement() {
  const [machines, setMachines] = useState([]);
  const [downtimes, setDowntimes] = useState([]);
  const [downtimeCodes, setDowntimeCodes] = useState(DEFAULT_DOWNTIME_CODES);
  const [operatorsList, setOperatorsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'downtime' | 'codes' | 'qr-fleet'

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDowntimeModal, setShowDowntimeModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedDowntimeToResume, setSelectedDowntimeToResume] = useState(null);
  const [qrMachine, setQrMachine] = useState(null);

  // Edit Codes State
  const [editingCodes, setEditingCodes] = useState(DEFAULT_DOWNTIME_CODES);
  const [savingCodes, setSavingCodes] = useState(false);

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

  // Downtime Registration Form (Requirement 5)
  const [downtimeForm, setDowntimeForm] = useState({
    machine_number: 'NC-01',
    downtime_code: 'D01',
    reason: 'Machine Breakdown',
    operator_name: '',
    start_time: '',
    remarks: '',
    shift: 'Shift A',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadAllResources();
  }, [filterType]);

  const loadAllResources = async () => {
    try {
      setLoading(true);
      const [machRes, dtRes, codesRes, empRes] = await Promise.all([
        api.getMachines(filterType),
        api.getMachineDowntime(),
        api.getDowntimeCodes(),
        api.getEmployees()
      ]);

      setMachines(machRes.machines || []);
      setDowntimes(dtRes.downtimes || dtRes.downtime_records || []);
      
      const loadedCodes = codesRes.codes || DEFAULT_DOWNTIME_CODES;
      setDowntimeCodes(loadedCodes);
      setEditingCodes(loadedCodes);

      const emps = empRes.employees || [];
      setOperatorsList(emps);
      if (emps.length > 0 && !downtimeForm.operator_name) {
        setDowntimeForm(prev => ({ ...prev, operator_name: emps[0].name }));
      }
    } catch (err) {
      showNotice('error', err.message || 'Failed to load machine data');
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
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
      loadAllResources();
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
      loadAllResources();
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
        loadAllResources();
      } catch (err) {
        showNotice('error', err.message);
      }
    }
  };

  // Open Stoppage / Downtime Registration Modal
  const openDowntimeForMachine = (m) => {
    const defaultCode = downtimeCodes[0]?.code || 'D01';
    const defaultReason = downtimeCodes[0]?.name || 'Machine Breakdown';
    const nowIso = new Date().toISOString();

    setDowntimeForm({
      machine_number: m ? m.machine_number : (machines[0]?.machine_number || 'NC-01'),
      downtime_code: defaultCode,
      reason: defaultReason,
      operator_name: m?.assigned_operator || (operatorsList[0]?.name || 'Operator'),
      start_time: nowIso,
      remarks: '',
      shift: 'Shift A',
      date: new Date().toISOString().split('T')[0]
    });
    setShowDowntimeModal(true);
  };

  // Handle Code selection in modal: displays corresponding reason automatically
  const handleCodeSelectInForm = (codeVal) => {
    const matched = downtimeCodes.find(c => c.code === codeVal);
    setDowntimeForm(prev => ({
      ...prev,
      downtime_code: codeVal,
      reason: matched ? matched.name : prev.reason
    }));
  };

  // Record Machine Stop / Stoppage (Requirement 5)
  const handleRecordDowntime = async (e) => {
    e.preventDefault();
    try {
      const nowIso = downtimeForm.start_time || new Date().toISOString();
      const payload = {
        machine_number: downtimeForm.machine_number,
        downtime_code: downtimeForm.downtime_code,
        reason: downtimeForm.reason,
        breakdown_reason: downtimeForm.reason,
        operator_name: downtimeForm.operator_name,
        reported_by: downtimeForm.operator_name,
        start_time: nowIso,
        breakdown_start: nowIso,
        date: downtimeForm.date,
        shift: downtimeForm.shift,
        status: 'Open',
        remarks: downtimeForm.remarks
      };

      await api.saveMachineDowntime(payload);
      showNotice('success', `Machine ${downtimeForm.machine_number} stopped: [${downtimeForm.downtime_code}] ${downtimeForm.reason}`);
      setShowDowntimeModal(false);
      loadAllResources();
    } catch (err) {
      showNotice('error', err.message || 'Failed to record downtime.');
    }
  };

  // Resume Production: Record End Time, auto-calculate duration, set status = Resolved
  const handleResumeProduction = async (dtRecord) => {
    const nowIso = new Date().toISOString();
    try {
      let durationMinutes = 15;
      const startTimeStr = dtRecord.start_time || dtRecord.breakdown_start;
      if (startTimeStr) {
        const t1 = new Date(startTimeStr).getTime();
        const t2 = new Date(nowIso).getTime();
        if (t2 > t1) {
          durationMinutes = Math.max(1, Math.round((t2 - t1) / 60000));
        }
      }

      await api.resolveMachineDowntime(dtRecord.id, {
        end_time: nowIso,
        breakdown_end: nowIso,
        duration_minutes: durationMinutes,
        total_downtime_minutes: durationMinutes
      });

      showNotice('success', `Production resumed on ${dtRecord.machine_number}. Duration: ${durationMinutes} minutes.`);
      loadAllResources();
    } catch (err) {
      showNotice('error', 'Failed to resume production: ' + err.message);
    }
  };

  // Save Configured Downtime Codes (Max 6 Codes)
  const handleSaveCodesConfig = async () => {
    try {
      setSavingCodes(true);
      await api.saveDowntimeCodes(editingCodes.slice(0, 6));
      setDowntimeCodes(editingCodes.slice(0, 6));
      showNotice('success', 'Configured 6 downtime codes successfully updated.');
    } catch (err) {
      showNotice('error', 'Failed to update downtime codes: ' + err.message);
    } finally {
      setSavingCodes(false);
    }
  };

  const handleEditCodeField = (index, field, value) => {
    setEditingCodes(prev => {
      const u = [...prev];
      u[index] = { ...u[index], [field]: value };
      return u;
    });
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

  const openQRForMachine = (m) => {
    setQrMachine(m);
    setShowQRModal(true);
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
  const idleCount = machines.filter(m => m.status === 'Idle' || !m.status).length;
  const activeDowntimes = downtimes.filter(d => d.status === 'Open');

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '20px 24px 80px', background: '#f8fafc', color: '#0f172a' }}>
      {/* Toast Notice */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 16,
          background: notification.type === 'success' ? '#f0fdf4' : '#fff7ed',
          border: `1px solid ${notification.type === 'success' ? '#bbf7d0' : '#fed7aa'}`,
          color: notification.type === 'success' ? '#15803d' : '#c2410c',
          fontWeight: 700,
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
        }}>
          {notification.type === 'success' ? <CheckCircle2 size={18} color="#16a34a" /> : <AlertCircle size={18} color="#ea580c" />}
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
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#ea580c', color: '#ffffff', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 900 }}>
                  PLANT ASSETS
                </span>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  PRESS SHOP MFG-2 • 22 HEAVY MACHINES
                </span>
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '2px 0 0' }}>
                Machine Directory & Downtime Management
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Tab switch */}
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setActiveTab('directory')}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'directory' ? '#ffffff' : 'transparent',
                  color: activeTab === 'directory' ? '#ea580c' : '#64748b',
                  fontWeight: activeTab === 'directory' ? 800 : 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Directory ({machines.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('downtime')}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'downtime' ? '#ffffff' : 'transparent',
                  color: activeTab === 'downtime' ? '#ea580c' : '#64748b',
                  fontWeight: activeTab === 'downtime' ? 800 : 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                Downtime History ({downtimes.length})
                {activeDowntimes.length > 0 && (
                  <span style={{ marginLeft: 6, background: '#dc2626', color: '#fff', padding: '1px 6px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 900 }}>
                    {activeDowntimes.length} STOPPED
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('codes')}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'codes' ? '#ffffff' : 'transparent',
                  color: activeTab === 'codes' ? '#ea580c' : '#64748b',
                  fontWeight: activeTab === 'codes' ? 800 : 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                6 Downtime Codes
              </button>
            </div>

            <button
              type="button"
              onClick={() => openDowntimeForMachine(null)}
              style={{
                background: '#ea580c',
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
                boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
              }}
            >
              <Square size={14} />
              <span>Record Machine Stop</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── TAB 1: MACHINE DIRECTORY ── */}
      {activeTab === 'directory' && (
        <div>
          {/* Quick Filter & Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['', 'NC', 'Tandem'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: filterType === t ? '2px solid #ea580c' : '1px solid #cbd5e1',
                    background: filterType === t ? '#fff7ed' : '#ffffff',
                    color: filterType === t ? '#ea580c' : '#475569',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {t === '' ? 'All Units' : (t === 'NC' ? 'NC Presses (16)' : 'Tandem Lines (6)')}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search by machine # or operator..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', width: 240 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
            {filteredMachines.map(m => {
              const isStopped = m.status === 'Breakdown';
              return (
                <div key={m.machine_number} style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  border: isStopped ? '2px solid #ef4444' : '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>{m.machine_number}</span>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        background: m.status === 'Running' ? '#dcfce7' : (isStopped ? '#fee2e2' : '#f1f5f9'),
                        color: m.status === 'Running' ? '#15803d' : (isStopped ? '#b91c1c' : '#475569')
                      }}>
                        {m.status || 'Idle'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 4 }}>
                      Type: <strong>{m.machine_type}</strong> • Tonnage: <strong>{m.tonnage}T</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 14 }}>
                      Operator: <strong>{m.assigned_operator || 'Line Operator'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => openQRForMachine(m)}
                      style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <QrCode size={13} />
                      <span>QR Tag</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openDowntimeForMachine(m)}
                      style={{
                        background: '#fff7ed',
                        border: '1px solid #fed7aa',
                        color: '#c2410c',
                        padding: '5px 12px',
                        borderRadius: 6,
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Stop Machine
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: DOWNTIME TRACKING LOG ── */}
      {activeTab === 'downtime' && (
        <div style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Machine Stoppage & Downtime Register
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
                All stoppages tracked under the 6 configured downtime codes. Click "Resume Production" when machine restarts.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openDowntimeForMachine(null)}
              style={{
                background: '#ea580c',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              + Record Machine Stop
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Code</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Machine #</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Downtime Reason</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Reported Operator</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Start Time</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>End Time</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Duration</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Status</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {downtimes.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                      No downtime records in database.
                    </td>
                  </tr>
                ) : (
                  downtimes.map((d) => {
                    const isOpen = d.status === 'Open';

                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9', background: isOpen ? '#fff7ed' : '#ffffff' }}>
                        <td style={{ padding: '11px 14px', fontWeight: 900, color: '#ea580c' }}>
                          {d.downtime_code || 'D01'}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 900, color: '#0f172a' }}>
                          {d.machine_number}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 700 }}>
                          {d.reason || d.breakdown_reason}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {d.operator_name || d.reported_by || 'Operator'}
                        </td>
                        <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>
                          {d.start_time || d.breakdown_start || '—'}
                        </td>
                        <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>
                          {d.end_time || d.breakdown_end || (isOpen ? 'In Progress' : '—')}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 900, color: '#ea580c' }}>
                          {isOpen ? 'Running...' : `${d.duration_minutes || d.total_downtime_minutes || 0}m`}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            background: isOpen ? '#fee2e2' : '#dcfce7',
                            color: isOpen ? '#b91c1c' : '#15803d'
                          }}>
                            {isOpen ? '🔴 Active Stop' : '✓ Resolved'}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                          {isOpen ? (
                            <button
                              type="button"
                              onClick={() => handleResumeProduction(d)}
                              style={{
                                background: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '5px 12px',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <Play size={12} />
                              <span>Resume Production</span>
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Archived</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: CONFIGURABLE 6 DOWNTIME CODES ── */}
      {activeTab === 'codes' && (
        <div style={{
          background: '#ffffff',
          borderRadius: 14,
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Downtime Reason Management (Maximum 6 Codes)
              </h3>
              <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '4px 0 0' }}>
                Administrators can configure code names and descriptions. All machine stoppages must use one of these six standard codes.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveCodesConfig}
              disabled={savingCodes}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 18px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Save size={14} />
              <span>{savingCodes ? 'Saving Codes...' : 'Save 6 Downtime Codes'}</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {editingCodes.slice(0, 6).map((c, idx) => (
              <div key={c.code} style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '16px 18px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{
                    background: '#ea580c',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    padding: '3px 8px',
                    borderRadius: 4
                  }}>
                    {c.code}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>
                    Code Slot {idx + 1}
                  </span>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 4 }}>
                    Downtime Reason Name *
                  </label>
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => handleEditCodeField(idx, 'name', e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 4 }}>
                    Description & Guidelines
                  </label>
                  <input
                    type="text"
                    value={c.description || ''}
                    onChange={(e) => handleEditCodeField(idx, 'description', e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL: RECORD MACHINE STOPPAGE / DOWNTIME (Requirement 5) ── */}
      {showDowntimeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#ea580c', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1rem' }}>Record Machine Stoppage</div>
                <div style={{ fontSize: '0.74rem', opacity: 0.9 }}>Records downtime start time & operator</div>
              </div>
              <button type="button" onClick={() => setShowDowntimeModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleRecordDowntime} style={{ padding: '20px' }}>
              {/* 1. Machine Selection */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 4 }}>
                  1. Machine Stopped *
                </label>
                <select
                  value={downtimeForm.machine_number}
                  onChange={(e) => setDowntimeForm({ ...downtimeForm, machine_number: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 800, background: '#fff' }}
                >
                  <optgroup label="NC Presses">
                    {ncMachines.map(m => <option key={m} value={m}>{m} (NC Press)</option>)}
                  </optgroup>
                  <optgroup label="Tandem Lines">
                    {tandemLines.map(t => <option key={t} value={t}>{t} (Tandem Line)</option>)}
                  </optgroup>
                </select>
              </div>

              {/* 2. Downtime Code Selection (Maximum 6 Codes) */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ea580c', display: 'block', marginBottom: 4 }}>
                  2. Select Downtime Code (6 Configured Codes) *
                </label>
                <select
                  value={downtimeForm.downtime_code}
                  onChange={(e) => handleCodeSelectInForm(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '2px solid #ea580c', fontSize: '0.85rem', fontWeight: 800, background: '#fff7ed' }}
                >
                  {downtimeCodes.map(c => (
                    <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
                  ))}
                </select>
              </div>

              {/* 3. Corresponding Reason Display */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 4 }}>
                  3. Corresponding Downtime Reason
                </label>
                <input
                  type="text"
                  readOnly
                  value={downtimeForm.reason}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700, background: '#f8fafc', color: '#475569' }}
                />
              </div>

              {/* 4. Operator Name */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 4 }}>
                  4. Operator Name *
                </label>
                {operatorsList.length > 0 ? (
                  <select
                    value={downtimeForm.operator_name}
                    onChange={(e) => setDowntimeForm({ ...downtimeForm, operator_name: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff' }}
                  >
                    {operatorsList.map(op => (
                      <option key={op.emp_id} value={op.name}>{op.name} ({op.emp_id})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={downtimeForm.operator_name}
                    onChange={(e) => setDowntimeForm({ ...downtimeForm, operator_name: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    required
                  />
                )}
              </div>

              {/* 5. Start Time Notification */}
              <div style={{ marginBottom: 14, background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#475569' }}>
                ⏱️ <strong>Start Time will be recorded automatically as current time:</strong> {new Date().toLocaleTimeString()}
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 4 }}>
                  Observations / Immediate Action Taken
                </label>
                <textarea
                  rows={2}
                  value={downtimeForm.remarks}
                  onChange={(e) => setDowntimeForm({ ...downtimeForm, remarks: e.target.value })}
                  placeholder="Optional details..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowDowntimeModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#ea580c',
                    color: '#fff',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Confirm Stoppage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: QR CODE ASSET TAG ── */}
      {showQRModal && qrMachine && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden', textAlign: 'center' }}>
            <div style={{ background: '#0f172a', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Asset Identifier — {qrMachine.machine_number}</div>
              <button type="button" onClick={() => setShowQRModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ width: 140, height: 140, margin: '0 auto 14px', border: '2px solid #0f172a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={110} color="#0f172a" />
              </div>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a' }}>{qrMachine.machine_number}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{qrMachine.machine_type} • {qrMachine.tonnage} Tons</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
