import React, { useState, useEffect } from 'react';
import { 
  Timer, 
  Cpu, 
  Layers, 
  GitBranch, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  User, 
  RefreshCw, 
  TrendingUp, 
  BarChart3, 
  Clock, 
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Wrench,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { api, DEFAULT_DOWNTIME_CODES } from '../api';

export default function HourlyProductionPage({ 
  selectedDate, 
  selectedShift = 'Shift A', 
  initialMachine = 'NC-01', 
  initialType = 'NC',
  onSync
}) {
  const activeDate = selectedDate || new Date().toISOString().split('T')[0];

  // Machine & Config Selection
  const [productionType, setProductionType] = useState(initialType || 'NC');
  const [selectedMachine, setSelectedMachine] = useState(initialMachine || 'NC-01');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [toolNumber, setToolNumber] = useState('TL-1001-CTR');
  const [operatorsList, setOperatorsList] = useState([]);
  
  // UPH (Units Per Hour) for NC machines - Target = UPH * 60
  const [uphValue, setUphValue] = useState(10); // Default 10 units per hour = 600 target
  const [downtimeCodes, setDowntimeCodes] = useState(DEFAULT_DOWNTIME_CODES);
  const [activeTab, setActiveTab] = useState('entry'); // 'entry' | 'machine-comparison' | 'operator-comparison'

  const ncMachines = Array.from({ length: 16 }, (_, i) => `NC-${String(i + 1).padStart(2, '0')}`);
  const tandemLines = ['LP-1', 'LP-2', 'HP-1', 'HP-2', 'HP-3', 'HP-4'];

  const hourIntervals = [
    { num: 1, label: 'Hour 1 (08:00 - 09:00)' },
    { num: 2, label: 'Hour 2 (09:00 - 10:00)' },
    { num: 3, label: 'Hour 3 (10:00 - 11:00)' },
    { num: 4, label: 'Hour 4 (11:00 - 12:00)' },
    { num: 5, label: 'Hour 5 (12:30 - 13:30)' },
    { num: 6, label: 'Hour 6 (13:30 - 14:30)' },
    { num: 7, label: 'Hour 7 (14:30 - 15:30)' },
    { num: 8, label: 'Hour 8 (15:30 - 16:30)' }
  ];

  // 8 Hours row state capturing all required fields:
  // Date, Shift, Machine, Tool, Operator, UPH, Calculated Target, Actual, Production %, Hourly Output %, Entry Time
  const [hoursState, setHoursState] = useState(() =>
    hourIntervals.map(h => ({
      hourNum: h.num,
      label: h.label,
      uph: 10,
      target: 600, // UPH * 60
      actual: 0,
      rejected: 0,
      downtime: 0,
      downtimeCode: 'D01',
      reason: 'Machine Breakdown',
      remarks: '',
      entryTime: '',
      operator: '',
      tool: 'TL-1001-CTR',
      isSaved: false
    }))
  );

  const [allHourlyRecords, setAllHourlyRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingHour, setSavingHour] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadDatabaseResources();
  }, []);

  useEffect(() => {
    loadHourlyDataForMachine();
    loadAllShiftHourly();
  }, [activeDate, selectedShift, selectedMachine]);

  const loadDatabaseResources = async () => {
    try {
      const [empRes, dtRes] = await Promise.all([
        api.getEmployees(),
        api.getDowntimeCodes()
      ]);
      const emps = empRes.employees || [];
      setOperatorsList(emps);
      if (emps.length > 0 && !selectedOperator) {
        setSelectedOperator(emps[0].name);
      }
      if (dtRes && dtRes.codes && dtRes.codes.length > 0) {
        setDowntimeCodes(dtRes.codes);
      }
    } catch (e) {
      console.warn('Initial resources load error:', e);
    }
  };

  const loadHourlyDataForMachine = async () => {
    try {
      setLoading(true);
      const res = await api.getHourlyProduction({
        date: activeDate,
        shift: selectedShift,
        machine: selectedMachine
      });

      const records = res.records || [];
      const recMap = {};
      records.forEach(r => {
        recMap[r.hour_interval] = r;
      });

      // Update hoursState from actual saved database records
      setHoursState(hourIntervals.map(h => {
        const found = recMap[h.label] || recMap[`Hour ${h.num}`];
        if (found) {
          const rowUph = Number(found.uph) || uphValue;
          // Target Production = UPH × 60 for NC machines
          const calcTarget = Number(found.target_qty) || (rowUph > 0 ? Math.round(rowUph * 60) : 600);
          return {
            hourNum: h.num,
            label: h.label,
            uph: rowUph,
            target: calcTarget,
            actual: Number(found.actual_qty) || 0,
            rejected: Number(found.rejected_qty) || 0,
            downtime: Number(found.downtime_minutes) || 0,
            downtimeCode: found.downtime_code || 'D01',
            reason: found.downtime_reason || 'Machine Breakdown',
            remarks: found.remarks || '',
            entryTime: found.entry_time || '',
            operator: found.operator_name || selectedOperator,
            tool: found.tool_number || toolNumber,
            isSaved: true
          };
        }
        return {
          hourNum: h.num,
          label: h.label,
          uph: uphValue,
          target: Math.round(uphValue * 60),
          actual: 0,
          rejected: 0,
          downtime: 0,
          downtimeCode: 'D01',
          reason: 'Machine Breakdown',
          remarks: '',
          entryTime: '',
          operator: selectedOperator,
          tool: toolNumber,
          isSaved: false
        };
      }));

      if (records.length > 0) {
        if (records[0].operator_name) setSelectedOperator(records[0].operator_name);
        if (records[0].tool_number) setToolNumber(records[0].tool_number);
        if (records[0].uph && Number(records[0].uph) > 0) setUphValue(Number(records[0].uph));
      }
    } catch (e) {
      console.warn('Hourly fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadAllShiftHourly = async () => {
    try {
      const res = await api.getHourlyProduction({
        date: activeDate,
        shift: selectedShift
      });
      setAllHourlyRecords(res.records || []);
    } catch (e) {
      setAllHourlyRecords([]);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleTypeChange = (type) => {
    setProductionType(type);
    const firstMach = type === 'NC' ? 'NC-01' : 'LP-1';
    setSelectedMachine(firstMach);
    const defUph = type === 'NC' ? 10 : 12;
    setUphValue(defUph);
    setHoursState(prev => prev.map(h => ({
      ...h,
      uph: defUph,
      target: Math.round(defUph * 60)
    })));
  };

  // When top-level UPH changes, update rows that haven't been saved yet
  const handleUphChange = (newUph) => {
    const val = Math.max(0, parseFloat(newUph) || 0);
    setUphValue(val);
    const calcTarget = Math.round(val * 60);
    setHoursState(prev => prev.map(h => ({
      ...h,
      uph: val,
      target: calcTarget
    })));
  };

  // Row updates
  const handleUpdateRow = (index, field, value) => {
    setHoursState(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };
      
      // If UPH on row is changed, automatically recalculate target = UPH * 60
      if (field === 'uph') {
        const u = Math.max(0, parseFloat(value) || 0);
        row.uph = u;
        row.target = Math.round(u * 60);
      }
      
      // If downtime code is changed, update reason description
      if (field === 'downtimeCode') {
        const matched = downtimeCodes.find(c => c.code === value);
        if (matched) {
          row.reason = matched.name;
        }
      }

      updated[index] = row;
      return updated;
    });
  };

  // Save single hourly entry capturing all 11 required parameters
  const handleSaveSingleHour = async (hourIndex) => {
    const row = hoursState[hourIndex];
    try {
      setSavingHour(row.hourNum);
      const currentTimeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const finalEntryTime = row.entryTime || currentTimeStr;

      // Target Production = UPH × 60
      const finalUph = Number(row.uph) || uphValue;
      const calcTarget = Math.round(finalUph * 60);
      const actualQty = Number(row.actual) || 0;
      const prodPct = calcTarget > 0 ? Number(((actualQty / calcTarget) * 100).toFixed(1)) : 0;
      const hourlyPct = prodPct;

      const payload = {
        date: activeDate,
        shift: selectedShift,
        machine_or_line: selectedMachine,
        production_type: productionType,
        tool_number: toolNumber || row.tool || 'TL-1001-CTR',
        operator_name: selectedOperator || row.operator || 'Line Operator',
        uph: finalUph,
        target_qty: calcTarget,
        actual_qty: actualQty,
        good_qty: Math.max(0, actualQty - (Number(row.rejected) || 0)),
        rejected_qty: Number(row.rejected) || 0,
        production_pct: prodPct,
        hourly_output_pct: hourlyPct,
        downtime_minutes: Number(row.downtime) || 0,
        downtime_code: row.downtimeCode || 'D01',
        downtime_reason: row.reason || 'Machine Breakdown',
        remarks: row.remarks || '',
        entry_time: finalEntryTime,
        hour_interval: row.label
      };

      await api.saveHourlyProduction(payload);
      showNotice('success', `Saved ${selectedMachine} ${row.label}: Target=${calcTarget} (UPH×60), Actual=${actualQty}, Achievement=${prodPct}%`);
      
      setHoursState(prev => {
        const u = [...prev];
        u[hourIndex] = { ...u[hourIndex], isSaved: true, entryTime: finalEntryTime, target: calcTarget };
        return u;
      });

      loadAllShiftHourly();
      if (onSync) onSync();
    } catch (err) {
      showNotice('error', err.message || 'Failed to save hourly record');
    } finally {
      setSavingHour(null);
    }
  };

  // Save all 8 hours in batch
  const handleSaveAllHours = async () => {
    try {
      setSavingAll(true);
      const currentTimeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      let savedCount = 0;

      for (let i = 0; i < hoursState.length; i++) {
        const row = hoursState[i];
        if (row.actual > 0 || row.downtime > 0 || row.isSaved) {
          const finalUph = Number(row.uph) || uphValue;
          const calcTarget = Math.round(finalUph * 60);
          const actualQty = Number(row.actual) || 0;
          const prodPct = calcTarget > 0 ? Number(((actualQty / calcTarget) * 100).toFixed(1)) : 0;

          const payload = {
            date: activeDate,
            shift: selectedShift,
            machine_or_line: selectedMachine,
            production_type: productionType,
            tool_number: toolNumber || row.tool || 'TL-1001-CTR',
            operator_name: selectedOperator || row.operator || 'Line Operator',
            uph: finalUph,
            target_qty: calcTarget,
            actual_qty: actualQty,
            good_qty: Math.max(0, actualQty - (Number(row.rejected) || 0)),
            rejected_qty: Number(row.rejected) || 0,
            production_pct: prodPct,
            hourly_output_pct: prodPct,
            downtime_minutes: Number(row.downtime) || 0,
            downtime_code: row.downtimeCode || 'D01',
            downtime_reason: row.reason || 'Machine Breakdown',
            remarks: row.remarks || '',
            entry_time: row.entryTime || currentTimeStr,
            hour_interval: row.label
          };
          await api.saveHourlyProduction(payload);
          savedCount++;
        }
      }
      showNotice('success', `Successfully saved ${savedCount} hours for ${selectedMachine}. Calculations updated.`);
      loadHourlyDataForMachine();
      loadAllShiftHourly();
      if (onSync) onSync();
    } catch (err) {
      showNotice('error', err.message || 'Failed to save all records');
    } finally {
      setSavingAll(false);
    }
  };

  // Shift aggregates
  const totalShiftTarget = hoursState.reduce((sum, h) => sum + (Number(h.target) || 0), 0);
  const totalShiftActual = hoursState.reduce((sum, h) => sum + (Number(h.actual) || 0), 0);
  const totalShiftDowntime = hoursState.reduce((sum, h) => sum + (Number(h.downtime) || 0), 0);
  const shiftAchievePct = totalShiftTarget > 0 ? Number(((totalShiftActual / totalShiftTarget) * 100).toFixed(1)) : 0;

  return (
    <div style={{ padding: '20px', maxWidth: '1440px', margin: '0 auto', color: '#0f172a' }}>
      {/* Toast Alert */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 16,
          background: notification.type === 'success' ? '#f0fdf4' : '#fff7ed',
          border: `1px solid ${notification.type === 'success' ? '#bbf7d0' : '#fed7aa'}`,
          color: notification.type === 'success' ? '#15803d' : '#c2410c',
          fontWeight: 700,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} color="#16a34a" /> : <AlertCircle size={18} color="#ea580c" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Header with Industrial Orange / Green Theme */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        padding: '20px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                background: '#ea580c',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: 6,
                fontWeight: 900,
                fontSize: '0.72rem',
                letterSpacing: '0.05em'
              }}>
                UPH CADENCE CALCULATION
              </span>
              <span style={{
                background: '#16a34a',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: 6,
                fontWeight: 800,
                fontSize: '0.72rem'
              }}>
                TARGET = UPH × 60
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Hourly Production Entry
              </h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>
              Target production is calculated automatically: <strong style={{ color: '#ea580c' }}>Target = UPH × 60</strong>. Operators enter only actual units produced.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#0f172a', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '7px 14px', borderRadius: 8, fontWeight: 700 }}>
              📅 {activeDate} • <span style={{ color: '#ea580c' }}>{selectedShift}</span>
            </span>
            <button
              onClick={() => { loadHourlyDataForMachine(); loadAllShiftHourly(); }}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
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

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: 6,
          marginTop: 18,
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 8,
          width: 'fit-content'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('entry')}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'entry' ? '#ffffff' : 'transparent',
              color: activeTab === 'entry' ? '#ea580c' : '#64748b',
              fontWeight: activeTab === 'entry' ? 800 : 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'entry' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Hourly Production Grid
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('machine-comparison')}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'machine-comparison' ? '#ffffff' : 'transparent',
              color: activeTab === 'machine-comparison' ? '#ea580c' : '#64748b',
              fontWeight: activeTab === 'machine-comparison' ? 800 : 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'machine-comparison' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Machine Comparison
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('operator-comparison')}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'operator-comparison' ? '#ffffff' : 'transparent',
              color: activeTab === 'operator-comparison' ? '#ea580c' : '#64748b',
              fontWeight: activeTab === 'operator-comparison' ? 800 : 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'operator-comparison' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Operator Comparison
          </button>
        </div>

        {/* Machine & Operator Configuration Controls */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
          marginTop: 18,
          paddingTop: 16,
          borderTop: '1px solid #f1f5f9'
        }}>
          {/* Production Type Toggle */}
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 5 }}>
              Production Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                type="button"
                onClick={() => handleTypeChange('NC')}
                style={{
                  padding: '8px',
                  borderRadius: 6,
                  border: productionType === 'NC' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                  background: productionType === 'NC' ? '#fff7ed' : '#fff',
                  color: productionType === 'NC' ? '#ea580c' : '#475569',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                NC (16 Presses)
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('Tandem')}
                style={{
                  padding: '8px',
                  borderRadius: 6,
                  border: productionType === 'Tandem' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                  background: productionType === 'Tandem' ? '#f0fdf4' : '#fff',
                  color: productionType === 'Tandem' ? '#16a34a' : '#475569',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Tandem (6 Lines)
              </button>
            </div>
          </div>

          {/* Machine Selection */}
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 5 }}>
              Machine Selection *
            </label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 800, background: '#fff' }}
            >
              {productionType === 'NC'
                ? ncMachines.map(m => <option key={m} value={m}>{m} (Press Unit)</option>)
                : tandemLines.map(t => <option key={t} value={t}>{t} (Tandem Line)</option>)
              }
            </select>
          </div>

          {/* Tool / Die Number */}
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 5 }}>
              Tool / Die Number *
            </label>
            <input
              type="text"
              placeholder="e.g. TL-1001-CTR"
              value={toolNumber}
              onChange={(e) => setToolNumber(e.target.value.toUpperCase())}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace' }}
            />
          </div>

          {/* Operator Name */}
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 5 }}>
              Operator Assigned *
            </label>
            {operatorsList.length > 0 ? (
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600, background: '#fff' }}
              >
                {operatorsList.map(op => (
                  <option key={op.emp_id} value={op.name}>{op.name} ({op.emp_id})</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Operator name"
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            )}
          </div>

          {/* UPH Input (Replaces Manual Target for NC Machines) */}
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ea580c', display: 'block', marginBottom: 5 }}>
              ⚡ UPH (Units Per Hour) *
            </label>
            <input
              type="number"
              min="1"
              step="0.5"
              value={uphValue}
              onChange={(e) => handleUphChange(e.target.value)}
              placeholder="e.g. 10"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '2px solid #ea580c',
                fontSize: '0.9rem',
                fontWeight: 900,
                color: '#ea580c',
                background: '#fff7ed'
              }}
            />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#16a34a', marginTop: 3, display: 'block' }}>
              ✓ Auto Target: {Math.round(uphValue * 60)} pcs/hr
            </span>
          </div>
        </div>
      </div>

      {/* ── VIEW 1: HOURLY ENTRY GRID ── */}
      {activeTab === 'entry' && (
        <div>
          {/* Shift Performance Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div style={{ background: '#ffffff', padding: '18px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Shift Total Actual</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px' }}>{totalShiftActual.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>Calculated Target: {totalShiftTarget.toLocaleString()} units</div>
            </div>

            <div style={{ background: '#ffffff', padding: '18px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Production Achievement %</div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 900,
                color: shiftAchievePct >= 85 ? '#16a34a' : '#ea580c',
                margin: '4px 0 2px'
              }}>
                {shiftAchievePct}%
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {shiftAchievePct >= 85 ? '✓ Good Performance' : '⚠️ Below UPH Target Cadence'}
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '18px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Standard Hourly Target</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ea580c', margin: '4px 0 2px' }}>
                {Math.round(uphValue * 60)} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>pcs</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Derived strictly from UPH ({uphValue} × 60)</div>
            </div>

            <div style={{ background: '#ffffff', padding: '18px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Shift Downtime</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: totalShiftDowntime > 0 ? '#ea580c' : '#16a34a', margin: '4px 0 2px' }}>
                {totalShiftDowntime} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>min</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Cumulative recorded stoppage</div>
            </div>
          </div>

          {/* 8-Hour Table Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            marginBottom: 20
          }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  8-Hour Production Matrix: {selectedMachine}
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
                  Target is automatically calculated as UPH × 60. Percentage is color-coded (Green ≥ 85%, Orange &lt; 85%).
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveAllHours}
                disabled={savingAll}
                style={{
                  background: '#ea580c',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
                }}
              >
                <Save size={15} />
                <span>{savingAll ? 'Saving All Records...' : 'Save All 8 Hours'}</span>
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#334155' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 800 }}>Hour Interval</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800 }}>Tool #</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800 }}>UPH</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#ea580c' }}>Calculated Target</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800 }}>Actual Output</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800 }}>Production %</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800 }}>Hourly Output %</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800 }}>Downtime (min)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800 }}>Reason (6 Codes)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800 }}>Entry Time</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {hoursState.map((h, index) => {
                    const rowTarget = h.target > 0 ? h.target : Math.round(h.uph * 60);
                    const ach = rowTarget > 0 ? Math.round((h.actual / rowTarget) * 100) : 0;
                    const isSaving = savingHour === h.hourNum;

                    return (
                      <tr 
                        key={h.hourNum} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9',
                          background: h.isSaved ? '#ffffff' : '#fcfcfd'
                        }}
                      >
                        {/* 1. Interval */}
                        <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>
                          <div>{h.label}</div>
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Hour {h.hourNum}</span>
                        </td>

                        {/* 2. Tool Number */}
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#475569' }}>
                          {toolNumber}
                        </td>

                        {/* 3. UPH Input */}
                        <td style={{ padding: '10px 14px' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={h.uph}
                            onChange={(e) => handleUpdateRow(index, 'uph', e.target.value)}
                            style={{ width: 60, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 800, color: '#ea580c' }}
                          />
                        </td>

                        {/* 4. Automatically Calculated Target (UPH * 60) */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            display: 'inline-block',
                            background: '#fff7ed',
                            color: '#ea580c',
                            fontWeight: 900,
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid #fed7aa',
                            fontSize: '0.85rem'
                          }}>
                            {rowTarget}
                          </span>
                        </td>

                        {/* 5. Actual Output Input */}
                        <td style={{ padding: '10px 14px' }}>
                          <input
                            type="number"
                            min="0"
                            value={h.actual}
                            onChange={(e) => handleUpdateRow(index, 'actual', parseInt(e.target.value) || 0)}
                            style={{ 
                              width: 80, 
                              padding: '6px 8px', 
                              borderRadius: 6, 
                              border: ach >= 85 ? '2px solid #16a34a' : '2px solid #ea580c', 
                              fontSize: '0.88rem',
                              fontWeight: 900,
                              color: ach >= 85 ? '#15803d' : '#ea580c',
                              background: '#ffffff'
                            }}
                          />
                        </td>

                        {/* 6. Production Percentage */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontWeight: 900,
                            fontSize: '0.78rem',
                            background: ach >= 85 ? '#dcfce7' : '#ffedd5',
                            color: ach >= 85 ? '#15803d' : '#ea580c',
                            display: 'inline-block'
                          }}>
                            {ach}%
                          </span>
                        </td>

                        {/* 7. Hourly Output Percentage */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontWeight: 900,
                            fontSize: '0.78rem',
                            background: ach >= 85 ? '#dcfce7' : '#ffedd5',
                            color: ach >= 85 ? '#15803d' : '#ea580c',
                            display: 'inline-block'
                          }}>
                            {ach}%
                          </span>
                        </td>

                        {/* 8. Downtime (min) */}
                        <td style={{ padding: '10px 14px' }}>
                          <input
                            type="number"
                            min="0"
                            value={h.downtime}
                            onChange={(e) => handleUpdateRow(index, 'downtime', parseInt(e.target.value) || 0)}
                            style={{ width: 60, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                          />
                        </td>

                        {/* 9. Reason (Dropdown of the 6 Configured Codes) */}
                        <td style={{ padding: '10px 14px' }}>
                          <select
                            value={h.downtimeCode}
                            onChange={(e) => handleUpdateRow(index, 'downtimeCode', e.target.value)}
                            style={{
                              width: 155,
                              padding: '6px 8px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              background: '#fff'
                            }}
                          >
                            {downtimeCodes.map(code => (
                              <option key={code.code} value={code.code}>
                                {code.code} – {code.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* 10. Entry Time */}
                        <td style={{ padding: '10px 14px', fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                          {h.entryTime || '—'}
                        </td>

                        {/* 11. Save Action */}
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleSaveSingleHour(index)}
                            disabled={isSaving}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 6,
                              border: 'none',
                              background: h.isSaved ? '#16a34a' : '#ea580c',
                              color: '#fff',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            {isSaving ? '...' : (h.isSaved ? '✓ Saved' : 'Save')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 2: MACHINE COMPARISON ── */}
      {activeTab === 'machine-comparison' && (
        <div style={{
          background: '#ffffff',
          borderRadius: 14,
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
            Shopfloor Machine-wise Performance ({activeDate} • {selectedShift})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {allHourlyRecords.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No production records logged yet for this shift.</p>
            ) : (
              allHourlyRecords.map((rec, i) => (
                <div key={i} style={{ border: '1px solid #e2e8f0', padding: '14px', borderRadius: 10, background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{rec.machine_or_line}</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{rec.hour_interval}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>Operator: <strong>{rec.operator_name || '—'}</strong></div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>Tool: <strong>{rec.tool_number || '—'}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#ea580c' }}>UPH: {rec.uph || '—'}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#16a34a' }}>Actual: {rec.actual_qty}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── VIEW 3: OPERATOR COMPARISON ── */}
      {activeTab === 'operator-comparison' && (
        <div style={{
          background: '#ffffff',
          borderRadius: 14,
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
            Assigned Operator Output ({activeDate} • {selectedShift})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {operatorsList.map(op => {
              const opRecs = allHourlyRecords.filter(r => r.operator_name === op.name);
              const opTotal = opRecs.reduce((s, r) => s + (Number(r.actual_qty) || 0), 0);
              const opTarget = opRecs.reduce((s, r) => s + (Number(r.target_qty) || 0), 0);
              const opPct = opTarget > 0 ? Math.round((opTotal / opTarget) * 100) : 0;

              return (
                <div key={op.emp_id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px', background: '#ffffff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                      {op.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>{op.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{op.emp_id} • {op.designation || 'Operator'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Produced:</span>
                    <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{opTotal} units</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cadence Achievement:</span>
                    <strong style={{ fontSize: '0.85rem', color: opPct >= 85 ? '#16a34a' : '#ea580c' }}>{opPct}%</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
