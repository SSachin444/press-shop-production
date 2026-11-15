import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Download, 
  Filter, 
  Layers, 
  Cpu, 
  Maximize2, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Calendar,
  Sparkles,
  TrendingUp,
  BarChart2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { api } from '../api';

export default function CellStatusPage({ selectedDate, selectedShift, onLogHourlyForMachine }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL'); // ALL, NC, TANDEM
  const [exporting, setExporting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [notice, setNotice] = useState(null);

  const exportRef = useRef(null);

  useEffect(() => {
    loadCellStatus();
  }, [selectedDate, selectedShift, filterType]);

  // Optional 10-second live auto-refresh
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

  // High-fidelity PDF Export preserving exact colors, layout, and positions
  const handleExportPdf = async () => {
    if (!exportRef.current) return;
    try {
      setExporting(true);
      setNotice({ type: 'info', message: 'Generating high-resolution Production Dashboard PDF...' });

      // Allow DOM to settle
      await new Promise((r) => setTimeout(r, 200));

      const element = exportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // 2x sharp resolution
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#0b1329', // High-contrast navy theme background
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [canvas.width * 0.75, canvas.height * 0.75]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width * 0.75, canvas.height * 0.75);
      const filename = `PHA_PRESS_SHOP_MFG2_Cell_Status_${selectedDate}_${selectedShift.replace(/\s+/g, '_')}.pdf`;
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

  const getTileBg = (val, isOee = false) => {
    if (val >= 85) return '#10b981'; // Green
    if (val >= 70) return '#f59e0b'; // Amber / Yellow
    if (val > 0) return '#ef4444'; // Red
    return '#64748b'; // Gray for 0%
  };

  const machines = data?.machines || [];
  const tickerItems = data?.ticker || [];
  const downtimePareto = data?.downtime_pareto || [];

  return (
    <div className="page-container" style={{ padding: '16px 20px' }}>
      {/* Toast Notification */}
      {notice && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 14,
          background: notice.type === 'success' ? '#ecfdf5' : notice.type === 'error' ? '#fef2f2' : '#eff6ff',
          border: `1px solid ${notice.type === 'success' ? '#a7f3d0' : notice.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
          color: notice.type === 'success' ? '#065f46' : notice.type === 'error' ? '#991b1b' : '#1e40af',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.86rem',
          fontWeight: 600
        }}>
          {notice.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span>{notice.message}</span>
        </div>
      )}

      {/* TOP LIVE STATUS TICKER BAR (Matching Image header) */}
      <div className="cell-top-ticker-bar">
        <div className="ticker-label">
          <div className="pulse-indicator" style={{ background: '#10b981' }} />
          <span>LIVE CELLS</span>
        </div>
        <div className="ticker-scroll-area">
          {tickerItems.length > 0 ? (
            tickerItems.map((item, idx) => (
              <div 
                key={idx}
                className="ticker-badge"
                style={{
                  background: item.status === 'green' ? '#10b981' : item.status === 'yellow' ? '#f59e0b' : item.status === 'red' ? '#ef4444' : '#475569',
                  color: '#ffffff'
                }}
              >
                <span className="ticker-name">{item.name}</span>
                <span className="ticker-pct">- {item.pct}</span>
              </div>
            ))
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Loading machine output rates...</div>
          )}
        </div>
      </div>

      {/* DASHBOARD CONTROLS BAR (Dashboard / Cell Status / Filter / Date / Actions) */}
      <div className="cell-controls-bar">
        <div className="cell-controls-left">
          <div className="cell-view-title-group">
            <h1 className="cell-main-title">Cell Status</h1>
            <span className="cell-sub-badge">PRESS SHOP MFG-2</span>
          </div>

          {/* Department Filter Toggle */}
          <div className="cell-filter-group">
            <button
              className={`cell-filter-btn ${filterType === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterType('ALL')}
            >
              All Machines ({machines.length})
            </button>
            <button
              className={`cell-filter-btn ${filterType === 'NC' ? 'active' : ''}`}
              onClick={() => setFilterType('NC')}
            >
              NC Presses (16)
            </button>
            <button
              className={`cell-filter-btn ${filterType === 'TANDEM' ? 'active' : ''}`}
              onClick={() => setFilterType('TANDEM')}
            >
              Tandem Lines (6)
            </button>
          </div>
        </div>

        <div className="cell-controls-right">
          {/* Live Auto-Refresh Toggle */}
          <button
            className={`btn btn-sm ${autoRefresh ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{ fontSize: '0.76rem', gap: 6 }}
            title="Auto-refresh every 10 seconds"
          >
            <Activity size={13} className={autoRefresh ? 'animate-pulse' : ''} />
            <span>{autoRefresh ? 'Live (10s)' : 'Auto-Sync Off'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadCellStatus()}
            disabled={loading}
            style={{ fontSize: '0.76rem', gap: 6 }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* HIGH IMPACT PDF EXPORT BUTTON */}
          <button
            className="btn btn-primary btn-sm export-pdf-btn"
            onClick={handleExportPdf}
            disabled={exporting}
            style={{ 
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
              color: '#fff', 
              fontWeight: 700,
              fontSize: '0.8rem',
              gap: 8,
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
            }}
          >
            <Download size={14} className={exporting ? 'animate-bounce' : ''} />
            <span>{exporting ? 'Exporting PDF...' : 'Export Dashboard PDF'}</span>
          </button>
        </div>
      </div>

      {/* EXPORTABLE DASHBOARD CONTENT (Preserves exact colors, styling & grid) */}
      <div id="cell-status-dashboard-view" ref={exportRef} className="cell-dashboard-container">
        
        {/* Printable/Export Brand Watermark Header */}
        <div className="export-header-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="pha-logo-badge" style={{ fontSize: '0.9rem', padding: '4px 8px' }}>PHA</div>
            <div>
              <div style={{ fontSize: '0.74rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
                PHA INDIA PRIVATE LIMITED
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                PRESS SHOP MFG-2 • CELL STATUS DASHBOARD
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.78rem', color: '#94a3b8' }}>
            <div>Date: <strong style={{ color: '#fff' }}>{selectedDate}</strong> | Shift: <strong style={{ color: '#fff' }}>{selectedShift}</strong></div>
            <div>Sriperumbudur Plant 1 • Generated Live</div>
          </div>
        </div>

        {/* MACHINE CELLS GRID */}
        <div className="cell-grid">
          {machines.map((m) => {
            const oeeColor = getTileBg(m.oee, true);
            const perfColor = getTileBg(m.performance);
            const qualColor = getTileBg(m.quality);
            const availColor = getTileBg(m.availability);

            return (
              <div key={m.machine_number} className="cell-card">
                {/* Machine Header */}
                <div className="cell-card-header">
                  <div className="cell-machine-name">
                    <span>{m.machine_number}</span>
                    <span className="cell-tonnage-tag">{m.tonnage}T</span>
                  </div>
                  <div className="cell-header-actions">
                    <span className={`cell-status-dot status-${m.status.toLowerCase()}`} title={`Status: ${m.status}`} />
                    <button 
                      type="button"
                      className="cell-icon-btn" 
                      title="Log Hourly Production"
                      onClick={() => onLogHourlyForMachine && onLogHourlyForMachine(m.machine_number, m.machine_type)}
                    >
                      <Maximize2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Top Row: OEE / Target / Actual */}
                <div className="cell-top-row">
                  {/* Big OEE Block */}
                  <div className="cell-metric-tile oee-tile" style={{ backgroundColor: oeeColor }}>
                    <div className="metric-val-big">{m.oee}%</div>
                    <div className="metric-label-white">OEE</div>
                  </div>

                  {/* Target Block */}
                  <div className="cell-metric-tile stat-tile">
                    <div className="metric-val-dark">{m.target.toLocaleString()}</div>
                    <div className="metric-label-muted">Target</div>
                  </div>

                  {/* Actual Block */}
                  <div className="cell-metric-tile stat-tile">
                    <div className="metric-val-dark">{m.actual.toLocaleString()}</div>
                    <div className="metric-label-muted">Actual</div>
                  </div>
                </div>

                {/* Bottom Row: Performance / Quality / Availability */}
                <div className="cell-bottom-row">
                  {/* Performance */}
                  <div className="cell-sub-tile" style={{ backgroundColor: perfColor }}>
                    <div className="sub-metric-val">{m.performance}%</div>
                    <div className="sub-metric-label">Performance</div>
                  </div>

                  {/* Quality */}
                  <div className="cell-sub-tile" style={{ backgroundColor: qualColor }}>
                    <div className="sub-metric-val">{m.quality}%</div>
                    <div className="sub-metric-label">Quality</div>
                  </div>

                  {/* Availability */}
                  <div className="cell-sub-tile" style={{ backgroundColor: availColor }}>
                    <div className="sub-metric-val">{m.availability}%</div>
                    <div className="sub-metric-label">Availability</div>
                  </div>
                </div>

                {/* Tool & Downtime Footer */}
                <div className="cell-card-footer">
                  <div className="cell-tool-info">
                    <span className="tool-tag">Tool: {m.active_tool}</span>
                    {m.downtime_minutes > 0 && (
                      <span className="downtime-tag">DT: {m.downtime_minutes}m</span>
                    )}
                  </div>
                  <div className="cell-output-rate">
                    <span>Good: <strong>{m.good.toLocaleString()}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* DOWNTIME PARETO CHART CARD (Matching Image Bottom Right) */}
          <div className="cell-card downtime-card">
            <div className="cell-card-header">
              <div className="cell-machine-name">
                <BarChart2 size={16} color="#38bdf8" />
                <span>Downtime Pareto Analysis</span>
              </div>
              <span className="cell-tonnage-tag">All Units</span>
            </div>

            <div className="pareto-chart-body">
              {/* Pareto Bars */}
              <div className="pareto-bars-wrap">
                {downtimePareto.slice(0, 10).map((cat, idx) => {
                  const maxMins = downtimePareto[0]?.minutes || 100;
                  const heightPct = Math.max(12, Math.round((cat.minutes / maxMins) * 100));

                  return (
                    <div key={idx} className="pareto-col">
                      <div className="pareto-line-dot" style={{ bottom: `${cat.cumulative_pct}%` }}>
                        <span className="pareto-line-label">{cat.cumulative_pct}%</span>
                      </div>
                      <div className="pareto-bar-track">
                        <div 
                          className="pareto-bar-fill" 
                          style={{ height: `${heightPct}%` }}
                          title={`${cat.category}: ${cat.minutes} mins (${cat.cumulative_pct}% cumulative)`}
                        />
                      </div>
                      <div className="pareto-cat-name" title={cat.category}>
                        {cat.category}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pareto Legend */}
              <div className="pareto-legend">
                <div className="legend-item">
                  <span className="legend-box blue-box" />
                  <span>Downtime (Minutes)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-box cyan-line" />
                  <span>Cumulative Pareto %</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
