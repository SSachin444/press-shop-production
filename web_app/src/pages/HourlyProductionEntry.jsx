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
  AlertTriangle,
  Zap
} from 'lucide-react';
import { api, DEFAULT_DOWNTIME_CODES } from '../api';

export default function HourlyProductionEntry({ 
  selectedDate, 
  selectedShift = 'Shift A', 
  initialMachine = 'NC-01',
  onSync 
}) {
  const activeDate = selectedDate || new Date().toISOString().split('T')[0];

  // Core Form State
  const [selectedMachine, setSelectedMachine] = useState(initialMachine);
  const [toolNumber, setToolNumber] = useState('TL-1001-CTR');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedHour, setSelectedHour] = useState('Hour 1');
  
  // UPH (Units Per Hour): Target = UPH × 60 for NC machines
  const [uphValue, setUphValue] = useState(10);
  const [calculatedTarget, setCalculatedTarget] = useState(600);
  const [actualQty, setActualQty] = useState(0);

  // Quality & Downtime
  const [rejectedQty, setRejectedQty] = useState(0);
  const [downtimeMinutes, setDowntimeMinutes] = useState(0);
  const [downtimeCode, setDowntimeCode] = useState('D01');
  const [downtimeReason, setDowntimeReason] = useState('Machine Breakdown');
  const [remarks, setRemarks] = useState('');

  // Dropdown options
  const [machinesList, setMachinesList] = useState([]);
  const [operatorsList, setOperatorsList] = useState([]);
  const [toolOptions, setToolOptions] = useState([]);
  const [downtimeCodes, setDowntimeCodes] = useState(DEFAULT_DOWNTIME_CODES);

  // 8-hour production records
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const hoursList = [
    { key: 'Hour 1', label: 'Hour 1 (08:00 - 09:00)', shortLabel: '1st Hr' },
    { key: 'Hour 2', label: 'Hour 2 (09:00 - 10:00)', shortLabel: '2nd Hr' },
    { key: 'Hour 3', label: 'Hour 3 (10:00 - 11:00)', shortLabel: '3rd Hr' },
    { key: 'Hour 4', label: 'Hour 4 (11:00 - 12:00)', shortLabel: '4th Hr' },
    { key: 'Hour 5', label: 'Hour 5 (12:30 - 13:30)', shortLabel: '5th Hr' },
    { key: 'Hour 6', label: 'Hour 6 (13:30 - 14:30)', shortLabel: '6th Hr' },
    { key: 'Hour 7', label: 'Hour 7 (14:30 - 15:30)', shortLabel: '7th Hr' },
    { key: 'Hour 8', label: 'Hour 8 (15:30 - 16:30)', shortLabel: '8th Hr' }
  ];

  // Load database options on mount
  useEffect(() => {
    loadDatabaseOptions();
  }, []);

  // Recalculate target whenever UPH changes: Target = UPH * 60
  useEffect(() => {
    const calc = Math.round(Math.max(0, parseFloat(uphValue) || 0) * 60);
    setCalculatedTarget(calc);
  }, [uphValue]);

  // When machine, date or shift changes, reload
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
      const [machRes, empRes, dtRes] = await Promise.all([
        api.getMachines(),
        api.getEmployees(),
        api.getDowntimeCodes()
      ]);

      setMachinesList(machRes.machines || []);
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
      if (dtRes && dtRes.codes && dtRes.codes.length > 0) {
        setDowntimeCodes(dtRes.codes);
      }
    } catch (err) {
      console.warn('Failed to load database options:', err);
    }
  };

  const loadMachineToolPlans = async (machineNum) => {
    try {
      const res = await api.getPlans(machineNum);
      const plans = res.plans || [];
      const tools = plans.map(p => ({
        toolNumber: p.tool_number,
        partName: p.part_name || 'Standard Die',
        display: `${p.tool_number} - ${p.part_name || 'Die'}`
      }));

      if (tools.length === 0) {
        tools.push(
          { toolNumber: 'TL-1001-CTR', partName: 'Center Pillar', display: 'TL-1001-CTR (Center Pillar)' },
          { toolNumber: 'TL-2010-DRF', partName: 'Door Frame', display: 'TL-2010-DRF (Door Frame)' }
        );
      }
      setToolOptions(tools);
      if (tools[0]) setToolNumber(tools[0].toolNumber);
    } catch (e) {
      setToolOptions([
        { toolNumber: 'TL-1001-CTR', partName: 'Center Pillar', display: 'TL-1001-CTR' }
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

      // Prefill if record exists for currently selected hour
      const currentRec = serverRecords.find(r => r.hour_interval && r.hour_interval.includes(selectedHour));
      if (currentRec) {
        if (currentRec.tool_number) setToolNumber(currentRec.tool_number);
        if (currentRec.operator_name) setSelectedOperator(currentRec.operator_name);
        if (currentRec.uph && Number(currentRec.uph) > 0) {
          setUphValue(Number(currentRec.uph));
        }
        setActualQty(Number(currentRec.actual_qty) || 0);
        setRejectedQty(Number(currentRec.rejected_qty) || 0);
        setDowntimeMinutes(Number(currentRec.downtime_minutes) || 0);
        setDowntimeCode(currentRec.downtime_code || 'D01');
        setDowntimeReason(currentRec.downtime_reason || 'Machine Breakdown');
        setRemarks(currentRec.remarks || '');
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

      // Target Production = UPH × 60
      const finalTarget = calculatedTarget;
      const prodPct = finalTarget > 0 ? Number(((actualQty / finalTarget) * 100).toFixed(1)) : 0;
      const hourlyPct = prodPct;
      const entryTimeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Clean operator name
      const opNameClean = selectedOperator.includes('(') ? selectedOperator.split('(')[0].trim() : selectedOperator;

      const payload = {
        production_type: isTandem ? 'Tandem' : 'NC',
        machine_or_line: selectedMachine,
        tool_number: toolNumber,
        operator_name: opNameClean,
        uph: Number(uphValue) || 10,
        target_qty: finalTarget,
        actual_qty: parseInt(actualQty, 10) || 0,
        good_qty: goodCount,
        rejected_qty: parseInt(rejectedQty, 10) || 0,
        production_pct: prodPct,
        hourly_output_pct: hourlyPct,
        downtime_minutes: parseInt(downtimeMinutes, 10) || 0,
        downtime_code: downtimeCode,
        downtime_reason: downtimeReason,
        remarks: remarks,
        entry_time: entryTimeStr,
        hour_interval: selectedHour,
        date: activeDate,
        shift: selectedShift
      };

      await api.saveHourlyProduction(payload);
      showNotice('success', `Saved ${selectedMachine} [${selectedHour}]: UPH=${uphValue}, Target=${finalTarget}, Actual=${actualQty}, Achievement=${prodPct}%`);
      
      // Auto-advance to next hour
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

  const handleSelectTableRow = (hourKey) => {
    setSelectedHour(hourKey);
    const found = records.find(r => r.hour_interval && r.hour_interval.includes(hourKey));
    if (found) {
      if (found.tool_number) setToolNumber(found.tool_number);
      if (found.operator_name) setSelectedOperator(found.operator_name);
      if (found.uph && Number(found.uph) > 0) setUphValue(Number(found.uph));
      setActualQty(Number(found.actual_qty) || 0);
      setRejectedQty(Number(found.rejected_qty) || 0);
      setDowntimeMinutes(Number(found.downtime_minutes) || 0);
      setDowntimeCode(found.downtime_code || 'D01');
      setDowntimeReason(found.downtime_reason || 'Machine Breakdown');
    }
  };

  // Aggregates for shift
  const totalTarget = records.reduce((sum, r) => sum + (Number(r.target_qty) || 0), 0);
  const totalActual = records.reduce((sum, r) => sum + (Number(r.actual_qty) || 0), 0);
  const totalDowntime = records.reduce((sum, r) => sum + (Number(r.downtime_minutes) || 0), 0);
  const shiftAchieve = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  return (
    <div style={{ padding: '16px', background: '#f8fafc', minHeight: '100%', color: '#0f172a' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 14,
          background: notification.type === 'success' ? '#f0fdf4' : '#fff7ed',
          border: `1px solid ${notification.type === 'success' ? '#bbf7d0' : '#fed7aa'}`,
          color: notification.type === 'success' ? '#15803d' : '#c2410c',
          fontWeight: 700,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} color="#16a34a" /> : <AlertCircle size={18} color="#ea580c" />}
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
                background: '#ea580c', 
                color: '#ffffff', 
                padding: '4px 10px', 
                borderRadius: 6, 
                fontWeight: 900, 
                fontSize: '0.72rem',
                letterSpacing: '0.05em'
              }}>
                UPH CADENCE
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Hourly Production Entry
              </h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
              Automatic target generation: <strong style={{ color: '#ea580c' }}>Target Production = UPH × 60</strong>. Operator enters actual output.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#0f172a', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 6, fontWeight: 700 }}>
              📅 {activeDate} • <span style={{ color: '#ea580c' }}>{selectedShift}</span>
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

      {/* CORE ENTRY FORM */}
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
            <Clock size={18} color="#ea580c" />
            <span>Hourly Production Entry Form</span>
          </h3>
          <span style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 800 }}>
            ✓ Target Calculated Automatically: UPH × 60
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
                2. Tool / Die Number *
              </label>
              <input
                type="text"
                list="tool-options-list"
                value={toolNumber}
                onChange={(e) => setToolNumber(e.target.value.toUpperCase())}
                placeholder="e.g. TL-1001-CTR"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#ea580c',
                  background: '#fff7ed',
                  fontFamily: 'monospace'
                }}
                required
              />
              <datalist id="tool-options-list">
                {toolOptions.map((t, idx) => (
                  <option key={idx} value={t.toolNumber}>{t.display}</option>
                ))}
              </datalist>
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

            {/* 5. UPH INPUT (Units Per Hour) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#ea580c', marginBottom: 6 }}>
                5. UPH (Units Per Hour) *
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={uphValue}
                onChange={(e) => setUphValue(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '2px solid #ea580c',
                  fontSize: '0.9rem',
                  fontWeight: 900,
                  color: '#ea580c',
                  background: '#fff7ed'
                }}
                required
              />
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#16a34a', marginTop: 4, display: 'block' }}>
                Auto Target: {calculatedTarget} pcs ({uphValue} × 60)
              </span>
            </div>

            {/* 6. ACTUAL PRODUCTION */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                6. Actual Production (Pcs) *
              </label>
              <input
                type="number"
                min="0"
                value={actualQty}
                onChange={(e) => setActualQty(parseInt(e.target.value, 10) || 0)}
                placeholder="Enter actual parts"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '2px solid #16a34a',
                  fontSize: '1rem',
                  fontWeight: 900,
                  color: '#16a34a',
                  background: '#f0fdf4'
                }}
                required
              />
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', marginTop: 4, display: 'block' }}>
                Achievement: {calculatedTarget > 0 ? Math.round((actualQty / calculatedTarget) * 100) : 0}%
              </span>
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
                      border: isSelected ? '2px solid #ea580c' : '1px solid #e2e8f0',
                      background: isSelected ? '#fff7ed' : hasActual ? '#f0fdf4' : '#ffffff',
                      color: isSelected ? '#ea580c' : hasActual ? '#15803d' : '#64748b'
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            background: '#f8fafc',
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            marginBottom: 16
          }}>
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', display: 'block', marginBottom: 4 }}>
                Good Parts Output
              </label>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#15803d', padding: '6px 0' }}>
                {Math.max(0, actualQty - rejectedQty)} pcs
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
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ea580c', display: 'block', marginBottom: 4 }}>
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
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Downtime Code (6 Codes)
              </label>
              <select
                value={downtimeCode}
                onChange={(e) => {
                  setDowntimeCode(e.target.value);
                  const matched = downtimeCodes.find(c => c.code === e.target.value);
                  if (matched) setDowntimeReason(matched.name);
                }}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
              >
                {downtimeCodes.map(c => (
                  <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
                Remarks / Observation
              </label>
              <input
                type="text"
                placeholder="Optional notes"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: '#ea580c',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
              }}
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : `Save ${selectedHour} Output`}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 8-HOUR MONITORING MATRIX */}
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '18px 20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
            Shift Production Matrix ({selectedMachine} • {selectedShift})
          </h3>
          <div style={{ display: 'flex', gap: 14, fontSize: '0.8rem' }}>
            <span>Target: <strong style={{ color: '#ea580c' }}>{totalTarget}</strong></span>
            <span>Actual: <strong style={{ color: '#16a34a' }}>{totalActual}</strong></span>
            <span>Achievement: <strong style={{ color: shiftAchieve >= 85 ? '#16a34a' : '#ea580c' }}>{shiftAchieve}%</strong></span>
            <span>Downtime: <strong>{totalDowntime}m</strong></span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Hour Interval</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Tool Number</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Operator</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, color: '#ea580c' }}>UPH</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Target (UPH×60)</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Actual Output</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Production %</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Hourly Output %</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Downtime</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Entry Time</th>
              </tr>
            </thead>
            <tbody>
              {hoursList.map(h => {
                const rec = records.find(r => r.hour_interval && r.hour_interval.includes(h.key));
                const tgt = rec ? (Number(rec.target_qty) || 0) : 0;
                const act = rec ? (Number(rec.actual_qty) || 0) : 0;
                const pct = tgt > 0 ? Math.round((act / tgt) * 100) : 0;

                return (
                  <tr key={h.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{h.label}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{rec?.tool_number || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{rec?.operator_name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: '#ea580c' }}>{rec?.uph || '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 800 }}>{tgt > 0 ? `${tgt} pcs` : '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 900, color: act > 0 ? '#16a34a' : '#94a3b8' }}>
                      {act > 0 ? `${act} pcs` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {tgt > 0 ? (
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontWeight: 800,
                          fontSize: '0.74rem',
                          background: pct >= 85 ? '#dcfce7' : '#ffedd5',
                          color: pct >= 85 ? '#15803d' : '#ea580c'
                        }}>
                          {pct}%
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {tgt > 0 ? (
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontWeight: 800,
                          fontSize: '0.74rem',
                          background: pct >= 85 ? '#dcfce7' : '#ffedd5',
                          color: pct >= 85 ? '#15803d' : '#ea580c'
                        }}>
                          {pct}%
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {rec && rec.downtime_minutes > 0 ? (
                        <span style={{ color: '#ea580c', fontWeight: 700 }}>{rec.downtime_minutes}m ({rec.downtime_reason || 'Stop'})</span>
                      ) : '0m'}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>
                      {rec?.entry_time || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
