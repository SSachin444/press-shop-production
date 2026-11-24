import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Layers, 
  Calendar, 
  Clock, 
  User, 
  Wrench, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  TrendingUp, 
  BarChart2, 
  AlertCircle,
  Play,
  Square,
  History,
  CheckCircle2,
  XCircle,
  Clock4,
  ArrowRight,
  ChevronRight,
  Activity,
  ShieldAlert
} from 'lucide-react';
import { api } from '../api';

export default function MachineSummaryPage({ 
  initialMachine = 'NC-01', 
  selectedDate, 
  selectedShift = 'Shift A',
  onLogHourlyForMachine
}) {
  const activeDate = selectedDate || new Date().toISOString().split('T')[0];

  const [selectedMachine, setSelectedMachine] = useState(initialMachine || 'NC-01');
  const [currentShift, setCurrentShift] = useState(selectedShift || 'Shift A');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedToolHistory, setSelectedToolHistory] = useState(null);
  const [notification, setNotification] = useState(null);

  const ncMachines = Array.from({ length: 16 }, (_, i) => `NC-${String(i + 1).padStart(2, '0')}`);
  const tandemLines = ['LP-1', 'LP-2', 'HP-1', 'HP-2', 'HP-3', 'HP-4'];

  useEffect(() => {
    loadMachineSummary();
  }, [selectedMachine, activeDate, currentShift]);

  const loadMachineSummary = async () => {
    try {
      setLoading(true);
      const data = await api.getMachineSummary(selectedMachine, activeDate, currentShift);
      setSummary(data);
      // If a tool history was selected, refresh it
      if (selectedToolHistory) {
        const refreshedTool = (data?.tool_details || []).find(t => t.tool_number === selectedToolHistory.tool_number);
        if (refreshedTool) setSelectedToolHistory(refreshedTool);
      }
    } catch (err) {
      console.warn('Failed to load machine summary:', err);
      showNotice('error', 'Could not load summary for ' + selectedMachine);
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const info = summary?.machine_info;
  const prod = summary?.production_details;
  const run = summary?.running_details;
  const tools = summary?.tool_details || [];
  const dtData = summary?.problems_and_downtime;

  const isStopped = info?.is_stopped || info?.current_machine_status === 'Breakdown';
  const achievePct = prod?.production_achievement_percentage || 0;
  const achieveColor = achievePct >= 85 ? '#16a34a' : '#ea580c';

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
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 700,
          fontSize: '0.85rem'
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} color="#16a34a" /> : <AlertTriangle size={18} color="#ea580c" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header & Machine Selector Strip */}
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
                ASSET INTELLIGENCE
              </span>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Machine Summary
              </h1>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>
              Comprehensive performance dossier for individual shopfloor press assets and production lines.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Machine Selection Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>Machine:</span>
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '2px solid #ea580c',
                  background: '#fff7ed',
                  color: '#ea580c',
                  fontSize: '0.9rem',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                <optgroup label="NC Machine Presses (16 Units)">
                  {ncMachines.map(m => <option key={m} value={m}>{m} (Press Shop)</option>)}
                </optgroup>
                <optgroup label="Tandem Production Lines (6 Lines)">
                  {tandemLines.map(t => <option key={t} value={t}>{t} (Tandem Line)</option>)}
                </optgroup>
              </select>
            </div>

            {/* Shift Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>Shift:</span>
              <select
                value={currentShift}
                onChange={(e) => setCurrentShift(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700
                }}
              >
                <option value="Shift A">Shift A</option>
                <option value="Shift B">Shift B</option>
                <option value="Shift C">Shift C</option>
              </select>
            </div>

            <button
              onClick={loadMachineSummary}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
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
      </div>

      {/* ── SECTION A: MACHINE INFORMATION ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        padding: '22px 24px',
        border: isStopped ? '2px solid #dc2626' : '1px solid #e2e8f0',
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        marginBottom: 20,
        position: 'relative'
      }}>
        {isStopped && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={18} color="#dc2626" />
              <strong style={{ fontSize: '0.88rem' }}>
                MACHINE CURRENTLY STOPPED: {info?.active_downtime?.downtime_code || 'D01'} – {info?.active_downtime?.reason || 'Machine Breakdown'}
              </strong>
            </div>
            <span style={{ fontSize: '0.78rem' }}>
              Started: {info?.active_downtime?.start_time ? new Date(info.active_downtime.start_time).toLocaleTimeString() : 'Active'}
            </span>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Machine Number</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: '2px 0' }}>{info?.machine_number}</div>
            <div style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 700 }}>{info?.machine_type} Press • {info?.tonnage} Tonnage</div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Current Machine Status</div>
            <div style={{ margin: '6px 0' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: '0.8rem',
                fontWeight: 900,
                background: isStopped ? '#fef2f2' : (info?.current_machine_status === 'Running' ? '#f0fdf4' : '#f8fafc'),
                color: isStopped ? '#b91c1c' : (info?.current_machine_status === 'Running' ? '#15803d' : '#64748b'),
                border: `1px solid ${isStopped ? '#fecaca' : '#bbf7d0'}`
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isStopped ? '#dc2626' : '#16a34a' }} />
                {info?.current_machine_status || 'Running'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Shift: <strong>{info?.current_shift}</strong></div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Current Operator Assigned</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                <User size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>{info?.current_operator_name}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Plant MFG-2 Operator</div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Current Active Tool</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                <Wrench size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>{info?.current_tool_number}</div>
                <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>Mounted & Ready</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION B: PRODUCTION DETAILS ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        padding: '22px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Production Performance Details
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
              Shift output, calculated targets (UPH × 60), and 8-hour progress cadence.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onLogHourlyForMachine && onLogHourlyForMachine(selectedMachine, info?.machine_type)}
            style={{
              background: '#ea580c',
              color: '#ffffff',
              border: 'none',
              padding: '7px 16px',
              borderRadius: 8,
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Clock size={13} />
            <span>Log Hourly for {selectedMachine}</span>
          </button>
        </div>

        {/* KPI Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
          marginBottom: 20
        }}>
          <div style={{ padding: '16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Actual Production</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px' }}>
              {(prod?.total_production || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>pcs</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Shift: {currentShift}</div>
          </div>

          <div style={{ padding: '16px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase' }}>Total Target Production</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ea580c', margin: '4px 0 2px' }}>
              {(prod?.total_target_production || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: '#c2410c', fontWeight: 600 }}>pcs</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#c2410c' }}>Calculated strictly from UPH × 60</div>
          </div>

          <div style={{ padding: '16px', borderRadius: 10, background: achievePct >= 85 ? '#f0fdf4' : '#fff7ed', border: `1px solid ${achievePct >= 85 ? '#bbf7d0' : '#fed7aa'}` }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: achieveColor, textTransform: 'uppercase' }}>Achievement Rate</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: achieveColor, margin: '4px 0 2px' }}>
              {achievePct}%
            </div>
            <div style={{ fontSize: '0.72rem', color: achieveColor, fontWeight: 700 }}>
              {achievePct >= 85 ? '✓ Target Met' : '⚠️ Below UPH Cadence'}
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Completed Tool Count</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px' }}>
              {prod?.number_of_completed_tools || 0} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>dies</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Used on this machine</div>
          </div>
        </div>

        {/* Hourly Production Breakdown Table */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
            Hour-by-Hour Production Breakdown ({currentShift})
          </h3>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Hour</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Interval</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Tool</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Operator</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800, color: '#ea580c' }}>UPH</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Target (UPH×60)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Actual Output</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Achievement %</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Downtime</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Entry Time</th>
                </tr>
              </thead>
              <tbody>
                {(prod?.hourly_breakdown || []).map((h) => {
                  const ach = h.production_pct;
                  const achClr = ach >= 85 ? '#16a34a' : (ach > 0 ? '#ea580c' : '#64748b');

                  return (
                    <tr key={h.hour_num} style={{ borderBottom: '1px solid #f1f5f9', background: h.is_logged ? '#ffffff' : '#fafafa' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>Hour {h.hour_num}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{h.hour_interval}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{h.tool_number || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{h.operator_name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#ea580c' }}>{h.uph || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 800 }}>{h.target_qty}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 900, color: h.actual_qty > 0 ? '#16a34a' : '#64748b' }}>
                        {h.actual_qty} pcs
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontWeight: 900,
                          fontSize: '0.74rem',
                          background: ach >= 85 ? '#dcfce7' : (ach > 0 ? '#ffedd5' : '#f1f5f9'),
                          color: achClr
                        }}>
                          {ach}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: h.downtime_minutes > 0 ? '#ea580c' : '#16a34a', fontWeight: 700 }}>
                        {h.downtime_minutes > 0 ? `${h.downtime_minutes}m (${h.downtime_reason})` : '0m'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#64748b', fontSize: '0.74rem' }}>
                        {h.entry_time || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shift-Wise and Daily Production Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12
        }}>
          {['Shift A', 'Shift B', 'Shift C'].map(s => {
            const sh = prod?.shift_wise_production?.[s] || { actual: 0, target: 0, pct: 0 };
            return (
              <div key={s} style={{ padding: '14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{s} (This Machine)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                  {sh.actual.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>/ {sh.target} pcs</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: sh.pct >= 85 ? '#16a34a' : '#ea580c', fontWeight: 700, marginTop: 4 }}>
                  Achievement: {sh.pct}%
                </div>
              </div>
            );
          })}

          <div style={{ padding: '14px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#ea580c', marginBottom: 4 }}>Daily Production Total</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ea580c' }}>
              {(prod?.daily_production?.actual || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: 500 }}>/ {prod?.daily_production?.target || 0} pcs</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#c2410c', fontWeight: 700, marginTop: 4 }}>
              Combined across all shifts for {activeDate}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION C: MACHINE RUNNING DETAILS ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        padding: '22px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 20
      }}>
        <div style={{ marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            Machine Running & Utilization Details
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
            Calculated strictly using actual stoppage records and timestamps. No estimated values.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
          marginBottom: 16
        }}>
          <div style={{ padding: '16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>Total Running Hours</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#15803d', margin: '4px 0 2px' }}>
              {run?.total_running_hours || 8.0} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>hrs</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#16a34a' }}>Actual active production time</div>
          </div>

          <div style={{ padding: '16px', borderRadius: 10, background: (run?.total_downtime_minutes || 0) > 0 ? '#fff7ed' : '#f8fafc', border: `1px solid ${(run?.total_downtime_minutes || 0) > 0 ? '#fed7aa' : '#e2e8f0'}` }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>Total Downtime Hours</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ea580c', margin: '4px 0 2px' }}>
              {run?.total_downtime_hours || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>hrs</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 700 }}>{run?.total_downtime_minutes || 0} cumulative lost minutes</div>
          </div>

          <div style={{ padding: '16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Available Hours</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px' }}>
              {run?.total_available_hours || 8.0} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>hrs</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Standard shift duration</div>
          </div>

          <div style={{ padding: '16px', borderRadius: 10, background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Machine Utilization %</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: (run?.machine_utilization_percentage || 0) >= 80 ? '#16a34a' : '#ea580c', margin: '4px 0 2px' }}>
              {run?.machine_utilization_percentage || 0}%
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>(Running Hours / Available Hours)</div>
          </div>
        </div>

        {/* Visual Utilization Progress Bar */}
        <div style={{ background: '#f1f5f9', borderRadius: 8, height: 12, overflow: 'hidden', display: 'flex' }}>
          <div style={{
            width: `${run?.machine_utilization_percentage || 100}%`,
            background: '#16a34a',
            transition: 'width 0.5s ease'
          }} title={`Running: ${run?.total_running_hours || 8} hrs`} />
          <div style={{
            width: `${100 - (run?.machine_utilization_percentage || 100)}%`,
            background: '#ea580c',
            transition: 'width 0.5s ease'
          }} title={`Downtime: ${run?.total_downtime_hours || 0} hrs`} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
            Running: {run?.total_running_hours || 8} hrs
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea580c' }} />
            Downtime: {run?.total_downtime_hours || 0} hrs
          </span>
        </div>
      </div>

      {/* ── SECTION D: TOOL DETAILS ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        padding: '22px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Tool Usage & Production History
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
              All tools currently or previously mounted on {selectedMachine}. Click a tool to view its full history log.
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 800 }}>
            {tools.length} Tools Recorded
          </span>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '11px 14px', fontWeight: 800 }}>Tool Number</th>
                <th style={{ padding: '11px 14px', fontWeight: 800 }}>Operator Name</th>
                <th style={{ padding: '11px 14px', fontWeight: 800 }}>Production Qty</th>
                <th style={{ padding: '11px 14px', fontWeight: 800 }}>Target Qty</th>
                <th style={{ padding: '11px 14px', fontWeight: 800 }}>Completed Qty</th>
                <th style={{ padding: '11px 14px', fontWeight: 800 }}>Status</th>
                <th style={{ padding: '11px 14px', fontWeight: 800 }}>Start Time</th>
                <th style={{ padding: '11px 14px', fontWeight: 800, textAlign: 'center' }}>History</th>
              </tr>
            </thead>
            <tbody>
              {tools.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No tools recorded for this machine yet.
                  </td>
                </tr>
              ) : (
                tools.map(tool => {
                  const isRunning = tool.completion_status === 'Running';
                  const isCompleted = tool.completion_status === 'Completed';

                  return (
                    <tr 
                      key={tool.tool_number} 
                      style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        background: selectedToolHistory?.tool_number === tool.tool_number ? '#fff7ed' : '#ffffff'
                      }}
                    >
                      <td style={{ padding: '11px 14px', fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>
                        {tool.tool_number}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {tool.operator_name}
                      </td>
                      <td style={{ padding: '11px 14px', fontWeight: 900, color: '#16a34a' }}>
                        {tool.production_quantity.toLocaleString()} pcs
                      </td>
                      <td style={{ padding: '11px 14px', fontWeight: 800, color: '#475569' }}>
                        {tool.target_quantity.toLocaleString()} pcs
                      </td>
                      <td style={{ padding: '11px 14px', fontWeight: 800, color: '#0f172a' }}>
                        {tool.completed_quantity.toLocaleString()} pcs
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: 6,
                          fontWeight: 900,
                          fontSize: '0.72rem',
                          background: isRunning ? '#dcfce7' : (isCompleted ? '#f1f5f9' : '#fef3c7'),
                          color: isRunning ? '#15803d' : (isCompleted ? '#334155' : '#b45309'),
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          {isRunning && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />}
                          {tool.completion_status}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace' }}>
                        {tool.start_time ? tool.start_time.substring(0, 16).replace('T', ' ') : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedToolHistory(selectedToolHistory?.tool_number === tool.tool_number ? null : tool)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid #fed7aa',
                            background: selectedToolHistory?.tool_number === tool.tool_number ? '#ea580c' : '#fff7ed',
                            color: selectedToolHistory?.tool_number === tool.tool_number ? '#ffffff' : '#c2410c',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          {selectedToolHistory?.tool_number === tool.tool_number ? 'Hide Log' : 'View History'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Tool History Modal / Expansion */}
        {selectedToolHistory && (
          <div style={{
            marginTop: 16,
            padding: '16px 20px',
            background: '#fff7ed',
            borderRadius: 10,
            border: '1px solid #fed7aa'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={16} color="#ea580c" />
                <strong style={{ fontSize: '0.9rem', color: '#9a3412' }}>
                  Production History Log for {selectedToolHistory.tool_number}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setSelectedToolHistory(null)}
                style={{ background: 'none', border: 'none', color: '#9a3412', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem' }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {selectedToolHistory.history?.map((h, i) => (
                <div key={i} style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 8, border: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>{h.date} • {h.shift}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{h.hour_interval} • Operator: {h.operator_name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontWeight: 800, fontSize: '0.8rem' }}>
                    <span style={{ color: '#ea580c' }}>Target: {h.target_qty}</span>
                    <span style={{ color: '#16a34a' }}>Actual: {h.actual_qty}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION E: PROBLEMS AND DOWNTIME ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        padding: '22px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Machine Problems & Downtime History
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
              Recorded breakdowns and stoppages categorized by the 6 standard downtime codes.
            </p>
          </div>
        </div>

        {/* Downtime Pareto Summary by Reason */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 18
        }}>
          {Object.entries(dtData?.summary_by_reason || {}).length === 0 ? (
            <div style={{ padding: '12px', color: '#16a34a', fontWeight: 700, fontSize: '0.82rem', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              ✓ No active stoppage recorded for this machine on {activeDate}.
            </div>
          ) : (
            Object.entries(dtData.summary_by_reason).map(([reason, mins]) => (
              <div key={reason} style={{ padding: '12px 14px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9a3412' }}>{reason}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#ea580c', margin: '2px 0' }}>
                  {mins} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>min</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Full Stoppages Record Table */}
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Code</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Downtime Reason</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Reported Operator</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Start Time</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>End Time</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Duration</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(dtData?.records || []).length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                    Zero downtime incidents recorded for this asset.
                  </td>
                </tr>
              ) : (
                dtData.records.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#ea580c' }}>
                      {r.downtime_code || 'D01'}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                      {r.reason || r.breakdown_reason}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.operator_name || r.reported_by || 'Operator'}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.74rem', color: '#64748b' }}>
                      {r.start_time || r.breakdown_start || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.74rem', color: '#64748b' }}>
                      {r.end_time || r.breakdown_end || (r.status === 'Open' ? 'Active' : '—')}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#ea580c' }}>
                      {r.duration_minutes || r.total_downtime_minutes || 0} min
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: r.status === 'Open' ? '#fef2f2' : '#f0fdf4',
                        color: r.status === 'Open' ? '#b91c1c' : '#15803d'
                      }}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
