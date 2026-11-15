import React, { useState, useEffect } from 'react';
import { 
  Timer, 
  Cpu, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  User, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Check, 
  Layers, 
  ChevronDown
} from 'lucide-react';
import { api } from '../api';

export default function HourlyProductionPage({ 
  selectedDate, 
  selectedShift = 'Shift A', 
  initialMachine = 'NC-01', 
  initialType = 'NC',
  onNavigateToCellStatus
}) {
  const activeDate = selectedDate || new Date().toISOString().split('T')[0];
  const [productionType, setProductionType] = useState(initialType || 'NC');
  const [selectedMachine, setSelectedMachine] = useState(initialMachine || 'NC-01');
  const [selectedOperator, setSelectedOperator] = useState('SACHIN S (A20755)');
  const [operatorsList, setOperatorsList] = useState([]);

  // Fixed Target Checkbox and Value
  const [isTargetFixed, setIsTargetFixed] = useState(true);
  const [fixedTargetQty, setFixedTargetQty] = useState(75);

  // Hour Filter / View Mode: 'ALL' or 1 to 8
  const [selectedHourTab, setSelectedHourTab] = useState('ALL');

  // Hourly rows state: exactly 8 hours with labels "1st Hour", "2nd Hour", etc. NO TIMINGS SHOWN.
  const hourLabels = [
    { hourNum: 1, label: '1st Hour', intervalKey: 'Hour 1' },
    { hourNum: 2, label: '2nd Hour', intervalKey: 'Hour 2' },
    { hourNum: 3, label: '3rd Hour', intervalKey: 'Hour 3' },
    { hourNum: 4, label: '4th Hour', intervalKey: 'Hour 4' },
    { hourNum: 5, label: '5th Hour', intervalKey: 'Hour 5' },
    { hourNum: 6, label: '6th Hour', intervalKey: 'Hour 6' },
    { hourNum: 7, label: '7th Hour', intervalKey: 'Hour 7' },
    { hourNum: 8, label: '8th Hour', intervalKey: 'Hour 8' }
  ];

  const [hourlyRows, setHourlyRows] = useState(() => 
    hourLabels.map(h => ({
      hourNum: h.hourNum,
      label: h.label,
      intervalKey: h.intervalKey,
      target_qty: 75,
      actual_qty: 0,
      isSaved: false
    }))
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const draftKey = `pha_hourly_draft_${selectedMachine}_${activeDate}_${selectedShift}`;

  useEffect(() => {
    loadOperators();
  }, []);

  useEffect(() => {
    loadHourlyData();
  }, [activeDate, selectedShift, selectedMachine]);

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load operators from manpower list
  const loadOperators = async () => {
    try {
      const res = await api.getEmployees();
      const emps = res.employees || [];
      if (emps.length > 0) {
        const formatted = emps.map(e => `${e.name} (${e.emp_id})`);
        setOperatorsList(formatted);
        if (!selectedOperator) setSelectedOperator(formatted[0]);
      } else {
        setOperatorsList([
          'SACHIN S (A20755)',
          'SRIRAM (A20556)',
          'KARTHIK M (A20821)',
          'MURUGAN R (A20112)',
          'SURESH K (A20340)',
          'PRAKASH M (A20455)',
          'ANAND T (A20610)',
          'RAJESH P (A20722)'
        ]);
      }
    } catch (e) {
      setOperatorsList([
        'SACHIN S (A20755)',
        'SRIRAM (A20556)',
        'KARTHIK M (A20821)',
        'MURUGAN R (A20112)',
        'SURESH K (A20340)',
        'PRAKASH M (A20455)',
        'ANAND T (A20610)',
        'RAJESH P (A20722)'
      ]);
    }
  };

  const loadHourlyData = async () => {
    try {
      setLoading(true);
      const isTandem = selectedMachine.includes('LP') || selectedMachine.includes('HP');
      const defaultTarget = isTandem ? 125 : 75;
      setFixedTargetQty(defaultTarget);

      // Check local draft first
      let localDraft = null;
      try {
        const stored = localStorage.getItem(draftKey);
        if (stored) localDraft = JSON.parse(stored);
      } catch (e) {}

      // Fetch from backend
      let serverRecords = [];
      try {
        const res = await api.getHourlyProduction({
          production_type: isTandem ? 'Tandem' : 'NC',
          machine_or_line: selectedMachine,
          date: activeDate,
          shift: selectedShift
        });
        serverRecords = res.records || [];
      } catch (e) {}

      const rows = hourLabels.map((h, idx) => {
        const found = serverRecords.find(r => r.hour_interval && r.hour_interval.includes(`Hour ${h.hourNum}`));
        const draftFound = localDraft ? localDraft[idx] : null;
        const effective = draftFound || found || {};

        return {
          hourNum: h.hourNum,
          label: h.label,
          intervalKey: h.intervalKey,
          target_qty: effective.target_qty !== undefined ? effective.target_qty : defaultTarget,
          actual_qty: effective.actual_qty !== undefined ? effective.actual_qty : 0,
          isSaved: Boolean(found)
        };
      });

      setHourlyRows(rows);
    } catch (err) {
      showNotice('error', 'Error loading hourly records');
    } finally {
      setLoading(false);
    }
  };

  const persistDraft = (updated) => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleToggleFixedTarget = (checked) => {
    setIsTargetFixed(checked);
    if (checked) {
      setHourlyRows(prev => {
        const updated = prev.map(r => ({ ...r, target_qty: fixedTargetQty }));
        persistDraft(updated);
        return updated;
      });
      showNotice('success', `Target fixed at ${fixedTargetQty} for all hours.`);
    }
  };

  const handleUpdateFixedTargetValue = (val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setFixedTargetQty(num);
    if (isTargetFixed) {
      setHourlyRows(prev => {
        const updated = prev.map(r => ({ ...r, target_qty: num }));
        persistDraft(updated);
        return updated;
      });
    }
  };

  const handleActualChange = (hourIndex, val) => {
    setHourlyRows(prev => {
      const updated = [...prev];
      const parsed = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
      updated[hourIndex] = { ...updated[hourIndex], actual_qty: parsed, isSaved: false };
      persistDraft(updated);
      return updated;
    });
  };

  const handleStepActual = (hourIndex, delta) => {
    setHourlyRows(prev => {
      const updated = [...prev];
      const current = Number(updated[hourIndex].actual_qty) || 0;
      const nextVal = Math.max(0, current + delta);
      updated[hourIndex] = { ...updated[hourIndex], actual_qty: nextVal, isSaved: false };
      persistDraft(updated);
      return updated;
    });
  };

  const handleTargetChange = (hourIndex, val) => {
    setHourlyRows(prev => {
      const updated = [...prev];
      const parsed = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
      updated[hourIndex] = { ...updated[hourIndex], target_qty: parsed, isSaved: false };
      persistDraft(updated);
      return updated;
    });
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const isTandem = selectedMachine.includes('LP') || selectedMachine.includes('HP');

      const recordsToSave = hourlyRows.map(r => ({
        production_type: isTandem ? 'Tandem' : 'NC',
        machine_or_line: selectedMachine,
        date: activeDate,
        shift: selectedShift,
        hour_interval: `Hour ${r.hourNum}`,
        operator_name: selectedOperator,
        target_qty: isTargetFixed ? fixedTargetQty : (Number(r.target_qty) || 0),
        actual_qty: Number(r.actual_qty) || 0,
        good_qty: Number(r.actual_qty) || 0,
        rejected_qty: 0,
        downtime_minutes: 0,
        downtime_reason: '',
        remarks: ''
      }));

      await api.saveHourlyProduction({ records: recordsToSave });
      try { localStorage.removeItem(draftKey); } catch (e) {}

      setHourlyRows(prev => prev.map(r => ({ ...r, isSaved: true })));
      showNotice('success', `✓ Saved all hours for ${selectedMachine}!`);
    } catch (err) {
      showNotice('error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Live Aggregates
  const totalTarget = hourlyRows.reduce((sum, r) => sum + (isTargetFixed ? fixedTargetQty : (Number(r.target_qty) || 0)), 0);
  const totalActual = hourlyRows.reduce((sum, r) => sum + (Number(r.actual_qty) || 0), 0);
  const achievementPct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  const visibleRows = selectedHourTab === 'ALL' 
    ? hourlyRows 
    : hourlyRows.filter(r => r.hourNum === Number(selectedHourTab));

  return (
    <div className="mobile-screen-content" style={{ padding: '14px 16px 90px', maxWidth: 640, margin: '0 auto' }}>
      
      {/* Toast Notice */}
      {notification && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 12,
          marginBottom: 12,
          background: notification.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${notification.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          color: notification.type === 'success' ? '#065F46' : '#991B1B',
          fontWeight: 700,
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div style={{
        background: '#102A43',
        color: '#ffffff',
        padding: '14px 16px',
        borderRadius: 16,
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(16,42,67,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#1E88E5', padding: '6px 12px', borderRadius: 8, fontWeight: 900, fontSize: '0.85rem' }}>
            {selectedShift}
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 900 }}>
              Hourly Production Entry
            </div>
            <div style={{ fontSize: '0.72rem', color: '#B9D0EA' }}>
              Only Target & Actual • Select 1st Hour, 2nd Hour...
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadHourlyData}
          style={{ background: 'transparent', border: 'none', color: '#B9D0EA', cursor: 'pointer' }}
          title="Reload"
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* SELECTION CONTROLS CARD:
          1. SELECT MACHINE
          2. SELECT OPERATOR (DROPDOWN FROM MANPOWER LIST - NO WRITING NEEDED!)
          3. FIXED TARGET LOCK
      */}
      <div style={{
        background: '#ffffff',
        borderRadius: 18,
        padding: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        marginBottom: 14
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          
          {/* 1. SELECT MACHINE */}
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#102A43', display: 'block', marginBottom: 4 }}>
              Machine
            </label>
            <select
              className="form-input"
              value={selectedMachine}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedMachine(val);
                const isTandem = val.includes('LP') || val.includes('HP');
                setProductionType(isTandem ? 'Tandem' : 'NC');
              }}
              style={{
                width: '100%',
                fontWeight: 800,
                fontSize: '0.9rem',
                color: '#102A43',
                background: '#F8FAFC',
                borderRadius: 10,
                padding: '9px 10px',
                border: '1px solid #CBD5E1'
              }}
            >
              <optgroup label="NC Presses (16 Units)">
                {Array.from({ length: 16 }, (_, i) => {
                  const id = `NC-${String(i + 1).padStart(2, '0')}`;
                  return <option key={id} value={id}>{id}</option>;
                })}
              </optgroup>
              <optgroup label="Tandem Lines (6 Lines)">
                <option value="LP-1">LP-1 (1200T)</option>
                <option value="LP-2">LP-2 (1200T)</option>
                <option value="HP-1">HP-1 (1600T)</option>
                <option value="HP-2">HP-2 (1600T)</option>
                <option value="HP-3">HP-3 (2000T)</option>
                <option value="HP-4">HP-4 (2000T)</option>
              </optgroup>
            </select>
          </div>

          {/* 2. SELECT OPERATOR (FROM MANPOWER LIST) */}
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#102A43', display: 'block', marginBottom: 4 }}>
              Operator (Manpower)
            </label>
            <select
              className="form-input"
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              style={{
                width: '100%',
                fontWeight: 700,
                fontSize: '0.84rem',
                color: '#102A43',
                background: '#F8FAFC',
                borderRadius: 10,
                padding: '9px 10px',
                border: '1px solid #CBD5E1'
              }}
            >
              {operatorsList.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. TARGET LOCK & VALUE */}
        <div style={{
          background: '#F8FAFC',
          borderRadius: 12,
          padding: '10px 14px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 800,
              color: isTargetFixed ? '#00B074' : '#64748B'
            }}>
              <input
                type="checkbox"
                checked={isTargetFixed}
                onChange={(e) => handleToggleFixedTarget(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              {isTargetFixed ? <Lock size={14} color="#00B074" /> : <Unlock size={14} color="#64748B" />}
              <span>{isTargetFixed ? 'Fixed Target for All Hours' : 'Editable per Hour'}</span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700 }}>Target:</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={fixedTargetQty}
              onChange={(e) => handleUpdateFixedTargetValue(e.target.value)}
              onFocus={(e) => e.target.select()}
              style={{
                width: 75,
                textAlign: 'center',
                fontWeight: 900,
                fontSize: '0.95rem',
                color: '#102A43',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                padding: '4px 6px',
                background: '#ffffff'
              }}
            />
            <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>pcs/hr</span>
          </div>
        </div>
      </div>

      {/* HOUR SELECTOR TABS: [ All Hours ] [ 1st Hour ] [ 2nd Hour ] ... [ 8th Hour ] */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 8,
        marginBottom: 14,
        WebkitOverflowScrolling: 'touch'
      }}>
        <button
          type="button"
          onClick={() => setSelectedHourTab('ALL')}
          style={{
            padding: '6px 14px',
            borderRadius: 16,
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            background: selectedHourTab === 'ALL' ? '#1E88E5' : '#ffffff',
            color: selectedHourTab === 'ALL' ? '#ffffff' : '#64748B',
            boxShadow: selectedHourTab === 'ALL' ? '0 2px 8px rgba(30,136,229,0.3)' : 'none',
            border: selectedHourTab === 'ALL' ? 'none' : '1px solid #E2E8F0'
          }}
        >
          All Hours (8)
        </button>

        {hourLabels.map(h => {
          const isAct = selectedHourTab === String(h.hourNum);
          return (
            <button
              key={h.hourNum}
              type="button"
              onClick={() => setSelectedHourTab(String(h.hourNum))}
              style={{
                padding: '6px 12px',
                borderRadius: 16,
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: isAct ? '#1E88E5' : '#ffffff',
                color: isAct ? '#ffffff' : '#64748B',
                boxShadow: isAct ? '0 2px 8px rgba(30,136,229,0.3)' : 'none',
                border: isAct ? 'none' : '1px solid #E2E8F0'
              }}
            >
              {h.label}
            </button>
          );
        })}
      </div>

      {/* SUMMARY BANNER */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        marginBottom: 14
      }}>
        <div style={{ background: '#ffffff', borderRadius: 14, padding: '10px 12px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>TOTAL TARGET</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#102A43', marginTop: 2 }}>{totalTarget}</div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: 14, padding: '10px 12px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>TOTAL ACTUAL</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#00B074', marginTop: 2 }}>{totalActual}</div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: 14, padding: '10px 12px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>OUTPUT %</div>
          <div style={{
            fontSize: '1.3rem',
            fontWeight: 900,
            color: achievementPct >= 85 ? '#00B074' : achievementPct >= 70 ? '#FF8A00' : '#EF4444',
            marginTop: 2
          }}>
            {achievementPct}%
          </div>
        </div>
      </div>

      {/* HOURLY ROWS (ONLY TARGET & ACTUAL NUMBERS, NO TIMINGS!) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {visibleRows.map((row) => {
          const hourIdx = row.hourNum - 1;
          const currentTarget = isTargetFixed ? fixedTargetQty : (Number(row.target_qty) || 0);
          const currentActual = Number(row.actual_qty) || 0;
          const pct = currentTarget > 0 ? Math.round((currentActual / currentTarget) * 100) : 0;

          return (
            <div 
              key={row.hourNum}
              style={{
                background: '#ffffff',
                borderRadius: 16,
                padding: '14px 16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}
            >
              {/* Hour Tag & Output % Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  background: '#102A43',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.86rem',
                  padding: '6px 12px',
                  borderRadius: 10
                }}>
                  {row.label}
                </div>

                <span style={{
                  background: pct >= 85 ? '#E8F5E9' : pct >= 70 ? '#FFF3E0' : '#FFEBEE',
                  color: pct >= 85 ? '#00B074' : pct >= 70 ? '#FF8A00' : '#EF4444',
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  padding: '3px 8px',
                  borderRadius: 10
                }}>
                  {pct}%
                </span>
              </div>

              {/* ONLY 2 INPUTS: TARGET & ACTUAL NUMBERS! */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                
                {/* TARGET */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 800, display: 'block', marginBottom: 2 }}>
                    TARGET
                  </span>
                  {isTargetFixed ? (
                    <div style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      padding: '7px 12px',
                      borderRadius: 10,
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      color: '#475569',
                      minWidth: 64,
                      textAlign: 'center'
                    }}>
                      {fixedTargetQty}
                    </div>
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={row.target_qty}
                      onChange={(e) => handleTargetChange(hourIdx, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      style={{
                        width: 64,
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: '0.95rem',
                        borderRadius: 10,
                        border: '1px solid #CBD5E1',
                        padding: '7px 4px',
                        background: '#ffffff'
                      }}
                    />
                  )}
                </div>

                {/* ACTUAL (TOUCH STEPPERS + INPUT) */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.66rem', color: '#1E88E5', fontWeight: 800, display: 'block', marginBottom: 2 }}>
                    ACTUAL *
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <button
                      type="button"
                      onClick={() => handleStepActual(hourIdx, -5)}
                      style={{
                        width: 28,
                        height: 36,
                        borderRadius: 8,
                        border: '1px solid #CBD5E1',
                        background: '#F1F5F9',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      value={row.actual_qty === 0 ? '' : row.actual_qty}
                      placeholder="0"
                      onChange={(e) => handleActualChange(hourIdx, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      style={{
                        width: 68,
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: '1.15rem',
                        color: '#1E88E5',
                        borderRadius: 10,
                        border: '1.5px solid #1E88E5',
                        padding: '6px 4px',
                        background: '#ffffff'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleStepActual(hourIdx, 5)}
                      style={{
                        width: 28,
                        height: 36,
                        borderRadius: 8,
                        border: '1px solid #CBD5E1',
                        background: '#F1F5F9',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* FLOATING SAVE BAR */}
      <div style={{
        position: 'fixed',
        bottom: 64,
        left: 0,
        right: 0,
        background: '#ffffff',
        borderTop: '1px solid #E2E8F0',
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 90,
        boxShadow: '0 -4px 16px rgba(16, 42, 67, 0.08)'
      }}>
        <div>
          <span style={{ fontSize: '0.68rem', color: '#6B7C93' }}>Total Output:</span>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#102A43' }}>
            {totalActual} <span style={{ fontSize: '0.74rem', color: '#00B074', fontWeight: 700 }}>({achievementPct}%)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          style={{
            background: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 12,
            padding: '10px 24px',
            fontWeight: 800,
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 14px rgba(30, 136, 229, 0.35)',
            cursor: 'pointer'
          }}
        >
          <Save size={16} />
          <span>{saving ? 'Saving...' : 'Save Shift Output'}</span>
        </button>
      </div>

    </div>
  );
}
