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
  Filter, 
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { api } from '../api';

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
  const [toolNumber, setToolNumber] = useState('');
  const [operatorsList, setOperatorsList] = useState([]);
  const [hourlyTarget, setHourlyTarget] = useState(75);
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

  // 8 Hours row state
  const [hoursState, setHoursState] = useState(() =>
    hourIntervals.map(h => ({
      hourNum: h.num,
      label: h.label,
      actual: 0,
      target: 75,
      rejected: 0,
      downtime: 0,
      reason: '',
      remarks: '',
      isSaved: false
    }))
  );

  const [allHourlyRecords, setAllHourlyRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingHour, setSavingHour] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadOperators();
  }, []);

  useEffect(() => {
    loadHourlyDataForMachine();
    loadAllShiftHourly();
  }, [activeDate, selectedShift, selectedMachine]);

  const loadOperators = async () => {
    try {
      const res = await api.getEmployees();
      const emps = res.employees || [];
      setOperatorsList(emps);
      if (emps.length > 0 && !selectedOperator) {
        setSelectedOperator(emps[0].name);
      }
    } catch (e) {
      console.warn('Operator list error:', e);
      setOperatorsList([]);
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
        // match by interval
        recMap[r.hour_interval] = r;
      });

      // Update hoursState from records
      setHoursState(hourIntervals.map(h => {
        const found = recMap[h.label] || recMap[`Hour ${h.num}`];
        if (found) {
          return {
            hourNum: h.num,
            label: h.label,
            actual: found.actual_qty || 0,
            target: found.target_qty || hourlyTarget,
            rejected: found.rejected_qty || 0,
            downtime: found.downtime_minutes || 0,
            reason: found.downtime_reason || '',
            remarks: found.remarks || '',
            isSaved: true
          };
        }
        return {
          hourNum: h.num,
          label: h.label,
          actual: 0,
          target: hourlyTarget,
          rejected: 0,
          downtime: 0,
          reason: '',
          remarks: '',
          isSaved: false
        };
      }));

      if (records.length > 0) {
        if (records[0].operator_name) setSelectedOperator(records[0].operator_name);
        if (records[0].tool_number) setToolNumber(records[0].tool_number);
      }
    } catch (e) {
      console.warn('Hourly fetch notice:', e);
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
    const defTgt = type === 'NC' ? 75 : 100;
    setHourlyTarget(defTgt);
    setHoursState(prev => prev.map(h => ({ ...h, target: defTgt })));
  };

  const handleUpdateRow = (index, field, value) => {
    setHoursState(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveSingleHour = async (hourIndex) => {
    const row = hoursState[hourIndex];
    try {
      setSavingHour(row.hourNum);
      const payload = {
        production_type: productionType,
        machine_or_line: selectedMachine,
        date: activeDate,
        shift: selectedShift,
        hour_interval: row.label,
        tool_number: toolNumber,
        operator_name: selectedOperator,
        target_qty: Number(row.target) || 0,
        actual_qty: Number(row.actual) || 0,
        good_qty: Math.max(0, (Number(row.actual) || 0) - (Number(row.rejected) || 0)),
        rejected_qty: Number(row.rejected) || 0,
        downtime_minutes: Number(row.downtime) || 0,
        downtime_reason: row.reason || '',
        remarks: row.remarks || ''
      };

      await api.saveHourlyProduction(payload);
      showNotice('success', `Saved output for ${row.label} (${row.actual} pcs).`);
      
      setHoursState(prev => {
        const u = [...prev];
        u[hourIndex].isSaved = true;
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

  const handleSaveAllHours = async () => {
    try {
      setSavingAll(true);
      for (let i = 0; i < hoursState.length; i++) {
        const row = hoursState[i];
        if (row.actual > 0 || row.downtime > 0) {
          const payload = {
            production_type: productionType,
            machine_or_line: selectedMachine,
            date: activeDate,
            shift: selectedShift,
            hour_interval: row.label,
            tool_number: toolNumber,
            operator_name: selectedOperator,
            target_qty: Number(row.target) || 0,
            actual_qty: Number(row.actual) || 0,
            good_qty: Math.max(0, (Number(row.actual) || 0) - (Number(row.rejected) || 0)),
            rejected_qty: Number(row.rejected) || 0,
            downtime_minutes: Number(row.downtime) || 0,
            downtime_reason: row.reason || '',
            remarks: row.remarks || ''
          };
          await api.saveHourlyProduction(payload);
        }
      }
      showNotice('success', `All hours saved successfully for ${selectedMachine}.`);
      loadHourlyDataForMachine();
      loadAllShiftHourly();
      if (onSync) onSync();
    } catch (err) {
      showNotice('error', err.message || 'Failed to save records');
    } finally {
      setSavingAll(false);
    }
  };

  // Cumulative sums
  const totalShiftTarget = hoursState.reduce((sum, h) => sum + (Number(h.target) || 0), 0);
  const totalShiftActual = hoursState.reduce((sum, h) => sum + (Number(h.actual) || 0), 0);
  const totalShiftGood = hoursState.reduce((sum, h) => sum + Math.max(0, (Number(h.actual) || 0) - (Number(h.rejected) || 0)), 0);
  const totalShiftDowntime = hoursState.reduce((sum, h) => sum + (Number(h.downtime) || 0), 0);
  const shiftAchievePct = totalShiftTarget > 0 ? Math.round((totalShiftActual / totalShiftTarget) * 100) : 0;
  const remainingShiftTarget = Math.max(0, totalShiftTarget - totalShiftActual);

  // Machine comparison aggregation
  const machineAgg = {};
  allHourlyRecords.forEach(r => {
    const m = r.machine_or_line;
    if (!machineAgg[m]) {
      machineAgg[m] = { machine: m, type: r.production_type, target: 0, actual: 0, downtime: 0, operator: r.operator_name };
    }
    machineAgg[m].target += r.target_qty || 0;
    machineAgg[m].actual += r.actual_qty || 0;
    machineAgg[m].downtime += r.downtime_minutes || 0;
  });
  const machineComparisonList = Object.values(machineAgg).map(m => ({
    ...m,
    achievePct: m.target > 0 ? Math.round((m.actual / m.target) * 100) : 0
  })).sort((a, b) => b.actual - a.actual);

  // Operator comparison aggregation
  const opAgg = {};
  allHourlyRecords.forEach(r => {
    const op = r.operator_name || 'Unassigned';
    if (!opAgg[op]) {
      opAgg[op] = { name: op, actual: 0, target: 0, count: 0, machines: new Set() };
    }
    opAgg[op].actual += r.actual_qty || 0;
    opAgg[op].target += r.target_qty || 0;
    opAgg[op].count += 1;
    opAgg[op].machines.add(r.machine_or_line);
  });
  const operatorComparisonList = Object.values(opAgg).map(o => ({
    ...o,
    machineCount: o.machines.size,
    achievePct: o.target > 0 ? Math.round((o.actual / o.target) * 100) : 0
  })).sort((a, b) => b.actual - a.actual);

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
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Timer size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>
                  PAGE 2
                </span>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  HOUR-BY-HOUR SHOPFLOOR LOGGING
                </span>
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '2px 0 0' }}>
                Hourly Production Management
              </h1>
            </div>
          </div>

          {/* Sub Navigation */}
          <div style={{ display: 'flex', gap: 8, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setActiveTab('entry')}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: 'none',
                background: activeTab === 'entry' ? '#ffffff' : 'transparent',
                color: activeTab === 'entry' ? '#1e40af' : '#64748b',
                fontWeight: activeTab === 'entry' ? 800 : 600,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              Hourly Entry Grid
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('machine-comparison')}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: 'none',
                background: activeTab === 'machine-comparison' ? '#ffffff' : 'transparent',
                color: activeTab === 'machine-comparison' ? '#1e40af' : '#64748b',
                fontWeight: activeTab === 'machine-comparison' ? 800 : 600,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              Machine Comparison
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('operator-comparison')}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: 'none',
                background: activeTab === 'operator-comparison' ? '#ffffff' : 'transparent',
                color: activeTab === 'operator-comparison' ? '#1e40af' : '#64748b',
                fontWeight: activeTab === 'operator-comparison' ? 800 : 600,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              Operator Comparison
            </button>
          </div>
        </div>

        {/* Machine & Operator Selection Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginTop: 18,
          paddingTop: 16,
          borderTop: '1px solid #f1f5f9'
        }}>
          {/* Production Type Toggle */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 4 }}>
              Production Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                type="button"
                onClick={() => handleTypeChange('NC')}
                style={{
                  padding: '7px',
                  borderRadius: 6,
                  border: productionType === 'NC' ? '2px solid #1e40af' : '1px solid #cbd5e1',
                  background: productionType === 'NC' ? '#eff6ff' : '#fff',
                  color: productionType === 'NC' ? '#1e40af' : '#475569',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                NC (16 Units)
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('Tandem')}
                style={{
                  padding: '7px',
                  borderRadius: 6,
                  border: productionType === 'Tandem' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                  background: productionType === 'Tandem' ? '#f5f3ff' : '#fff',
                  color: productionType === 'Tandem' ? '#7c3aed' : '#475569',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Tandem (6 Lines)
              </button>
            </div>
          </div>

          {/* Machine Selection */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 4 }}>
              Machine Selection *
            </label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 800, background: '#fff' }}
            >
              {productionType === 'NC'
                ? ncMachines.map(m => <option key={m} value={m}>{m} (Press Shop)</option>)
                : tandemLines.map(t => <option key={t} value={t}>{t} (Tandem Line)</option>)
              }
            </select>
          </div>

          {/* Tool Number */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 4 }}>
              Tool / Die Number
            </label>
            <input
              type="text"
              placeholder="e.g. TL-1001-CTR"
              value={toolNumber}
              onChange={(e) => setToolNumber(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
            />
          </div>

          {/* Operator Selection */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 4 }}>
              Operator Assigned
            </label>
            {operatorsList.length > 0 ? (
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
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
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
            )}
          </div>

          {/* Standard Target per Hour */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 4 }}>
              Target per Hour
            </label>
            <input
              type="number"
              min="1"
              value={hourlyTarget}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setHourlyTarget(val);
                setHoursState(prev => prev.map(h => ({ ...h, target: val })));
              }}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 800 }}
            />
          </div>
        </div>
      </div>

      {/* ── VIEW 1: HOURLY ENTRY GRID ── */}
      {activeTab === 'entry' && (
        <div>
          {/* Shift Performance Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Shift Total Actual</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e40af', margin: '4px 0 2px' }}>{totalShiftActual.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Target: {totalShiftTarget.toLocaleString()} units</div>
            </div>

            <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Achievement Rate</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: shiftAchievePct >= 95 ? '#059669' : (shiftAchievePct >= 75 ? '#d97706' : '#dc2626'), margin: '4px 0 2px' }}>
                {shiftAchievePct}%
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {shiftAchievePct >= 95 ? 'Target on track' : 'Below target cadence'}
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Remaining Target</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: remainingShiftTarget === 0 ? '#059669' : '#d97706', margin: '4px 0 2px' }}>
                {remainingShiftTarget.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Units needed to meet shift quota</div>
            </div>

            <div style={{ background: '#ffffff', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Downtime</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: totalShiftDowntime > 0 ? '#ea580c' : '#64748b', margin: '4px 0 2px' }}>
                {totalShiftDowntime}m
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Cumulative lost minutes</div>
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
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Hour-by-Hour Production Entry: {selectedMachine}
                </h3>
                <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0' }}>
                  Hours below target are automatically highlighted in amber/red. Enter output and click Save.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveAllHours}
                disabled={savingAll}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Save size={14} />
                <span>{savingAll ? 'Saving All...' : 'Save All 8 Hours'}</span>
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Hour</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Interval</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Target</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Actual Output</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Scrap</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Achievement</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Downtime (min)</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Reason</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {hoursState.map((h, index) => {
                    const ach = h.target > 0 ? Math.round((h.actual / h.target) * 100) : 0;
                    const belowTarget = h.actual < h.target && h.actual > 0;
                    const isSaving = savingHour === h.hourNum;

                    return (
                      <tr 
                        key={h.hourNum} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9',
                          background: belowTarget ? '#fffbeb' : (h.isSaved ? '#f8fafc' : '#ffffff')
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>Hour {h.hourNum}</td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{h.label}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <input
                            type="number"
                            min="0"
                            value={h.target}
                            onChange={(e) => handleUpdateRow(index, 'target', parseInt(e.target.value) || 0)}
                            style={{ width: 65, padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                          />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <input
                            type="number"
                            min="0"
                            value={h.actual}
                            onChange={(e) => handleUpdateRow(index, 'actual', parseInt(e.target.value) || 0)}
                            style={{ 
                              width: 75, 
                              padding: '5px 8px', 
                              borderRadius: 4, 
                              border: belowTarget ? '2px solid #f59e0b' : '1px solid #3b82f6', 
                              fontSize: '0.85rem',
                              fontWeight: 800,
                              color: belowTarget ? '#b45309' : '#1e40af'
                            }}
                          />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <input
                            type="number"
                            min="0"
                            value={h.rejected}
                            onChange={(e) => handleUpdateRow(index, 'rejected', parseInt(e.target.value) || 0)}
                            style={{ width: 60, padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                          />
                        </td>
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
                        <td style={{ padding: '10px 14px' }}>
                          <input
                            type="number"
                            min="0"
                            value={h.downtime}
                            onChange={(e) => handleUpdateRow(index, 'downtime', parseInt(e.target.value) || 0)}
                            style={{ width: 60, padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                          />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <input
                            type="text"
                            placeholder="Reason if delayed"
                            value={h.reason}
                            onChange={(e) => handleUpdateRow(index, 'reason', e.target.value)}
                            style={{ width: 140, padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.76rem' }}
                          />
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleSaveSingleHour(index)}
                            disabled={isSaving}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 4,
                              border: 'none',
                              background: h.isSaved ? '#10b981' : '#2563eb',
                              color: '#fff',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer'
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
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Cross-Machine Hourly Output Comparison ({selectedShift} on {activeDate})
            </h3>
            <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0' }}>
              Benchmarking total actual production and target achievement percentages across plant units
            </p>
          </div>

          {machineComparisonList.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              No machines have logged hourly output yet for this shift.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Rank</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Machine / Line</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Type</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Operator</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Total Target</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Actual Output</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Achievement</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Downtime</th>
                  </tr>
                </thead>
                <tbody>
                  {machineComparisonList.map((m, idx) => (
                    <tr key={m.machine} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#64748b' }}>#{idx + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#1e40af' }}>{m.machine}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{m.type}</td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>{m.operator || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{m.target}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>{m.actual}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          background: m.achievePct >= 95 ? '#ecfdf5' : '#fffbeb',
                          color: m.achievePct >= 95 ? '#059669' : '#d97706'
                        }}>
                          {m.achievePct}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: m.downtime > 0 ? '#dc2626' : '#64748b' }}>
                        {m.downtime}m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 3: OPERATOR COMPARISON ── */}
      {activeTab === 'operator-comparison' && (
        <div style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Operator Output Benchmarking ({selectedShift} on {activeDate})
            </h3>
            <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0' }}>
              Comparison of parts produced, assigned machines, and target achievement per operator
            </p>
          </div>

          {operatorComparisonList.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              No operator production records found for this shift.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Rank</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Operator Name</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Machines Manned</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Total Target</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Total Output</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800 }}>Achievement</th>
                  </tr>
                </thead>
                <tbody>
                  {operatorComparisonList.map((op, idx) => (
                    <tr key={op.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#64748b' }}>#{idx + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>{op.name}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{op.machineCount} unit(s)</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{op.target}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#1e40af' }}>{op.actual}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          background: op.achievePct >= 95 ? '#ecfdf5' : '#fffbeb',
                          color: op.achievePct >= 95 ? '#059669' : '#d97706'
                        }}>
                          {op.achievePct}%
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
    </div>
  );
}
