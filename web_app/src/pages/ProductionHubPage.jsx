import React, { useState } from 'react';
import { 
  Factory, 
  Target, 
  Cpu, 
  Calendar, 
  Gauge, 
  TrendingUp, 
  CheckCircle2, 
  Timer, 
  Activity, 
  ClipboardList, 
  ChevronRight,
  Layers,
  GitBranch
} from 'lucide-react';
import HourlyProductionPage from './HourlyProductionPage';
import CellStatusPage from './CellStatusPage';
import PlanDetailsPage from './PlanDetailsPage';

export default function ProductionHubPage({ 
  selectedDate, 
  selectedShift, 
  initialSubTab = 'hub',
  selectedMachineForHourly,
  onLogHourlyForMachine
}) {
  const [activeTab, setActiveTab] = useState(initialSubTab || 'hub');
  const [lineType, setLineType] = useState('NC'); // 'NC' or 'Tandem'

  return (
    <div className="mobile-screen-content" style={{ padding: '14px 16px 85px', maxWidth: 640, margin: '0 auto' }}>
      
      {/* SUB-NAVIGATION PILLS (Hub Overview | Hourly Entry | Cell Status % | Tool Plans) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 6,
        marginBottom: 14,
        WebkitOverflowScrolling: 'touch'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('hub')}
          style={{
            padding: '7px 14px',
            borderRadius: 18,
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            background: activeTab === 'hub' ? '#1E88E5' : '#ffffff',
            color: activeTab === 'hub' ? '#ffffff' : '#64748B',
            boxShadow: activeTab === 'hub' ? '0 2px 8px rgba(30,136,229,0.3)' : 'none',
            border: activeTab === 'hub' ? 'none' : '1px solid #E2E8F0'
          }}
        >
          Production Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hourly')}
          style={{
            padding: '7px 14px',
            borderRadius: 18,
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            background: activeTab === 'hourly' ? '#1E88E5' : '#ffffff',
            color: activeTab === 'hourly' ? '#ffffff' : '#64748B',
            boxShadow: activeTab === 'hourly' ? '0 2px 8px rgba(30,136,229,0.3)' : 'none',
            border: activeTab === 'hourly' ? 'none' : '1px solid #E2E8F0'
          }}
        >
          ⚡ Hourly Entry
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cell-status')}
          style={{
            padding: '7px 14px',
            borderRadius: 18,
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            background: activeTab === 'cell-status' ? '#1E88E5' : '#ffffff',
            color: activeTab === 'cell-status' ? '#ffffff' : '#64748B',
            boxShadow: activeTab === 'cell-status' ? '0 2px 8px rgba(30,136,229,0.3)' : 'none',
            border: activeTab === 'cell-status' ? 'none' : '1px solid #E2E8F0'
          }}
        >
          Cell Status %
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('plans')}
          style={{
            padding: '7px 14px',
            borderRadius: 18,
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            background: activeTab === 'plans' ? '#1E88E5' : '#ffffff',
            color: activeTab === 'plans' ? '#ffffff' : '#64748B',
            boxShadow: activeTab === 'plans' ? '0 2px 8px rgba(30,136,229,0.3)' : 'none',
            border: activeTab === 'plans' ? 'none' : '1px solid #E2E8F0'
          }}
        >
          Tool Plans
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeTab === 'hourly' && (
        <HourlyProductionPage 
          selectedDate={selectedDate}
          selectedShift={selectedShift}
          initialMachine={selectedMachineForHourly?.machine || 'NC-01'}
          initialType={selectedMachineForHourly?.type || 'NC'}
          onNavigateToCellStatus={() => setActiveTab('cell-status')}
        />
      )}

      {activeTab === 'cell-status' && (
        <CellStatusPage 
          selectedDate={selectedDate}
          selectedShift={selectedShift}
          onLogHourlyForMachine={(m, t) => {
            if (onLogHourlyForMachine) onLogHourlyForMachine(m, t);
            setActiveTab('hourly');
          }}
        />
      )}

      {activeTab === 'plans' && (
        <PlanDetailsPage 
          selectedDate={selectedDate}
          selectedShift={selectedShift}
        />
      )}

      {activeTab === 'hub' && (
        <div>
          {/* TOP BAR (Matching Screen 3) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: '#E3F2FD', color: '#1E88E5', padding: 8, borderRadius: 10, display: 'flex' }}>
                <Factory size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#102A43', margin: 0 }}>
                  Production
                </h2>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#6B7C93' }}>Daily Output & Line Monitoring</p>
              </div>
            </div>

            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#102A43'
            }}>
              <Calendar size={18} />
            </div>
          </div>

          {/* NC / TANDEM SEGMENTED SWITCHER (Matching Screen 3) */}
          <div style={{
            background: '#F1F5F9',
            borderRadius: 14,
            padding: 4,
            display: 'flex',
            gap: 4,
            marginBottom: 16
          }}>
            <button
              type="button"
              onClick={() => setLineType('NC')}
              style={{
                flex: 1,
                padding: '9px 16px',
                borderRadius: 10,
                border: 'none',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                background: lineType === 'NC' ? '#1E88E5' : 'transparent',
                color: lineType === 'NC' ? '#ffffff' : '#64748B',
                boxShadow: lineType === 'NC' ? '0 2px 8px rgba(30,136,229,0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              NC (16 Presses)
            </button>

            <button
              type="button"
              onClick={() => setLineType('Tandem')}
              style={{
                flex: 1,
                padding: '9px 16px',
                borderRadius: 10,
                border: 'none',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                background: lineType === 'Tandem' ? '#1E88E5' : 'transparent',
                color: lineType === 'Tandem' ? '#ffffff' : '#64748B',
                boxShadow: lineType === 'Tandem' ? '0 2px 8px rgba(30,136,229,0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Tandem (6 Lines)
            </button>
          </div>

          {/* NC PRODUCTION CARD (Blue Gradient Card Matching Screen 3) */}
          <div style={{
            background: 'linear-gradient(135deg, #1E88E5 0%, #0D47A1 100%)',
            borderRadius: 20,
            padding: '18px 20px',
            color: '#ffffff',
            boxShadow: '0 4px 16px rgba(13, 71, 161, 0.35)',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#E3F2FD' }}>
                NC Production
              </span>
              <span style={{
                background: 'rgba(0, 200, 83, 0.25)',
                border: '1px solid rgba(0, 200, 83, 0.4)',
                color: '#A5D6A7',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 8
              }}>
                ↑ 104%
              </span>
            </div>

            <div style={{ fontSize: '1.9rem', fontWeight: 900, letterSpacing: -0.5, marginBottom: 14 }}>
              12,500 <span style={{ fontSize: '1.15rem', color: '#BBDEFB', fontWeight: 600 }}>/ 12,000</span>
            </div>

            {/* 2 White Inner Metric Widgets */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Widget 1: Hourly Output */}
              <div style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: '12px 14px',
                color: '#102A43',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ background: '#E3F2FD', padding: 5, borderRadius: 8, color: '#1E88E5' }}>
                    <Gauge size={14} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700 }}>Hourly Output</span>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#102A43' }}>
                  1,250
                </div>
                <div style={{ fontSize: '0.64rem', color: '#64748B' }}>Units/hr</div>
              </div>

              {/* Widget 2: Output % */}
              <div style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: '12px 14px',
                color: '#102A43',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ background: '#FFEBEE', padding: 5, borderRadius: 8, color: '#D32F2F' }}>
                    <Target size={14} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700 }}>Output %</span>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#102A43' }}>
                  98.5%
                </div>
                <div style={{ fontSize: '0.64rem', color: '#00B074', fontWeight: 700 }}>Above Target</div>
              </div>
            </div>
          </div>

          {/* TANDEM LINE CARD (Matching Screen 3) */}
          <div style={{
            background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2F6 100%)',
            borderRadius: 20,
            padding: '16px 18px',
            border: '1px solid #CBD5E1',
            marginBottom: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#102A43' }}>
                  Tandem Line
                </span>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Total Output</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#102A43' }}>
                    18,000
                  </span>
                  <span style={{ color: '#00B074', fontSize: '0.74rem', fontWeight: 800 }}>
                    ↑ 102%
                  </span>
                </div>
              </div>

              {/* Robotic Conveyor Silhouette */}
              <div style={{ opacity: 0.25 }}>
                <Cpu size={50} color="#1E88E5" />
              </div>
            </div>

            {/* 6 Lines Checklist Grid */}
            <div style={{ marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 10 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', marginBottom: 8 }}>
                6 Active Lines:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {['LP-1', 'LP-2', 'HP-1', 'HP-2', 'HP-3', 'HP-4'].map(line => (
                  <div 
                    key={line} 
                    style={{
                      background: '#ffffff',
                      borderRadius: 10,
                      padding: '6px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: '#102A43',
                      border: '1px solid #E2E8F0'
                    }}
                  >
                    <CheckCircle2 size={13} color="#00B074" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* HOURLY PRODUCTION BAR CHART (Matching Screen 3) */}
          <div style={{
            background: '#ffffff',
            borderRadius: 18,
            padding: '16px 18px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#102A43', margin: 0 }}>
                Hourly Production
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.7rem', fontWeight: 700 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#1E88E5' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1E88E5' }} />
                  NC
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#7C4DFF' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7C4DFF' }} />
                  Tandem
                </span>
              </div>
            </div>

            {/* Double Bar Chart Mockup matching image */}
            <div style={{ position: 'relative', height: 110, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: 20 }}>
              {/* 8AM */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
                  <div style={{ width: 10, height: 45, background: '#1E88E5', borderRadius: '4px 4px 0 0' }} />
                  <div style={{ width: 10, height: 60, background: '#7C4DFF', borderRadius: '4px 4px 0 0' }} />
                </div>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>8AM</span>
              </div>

              {/* 12PM */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
                  <div style={{ width: 10, height: 65, background: '#1E88E5', borderRadius: '4px 4px 0 0' }} />
                  <div style={{ width: 10, height: 50, background: '#7C4DFF', borderRadius: '4px 4px 0 0' }} />
                </div>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>12PM</span>
              </div>

              {/* 4PM */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
                  <div style={{ width: 10, height: 75, background: '#1E88E5', borderRadius: '4px 4px 0 0' }} />
                  <div style={{ width: 10, height: 70, background: '#7C4DFF', borderRadius: '4px 4px 0 0' }} />
                </div>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>4PM</span>
              </div>

              {/* 8PM */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
                  <div style={{ width: 10, height: 80, background: '#1E88E5', borderRadius: '4px 4px 0 0' }} />
                  <div style={{ width: 10, height: 78, background: '#7C4DFF', borderRadius: '4px 4px 0 0' }} />
                </div>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>8PM</span>
              </div>
            </div>
          </div>

          {/* QUICK SHORTCUT BUTTON TO HOURLY ENTRY */}
          <button
            type="button"
            onClick={() => setActiveTab('hourly')}
            style={{
              width: '100%',
              background: '#1E88E5',
              color: '#ffffff',
              border: 'none',
              borderRadius: 14,
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
            <Timer size={18} />
            <span>Open Hourly Production Entry (Target & Actual)</span>
          </button>
        </div>
      )}

    </div>
  );
}
