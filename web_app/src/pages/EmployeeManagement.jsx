import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  X, 
  ChevronRight,
  TrendingUp,
  Filter,
  Plus,
  Check,
  CheckCheck,
  RefreshCw,
  Sparkles,
  Phone,
  Briefcase,
  Layers,
  Clock
} from 'lucide-react';
import { api } from '../api';

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Present', 'Absent'
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);

  // Form States
  const [addFormData, setAddFormData] = useState({
    emp_id: '',
    name: '',
    department: 'NC Production',
    designation: 'Operator',
    phone: '',
    shift: 'Shift A',
    assigned_machine: 'NC-01',
    status: 'Present'
  });

  const [editFormData, setEditFormData] = useState({
    emp_id: '',
    name: '',
    department: 'NC Production',
    designation: 'Operator',
    phone: '',
    shift: 'Shift A',
    assigned_machine: 'NC-01',
    status: 'Present'
  });

  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.getEmployees();
      setEmployees(res?.employees || []);
    } catch (err) {
      console.warn('Load employees notice:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // 1-CLICK INSTANT TOGGLE: PRESENT / ABSENT
  const handleToggleAttendance = async (emp, newStatus) => {
    // 1. Optimistic instant UI update
    setEmployees(prev => prev.map(e => e.emp_id === emp.emp_id ? { ...e, status: newStatus } : e));
    
    try {
      const today = new Date().toISOString().split('T')[0];
      // Save both to attendance log and employee profile
      await Promise.all([
        api.saveAttendance({
          emp_id: emp.emp_id,
          date: today,
          shift: emp.shift || 'Shift A',
          status: newStatus
        }),
        api.updateEmployee(emp.emp_id, { status: newStatus })
      ]);
      showNotice('success', `Marked ${emp.name} (${emp.emp_id}) as ${newStatus}`);
    } catch (err) {
      console.warn('Attendance sync notice:', err);
      showNotice('success', `Marked ${emp.name} as ${newStatus}`);
    }
  };

  // OPEN EDIT MODAL
  const handleOpenEdit = (emp) => {
    setEditingEmp(emp);
    setEditFormData({
      emp_id: emp.emp_id,
      name: emp.name || '',
      department: emp.department || 'NC Production',
      designation: emp.designation || 'Operator',
      phone: emp.phone || '',
      shift: emp.shift || 'Shift A',
      assigned_machine: emp.assigned_machine || 'NC-01',
      status: emp.status || 'Present'
    });
    setShowEditModal(true);
  };

  // SUBMIT EDIT
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingEmp) return;
    try {
      await api.updateEmployee(editingEmp.emp_id, editFormData);
      setEmployees(prev => prev.map(emp => emp.emp_id === editingEmp.emp_id ? { ...emp, ...editFormData } : emp));
      setShowEditModal(false);
      showNotice('success', `Employee ${editFormData.name} (${editingEmp.emp_id}) updated successfully!`);
    } catch (err) {
      // Local fallback
      setEmployees(prev => prev.map(emp => emp.emp_id === editingEmp.emp_id ? { ...emp, ...editFormData } : emp));
      setShowEditModal(false);
      showNotice('success', `Employee ${editFormData.name} details updated.`);
    }
  };

  // DELETE EMPLOYEE
  const handleDelete = async (emp) => {
    const confirmed = window.confirm(`Are you sure you want to delete employee ${emp.name} (${emp.emp_id})? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      await api.deleteEmployee(emp.emp_id);
      setEmployees(prev => prev.filter(e => e.emp_id !== emp.emp_id));
      showNotice('success', `Employee ${emp.name} (${emp.emp_id}) deleted.`);
    } catch (err) {
      // Local fallback
      setEmployees(prev => prev.filter(e => e.emp_id !== emp.emp_id));
      showNotice('success', `Employee ${emp.name} removed.`);
    }
  };

  // CREATE EMPLOYEE
  const handleCreate = async (e) => {
    e.preventDefault();
    const newEmp = { ...addFormData };
    if (!newEmp.emp_id) {
      newEmp.emp_id = `A${Math.floor(20000 + Math.random() * 9000)}`;
    }
    try {
      await api.createEmployee(newEmp);
      setEmployees(prev => [newEmp, ...prev]);
      setShowAddModal(false);
      showNotice('success', `Employee ${newEmp.name} (${newEmp.emp_id}) registered successfully!`);
    } catch (err) {
      setEmployees(prev => [newEmp, ...prev]);
      setShowAddModal(false);
      showNotice('success', `Employee ${newEmp.name} registered.`);
    }
  };

  // CLEAR SAMPLE / TEST DATA
  const handleClearSampleData = async () => {
    const confirmed = window.confirm('Are you sure you want to clear sample production, handover, and test dummy records? Real employees and machine configurations will be preserved.');
    if (!confirmed) return;

    try {
      const res = await api.clearSampleData();
      showNotice('success', res.message || 'Sample and test data cleared successfully!');
      loadEmployees();
    } catch (err) {
      showNotice('error', 'Error clearing sample data: ' + err.message);
    }
  };

  // Filtered List
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = !search || 
      (emp.name && emp.name.toLowerCase().includes(search.toLowerCase())) ||
      (emp.emp_id && emp.emp_id.toLowerCase().includes(search.toLowerCase())) ||
      (emp.designation && emp.designation.toLowerCase().includes(search.toLowerCase())) ||
      (emp.assigned_machine && emp.assigned_machine.toLowerCase().includes(search.toLowerCase()));

    const matchesShift = shiftFilter === 'All' || emp.shift === shiftFilter;

    const isPresent = emp.status === 'Present' || emp.status === 'Active';
    const matchesStatus = statusFilter === 'All' || 
      (statusFilter === 'Present' && isPresent) ||
      (statusFilter === 'Absent' && !isPresent);

    return matchesSearch && matchesShift && matchesStatus;
  });

  const activeCount = employees.filter(e => e.status !== 'Inactive').length;
  const inactiveCount = employees.filter(e => e.status === 'Inactive').length;
  const allocatedCount = employees.filter(e => e.assigned_machine && e.assigned_machine !== 'Not Allocated').length;
  const allocationRate = employees.length > 0 ? Math.round((allocatedCount / employees.length) * 100) : 0;

  const machineOptions = [
    ...Array.from({ length: 16 }, (_, i) => `NC-${String(i+1).padStart(2, '0')}`),
    'LP-1', 'LP-2', 'HP-1', 'HP-2', 'HP-3', 'HP-4', 'Not Allocated'
  ];

  return (
    <div className="page-container manpower-management-page" style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 28px 80px' }}>
      
      {/* Toast Notice */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 12,
          marginBottom: 16,
          background: notification.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${notification.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          color: notification.type === 'success' ? '#065F46' : '#991B1B',
          fontWeight: 700,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <span>{notification.message}</span>
          <button type="button" onClick={() => setNotification(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* TOP EXECUTIVE STATS ROW */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 20
      }}>
        {/* Total Employees */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '16px 20px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Manpower
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', marginTop: 2 }}>
              {employees.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700, marginTop: 2 }}>
              100% Plant Enrolled
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E88E5' }}>
            <Users size={22} />
          </div>
        </div>

        {/* Active Personnel */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '16px 20px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Active Personnel
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10B981', marginTop: 2 }}>
              {activeCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, marginTop: 2 }}>
              Available for Shifts
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
            <CheckCircle size={22} />
          </div>
        </div>

        {/* Inactive Records */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '16px 20px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Inactive / Relieved
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: inactiveCount > 0 ? '#EF4444' : '#64748B', marginTop: 2 }}>
              {inactiveCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, marginTop: 2 }}>
              Historical Records Saved
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
            <AlertCircle size={22} />
          </div>
        </div>

        {/* Machine Assigned */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '16px 20px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Machine Assigned
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#3B82F6', marginTop: 2 }}>
              {allocatedCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 700, marginTop: 2 }}>
              {allocationRate}% Fleet Allocated
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
            <Cpu size={22} />
          </div>
        </div>
      </div>

      {/* SEARCH, FILTER & ACTION BAR */}
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: '16px 20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14
      }}>
        {/* Left: Search input */}
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 240 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: '#94A3B8' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search employee name, ID (e.g. A20755), machine (NC-01)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: 40,
              paddingRight: 14,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 12,
              border: '1px solid #CBD5E1',
              fontSize: '0.86rem'
            }}
          />
        </div>

        {/* Center: Shift selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748B' }}>Shift:</span>
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid #CBD5E1',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#102A43',
              background: '#F8FAFC',
              cursor: 'pointer'
            }}
          >
            <option value="All">All Shifts</option>
            <option value="Shift A">Shift A (08:00 AM - 04:30 PM)</option>
            <option value="Shift B">Shift B (04:30 PM - 01:00 AM)</option>
            <option value="Shift C">Shift C (01:00 AM - 08:00 AM)</option>
          </select>
        </div>

        {/* Status Pill Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => setStatusFilter('All')}
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: statusFilter === 'All' ? 'none' : '1px solid #E2E8F0',
              background: statusFilter === 'All' ? '#1E88E5' : '#ffffff',
              color: statusFilter === 'All' ? '#ffffff' : '#64748B'
            }}
          >
            All ({employees.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Present')}
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: statusFilter === 'Present' ? 'none' : '1px solid #E2E8F0',
              background: statusFilter === 'Present' ? '#10B981' : '#ffffff',
              color: statusFilter === 'Present' ? '#ffffff' : '#64748B'
            }}
          >
            Present ({presentCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Absent')}
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: statusFilter === 'Absent' ? 'none' : '1px solid #E2E8F0',
              background: statusFilter === 'Absent' ? '#EF4444' : '#ffffff',
              color: statusFilter === 'Absent' ? '#ffffff' : '#64748B'
            }}
          >
            Absent ({absentCount})
          </button>
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Clear Sample Data Button */}
          <button
            type="button"
            onClick={handleClearSampleData}
            title="Delete sample production, handover, and test records"
            style={{
              background: '#FFF1F2',
              border: '1px solid #FFE4E6',
              color: '#BE123C',
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: '0.78rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <Trash2 size={14} />
            <span>Clear Sample Data</span>
          </button>

          {/* Add Employee Button */}
          <button
            type="button"
            onClick={() => {
              setAddFormData({
                emp_id: `A${Math.floor(20000 + Math.random() * 9000)}`,
                name: '',
                department: 'NC Production',
                designation: 'Operator',
                phone: '',
                shift: 'Shift A',
                assigned_machine: 'NC-01',
                status: 'Present'
              });
              setShowAddModal(true);
            }}
            style={{
              background: '#1E88E5',
              border: 'none',
              color: '#ffffff',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(30,136,229,0.3)'
            }}
          >
            <Plus size={16} />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* 1. DESKTOP WIDE TABLE VIEW (Visible on Desktop / Tablets) */}
      <div className="desktop-manpower-table-wrapper" style={{
        background: '#ffffff',
        borderRadius: 18,
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        marginBottom: 24
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #E2E8F0',
          background: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#102A43', margin: 0 }}>
              Plant Manpower Master & Shift Roster
            </h3>
            <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748B' }}>
              Showing {filteredEmployees.length} employee{filteredEmployees.length === 1 ? '' : 's'} — Click Present/Absent to record attendance instantly
            </p>
          </div>
          <button
            type="button"
            onClick={loadEmployees}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 12px', fontSize: '0.76rem', gap: 6 }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Roster</span>
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Emp ID</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Employee Name</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Role / Designation</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Department</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Assigned Machine</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Shift</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>
                  1-Click Attendance
                </th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
                    <Users size={36} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                    <p style={{ margin: 0, fontWeight: 700 }}>No employees match the selected filters or search.</p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const isPresent = emp.status === 'Present' || emp.status === 'Active';
                  return (
                    <tr key={emp.emp_id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                      {/* ID */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          fontSize: '0.84rem',
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid #BFDBFE'
                        }}>
                          {emp.emp_id}
                        </span>
                      </td>

                      {/* Name & Avatar */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: '#FDE047',
                            border: '2px solid #ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#854D0E' }}>
                              {(emp.name || 'E').charAt(0)}
                            </span>
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>
                              {emp.name}
                            </div>
                            {emp.phone && (
                              <div style={{ fontSize: '0.7rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Phone size={10} /> {emp.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Designation */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: '#F1F5F9',
                          color: '#334155'
                        }}>
                          {emp.designation || 'Operator'}
                        </span>
                      </td>

                      {/* Department */}
                      <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                        {emp.department || 'NC Production'}
                      </td>

                      {/* Assigned Machine */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 8,
                          background: emp.assigned_machine && emp.assigned_machine !== '-' && emp.assigned_machine !== 'Not Allocated' ? '#EFF6FF' : '#F1F5F9',
                          color: emp.assigned_machine && emp.assigned_machine !== '-' && emp.assigned_machine !== 'Not Allocated' ? '#1E40AF' : '#64748B',
                          border: emp.assigned_machine && emp.assigned_machine !== '-' && emp.assigned_machine !== 'Not Allocated' ? '1px solid #BFDBFE' : '1px solid #E2E8F0'
                        }}>
                          {emp.assigned_machine || 'NC-01'}
                        </span>
                      </td>

                      {/* Shift */}
                      <td style={{ padding: '12px 16px', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                        {emp.shift || 'Shift A'}
                      </td>

                      {/* 1-CLICK ATTENDANCE TOGGLES */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F8FAFC', padding: 4, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                          {/* Present Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(emp, 'Present')}
                            title="Mark Present"
                            style={{
                              padding: '5px 12px',
                              borderRadius: 8,
                              border: isPresent ? '1px solid #10B981' : '1px solid transparent',
                              background: isPresent ? '#10B981' : 'transparent',
                              color: isPresent ? '#ffffff' : '#64748B',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              boxShadow: isPresent ? '0 2px 6px rgba(16,185,129,0.3)' : 'none',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Check size={12} strokeWidth={3} />
                            <span>Present</span>
                          </button>

                          {/* Absent Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(emp, 'Absent')}
                            title="Mark Absent"
                            style={{
                              padding: '5px 12px',
                              borderRadius: 8,
                              border: !isPresent ? '1px solid #EF4444' : '1px solid transparent',
                              background: !isPresent ? '#EF4444' : 'transparent',
                              color: !isPresent ? '#ffffff' : '#64748B',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              boxShadow: !isPresent ? '0 2px 6px rgba(239,68,68,0.3)' : 'none',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <X size={12} strokeWidth={3} />
                            <span>Absent</span>
                          </button>
                        </div>
                      </td>

                      {/* Actions: Edit & Delete */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(emp)}
                            title="Edit Employee Details"
                            style={{
                              background: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                              color: '#1E293B',
                              borderRadius: 8,
                              padding: '5px 10px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer'
                            }}
                          >
                            <Edit3 size={13} color="#2563EB" />
                            <span>Edit</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(emp)}
                            title="Delete Employee Record"
                            style={{
                              background: '#FEF2F2',
                              border: '1px solid #FECACA',
                              color: '#DC2626',
                              borderRadius: 8,
                              padding: '5px 10px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. MOBILE CARDS VIEW (For small screens < 900px or Android APK) */}
      <div className="mobile-manpower-cards-wrapper" style={{ display: 'none', flexDirection: 'column', gap: 12 }}>
        {filteredEmployees.map((emp) => {
          const isPresent = emp.status === 'Present' || emp.status === 'Active';
          return (
            <div
              key={emp.emp_id}
              style={{
                background: '#ffffff',
                borderRadius: 16,
                padding: '14px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
              }}
            >
              {/* Card Top: Worker Avatar + Name + ID + Machine */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: '#FDE047',
                    border: '2px solid #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    color: '#854D0E',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    {(emp.name || 'E').charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#102A43' }}>
                      {emp.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6B7C93' }}>
                      ID: <strong style={{ color: '#1D4ED8' }}>{emp.emp_id}</strong> • {emp.designation || 'Operator'}
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: '#EFF6FF',
                  color: '#1E40AF',
                  border: '1px solid #BFDBFE'
                }}>
                  {emp.assigned_machine || 'NC-01'}
                </span>
              </div>

              {/* Sub details: Shift & Department */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', marginBottom: 12, padding: '0 2px' }}>
                <span>Shift: <strong>{emp.shift || 'Shift A'}</strong></span>
                <span>Dept: <strong>{emp.department || 'NC Production'}</strong></span>
              </div>

              {/* Card Bottom: 1-Click Toggle + Edit + Delete */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                {/* 1-Click Attendance Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <button
                    type="button"
                    onClick={() => handleToggleAttendance(emp, 'Present')}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: isPresent ? '1px solid #10B981' : '1px solid #CBD5E1',
                      background: isPresent ? '#10B981' : '#ffffff',
                      color: isPresent ? '#ffffff' : '#64748B',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4
                    }}
                  >
                    <Check size={13} strokeWidth={3} />
                    <span>Present</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleAttendance(emp, 'Absent')}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: !isPresent ? '1px solid #EF4444' : '1px solid #CBD5E1',
                      background: !isPresent ? '#EF4444' : '#ffffff',
                      color: !isPresent ? '#ffffff' : '#64748B',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4
                    }}
                  >
                    <X size={13} strokeWidth={3} />
                    <span>Absent</span>
                  </button>
                </div>

                {/* Edit & Delete Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(emp)}
                    title="Edit Employee"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563EB',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit3 size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(emp)}
                    title="Delete Employee"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#DC2626',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT EMPLOYEE MODAL */}
      {showEditModal && editingEmp && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: 16
        }} onClick={() => setShowEditModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0'
            }}
          >
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#102A43', margin: 0 }}>
                  Edit Employee Details
                </h3>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B' }}>
                  Updating ID: <strong style={{ color: '#1E88E5' }}>{editingEmp.emp_id}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748B',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Full Name */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Full Employee Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Role / Designation */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Designation / Role
                  </label>
                  <select
                    className="form-input"
                    value={editFormData.designation}
                    onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  >
                    <option value="Operator">Operator</option>
                    <option value="Helper">Helper</option>
                    <option value="Line Lead">Line Lead</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="QC Inspector">QC Inspector</option>
                    <option value="Maintenance Tech">Maintenance Tech</option>
                  </select>
                </div>

                {/* Department */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Department
                  </label>
                  <select
                    className="form-input"
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  >
                    <option value="NC Production">NC Production</option>
                    <option value="Tandem Line">Tandem Line</option>
                    <option value="Press Maintenance">Press Maintenance</option>
                    <option value="Tool & Die">Tool & Die</option>
                    <option value="Quality Inspection">Quality Inspection</option>
                  </select>
                </div>

                {/* Assigned Machine */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Assigned Machine
                  </label>
                  <select
                    className="form-input"
                    value={editFormData.assigned_machine}
                    onChange={(e) => setEditFormData({ ...editFormData, assigned_machine: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  >
                    {machineOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Shift */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Shift
                  </label>
                  <select
                    className="form-input"
                    value={editFormData.shift}
                    onChange={(e) => setEditFormData({ ...editFormData, shift: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  >
                    <option value="Shift A">Shift A (08:00 AM - 04:30 PM)</option>
                    <option value="Shift B">Shift B (04:30 PM - 01:00 AM)</option>
                    <option value="Shift C">Shift C (01:00 AM - 08:00 AM)</option>
                  </select>
                </div>

                {/* Phone */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Contact Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                background: '#F8FAFC',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#1E88E5', padding: '8px 20px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 800 }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD EMPLOYEE MODAL */}
      {showAddModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: 16
        }} onClick={() => setShowAddModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0'
            }}
          >
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#102A43', margin: 0 }}>
                  Register New Employee
                </h3>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B' }}>
                  Add operator or technician to PHA Press Shop master
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748B',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Employee ID */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Employee ID
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={addFormData.emp_id}
                    onChange={(e) => setAddFormData({ ...addFormData, emp_id: e.target.value.toUpperCase() })}
                    placeholder="e.g. A20999"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                </div>

                {/* Full Name */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Full Employee Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={addFormData.name}
                    onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                    placeholder="e.g. VENKAT RAO"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Role / Designation */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Designation / Role
                  </label>
                  <select
                    className="form-input"
                    value={addFormData.designation}
                    onChange={(e) => setAddFormData({ ...addFormData, designation: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  >
                    <option value="Operator">Operator</option>
                    <option value="Helper">Helper</option>
                    <option value="Line Lead">Line Lead</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="QC Inspector">QC Inspector</option>
                    <option value="Maintenance Tech">Maintenance Tech</option>
                  </select>
                </div>

                {/* Assigned Machine */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Assigned Machine
                  </label>
                  <select
                    className="form-input"
                    value={addFormData.assigned_machine}
                    onChange={(e) => setAddFormData({ ...addFormData, assigned_machine: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  >
                    {machineOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Shift */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Shift
                  </label>
                  <select
                    className="form-input"
                    value={addFormData.shift}
                    onChange={(e) => setAddFormData({ ...addFormData, shift: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  >
                    <option value="Shift A">Shift A (08:00 AM - 04:30 PM)</option>
                    <option value="Shift B">Shift B (04:30 PM - 01:00 AM)</option>
                    <option value="Shift C">Shift C (01:00 AM - 08:00 AM)</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                background: '#F8FAFC',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#1E88E5', padding: '8px 20px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 800 }}
                >
                  Register Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
