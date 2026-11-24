import React, { useState } from 'react';
import { Layers, Timer, ArrowLeftRight, Maximize2, Minimize2 } from 'lucide-react';
import StandardProductionEntry from './StandardProductionEntry';
import HourlyProductionEntry from './HourlyProductionEntry';

/**
 * ProductionWorkspacePage
 * 
 * Displays two independent production applications side-by-side:
 *   LEFT PANEL  → Page 1: Standard Production Entry (NC + Tandem)
 *   RIGHT PANEL → Page 2: Hourly Production Entry
 * 
 * On narrow screens (< 1100px), tabs are shown instead of split view.
 */
export default function ProductionWorkspacePage({
  selectedDate,
  selectedShift,
  onSync,
  initialMachine = 'NC-01',
}) {
  const [mobileTab, setMobileTab] = useState('standard'); // 'standard' | 'hourly'
  const [leftFocus, setLeftFocus] = useState(false);
  const [rightFocus, setRightFocus] = useState(false);
  const [syncKey, setSyncKey] = useState(0);

  const handleSync = () => {
    setSyncKey(k => k + 1);
    if (onSync) onSync();
  };

  const PanelHeader = ({ title, subtitle, badge, badgeBg, badgeColor, icon, isFocused, onToggleFocus }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      background: isFocused ? '#020617' : '#0f172a',
      borderBottom: '2px solid #1e293b',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          background: badgeBg,
          color: badgeColor,
          padding: '3px 8px',
          borderRadius: 5,
          fontSize: '0.63rem',
          fontWeight: 900,
          letterSpacing: '0.05em',
          border: `1px solid ${badgeColor}40`
        }}>{badge}</div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {icon}
            <span style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '0.9rem' }}>{title}</span>
          </div>
          <div style={{ color: '#475569', fontSize: '0.68rem', marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      <button
        onClick={onToggleFocus}
        title={isFocused ? 'Restore panel size' : 'Expand this panel'}
        style={{
          background: isFocused ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#94a3b8', borderRadius: 6, padding: '5px 7px',
          cursor: 'pointer', display: 'flex', alignItems: 'center'
        }}
      >
        {isFocused ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      </button>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0b1329',
      overflow: 'hidden'
    }}>

      {/* ===== WORKSPACE TOOLBAR ===== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 18px',
        background: '#020617',
        borderBottom: '1px solid #1e293b',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: 8,
        zIndex: 10
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e40af, #2563eb)',
            padding: '4px 10px', borderRadius: 5,
            fontSize: '0.63rem', fontWeight: 900, color: '#bfdbfe', letterSpacing: '0.06em'
          }}>
            PRODUCTION WORKSPACE
          </div>
          <span style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 600 }}>
            {selectedDate} &nbsp;•&nbsp; {selectedShift}
          </span>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="pws-mobile-tabs" style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setMobileTab('standard')}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
              background: mobileTab === 'standard' ? '#1e40af' : 'rgba(255,255,255,0.06)',
              color: mobileTab === 'standard' ? '#ffffff' : '#64748b',
              border: mobileTab === 'standard' ? 'none' : '1px solid #1e293b',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
            }}
          >
            <Layers size={12} /> Standard Entry
          </button>
          <button
            onClick={() => setMobileTab('hourly')}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
              background: mobileTab === 'hourly' ? '#059669' : 'rgba(255,255,255,0.06)',
              color: mobileTab === 'hourly' ? '#ffffff' : '#64748b',
              border: mobileTab === 'hourly' ? 'none' : '1px solid #1e293b',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
            }}
          >
            <Timer size={12} /> Hourly Entry
          </button>
        </div>

        {/* Live sync badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 700 }}>LIVE SYNC</span>
          <ArrowLeftRight size={13} color="#334155" />
          <span style={{ color: '#334155', fontSize: '0.68rem' }}>Shared Database</span>
        </div>
      </div>

      {/* ===== DUAL PANEL BODY ===== */}
      <div className="pws-panels" style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
        gap: 0
      }}>

        {/* LEFT PANEL: Standard Production Entry */}
        <div
          className={`pws-left ${mobileTab === 'standard' ? 'pws-panel-visible' : 'pws-panel-hidden'}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: leftFocus ? 2.5 : (rightFocus ? 0.4 : 1),
            transition: 'flex 0.3s cubic-bezier(0.4,0,0.2,1)',
            overflow: 'hidden',
            minWidth: 0,
            borderRight: '2px solid #1e293b'
          }}
        >
          <PanelHeader
            title="Overall Production Summary"
            subtitle="Auto-calculated from hourly entries • Shift & Daily totals"
            badge="OVERALL"
            badgeBg="#fff7ed"
            badgeColor="#ea580c"
            icon={<Layers size={15} color="#ea580c" />}
            isFocused={leftFocus}
            onToggleFocus={() => { setLeftFocus(!leftFocus); if (!leftFocus) setRightFocus(false); }}
          />
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: '#f8fafc'
          }}>
            <StandardProductionEntry
              key={`std-${syncKey}`}
              selectedDate={selectedDate}
              selectedShift={selectedShift}
              onSync={handleSync}
              onSwitchToHourly={() => setMobileTab('hourly')}
            />
          </div>
        </div>

        {/* RIGHT PANEL: Hourly Production Entry */}
        <div
          className={`pws-right ${mobileTab === 'hourly' ? 'pws-panel-visible' : 'pws-panel-hidden'}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: rightFocus ? 2.5 : (leftFocus ? 0.4 : 1),
            transition: 'flex 0.3s cubic-bezier(0.4,0,0.2,1)',
            overflow: 'hidden',
            minWidth: 0
          }}
        >
          <PanelHeader
            title="Hourly Production Entry"
            subtitle="Tool • Machine • Operator • Target • Hour • Actual"
            badge="PAGE 2"
            badgeBg="#052e16"
            badgeColor="#6ee7b7"
            icon={<Timer size={15} color="#34d399" />}
            isFocused={rightFocus}
            onToggleFocus={() => { setRightFocus(!rightFocus); if (!rightFocus) setLeftFocus(false); }}
          />
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: '#f8fafc'
          }}>
            <HourlyProductionEntry
              key={`hrly-${syncKey}`}
              selectedDate={selectedDate}
              selectedShift={selectedShift}
              initialMachine={initialMachine}
              onSync={handleSync}
            />
          </div>
        </div>
      </div>

      <style>{`
        /* On wide screens: show both panels, hide mobile tabs */
        @media (min-width: 1100px) {
          .pws-mobile-tabs { display: none !important; }
          .pws-left { display: flex !important; }
          .pws-right { display: flex !important; }
          .pws-panel-hidden { display: flex !important; }
          .pws-panel-visible { display: flex !important; }
        }

        /* On narrow screens: show only the selected tab panel */
        @media (max-width: 1099px) {
          .pws-mobile-tabs { display: flex !important; }
          .pws-panel-hidden { display: none !important; }
          .pws-panel-visible { display: flex !important; }
          .pws-left, .pws-right { flex: 1 !important; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
