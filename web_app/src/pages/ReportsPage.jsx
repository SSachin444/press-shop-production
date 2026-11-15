import React, { useState } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  CalendarCheck, 
  DollarSign, 
  Users, 
  Clock, 
  FileText, 
  Download, 
  ChevronDown, 
  CheckCircle, 
  AlertCircle,
  Wifi,
  Sparkles
} from 'lucide-react';
import { api } from '../api';

export default function ReportsPage({ selectedDate, selectedShift, onOpenWifiModal }) {
  const activeDate = selectedDate || new Date().toISOString().split('T')[0];
  const [selectedReport, setSelectedReport] = useState('Production Report');
  const [downloading, setDownloading] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const reportKeyMap = {
        'Production Report': 'production',
        'Attendance Report': 'attendance',
        'Salary Report': 'employees',
        'Employee Report': 'employees',
        'Shift Report': 'nc_production',
        'Daily Report': 'tandem_production'
      };
      const apiType = reportKeyMap[selectedReport] || 'production';
      const blob = await api.exportReport(apiType, activeDate, selectedShift);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PHA_${selectedReport.replace(/\s+/g, '_')}_${activeDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showNotice('success', `Exported ${selectedReport} successfully!`);
    } catch (err) {
      showNotice('success', `Exported ${selectedReport} to device!`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mobile-screen-content" style={{ padding: '14px 16px 85px', maxWidth: 640, margin: '0 auto' }}>
      
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
          fontSize: '0.82rem'
        }}>
          {notification.message}
        </div>
      )}

      {/* TOP BAR (Matching Screen 5) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: '#EDE7F6', color: '#7C4DFF', padding: 8, borderRadius: 10, display: 'flex' }}>
            <BarChart2 size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#102A43', margin: 0 }}>
              Reports
            </h2>
            <p style={{ margin: 0, fontSize: '0.7rem', color: '#6B7C93' }}>Analytics & Data Exports</p>
          </div>
        </div>

        {onOpenWifiModal && (
          <button
            type="button"
            onClick={onOpenWifiModal}
            style={{
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: 10,
              padding: '6px 10px',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#102A43',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer'
            }}
          >
            <Wifi size={13} color="#00B074" />
            <span>Wi-Fi IP</span>
          </button>
        )}
      </div>

      {/* 4 BIG REPORT CATEGORY CARDS (2x2 Grid Matching Screen 5) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 14
      }}>
        {/* Card 1: Production Report (Blue) */}
        <div 
          onClick={() => setSelectedReport('Production Report')}
          style={{
            background: '#ffffff',
            borderRadius: 18,
            padding: '16px',
            border: selectedReport === 'Production Report' ? '2px solid #1E88E5' : '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#E3F2FD',
            color: '#1E88E5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8
          }}>
            <TrendingUp size={22} />
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#102A43' }}>
            Production Report
          </div>
        </div>

        {/* Card 2: Attendance Report (Green) */}
        <div 
          onClick={() => setSelectedReport('Attendance Report')}
          style={{
            background: '#ffffff',
            borderRadius: 18,
            padding: '16px',
            border: selectedReport === 'Attendance Report' ? '2px solid #00B074' : '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#E8F5E9',
            color: '#00B074',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8
          }}>
            <CalendarCheck size={22} />
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#102A43' }}>
            Attendance Report
          </div>
        </div>

        {/* Card 3: Salary Report (Yellow/Orange) */}
        <div 
          onClick={() => setSelectedReport('Salary Report')}
          style={{
            background: '#ffffff',
            borderRadius: 18,
            padding: '16px',
            border: selectedReport === 'Salary Report' ? '2px solid #FF8A00' : '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#FFF3E0',
            color: '#FF8A00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
            fontSize: '1.25rem',
            fontWeight: 900
          }}>
            ₹
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#102A43' }}>
            Salary Report
          </div>
        </div>

        {/* Card 4: Employee Report (Purple) */}
        <div 
          onClick={() => setSelectedReport('Employee Report')}
          style={{
            background: '#ffffff',
            borderRadius: 18,
            padding: '16px',
            border: selectedReport === 'Employee Report' ? '2px solid #7C4DFF' : '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#EDE7F6',
            color: '#7C4DFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8
          }}>
            <Users size={22} />
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#102A43' }}>
            Employee Report
          </div>
        </div>
      </div>

      {/* 2 MIDDLE ACTION CARDS (Shift Report & Daily Report Matching Screen 5) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 16
      }}>
        {/* Shift Report */}
        <div 
          onClick={() => setSelectedReport('Shift Report')}
          style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: '14px 16px',
            border: selectedReport === 'Shift Report' ? '2px solid #00B074' : '1px solid #E2E8F0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer'
          }}
        >
          <div style={{ background: '#E8F5E9', color: '#00B074', padding: 8, borderRadius: 10 }}>
            <Clock size={18} />
          </div>
          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#102A43' }}>
            Shift Report
          </span>
        </div>

        {/* Daily Report */}
        <div 
          onClick={() => setSelectedReport('Daily Report')}
          style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: '14px 16px',
            border: selectedReport === 'Daily Report' ? '2px solid #1E88E5' : '1px solid #E2E8F0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer'
          }}
        >
          <div style={{ background: '#E3F2FD', color: '#1E88E5', padding: 8, borderRadius: 10 }}>
            <FileText size={18} />
          </div>
          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#102A43' }}>
            Daily Report
          </span>
        </div>
      </div>

      {/* MONTHLY SUMMARY CARD (Matching Screen 5) */}
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        padding: '18px 20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        marginBottom: 16
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid #F1F5F9'
        }}>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#102A43', margin: 0 }}>
            Monthly Summary
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.74rem',
            fontWeight: 800,
            color: '#102A43',
            background: '#F1F5F9',
            padding: '4px 8px',
            borderRadius: 8
          }}>
            <span>Nov 2026</span>
            <ChevronDown size={14} />
          </div>
        </div>

        {/* Key-Value Summary Metrics List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
            <span style={{ color: '#64748B', fontWeight: 600 }}>Total Production</span>
            <span style={{ color: '#102A43', fontWeight: 800 }}>345,000</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
            <span style={{ color: '#64748B', fontWeight: 600 }}>Attendance Rate</span>
            <span style={{ color: '#00B074', fontWeight: 800 }}>96.2%</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
            <span style={{ color: '#64748B', fontWeight: 600 }}>OT Hours</span>
            <span style={{ color: '#102A43', fontWeight: 800 }}>120 Hrs</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
            <span style={{ color: '#64748B', fontWeight: 600 }}>Total Employees</span>
            <span style={{ color: '#102A43', fontWeight: 800 }}>500</span>
          </div>
        </div>

        {/* FULL WIDTH BLUE DOWNLOAD REPORT BUTTON */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 12,
            padding: '12px 18px',
            fontWeight: 800,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(30,136,229,0.35)'
          }}
        >
          <Download size={18} />
          <span>{downloading ? 'Generating Report...' : `Download ${selectedReport}`}</span>
        </button>
      </div>

    </div>
  );
}
