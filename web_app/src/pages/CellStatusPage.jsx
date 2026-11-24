import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Download, 
  Layers, 
  Cpu, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  User,
  Wrench,
  AlertCircle,
  FileText
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { api } from '../api';

/**
 * Reusable Circular Progress Indicator
 * Smooth SVG circle animation with percentage displayed directly inside
 */
function CircularProgress({ percentage, label, subtext, color, size = 115, strokeWidth = 10 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, Number(percentage) || 0));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Subtle Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated Value Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease'
            }}
          />
        </svg>

        {/* Percentage Label inside the circle */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <span style={{
            fontSize: size >= 110 ? '1.35rem' : '1.1rem',
            fontWeight: 900,
            color: color,
            lineHeight: 1,
            letterSpacing: '-0.02em'
          }}>
            {clamped}%
          </span>
        </div>
      </div>

      {/* Label and Subtext underneath */}
      <div style={{ marginTop: 8, textAlign: 'center' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>{label}</div>
        {subtext && (
          <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 1, fontWeight: 500 }}>
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CellStatusPage({ selectedDate, selectedShift, onLogHourlyForMachine, onSelectMachineSummary }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL'); // ALL, NC, TANDEM
  const [exporting, setExporting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true); // Default live auto-refresh enabled
  const [notice, setNotice] = useState(null);

  const exportRef = useRef(null);

  useEffect(() => {
    loadCellStatus();
  }, [selectedDate, selectedShift, filterType]);

  // 10-second live auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadCellStatus(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedDate, selectedShift, filterType]);

  const loadCellStatus = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await api.getCellStatus(selectedDate, selectedShift, filterType);
      setData(res);
    } catch (err) {
      console.error('Failed to load cell status:', err);
      if (!isBackground) {
        setNotice({ type: 'error', message: err.message || 'Failed to load live cell status data' });
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // High-resolution PDF Export
  const handleExportPdf = async () => {
    if (!exportRef.current) return;
    try {
      setExporting(true);
      setNotice({ type: 'info', message: 'Generating Production Cell Status PDF report...' });

      await new Promise((r) => setTimeout(r, 200));

      const element = exportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#f8fafc',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [canvas.width * 0.75, canvas.height * 0.75]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width * 0.75, canvas.height * 0.75);
      const filename = `PHA_INDIA_Cell_Status_${selectedDate}_${(selectedShift || 'ShiftA').replace(/\s+/g, '_')}.pdf`;
      pdf.save(filename);

      setNotice({ type: 'success', message: `Exported: ${filename}` });
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      console.error('PDF export error:', err);
      setNotice({ type: 'error', message: 'Failed to export PDF: ' + err.message });
    } finally {
      setExporting(false);
    }
  };

  const machines = data?.machines || [];

  // Summary Metrics
  const totalMachines = machines.length;
  const goodMachines = machines.filter(m => (m.total_output_pct || 0) >= 85).length;
  const lowMachines = machines.filter(m => (m.total_output_pct || 0) < 85 && !m.is_stopped).length;
  const stoppedMachines = machines.filter(m => m.is_stopped || m.status === 'Breakdown').length;

  return (
    <div style={{ padding: '20px', maxWidth: '1440px', margin: '0 auto', color: '#0f172a' }}>
      {/* Toast Notice */}
      {notice && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 16,
          background: notice.type === 'success' ? '#f0fdf4' : notice.type === 'error' ? '#fef2f2' : '#fff7ed',
          border: `1px solid ${notice.type === 'success' ? '#bbf7d0' : notice.type === 'error' ? '#fecaca' : '#fed7aa'}`,
          color: notice.type === 'success' ? '#15803d' : notice.type === 'error' ? '#b91c1c' : '#c2410c',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.86rem',
          fontWeight: 700,
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
        }}>
          {notice.type === 'success' ? <CheckCircle size={18} color="#16a34a" /> : <AlertTriangle size={18} color="#ea580c" />}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        padding: '18px 22px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          {/* Left Title & Department Filter */}
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
                LIVE SHOPFLOOR
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Live Cell Status
              </h2>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '4px 0 0' }}>
              Dual circular indicators for every machine: <strong style={{ color: '#16a34a' }}>Circle 1 (Total Output %)</strong> and <strong style={{ color: '#ea580c' }}>Circle 2 (Hourly Output %)</strong>.
            </p>
          </div>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Department Filter Toggle */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: filterType === 'ALL' ? '#ffffff' : 'transparent',
                  color: filterType === 'ALL' ? '#ea580c' : '#64748b',
                  fontWeight: filterType === 'ALL' ? 800 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: filterType === 'ALL' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                All Machines ({data?.machines?.length || 22})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('NC')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: filterType === 'NC' ? '#ffffff' : 'transparent',
                  color: filterType === 'NC' ? '#ea580c' : '#64748b',
                  fontWeight: filterType === 'NC' ? 800 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: filterType === 'NC' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                NC Presses (16)
              </button>
              <button
                type="button"
                onClick={() => setFilterType('TANDEM')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: filterType === 'TANDEM' ? '#ffffff' : 'transparent',
                  color: filterType === 'TANDEM' ? '#ea580c' : '#64748b',
                  fontWeight: filterType === 'TANDEM' ? 800 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: filterType === 'TANDEM' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Tandem Lines (6)
              </button>
            </div>

            {/* Auto-Refresh Toggle */}
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                background: autoRefresh ? '#f0fdf4' : '#ffffff',
                border: `1px solid ${autoRefresh ? '#bbf7d0' : '#cbd5e1'}`,
                color: autoRefresh ? '#15803d' : '#64748b',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Automatically poll and update live database values"
            >
              <Activity size={13} className={autoRefresh ? 'animate-pulse' : ''} />
              <span>{autoRefresh ? 'Live Sync Active (10s)' : 'Live Sync Paused'}</span>
            </button>

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={() => loadCellStatus()}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            {/* PDF Export */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                background: '#ea580c',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
              }}
            >
              <Download size={13} />
              <span>{exporting ? 'Exporting...' : 'Export PDF'}</span>
            </button>
          </div>
        </div>

        {/* Plant Status KPI Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid #f1f5f9'
        }}>
          <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Total Monitored Units</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>{totalMachines} Machines</div>
          </div>
          <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 700 }}>Good Performance (≥ 85%)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>{goodMachines} Units</div>
          </div>
          <div style={{ padding: '8px 12px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
            <div style={{ fontSize: '0.7rem', color: '#c2410c', fontWeight: 700 }}>Low Performance (&lt; 85%)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ea580c' }}>{lowMachines} Units</div>
          </div>
          <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '0.7rem', color: '#b91c1c', fontWeight: 700 }}>Stopped / Breakdown</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#dc2626' }}>{stoppedMachines} Units</div>
          </div>
        </div>
      </div>

      {/* EXPORTABLE CELLS CONTAINER */}
      <div ref={exportRef} style={{ background: '#f8fafc' }}>
        {/* Print / Export Watermark Banner */}
        <div style={{
          display: 'none',
          padding: '12px 16px',
          background: '#ffffff',
          borderRadius: 8,
          marginBottom: 16,
          border: '1px solid #e2e8f0'
        }} className="export-only-banner">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ea580c' }}>PHA INDIA PRIVATE LIMITED</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>PRESS SHOP MFG-2 • LIVE CELL STATUS REPORT</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#475569' }}>
              <div>Date: <strong>{selectedDate}</strong> | Shift: <strong>{selectedShift}</strong></div>
            </div>
          </div>
        </div>

        {/* MACHINE STATUS CARDS GRID */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 18
        }}>
          {machines.map((m) => {
            const totalPct = Number(m.total_output_pct) || 0;
            const hourlyPct = Number(m.hourly_output_pct) || 0;

            // Green for good performance (>= 85%), Orange for low performance (< 85%)
            const totalCircleColor = totalPct >= 85 ? '#16a34a' : '#ea580c';
            const hourlyCircleColor = hourlyPct >= 85 ? '#16a34a' : '#ea580c';

            const isStopped = m.is_stopped || m.status === 'Breakdown';
            const statusBg = isStopped ? '#fef2f2' : (m.status === 'Running' ? '#f0fdf4' : '#f8fafc');
            const statusColor = isStopped ? '#b91c1c' : (m.status === 'Running' ? '#15803d' : '#475569');

            return (
              <div
                key={m.machine_number}
                style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  border: isStopped ? '2px solid #ef4444' : '1px solid #e2e8f0',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  position: 'relative'
                }}
              >
                {/* Active Breakdown Alert Ribbon if machine is stopped */}
                {isStopped && (
                  <div style={{
                    position: 'absolute',
                    top: -10,
                    right: 20,
                    background: '#dc2626',
                    color: '#ffffff',
                    padding: '2px 10px',
                    borderRadius: 10,
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    boxShadow: '0 2px 6px rgba(220,38,38,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                    DOWNTIME ACTIVE: {m.active_downtime?.downtime_code || 'D01'}
                  </div>
                )}

                {/* Card Header: Machine Number, Tonnage, Operator Name, Machine Status */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                          {m.machine_number}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: '#f1f5f9',
                          color: '#475569'
                        }}>
                          {m.tonnage}T • {m.machine_type}
                        </span>
                      </div>

                      {/* Clear Operator Name Display (Mandatory Requirement) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <User size={13} color="#ea580c" />
                        <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 700 }}>
                          Operator: <span style={{ color: '#0f172a' }}>{m.operator || m.operator_name || 'Line Operator'}</span>
                        </span>
                      </div>

                      {/* Tool Number */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Wrench size={12} color="#64748b" />
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                          Tool: {m.tool_number || 'TL-1001'}
                        </span>
                      </div>
                    </div>

                    {/* Machine Status Pill */}
                    <div style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: statusBg,
                      color: statusColor,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      border: `1px solid ${statusColor}30`,
                      textTransform: 'uppercase'
                    }}>
                      {m.status || (isStopped ? 'Breakdown' : 'Running')}
                    </div>
                  </div>

                  {/* ── TWO PROMINENT CIRCULAR PROGRESS INDICATORS ── */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    padding: '16px 8px',
                    margin: '12px 0',
                    background: '#fafbfc',
                    borderRadius: 12,
                    border: '1px solid #f1f5f9'
                  }}>
                    {/* Circle 1 – Total Output Percentage */}
                    <CircularProgress
                      percentage={totalPct}
                      label="Total Output %"
                      subtext={`${(m.actual || 0).toLocaleString()} / ${(m.target || 0).toLocaleString()} pcs`}
                      color={totalCircleColor}
                      size={112}
                      strokeWidth={10}
                    />

                    {/* Dividing Vertical Line */}
                    <div style={{ width: 1, height: 90, background: '#e2e8f0' }} />

                    {/* Circle 2 – Hourly Output Percentage */}
                    <CircularProgress
                      percentage={hourlyPct}
                      label="Hourly Output %"
                      subtext={`${m.hourly_actual || 0} / ${m.hourly_target || 75} pcs`}
                      color={hourlyCircleColor}
                      size={112}
                      strokeWidth={10}
                    />
                  </div>
                </div>

                {/* Card Footer: Quick Action Buttons (Log Hourly & Machine Summary) */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 8,
                  paddingTop: 10,
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <button
                    type="button"
                    onClick={() => onSelectMachineSummary && onSelectMachineSummary(m.machine_number)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ea580c',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 4
                    }}
                    title="View detailed Machine Summary"
                  >
                    <FileText size={13} />
                    <span>Machine Summary</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLogHourlyForMachine && onLogHourlyForMachine(m.machine_number, m.machine_type)}
                    style={{
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      color: '#c2410c',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '5px 12px',
                      borderRadius: 6
                    }}
                  >
                    <span>Log Hourly</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
