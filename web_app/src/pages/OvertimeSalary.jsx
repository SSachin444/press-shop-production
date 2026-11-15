import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Plus, 
  FileText, 
  ShieldAlert, 
  Printer, 
  Search, 
  X,
  Edit2
} from 'lucide-react';
import { api } from '../api';

export default function OvertimeSalary({ selectedDate, selectedShift, currentUser }) {
  const [activeTab, setActiveTab] = useState('overtime'); // 'overtime' or 'salary'
  
  // Overtime state
  const [overtimeList, setOvertimeList] = useState([]);
  const [loadingOt, setLoadingOt] = useState(true);
  const [showAddOtModal, setShowAddOtModal] = useState(false);
  const [otFormData, setOtFormData] = useState({
    emp_id: '',
    date: selectedDate,
    shift: selectedShift,
    regular_hours: 8.0,
    ot_hours: 2.0,
    reason: 'Urgent production order target'
  });

  // Salary state
  const [salarySheets, setSalarySheets] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [salaryError, setSalaryError] = useState(null);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [showEditSalaryModal, setShowEditSalaryModal] = useState(false);
  const [editSalaryForm, setEditSalaryForm] = useState(null);

  const [notification, setNotification] = useState(null);

  const isAuthorizedForSalary = currentUser?.role === 'Admin' || currentUser?.role === 'Management';

  useEffect(() => {
    if (activeTab === 'overtime') {
      loadOvertime();
    } else if (activeTab === 'salary' && isAuthorizedForSalary) {
      loadSalaries();
    }
  }, [activeTab, selectedMonth, selectedDate]);

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadOvertime = async () => {
    try {
      setLoadingOt(true);
      const res = await api.getOvertime({ month: selectedMonth });
      setOvertimeList(res.overtime || []);
    } catch (err) {
      showNotice('error', err.message || 'Failed to load overtime');
    } finally {
      setLoadingOt(false);
    }
  };

  const loadSalaries = async () => {
    try {
      setLoadingSalary(true);
      setSalaryError(null);
      const res = await api.getSalary({ month: selectedMonth });
      setSalarySheets(res.salary_sheets || []);
      setPayrollSummary({
        total_employees: res.total_employees,
        total_payroll_payout: res.total_payroll_payout
      });
    } catch (err) {
      setSalaryError(err.message || 'Failed to load salary calculations');
    } finally {
      setLoadingSalary(false);
    }
  };

  const handleCreateOt = async (e) => {
    e.preventDefault();
    try {
      await api.createOvertime(otFormData);
      showNotice('success', 'Overtime record submitted for approval!');
      setShowAddModal(false);
      loadOvertime();
    } catch (err) {
      showNotice('error', err.message || 'Error submitting overtime');
    }
  };

  const handleApproveReject = async (id, status) => {
    try {
      await api.updateOvertimeStatus(id, { 
        status, 
        approved_by: currentUser?.full_name || 'Supervisor' 
      });
      showNotice('success', `Overtime record #${id} ${status}`);
      loadOvertime();
      if (isAuthorizedForSalary) loadSalaries();
    } catch (err) {
      showNotice('error', err.message);
    }
  };

  const handleUpdateSalary = async (e) => {
    e.preventDefault();
    try {
      await api.updateSalaryConfig(editSalaryForm.emp_id, editSalaryForm);
      showNotice('success', `Salary configuration updated for ${editSalaryForm.emp_id}`);
      setShowEditSalaryModal(false);
      loadSalaries();
    } catch (err) {
      showNotice('error', err.message);
    }
  };

  const openEditSalary = (sheet) => {
    setEditSalaryForm({
      emp_id: sheet.emp_id,
      name: sheet.name,
      basic_salary: sheet.basic_salary,
      hra: sheet.hra,
      da: sheet.da,
      conveyance: sheet.conveyance,
      special_allowance: sheet.special_allowance,
      pf_deduction: sheet.pf_deduction,
      esi_deduction: sheet.esi_deduction,
      tds_deduction: sheet.tds_deduction,
      ot_hourly_rate: sheet.ot_rate
    });
    setShowEditSalaryModal(true);
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

      {/* Module Switcher Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '2px solid #e2e8f0', paddingBottom: 4 }}>
        <button
          onClick={() => setActiveTab('overtime')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'overtime' ? '#1e40af' : 'transparent',
            color: activeTab === 'overtime' ? '#ffffff' : '#64748b',
            fontWeight: 700,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Clock size={18} />
          <span>Overtime Management (OT Hours & Approvals)</span>
        </button>

        <button
          onClick={() => setActiveTab('salary')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'salary' ? '#1e40af' : 'transparent',
            color: activeTab === 'salary' ? '#ffffff' : '#64748b',
            fontWeight: 700,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <DollarSign size={18} />
          <span>Salary & Compensation (Payroll & Payslips)</span>
        </button>
      </div>

      {/* ================= OVERTIME TAB ================= */}
      {activeTab === 'overtime' && (
        <>
          <div className="card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Shopfloor Overtime Authorization</h3>
                <p style={{ color: '#64748b', fontSize: '0.84rem' }}>
                  Track overtime hours, reasons, and supervisor approvals for month: <strong style={{ color: '#1e40af' }}>{selectedMonth}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="form-input"
                  style={{ width: 170 }}
                />
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowAddOtModal(true)}
                >
                  <Plus size={16} />
                  <span>Log Overtime</span>
                </button>
              </div>
            </div>
          </div>

          <div className="card-panel">
            <div className="table-responsive">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Name</th>
                    <th>Date</th>
                    <th>Shift</th>
                    <th>Regular Hrs</th>
                    <th>OT Hours</th>
                    <th>Reason</th>
                    <th>Approval Status</th>
                    <th>Approved By</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingOt ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '30px' }}>Loading overtime records...</td>
                    </tr>
                  ) : overtimeList.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="empty-state">No overtime records logged for {selectedMonth}.</td>
                    </tr>
                  ) : (
                    overtimeList.map((ot) => (
                      <tr key={ot.id}>
                        <td><span className="mono" style={{ fontWeight: 700, color: '#1e40af' }}>{ot.emp_id}</span></td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{ot.emp_name}</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{ot.department}</div>
                        </td>
                        <td>{ot.date}</td>
                        <td><span style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{ot.shift}</span></td>
                        <td>{ot.regular_hours} hrs</td>
                        <td><strong style={{ color: '#2563eb' }}>{ot.ot_hours} hrs</strong></td>
                        <td style={{ fontSize: '0.82rem', color: '#475569' }}>{ot.reason || '--'}</td>
                        <td>
                          <span className={`status-badge ${ot.approval_status === 'Approved' ? 'running' : ot.approval_status === 'Rejected' ? 'breakdown' : 'idle'}`}>
                            {ot.approval_status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{ot.approved_by || '--'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {ot.approval_status === 'Pending' && (
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button 
                                className="btn btn-success btn-sm" 
                                title="Approve Overtime"
                                onClick={() => handleApproveReject(ot.id, 'Approved')}
                              >
                                Approve
                              </button>
                              <button 
                                className="btn btn-danger btn-sm" 
                                title="Reject Overtime"
                                onClick={() => handleApproveReject(ot.id, 'Rejected')}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ================= SALARY TAB ================= */}
      {activeTab === 'salary' && (
        <>
          {!isAuthorizedForSalary ? (
            <div className="card-panel" style={{ textAlign: 'center', padding: '50px 20px' }}>
              <ShieldAlert size={48} color="#dc2626" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#991b1b' }}>Access Restricted</h3>
              <p style={{ color: '#64748b', maxWidth: 480, margin: '8px auto 16px auto' }}>
                Salary and compensation details are confidential and restricted to authorized <strong>Plant Management</strong> and <strong>Administrators</strong>.
              </p>
              <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                Current User Role: <strong>{currentUser?.role || 'Operator'}</strong>. Please switch to an Administrator or Management account.
              </div>
            </div>
          ) : (
            <>
              {/* Payroll Top Summary */}
              <div className="card-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Monthly Payroll Calculation</h3>
                    <p style={{ color: '#64748b', fontSize: '0.84rem' }}>
                      Calculated from real attendance, approved overtime rates, allowances, and statutory deductions
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="form-input"
                      style={{ width: 170 }}
                    />
                    <button className="btn btn-secondary" onClick={loadSalaries}>
                      Recalculate
                    </button>
                  </div>
                </div>

                {payrollSummary && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 18 }}>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>PAYROLL EMPLOYEES</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{payrollSummary.total_employees}</div>
                    </div>
                    <div style={{ background: '#ecfdf5', padding: '14px', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>ESTIMATED NET PAYOUT</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>
                        ₹{payrollSummary.total_payroll_payout.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payroll Table */}
              <div className="card-panel">
                <div className="table-responsive">
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th>Emp ID</th>
                        <th>Name</th>
                        <th>Department</th>
                        <th>Present Days</th>
                        <th>Approved OT</th>
                        <th>Basic Salary</th>
                        <th>Allowances</th>
                        <th>OT Pay</th>
                        <th>Gross Salary</th>
                        <th>Deductions</th>
                        <th>Net Salary</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingSalary ? (
                        <tr><td colSpan="12" style={{ textAlign: 'center', padding: '30px' }}>Computing payroll...</td></tr>
                      ) : salarySheets.length === 0 ? (
                        <tr><td colSpan="12" className="empty-state">No employee salary records available.</td></tr>
                      ) : (
                        salarySheets.map((s) => (
                          <tr key={s.emp_id}>
                            <td><span className="mono" style={{ fontWeight: 700, color: '#1e40af' }}>{s.emp_id}</span></td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{s.name}</div>
                              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{s.designation}</div>
                            </td>
                            <td>{s.department}</td>
                            <td><strong>{s.present_days}</strong> days</td>
                            <td>{s.approved_ot_hours} hrs</td>
                            <td>₹{s.basic_salary.toLocaleString()}</td>
                            <td style={{ fontSize: '0.8rem' }}>₹{(s.hra + s.da + s.conveyance + s.special_allowance).toLocaleString()}</td>
                            <td style={{ color: '#2563eb', fontWeight: 600 }}>₹{s.ot_pay.toLocaleString()}</td>
                            <td style={{ fontWeight: 700 }}>₹{s.gross_salary.toLocaleString()}</td>
                            <td style={{ color: '#dc2626' }}>-₹{s.total_deductions.toLocaleString()}</td>
                            <td><strong style={{ fontSize: '0.98rem', color: '#059669' }}>₹{s.net_salary.toLocaleString()}</strong></td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button 
                                  className="btn btn-secondary btn-sm" 
                                  title="View / Print Payslip"
                                  onClick={() => setSelectedPayslip(s)}
                                >
                                  <Printer size={13} />
                                </button>
                                <button 
                                  className="btn btn-secondary btn-sm" 
                                  title="Configure Rates"
                                  onClick={() => openEditSalary(s)}
                                >
                                  <Edit2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* LOG OVERTIME MODAL */}
      {showAddOtModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Log Employee Overtime</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddOtModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateOt}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Employee ID *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. PHA-001"
                    required
                    value={otFormData.emp_id}
                    onChange={(e) => setOtFormData({ ...otFormData, emp_id: e.target.value.toUpperCase() })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      required
                      value={otFormData.date}
                      onChange={(e) => setOtFormData({ ...otFormData, date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shift</label>
                    <select
                      className="form-select"
                      value={otFormData.shift}
                      onChange={(e) => setOtFormData({ ...otFormData, shift: e.target.value })}
                    >
                      <option value="Shift A">Shift A</option>
                      <option value="Shift B">Shift B</option>
                      <option value="Shift C">Shift C</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Regular Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-input"
                      value={otFormData.regular_hours}
                      onChange={(e) => setOtFormData({ ...otFormData, regular_hours: parseFloat(e.target.value) || 8 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Overtime Hours *</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-input"
                      required
                      value={otFormData.ot_hours}
                      onChange={(e) => setOtFormData({ ...otFormData, ot_hours: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason / Work Order Details *</label>
                  <textarea
                    rows="3"
                    className="form-textarea"
                    required
                    placeholder="e.g. Finishing urgent stamping run for export order"
                    value={otFormData.reason}
                    onChange={(e) => setOtFormData({ ...otFormData, reason: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddOtModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit for Approval</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SALARY CONFIG MODAL */}
      {showEditSalaryModal && editSalaryForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Configure Salary: {editSalaryForm.emp_id} ({editSalaryForm.name})</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEditSalaryModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleUpdateSalary}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Basic Salary (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editSalaryForm.basic_salary}
                      onChange={(e) => setEditSalaryForm({ ...editSalaryForm, basic_salary: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">HRA Allowance (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editSalaryForm.hra}
                      onChange={(e) => setEditSalaryForm({ ...editSalaryForm, hra: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">DA (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editSalaryForm.da}
                      onChange={(e) => setEditSalaryForm({ ...editSalaryForm, da: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Conveyance (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editSalaryForm.conveyance}
                      onChange={(e) => setEditSalaryForm({ ...editSalaryForm, conveyance: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Special Allowance (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editSalaryForm.special_allowance}
                      onChange={(e) => setEditSalaryForm({ ...editSalaryForm, special_allowance: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">OT Hourly Rate (₹/hr)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editSalaryForm.ot_hourly_rate}
                      onChange={(e) => setEditSalaryForm({ ...editSalaryForm, ot_hourly_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PF Deduction (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editSalaryForm.pf_deduction}
                      onChange={(e) => setEditSalaryForm({ ...editSalaryForm, pf_deduction: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ESI Deduction (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editSalaryForm.esi_deduction}
                      onChange={(e) => setEditSalaryForm({ ...editSalaryForm, esi_deduction: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditSalaryModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Salary Structure</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE PAYSLIP MODAL */}
      {selectedPayslip && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Employee Salary Pay Slip</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPayslip(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" id="printable-payslip">
              <div style={{ borderBottom: '2px solid #1e40af', paddingBottom: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e40af' }}>PHA INDIA PRIVATE LIMITED</h2>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Industrial Stamping & Automotive Components</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Sriperumbudur Plant, Tamil Nadu</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>PAY SLIP</div>
                    <div style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 600 }}>Period: {selectedPayslip.month}</div>
                  </div>
                </div>
              </div>

              {/* Employee info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: '0.84rem' }}>
                <div><strong>Employee ID:</strong> {selectedPayslip.emp_id}</div>
                <div><strong>Employee Name:</strong> {selectedPayslip.name}</div>
                <div><strong>Department:</strong> {selectedPayslip.department}</div>
                <div><strong>Designation:</strong> {selectedPayslip.designation}</div>
                <div><strong>Present Days:</strong> {selectedPayslip.present_days}</div>
                <div><strong>Approved OT:</strong> {selectedPayslip.approved_ot_hours} hrs</div>
              </div>

              {/* Earnings & Deductions Table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: 4, marginBottom: 8, color: '#059669' }}>
                    EARNINGS
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                    <span>Basic Salary:</span><span>₹{selectedPayslip.basic_salary.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                    <span>HRA:</span><span>₹{selectedPayslip.hra.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                    <span>DA:</span><span>₹{selectedPayslip.da.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                    <span>Conveyance:</span><span>₹{selectedPayslip.conveyance.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                    <span>Special Allowance:</span><span>₹{selectedPayslip.special_allowance.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4, fontWeight: 600, color: '#1e40af' }}>
                    <span>Overtime Pay:</span><span>₹{selectedPayslip.ot_pay.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 6 }}>
                    <span>Gross Salary:</span><span>₹{selectedPayslip.gross_salary.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: 4, marginBottom: 8, color: '#dc2626' }}>
                    DEDUCTIONS
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                    <span>PF (Provident Fund):</span><span>₹{selectedPayslip.pf_deduction.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                    <span>ESI:</span><span>₹{selectedPayslip.esi_deduction.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                    <span>TDS:</span><span>₹{selectedPayslip.tds_deduction.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 38 }}>
                    <span>Total Deductions:</span><span>₹{selectedPayslip.total_deductions.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Net Payout Banner */}
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: 14, borderRadius: 8, marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#047857', fontSize: '0.95rem' }}>NET SALARY PAYABLE:</span>
                <span style={{ fontWeight: 800, color: '#059669', fontSize: '1.35rem' }}>₹{selectedPayslip.net_salary.toLocaleString()}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedPayslip(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={15} />
                <span>Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
