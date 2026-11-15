import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Filter, 
  Calendar, 
  Clock, 
  Layers, 
  Cpu, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle, 
  RefreshCw, 
  Search,
  FileText,
  BarChart2,
  ChevronRight,
  Sliders,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api';

const REPORT_DEFINITIONS = [
  { id: 'daily_production', label: '1. Daily Production Report', desc: 'Comprehensive record of all lines and machines operated', icon: TrendingUp, color: '#1E88E5' },
  { id: 'shift_wise', label: '2. Shift-wise Production Report', desc: 'Comparison of Shift A, B, and C output, targets & scrap', icon: Clock, color: '#00B074' },
  { id: 'hourly_production', label: '3. Hourly Production Report', desc: 'Hour-by-hour telemetry and hourly target variance', icon: BarChart2, color: '#7C4DFF' },
  { id: 'nc_production', label: '4. NC Production Report', desc: 'Detailed breakdown across all 16 NC Press units', icon: Layers, color: '#2563EB' },
  { id: 'tandem_production', label: '5. Tandem Production Report', desc: 'Output across 6 tandem lines (LP-1..2, HP-1..4)', icon: Cpu, color: '#059669' },
  { id: 'machine_wise', label: '6. Machine-wise Production Report', desc: 'Lifetime & period aggregation sorted by machine utilization', icon: Sliders, color: '#D97706' },
  { id: 'operator_wise', label: '7. Operator-wise Production Report', desc: 'Operator efficiency, machines operated and output count', icon: Users, color: '#4F46E5' },
  { id: 'target_achievement', label: '8. Target Achievement Report', desc: 'Target vs actual variance analysis and compliance flags', icon: CheckCircle, color: '#16A34A' },
  { id: 'downtime', label: '9. Downtime Report', desc: 'Breakdown incidents, lost minutes and downtime reasons', icon: AlertTriangle, color: '#DC2626' },
  { id: 'manpower', label: '10. Manpower Report', desc: 'Muster roll, shift allocation, attendance and check-in times', icon: Users, color: '#9333EA' },
  { id: 'monthly_production', label: '11. Monthly Production Report', desc: 'Monthly aggregated production volume, target and scrap', icon: Calendar, color: '#0891B2' },
];

export default function ReportsPage({ selectedDate, selectedShift }) {
  const today = selectedDate || new Date().toISOString().split('T')[0];
  const [selectedReport, setSelectedReport] = useState('daily_production');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [shiftFilter, setShiftFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({ columns: [], rows: [], count: 0 });
  const [notification, setNotification] = useState(null);

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    fetchReport();
  }, [selectedReport, fromDate, toDate, shiftFilter, machineFilter, typeFilter]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.getReportsData({
        report_type: selectedReport,
        from_date: fromDate,
        to_date: toDate,
        shift: shiftFilter,
        machine: machineFilter,
        type: typeFilter
      });
      if (res && res.success) {
        setReportData({
          columns: res.columns || [],
          rows: res.rows || [],
          count: res.count || 0
        });
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      showNotice('error', 'Failed to retrieve report data from server');
    } finally {
      setLoading(false);
    }
  };

  // Filter rows by client search
  const filteredRows = (reportData.rows || []).filter(row => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(term)
    );
  });

  // Calculate summary stats
  const totalTarget = filteredRows.reduce((acc, r) => acc + (Number(r.target_qty || r.total_target) || 0), 0);
  const totalActual = filteredRows.reduce((acc, r) => acc + (Number(r.actual_qty || r.total_actual) || 0), 0);
  const totalDowntime = filteredRows.reduce((acc, r) => acc + (Number(r.downtime_minutes || r.total_downtime) || 0), 0);
  const overallAchievement = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (!filteredRows.length) {
      showNotice('error', 'No rows available to export.');
      return;
    }

    const headers = reportData.columns;
    const csvRows = [];
    
    // Header row
    csvRows.push(headers.map(h => `"${formatColumnHeader(h)}"`).join(','));

    // Data rows
    filteredRows.forEach(row => {
      const values = headers.map(h => {
        const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvString = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PHA_${selectedReport.toUpperCase()}_${fromDate}_to_${toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showNotice('success', `Exported ${filteredRows.length} records to Excel CSV!`);
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  function formatColumnHeader(col) {
    return col
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  const activeDef = REPORT_DEFINITIONS.find(r => r.id === selectedReport) || REPORT_DEFINITIONS[0];

  return (
    <div className="page-container" style={{ padding: '20px', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* Toast Notice */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 16,
          background: notification.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${notification.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          color: notification.type === 'success' ? '#065F46' : '#991B1B',
          fontWeight: 700,
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header Panel */}
      <div className="card-panel" style={{ background: '#ffffff', borderRadius: 12, padding: '20px', border: '1px solid #E2E8F0', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 12, 
              background: '#EFF6FF', 
              color: '#1E88E5', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(30,136,229,0.15)'
            }}>
              <FileSpreadsheet size={26} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Factory Production & Management Reports
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
                PHA INDIA PRIVATE LIMITED • 11 Standardized ERP Audit Reports • Real-time DB extraction
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                fontWeight: 700,
                cursor: 'pointer',
                color: '#334155'
              }}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#ffffff',
                fontWeight: 700,
                cursor: 'pointer',
                color: '#1E293B'
              }}
            >
              <Printer size={16} />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#ffffff',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
              }}
            >
              <Download size={16} />
              <span>Export to Excel</span>
            </button>
          </div>
        </div>

        {/* 11 Reports Selector Grid / Bar */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
            Select Standard Factory Report (11 Available):
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', 
            gap: 8 
          }}>
            {REPORT_DEFINITIONS.map(r => {
              const isSelected = selectedReport === r.id;
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedReport(r.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: isSelected ? '#0F172A' : '#F8FAFC',
                    color: isSelected ? '#ffffff' : '#334155',
                    border: isSelected ? '1px solid #0F172A' : '1px solid #E2E8F0',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={16} color={isSelected ? '#38BDF8' : r.color} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: isSelected ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* FILTER BAR & SUMMARY KPI STRIP */}
      <div className="card-panel" style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #E2E8F0', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Filter size={18} color="#2563EB" />
          <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Report Query Filters & Date Range
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#64748B', marginLeft: 'auto' }}>
            Currently Viewing: <strong style={{ color: '#2563EB' }}>{activeDef.label}</strong>
          </span>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', 
          gap: 12,
          alignItems: 'flex-end'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              From Date
            </label>
            <input 
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              To Date
            </label>
            <input 
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Shift Filter
            </label>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
            >
              <option value="">All Shifts (A, B, C)</option>
              <option value="Shift A">Shift A (Morning)</option>
              <option value="Shift B">Shift B (Evening)</option>
              <option value="Shift C">Shift C (Night)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Machine / Line
            </label>
            <select
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
            >
              <option value="">All Equipment</option>
              <optgroup label="Tandem Lines">
                <option value="LP-1">LP-1 (Line 1)</option>
                <option value="LP-2">LP-2 (Line 2)</option>
                <option value="HP-1">HP-1 (Line 3)</option>
                <option value="HP-2">HP-2 (Line 4)</option>
                <option value="HP-3">HP-3 (Line 5)</option>
                <option value="HP-4">HP-4 (Line 6)</option>
              </optgroup>
              <optgroup label="NC Presses (16 Units)">
                {Array.from({ length: 16 }, (_, i) => {
                  const mId = `NC-${String(i + 1).padStart(2, '0')}`;
                  return <option key={mId} value={mId}>{mId}</option>;
                })}
              </optgroup>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Production Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
            >
              <option value="">All Types (NC & Tandem)</option>
              <option value="NC">NC Press Only</option>
              <option value="Tandem">Tandem Lines Only</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Search in Results
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94A3B8' }} />
              <input 
                type="text"
                placeholder="Search text..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
              />
            </div>
          </div>
        </div>

        {/* Quick KPI summary */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: 12, 
          marginTop: 18,
          paddingTop: 16,
          borderTop: '1px solid #F1F5F9'
        }}>
          <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>RECORDS RETURNED</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A' }}>{filteredRows.length}</div>
          </div>

          {totalTarget > 0 && (
            <div style={{ background: '#EFF6FF', padding: '10px 14px', borderRadius: 8, border: '1px solid #BFDBFE' }}>
              <div style={{ fontSize: '0.72rem', color: '#1E40AF', fontWeight: 700 }}>TOTAL TARGET</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1E40AF' }}>{totalTarget.toLocaleString()}</div>
            </div>
          )}

          {totalActual > 0 && (
            <div style={{ background: '#ECFDF5', padding: '10px 14px', borderRadius: 8, border: '1px solid #A7F3D0' }}>
              <div style={{ fontSize: '0.72rem', color: '#065F46', fontWeight: 700 }}>TOTAL ACTUAL</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669' }}>{totalActual.toLocaleString()}</div>
            </div>
          )}

          {totalTarget > 0 && (
            <div style={{ background: overallAchievement >= 90 ? '#ECFDF5' : '#FFFBEB', padding: '10px 14px', borderRadius: 8, border: overallAchievement >= 90 ? '1px solid #A7F3D0' : '1px solid #FDE68A' }}>
              <div style={{ fontSize: '0.72rem', color: overallAchievement >= 90 ? '#065F46' : '#92400E', fontWeight: 700 }}>ACHIEVEMENT RATE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: overallAchievement >= 90 ? '#059669' : '#D97706' }}>
                {overallAchievement}%
              </div>
            </div>
          )}

          {totalDowntime > 0 && (
            <div style={{ background: '#FEF2F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FECACA' }}>
              <div style={{ fontSize: '0.72rem', color: '#991B1B', fontWeight: 700 }}>TOTAL DOWNTIME</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#DC2626' }}>{totalDowntime} mins</div>
            </div>
          )}
        </div>
      </div>

      {/* DATA TABLE CONTAINER */}
      <div className="card-panel" style={{ background: '#ffffff', borderRadius: 12, padding: '20px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              {activeDef.label}
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{activeDef.desc}</div>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369A1', background: '#E0F2FE', padding: '4px 10px', borderRadius: 20 }}>
            {filteredRows.length} Row{filteredRows.length === 1 ? '' : 's'} Matched
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748B' }}>
            <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: '#2563EB' }} />
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Extracting report records from production database...</div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: '#F8FAFC', borderRadius: 10, border: '1px dashed #CBD5E1', margin: '10px 0' }}>
            <FileText size={36} color="#94A3B8" style={{ margin: '0 auto 10px', display: 'block' }} />
            <h4 style={{ margin: '0 0 6px', color: '#1E293B', fontWeight: 700 }}>No production records match this criteria</h4>
            <p style={{ margin: 0, color: '#64748B', fontSize: '0.84rem' }}>
              Try broadening the date range or clearing shift/machine filters.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#0F172A', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '12px 14px', fontWeight: 700, width: 44 }}>#</th>
                  {reportData.columns.map(col => (
                    <th key={col} style={{ padding: '12px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {formatColumnHeader(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const ach = Number(row.achievement_pct);
                  return (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid #F1F5F9',
                        background: idx % 2 === 0 ? '#ffffff' : '#F8FAFC',
                        transition: 'background 0.1s'
                      }}
                    >
                      <td style={{ padding: '10px 14px', color: '#94A3B8', fontWeight: 600 }}>{idx + 1}</td>
                      {reportData.columns.map(col => {
                        const val = row[col];
                        
                        // Custom cell formatting
                        if (col === 'achievement_pct') {
                          const pct = Number(val) || 0;
                          return (
                            <td key={col} style={{ padding: '10px 14px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontWeight: 800,
                                fontSize: '0.78rem',
                                background: pct >= 90 ? '#ECFDF5' : pct >= 70 ? '#EFF6FF' : '#FEF2F2',
                                color: pct >= 90 ? '#065F46' : pct >= 70 ? '#1E40AF' : '#991B1B'
                              }}>
                                {val !== null && val !== undefined ? `${val}%` : '-'}
                              </span>
                            </td>
                          );
                        }

                        if (col === 'status') {
                          const isMet = String(val).toLowerCase().includes('met') || String(val).toLowerCase().includes('active');
                          return (
                            <td key={col} style={{ padding: '10px 14px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontWeight: 700,
                                fontSize: '0.76rem',
                                background: isMet ? '#ECFDF5' : '#FEF2F2',
                                color: isMet ? '#065F46' : '#991B1B'
                              }}>
                                {val || '-'}
                              </span>
                            </td>
                          );
                        }

                        if (col === 'downtime_minutes' || col === 'total_downtime') {
                          const dt = Number(val) || 0;
                          return (
                            <td key={col} style={{ padding: '10px 14px', fontWeight: dt > 0 ? 700 : 500, color: dt > 0 ? '#DC2626' : '#64748B' }}>
                              {dt > 0 ? `${dt} min` : '0'}
                            </td>
                          );
                        }

                        if (col === 'target_qty' || col === 'actual_qty' || col === 'good_qty' || col === 'total_target' || col === 'total_actual') {
                          return (
                            <td key={col} style={{ padding: '10px 14px', fontWeight: 700, color: '#0F172A' }}>
                              {Number(val).toLocaleString()}
                            </td>
                          );
                        }

                        return (
                          <td key={col} style={{ padding: '10px 14px', color: '#334155', whiteSpace: 'nowrap' }}>
                            {val !== null && val !== undefined ? String(val) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Footnote (Visible in Print View) */}
      <div className="print-only" style={{ display: 'none', marginTop: 30, fontSize: '0.75rem', color: '#64748B', textAlign: 'center' }}>
        PHA INDIA PRIVATE LIMITED • PRESS SHOP MFG-2 • Industrial Production Record • Generated {new Date().toLocaleString()}
      </div>

    </div>
  );
}
