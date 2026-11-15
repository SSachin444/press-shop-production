import React, { useState, useEffect } from 'react';
import { 
  Timer, 
  Cpu, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  User, 
  Wrench, 
  Calendar, 
  Clock, 
  RefreshCw,
  Layers,
  GitBranch,
  ArrowRight,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { api } from '../api';

export default function HourlyProductionEntry({ 
  selectedDate, 
  selectedShift = 'Shift A', 
  initialMachine = 'NC-01',
  onSync 
}) {
  const activeDate = selectedDate || new Date().toISOString().split('T')[0];

  // Selection states (as explicitly requested)
  const [selectedMachine, setSelectedMachine] = useState(initialMachine);
  const [toolNumber, setToolNumber] = useState('TL-1002-CTR');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedHour, setSelectedHour] = useState('Hour 1');
  const [targetQty, setTargetQty] = useState(75);
  const [actualQty, setActualQty] = useState(70);

  // Quality & Downtime
  const [rejectedQty, setRejectedQty] = useState(0);
  const [downtimeMinutes, setDowntimeMinutes] = useState(0);
  const [downtimeReason, setDowntimeReason] = useState('');
  const [remarks, setRemarks] = useState('');

  // Dropdown options loaded from existing database records
  const [machinesList, setMachinesList] = useState([]);
  const [operatorsList, setOperatorsList] = useState([]);
  const [toolOptions, setToolOptions] = useState([]);

  // 8-hour production records matrix
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const hoursList = [
    { key: 'Hour 1', label: 'Hour 1 (06:00 - 07:00)', shortLabel: '1st Hour' },
    { key: 'Hour 2', label: 'Hour 2 (07:00 - 08:00)', shortLabel: '2nd Hour' },
    { key: 'Hour 3', label: 'Hour 3 (08:00 - 09:00)', shortLabel: '3rd Hour' },
    { key: 'Hour 4', label: 'Hour 4 (09:00 - 10:00)', shortLabel: '4th Hour' },
    { key: 'Hour 5', label: 'Hour 5 (10:00 - 11:00)', shortLabel: '5th Hour' },
    { key: 'Hour 6', label: 'Hour 6 (11:00 - 12:00)', shortLabel: '6th Hour' },
    { key: 'Hour 7', label: 'Hour 7 (12:00 - 13:00)', shortLabel: '7th Hour' },
    { key: 'Hour 8', label: 'Hour 8 (13:00 - 14:00)', shortLabel: '8th Hour' }
  ];

  // Load existing records from DB on mount
  useEffect(() => {
    loadDatabaseOptions();
  }, []);

  // When machine, date or shift changes, load hourly data & tool plans
  useEffect(() => {
    loadMachineToolPlans(selectedMachine);
    loadHourlyRecords();
  }, [selectedMachine, activeDate, selectedShift]);

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadDatabaseOptions = async () => {
    try {
      const [machRes, empRes] = await Promise.all([
        api.getMachines(),
        api.getEmployees()
      ]);

      const machines = machRes.machines || [];
      setMachinesList(machines);

      const employees = empRes.employees || [];
      const opList = employees.map(e => ({
        id: e.emp_id,
        name: e.name,
        display: `${e.name} (${e.emp_id})`
      }));
      setOperatorsList(opList);
      if (opList.length > 0 && !selectedOperator) {
        setSelectedOperator(opList[0].display);
      }
    } catch (err) {
      console.warn('Failed to load DB dropdown options:', err);
    }
  };

  const loadMachineToolPlans = async (machineNum) => {
    try {
      const isTandem = machineNum.includes('LP') || machineNum.includes('HP');
      const defTarget = isTandem ? 125 : 75;
      setTargetQty(defTarget);

      const res = await api.getPlans(machineNum);
      const plans = res.plans || [];
      const tools = plans.map(p => ({
        toolNumber: p.tool_number,
        partName: p.part_name || 'Standard Die',
        display: `${p.tool_number} - ${p.part_name || 'Die'}`
      }));

      // Add common default tools if machine has no specific tool plan yet
      if (tools.length === 0) {
        tools.push(
          { toolNumber: `TL-${machineNum}-01`, partName: 'Die Standard', display: `TL-${machineNum}-01 (Standard)` },
          { toolNumber: 'TL-1002-CTR', partName: 'Center Pillar', display: 'TL-1002-CTR (Center Pillar)' },
          { toolNumber: 'TL-2010-DRF', partName: 'Door Frame', display: 'TL-2010-DRF (Door Frame)' }
        );
      }
      setToolOptions(tools);
      if (tools[0]) setToolNumber(tools[0].toolNumber);
    } catch (e) {
      setToolOptions([
        { toolNumber: 'TL-1002-CTR', partName: 'Center Pillar', display: 'TL-1002-CTR' },
        { toolNumber: 'TL-2010-DRF', partName: 'Door Frame', display: 'TL-2010-DRF' }
      ]);
    }
  };

  const loadHourlyRecords = async () => {
    try {
      setLoading(true);
      const res = await api.getHourlyProduction({
        machine_or_line: selectedMachine,
        date: activeDate,
        shift: selectedShift
      });
      const serverRecords = res.records || [];
      setRecords(serverRecords);

      // If an existing record exists for currently selected hour, prefill form
      const currentRec = serverRecords.find(r => r.hour_interval && r.hour_interval.includes(selectedHour));
      if (currentRec) {
        if (currentRec.tool_number) setToolNumber(currentRec.tool_number);
        if (currentRec.operator_name) setSelectedOperator(currentRec.operator_name);
        setTargetQty(currentRec.target_qty || 75);
        setActualQty(currentRec.actual_qty || 0);
        setRejectedQty(currentRec.rejected_qty || 0);
        setDowntimeMinutes(currentRec.downtime_minutes || 0);
        setDowntimeReason(currentRec.downtime_reason || '');
      }
    } catch (err) {
      console.warn('Load hourly error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Submit Hourly Production Entry
  const handleSaveEntry = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const isTandem = selectedMachine.includes('LP') || selectedMachine.includes('HP');
      const goodCount = Math.max(0, actualQty - rejectedQty);

      const payload = {
        production_type: isTandem ? 'Tandem' : 'NC',
        machine_or_line: selectedMachine,
        tool_number: toolNumber,
        operator_name: selectedOperator,
        target_qty: parseInt(targetQty, 10) || 0,
        actual_qty: parseInt(actualQty, 10) || 0,
        good_qty: goodCount,
        rejected_qty: parseInt(rejectedQty, 10) || 0,
        downtime_minutes: parseInt(downtimeMinutes, 10) || 0,
        downtime_reason: downtimeReason,
        remarks: remarks,
        hour_interval: selectedHour,
        date: activeDate,
        shift: selectedShift
      };

      await api.saveHourlyProduction(payload);
      showNotice('success', `Saved ${selectedMachine} output for ${selectedHour}: ${actualQty} parts (Tool: ${toolNumber})`);
      
      // Auto-advance to next hour for quick sequential shopfloor entry
      const currentIdx = hoursList.findIndex(h => h.key === selectedHour);
      if (currentIdx >= 0 && currentIdx < hoursList.length - 1) {
        setSelectedHour(hoursList[currentIdx + 1].key);
      }

      loadHourlyRecords();
      if (onSync) onSync();
    } catch (err) {
      showNotice('error', err.message || 'Failed to save production entry');
    } finally {
      setSaving(false);
    }
  };

  // Handle clicking an hour row in the table to load its data
  const handleSelectTableRow = (hourKey) => {
    setSelectedHour(hourKey);
    const found = records.find(r => r.hour_interval && r.hour_interval.includes(hourKey));
    if (found) {
      if (found.tool_number) setToolNumber(found.tool_number);
      if (found.operator_name) setSelectedOperator(found.operator_name);
      setTargetQty(found.target_qty || 75);
      setActualQty(found.actual_qty || 0);
      setRejectedQty(found.rejected_qty || 0);
      setDowntimeMinutes(found.downtime_minutes || 0);
      setDowntimeReason(found.downtime_reason || '');
    }
  };

  // Aggregates for shift
  const totalTarget = records.reduce((sum, r) => sum + (r.target_qty || 0), 0);
  const totalActual = records.reduce((sum, r) => sum + (r.actual_qty || 0), 0);
  const totalGood = records.reduce((sum, r) => sum + (r.good_qty || 0), 0);
  const totalScrap = records.reduce((sum, r) => sum + (r.rejected_qty || 0), 0);
  const totalDowntime = records.reduce((sum, r) => sum + (r.downtime_minutes || 0), 0);
  const shiftAchieve = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  return (
    <div style={{ padding: '16px', background: '#f8fafc', minHeight: '100%' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 14,
          background: notification.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${notification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: notification.type === 'success' ? '#065f46' : '#991b1b',
          fontWeight: 700,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '16px 20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ 
                background: '#fef3c7', 
                color: '#92400e', 
                padding: '4px 10px', 
                borderRadius: 6, 
                fontWeight: 800, 
                fontSize: '0.72rem',
                border: '1px solid #fde68a'
              }}>
                PAGE 2 • SHOPFLOOR LOGGING
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Hourly Production Entry
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 3 }}>
              Rapid shopfloor entry with tool tracking, target verification, and 8-hour progress monitoring
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#475569', background: '#f1f5f9', padding: '6px 12px', borderRadius: 6, fontWeight: 700 }}>
              📅 {activeDate} • {selectedShift}
            </span>
            <button
              onClick={loadHourlyRecords}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 6,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* CORE FORM: 6 MANDATORY FIELDS (Tool, Machine, Operator, Target, Hour, Actual) */}
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '18px 20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 20
      }}>
        <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 10, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color="#1e40af" />
            <span>Production Entry Form</span>
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Records are stored directly in production_records
          </span>
        </div>

        <form onSubmit={handleSaveEntry}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 16
          }}>
            {/* 1. MACHINE SELECTION */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                1. Machine Selection *
              </label>
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  background: '#ffffff'
                }}
              >
                <optgroup label="NC Machine Presses (16 Units)">
                  {Array.from({ length: 16 }, (_, i) => {
                    const id = `NC-${String(i + 1).padStart(2, '0')}`;
                    return <option key={id} value={id}>{id} (NC Press)</option>;
                  })}
                </optgroup>
                <optgroup label="Tandem Production Lines (6 Lines)">
                  <option value="LP-1">LP-1 (Low Press 1)</option>
                  <option value="LP-2">LP-2 (Low Press 2)</option>
                  <option value="HP-1">HP-1 (Heavy Press 1)</option>
                  <option value="HP-2">HP-2 (Heavy Press 2)</option>
                  <option value="HP-3">HP-3 (Heavy Press 3)</option>
                  <option value="HP-4">HP-4 (Heavy Press 4)</option>
                </optgroup>
              </select>
            </div>

            {/* 2. TOOL NUMBER */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                2. Tool Number *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  list="tool-datalist"
                  value={toolNumber}
                  onChange={(e) => setToolNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. TL-1002-CTR"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#1e40af',
                    background: '#f8fafc',
                    fontFamily: 'monospace'
                  }}
                  required
                />
                <datalist id="tool-datalist">
                  {toolOptions.map((t, idx) => (
                    <option key={idx} value={t.toolNumber}>{t.display}</option>
                  ))}
                </datalist>
              </div>
            </div>

            {/* 3. OPERATOR SELECTION */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                3. Operator Selection *
              </label>
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#ffffff'
                }}
                required
              >
                {operatorsList.map((op) => (
                  <option key={op.id} value={op.display}>{op.display}</option>
                ))}
              </select>
            </div>

            {/* 4. HOUR SELECTION */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                4. Hour Selection *
              </label>
              <select
                value={selectedHour}
                onChange={(e) => handleSelectTableRow(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  background: '#ffffff'
                }}
              >
                {hoursList.map((h) => (
                  <option key={h.key} value={h.key}>{h.label}</option>
                ))}
              </select>
            </div>

            {/* 5. TARGET PRODUCTION */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                5. Target Production *
              </label>
              <input
                type="number"
                min="0"
                value={targetQty}
                onChange={(e) => setTargetQty(parseInt(e.target.value, 10) || 0)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: '#334155'
                }}
                required
              />
            </div>

            {/* 6. ACTUAL PRODUCTION */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', marginBottom: 6 }}>
                6. Actual Production *
              </label>
              <input
                type="number"
                min="0"
                value={actualQty}
                onChange={(e) => setActualQty(parseInt(e.target.value, 10) || 0)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '2px solid #2563eb',
                  fontSize: '1rem',
                  fontWeight: 900,
                  color: '#1e40af',
                  background: '#eff6ff'
                }}
                required
              />
            </div>
          </div>

          {/* Quick Hour Pill Buttons */}
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>
              Quick Hour Switch:
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {hoursList.map((h) => {
                const isSelected = selectedHour === h.key;
                const existing = records.find(r => r.hour_interval && r.hour_interval.includes(h.key));
                const hasActual = existing && existing.actual_qty > 0;

                return (
                  <button
                    key={h.key}
                    type="button"
                    onClick={() => handleSelectTableRow(h.key)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #1e40af' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : hasActual ? '#f0fdf4' : '#ffffff',
                      color: isSelected ? '#1e40af' : hasActual ? '#166534' : '#64748b'
                    }}
                  >
                    {h.shortLabel} {hasActual && `(${existing.actual_qty})`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quality & Downtime Secondary Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
            background: '#f8fafc',
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            marginBottom: 16
          }}>
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', display: 'block', marginBottom: 4 }}>
                Good Parts
              </label>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#166534', padding: '6px 0' }}>
                {Math.max(0, actualQty - rejectedQty)}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: 4 }}>
                Rejections (Scrap)
              </label>
              <input
                type="number"
                min="0"
                value={rejectedQty}
                onChange={(e) => setRejectedQty(parseInt(e.target.value, 10) || 0)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309', display: 'block', marginBottom: 4 }}>
                Downtime (Minutes)
              </label>
              <input
                type="number"
                min="0"
                value={downtimeMinutes}
                onChange={(e) => setDowntimeMinutes(parseInt(e.target.value, 10) || 0)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
                Downtime Reason
              </label>
              <input
                type="text"
                placeholder="Die change, inspection, etc."
                value={downtimeReason}
                onChange={(e) => setDowntimeReason(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          {/* Submit Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Hourly Variance: <strong style={{ color: actualQty >= targetQty ? '#16a34a' : '#dc2626' }}>
                {actualQty - targetQty >= 0 ? `+${actualQty - targetQty} Surplus` : `${actualQty - targetQty} Deficit`}
              </strong>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 24px',
                borderRadius: 8,
                background: '#1e40af',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(30,64,175,0.25)'
              }}
            >
              <Save size={16} />
              <span>{saving ? 'Recording Output...' : `Save ${selectedHour} Output`}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 8-HOUR PRODUCTION MATRIX TABLE FOR THIS MACHINE */}
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '18px 20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
            8-Hour Shift Summary — {selectedMachine}
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Click any row to load into form
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: '#334155' }}>Hour</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: '#334155' }}>Tool Number</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: '#334155' }}>Operator</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#334155' }}>Target</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#1e40af' }}>Actual</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>Good</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>Scrap</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#b45309' }}>Downtime</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#334155' }}>Status %</th>
              </tr>
            </thead>
            <tbody>
              {hoursList.map((h) => {
                const rec = records.find(r => r.hour_interval && r.hour_interval.includes(h.key));
                const target = rec ? rec.target_qty : (selectedMachine.includes('LP') || selectedMachine.includes('HP') ? 125 : 75);
                const actual = rec ? rec.actual_qty : 0;
                const good = rec ? rec.good_qty : 0;
                const scrap = rec ? rec.rejected_qty : 0;
                const dt = rec ? rec.downtime_minutes : 0;
                const op = rec ? (rec.operator_name || '—') : '—';
                const tool = rec ? (rec.tool_number || '—') : '—';
                const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
                const isSelected = selectedHour === h.key;

                return (
                  <tr
                    key={h.key}
                    onClick={() => handleSelectTableRow(h.key)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: isSelected ? '#1e40af' : '#0f172a' }}>
                      {h.shortLabel}
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#1e40af', fontWeight: 600 }}>
                      {tool}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#475569' }}>
                      {op}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>
                      {target}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#1e40af' }}>
                      {actual}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>
                      {good}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: scrap > 0 ? '#dc2626' : '#94a3b8' }}>
                      {scrap}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: dt > 0 ? '#b45309' : '#94a3b8' }}>
                      {dt > 0 ? `${dt}m` : '0'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: pct >= 95 ? '#dcfce7' : pct >= 80 ? '#fef3c7' : '#fee2e2',
                        color: pct >= 95 ? '#15803d' : pct >= 80 ? '#b45309' : '#b91c1c'
                      }}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                <td colSpan={3} style={{ padding: '10px', color: '#0f172a' }}>Shift Total Aggregate:</td>
                <td style={{ padding: '10px', textAlign: 'right', color: '#64748b' }}>{totalTarget}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: '#1e40af', fontSize: '0.9rem' }}>{totalActual}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: '#16a34a' }}>{totalGood}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: totalScrap > 0 ? '#dc2626' : '#64748b' }}>{totalScrap}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: '#b45309' }}>{totalDowntime}m</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    background: shiftAchieve >= 95 ? '#16a34a' : shiftAchieve >= 80 ? '#f59e0b' : '#ef4444',
                    color: '#ffffff'
                  }}>
                    {shiftAchieve}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
