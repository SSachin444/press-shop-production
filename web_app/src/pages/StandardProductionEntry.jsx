import React, { useState, useEffect } from 'react';
import { 
  Factory, 
  Layers, 
  GitBranch, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  X, 
  RefreshCw,
  TrendingUp,
  Percent,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { api } from '../api';

export default function StandardProductionEntry({ selectedDate, selectedShift = 'Shift A', onSync }) {
  const activeDate = selectedDate || new Date().toISOString().split('T')[0];

  // Form State
  const [formData, setFormData] = useState({
    date: activeDate,
    shift: selectedShift,
    production_type: 'NC', // 'NC' or 'Tandem'
    machine_or_line: 'NC-01',
    target_qty: 600,
    actual_qty: 0,
    good_qty: 0,
    rejected_qty: 0,
    operator_name: '',
    supervisor_name: '',
    remarks: '',
    tool_number: '',
    downtime_minutes: 0,
    downtime_reason: ''
  });

  const [editingId, setEditingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // History & Options State
  const [historyRecords, setHistoryRecords] = useState([]);
  const [operatorsList, setOperatorsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // Filters for History Table
  const [filterDate, setFilterDate] = useState(activeDate);
  const [filterShift, setFilterShift] = useState('ALL');
  const [filterMachine, setFilterMachine] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const ncMachines = Array.from({ length: 16 }, (_, i) => `NC-${String(i + 1).padStart(2, '0')}`);
  const tandemLines = ['LP-1', 'LP-2', 'HP-1', 'HP-2', 'HP-3', 'HP-4'];

  useEffect(() => {
    // Sync initial supervisor from local storage
    try {
      const u = JSON.parse(localStorage.getItem('pha_user') || '{}');
      if (u.full_name) {
        setFormData(prev => ({ ...prev, supervisor_name: u.full_name }));
      }
    } catch (e) {}

    loadOperators();
    loadHistory();
  }, [filterDate, filterShift, filterMachine]);

  const loadOperators = async () => {
    try {
      const res = await api.getEmployees();
      const emps = res.employees || [];
      setOperatorsList(emps);
      if (emps.length > 0 && !formData.operator_name) {
        setFormData(prev => ({ ...prev, operator_name: emps[0].name }));
      }
    } catch (e) {
      console.warn('Operator list notice:', e);
      setOperatorsList([]);
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterShift !== 'ALL') params.shift = filterShift;
      if (filterMachine !== 'ALL') params.machine = filterMachine;

      const res = await api.getProductionRecords(params);
      setHistoryRecords(res.records || []);
    } catch (err) {
      console.warn('Failed to load history:', err);
      setHistoryRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Live Calculations
  const targetVal = Number(formData.target_qty) || 0;
  const actualVal = Number(formData.actual_qty) || 0;
  const achievementPct = targetVal > 0 ? Math.round((actualVal / targetVal) * 100) : 0;
  const remainingQty = Math.max(0, targetVal - actualVal);

  const handleTypeChange = (type) => {
    const defaultMach = type === 'NC' ? 'NC-01' : 'LP-1';
    const defaultTgt = type === 'NC' ? 600 : 800;
    setFormData(prev => ({
      ...prev,
      production_type: type,
      machine_or_line: defaultMach,
      target_qty: defaultTgt
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.machine_or_line) {
      showNotice('error', 'Please select a Machine or Tandem Line');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        hour_interval: 'Standard Shift Entry',
        good_qty: Math.max(0, actualVal - (Number(formData.rejected_qty) || 0))
      };

      if (editingId) {
        await api.updateProductionRecord(editingId, payload);
        showNotice('success', `Record #${editingId} updated successfully.`);
        setEditingId(null);
      } else {
        await api.saveProductionRecord(payload);
        showNotice('success', `Standard production record saved for ${formData.machine_or_line}.`);
      }

      // Reset form actuals
      setFormData(prev => ({
        ...prev,
        actual_qty: 0,
        good_qty: 0,
        rejected_qty: 0,
        downtime_minutes: 0,
        downtime_reason: '',
        remarks: ''
      }));

      loadHistory();
      if (onSync) onSync();
    } catch (err) {
      showNotice('error', err.message || 'Failed to save production record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    setFormData({
      date: record.date || activeDate,
      shift: record.shift || selectedShift,
      production_type: record.production_type || 'NC',
      machine_or_line: record.machine_or_line || 'NC-01',
      target_qty: record.target_qty || 600,
      actual_qty: record.actual_qty || 0,
      good_qty: record.good_qty || 0,
      rejected_qty: record.rejected_qty || 0,
      operator_name: record.operator_name || '',
      supervisor_name: record.supervisor_name || '',
      remarks: record.remarks || '',
      tool_number: record.tool_number || '',
      downtime_minutes: record.downtime_minutes || 0,
      downtime_reason: record.downtime_reason || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(prev => ({
      ...prev,
      actual_qty: 0,
      good_qty: 0,
      rejected_qty: 0,
      remarks: '',
      downtime_minutes: 0,
      downtime_reason: ''
    }));
  };

  const handleDelete = async (recordId) => {
    try {
      await api.deleteProductionRecord(recordId);
      showNotice('success', `Record #${recordId} deleted.`);
      setDeleteConfirmId(null);
      loadHistory();
      if (onSync) onSync();
    } catch (err) {
      showNotice('error', err.message || 'Failed to delete record');
    }
  };

  const filteredHistory = historyRecords.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchMach = r.machine_or_line?.toLowerCase().includes(q);
      const matchOp = r.operator_name?.toLowerCase().includes(q);
      const matchTool = r.tool_number?.toLowerCase().includes(q);
      if (!matchMach && !matchOp && !matchTool) return false;
    }
    return true;
  });

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
              <Factory size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>
                  PAGE 1
                </span>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  PHA INDIA • PRESS SHOP MFG-2
                </span>
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '2px 0 0' }}>
                Standard Production Entry
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>ACTIVE TELEMETRY</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e40af' }}>{formData.date} • {formData.shift}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Form (Left) + Calculation Gauges & History (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 480px) 1fr', gap: 20, alignItems: 'start' }}>
        
        {/* ── LEFT PANEL: ENTRY FORM ── */}
        <div style={{
          background: '#ffffff',
          borderRadius: 14,
          padding: '22px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              {editingId ? `Edit Record #${editingId}` : 'Log Production Entry'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 10px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            {/* 1. Date & Shift */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700 }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Shift *
                </label>
                <select
                  value={formData.shift}
                  onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, background: '#fff' }}
                  required
                >
                  <option value="Shift A">Shift A (08:00 - 16:30)</option>
                  <option value="Shift B">Shift B (16:30 - 01:00)</option>
                  <option value="Shift C">Shift C (01:00 - 08:00)</option>
                </select>
              </div>
            </div>

            {/* 2. Production Type (NC vs Tandem) */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 6 }}>
                Production Type *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleTypeChange('NC')}
                  style={{
                    padding: '10px',
                    borderRadius: 8,
                    border: formData.production_type === 'NC' ? '2px solid #1e40af' : '1px solid #cbd5e1',
                    background: formData.production_type === 'NC' ? '#eff6ff' : '#ffffff',
                    color: formData.production_type === 'NC' ? '#1e40af' : '#475569',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Layers size={16} />
                  <span>NC Press (16 Units)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange('Tandem')}
                  style={{
                    padding: '10px',
                    borderRadius: 8,
                    border: formData.production_type === 'Tandem' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                    background: formData.production_type === 'Tandem' ? '#f5f3ff' : '#ffffff',
                    color: formData.production_type === 'Tandem' ? '#7c3aed' : '#475569',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <GitBranch size={16} />
                  <span>Tandem (6 Lines)</span>
                </button>
              </div>
            </div>

            {/* 3. Machine / Line Selection */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                {formData.production_type === 'NC' ? 'NC Machine Number *' : 'Tandem Line Number *'}
              </label>
              <select
                value={formData.machine_or_line}
                onChange={(e) => setFormData({ ...formData, machine_or_line: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 800, background: '#fff' }}
                required
              >
                {formData.production_type === 'NC'
                  ? ncMachines.map(m => <option key={m} value={m}>{m} (Press Shop NC)</option>)
                  : tandemLines.map(t => <option key={t} value={t}>{t} (Tandem Line)</option>)
                }
              </select>
            </div>

            {/* 4. Target & Actual Output */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Target Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.target_qty}
                  onChange={(e) => setFormData({ ...formData, target_qty: Math.max(0, parseInt(e.target.value) || 0) })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1e40af', display: 'block', marginBottom: 4 }}>
                  Production Output (Actual) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.actual_qty}
                  onChange={(e) => setFormData({ ...formData, actual_qty: Math.max(0, parseInt(e.target.value) || 0) })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '2px solid #2563eb', fontSize: '0.95rem', fontWeight: 900, color: '#1e40af' }}
                  required
                />
              </div>
            </div>

            {/* 5. Scrap & Tool Number */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#dc2626', display: 'block', marginBottom: 4 }}>
                  Scrap / Rejection Qty
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.rejected_qty}
                  onChange={(e) => setFormData({ ...formData, rejected_qty: Math.max(0, parseInt(e.target.value) || 0) })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Tool / Die Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. TL-1001-CTR"
                  value={formData.tool_number}
                  onChange={(e) => setFormData({ ...formData, tool_number: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* 6. Operator Name & Supervisor Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Operator Name
                </label>
                {operatorsList.length > 0 ? (
                  <select
                    value={formData.operator_name}
                    onChange={(e) => setFormData({ ...formData, operator_name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                  >
                    <option value="">Select Operator...</option>
                    {operatorsList.map(op => (
                      <option key={op.emp_id} value={op.name}>{op.name} ({op.emp_id})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter operator name"
                    value={formData.operator_name}
                    onChange={(e) => setFormData({ ...formData, operator_name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Supervisor Name
                </label>
                <input
                  type="text"
                  placeholder="Supervisor in charge"
                  value={formData.supervisor_name}
                  onChange={(e) => setFormData({ ...formData, supervisor_name: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            {/* 7. Downtime & Reason */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ea580c', display: 'block', marginBottom: 4 }}>
                  Downtime (min)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.downtime_minutes}
                  onChange={(e) => setFormData({ ...formData, downtime_minutes: Math.max(0, parseInt(e.target.value) || 0) })}
                  style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Downtime Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Die cleaning, sensor calibration, coil feed"
                  value={formData.downtime_reason}
                  onChange={(e) => setFormData({ ...formData, downtime_reason: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            {/* 8. Remarks */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                Remarks & Shopfloor Notes
              </label>
              <textarea
                rows={2}
                placeholder="Quality observations, changeover remarks..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', resize: 'none' }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 8,
                border: 'none',
                background: editingId ? '#0f766e' : '#2563eb',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
              }}
            >
              <Check size={18} />
              <span>{editingId ? 'Update Production Entry' : 'Save Production Entry'}</span>
            </button>
          </form>
        </div>

        {/* ── RIGHT PANEL: LIVE GAUGES & HISTORY TABLE ── */}
        <div>
          {/* Automatic Calculation Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {/* Target Achievement % */}
            <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                Auto Achievement
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: achievementPct >= 95 ? '#059669' : (achievementPct >= 75 ? '#d97706' : '#dc2626'), margin: '4px 0 2px' }}>
                {achievementPct}%
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {actualVal} of {targetVal} units
              </div>
              <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, achievementPct)}%`, height: '100%', background: achievementPct >= 95 ? '#10b981' : '#2563eb' }} />
              </div>
            </div>

            {/* Remaining Production */}
            <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                Remaining Production
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: remainingQty === 0 ? '#059669' : '#1e40af', margin: '4px 0 2px' }}>
                {remainingQty.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {remainingQty === 0 ? 'Target fully completed!' : 'Units left to reach goal'}
              </div>
            </div>

            {/* Quality Pass Rate */}
            <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                Good Output Rate
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#059669', margin: '4px 0 2px' }}>
                {actualVal > 0 ? Math.round(((actualVal - (Number(formData.rejected_qty) || 0)) / actualVal) * 100) : 100}%
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {Math.max(0, actualVal - (Number(formData.rejected_qty) || 0))} good parts
              </div>
            </div>
          </div>

          {/* ── PRODUCTION HISTORY TABLE ── */}
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden'
          }}>
            {/* Filter Bar */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={18} color="#1e40af" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Production History ({filteredHistory.length} records)
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search machine, tool, operator..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: '6px 10px 6px 28px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.76rem', width: 170 }}
                  />
                </div>

                {/* Filter Date */}
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.76rem' }}
                />

                {/* Filter Shift */}
                <select
                  value={filterShift}
                  onChange={(e) => setFilterShift(e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.76rem', background: '#fff' }}
                >
                  <option value="ALL">All Shifts</option>
                  <option value="Shift A">Shift A</option>
                  <option value="Shift B">Shift B</option>
                  <option value="Shift C">Shift C</option>
                </select>

                <button
                  type="button"
                  onClick={loadHistory}
                  title="Reload History"
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Table */}
            {filteredHistory.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <Factory size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 800, color: '#475569', fontSize: '0.95rem' }}>No Production Records Found</div>
                <div style={{ fontSize: '0.76rem', marginTop: 4 }}>
                  Fill out the form on the left and click "Save Production Entry" to log output into the database.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>ID</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>Machine / Line</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>Date & Shift</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>Tool #</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>Operator</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>Target</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>Actual</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>Achievement</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>Remaining</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((r) => {
                      const ach = r.target_qty > 0 ? Math.round((r.actual_qty / r.target_qty) * 100) : 0;
                      const rem = Math.max(0, r.target_qty - r.actual_qty);
                      const isConfirmingDelete = deleteConfirmId === r.id;

                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>#{r.id}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: '#1e40af' }}>{r.machine_or_line}</td>
                          <td style={{ padding: '10px 14px', color: '#334155' }}>{r.date} ({r.shift})</td>
                          <td style={{ padding: '10px 14px', color: '#475569' }}>{r.tool_number || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#334155' }}>{r.operator_name || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.target_qty}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>{r.actual_qty}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontWeight: 800,
                              fontSize: '0.72rem',
                              background: ach >= 95 ? '#ecfdf5' : (ach >= 75 ? '#fffbeb' : '#fef2f2'),
                              color: ach >= 95 ? '#059669' : (ach >= 75 ? '#d97706' : '#dc2626')
                            }}>
                              {ach}%
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: rem === 0 ? '#059669' : '#64748b', fontWeight: rem === 0 ? 800 : 500 }}>
                            {rem === 0 ? '✓ Met' : rem}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {isConfirmingDelete ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(r.id)}
                                  style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: '3px 8px', fontSize: '0.7rem', cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(r)}
                                  title="Edit entry"
                                  style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 4, padding: '4px 6px', cursor: 'pointer' }}
                                >
                                  <Edit size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(r.id)}
                                  title="Delete entry"
                                  style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 4, padding: '4px 6px', cursor: 'pointer' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
