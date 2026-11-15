import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Layers, 
  Cpu, 
  TrendingUp, 
  AlertOctagon, 
  Activity, 
  CheckCircle, 
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { api } from '../api';

export default function ProductionAnalyticsPage({ selectedDate, selectedShift }) {
  const [ncData, setNcData] = useState(null);
  const [tandemData, setTandemData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [selectedDate, selectedShift]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [ncRes, tandemRes] = await Promise.all([
        api.getNcProduction(selectedDate, selectedShift),
        api.getTandemProduction(selectedDate, selectedShift)
      ]);
      setNcData(ncRes);
      setTandemData(tandemRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const ncMatrix = ncData?.machine_matrix || [];
  const tandemMatrix = tandemData?.line_matrix || [];

  const combinedTarget = (ncData?.total_target || 0) + (tandemData?.total_target || 0);
  const combinedActual = (ncData?.total_actual || 0) + (tandemData?.total_actual || 0);
  const combinedGood = (ncData?.total_good || 0) + (tandemData?.total_good || 0);
  const combinedRej = (ncData?.total_rejected || 0) + (tandemData?.total_rejected || 0);
  const combinedDowntime = (ncData?.total_downtime || 0) + (tandemData?.total_downtime || 0);
  const combinedAchievement = combinedTarget > 0 ? Math.round((combinedActual / combinedTarget) * 100) : 0;
  const combinedRejectionRate = combinedActual > 0 ? ((combinedRej / combinedActual) * 100).toFixed(1) : 0;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart3 size={22} color="#1e40af" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Management Production Analytics Dashboard</h2>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.84rem', marginTop: 2 }}>
              Executive performance intelligence • Visually distinct NC Press & Tandem Line tracking • Date: <strong style={{ color: '#1e40af' }}>{selectedDate}</strong> ({selectedShift})
            </p>
          </div>
        </div>

        {/* Combined Factory Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 18 }}>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>FACTORY TARGET</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{combinedTarget.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>NC + Tandem total</div>
          </div>

          <div style={{ background: '#eff6ff', padding: '14px', borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 600 }}>TOTAL ACTUAL OUTPUT</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e40af' }}>{combinedActual.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 600 }}>{combinedAchievement}% Plant Achievement</div>
          </div>

          <div style={{ background: '#ecfdf5', padding: '14px', borderRadius: 8, border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>QUALITY GOOD PARTS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>{combinedGood.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#047857' }}>Passes QA specifications</div>
          </div>

          <div style={{ background: '#fef2f2', padding: '14px', borderRadius: 8, border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600 }}>FACTORY SCRAP</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>{combinedRej.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#b91c1c' }}>{combinedRejectionRate}% Scrap Rate</div>
          </div>

          <div style={{ background: '#fffbeb', padding: '14px', borderRadius: 8, border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>COMBINED DOWNTIME</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>{combinedDowntime}m</div>
            <div style={{ fontSize: '0.72rem', color: '#b45309' }}>Lost machine minutes</div>
          </div>
        </div>
      </div>

      {/* SECTION 1: NC PRODUCTION ANALYTICS (16 POSITIONS) */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Layers size={20} color="#7c3aed" />
              <span>NC Presses Machine-Wise Comparative Output (16 Machines)</span>
            </div>
            <div className="panel-subtitle">Individual output versus target for all 16 designated NC positions</div>
          </div>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#7c3aed', background: '#faf5ff', padding: '4px 10px', borderRadius: 20 }}>
            NC Achievement: {ncData?.achievement_pct || 0}%
          </span>
        </div>

        {/* Machine-by-Machine Visual Bar Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {ncMatrix.map((m) => {
            const pct = m.achievement_pct;
            return (
              <div key={m.machine_number} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 140px 90px', alignItems: 'center', gap: 14 }}>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#475569' }}>
                  {m.machine_number} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({m.tonnage}T)</span>
                </div>
                <div style={{ position: 'relative', height: 22, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${Math.min(100, pct)}%`, 
                      height: '100%', 
                      background: pct >= 90 ? 'linear-gradient(90deg, #7c3aed, #a855f7)' : pct > 0 ? '#818cf8' : '#e2e8f0',
                      borderRadius: 4,
                      transition: 'width 0.4s ease'
                    }} 
                  />
                  {pct > 15 && (
                    <span style={{ position: 'absolute', left: 10, top: 2, fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>
                      {m.actual} pcs
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569', textAlign: 'right' }}>
                  Target: <strong>{m.target}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ 
                    fontWeight: 800, 
                    fontSize: '0.86rem', 
                    color: pct >= 90 ? '#059669' : pct > 0 ? '#2563eb' : '#94a3b8' 
                  }}>
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: TANDEM PRODUCTION ANALYTICS (6 LINES) */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Cpu size={20} color="#0891b2" />
              <span>Tandem Production Lines Comparison (LP-1, LP-2, HP-1, HP-2, HP-3, HP-4)</span>
            </div>
            <div className="panel-subtitle">Individual output versus target for all 6 designated tandem lines</div>
          </div>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0891b2', background: '#ecfeff', padding: '4px 10px', borderRadius: 20 }}>
            Tandem Achievement: {tandemData?.achievement_pct || 0}%
          </span>
        </div>

        {/* 6 Line Cards Side-by-Side Visual */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {tandemMatrix.map((line) => {
            const isHigh = line.line_number.startsWith('HP');
            return (
              <div 
                key={line.line_number} 
                style={{ 
                  border: '1px solid #cbd5e1', 
                  borderRadius: 10, 
                  padding: 16, 
                  background: isHigh ? '#f0fdf4' : '#f0f9ff',
                  borderTop: `4px solid ${line.achievement_pct >= 90 ? '#10b981' : '#0891b2'}` 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>{line.line_number}</strong>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#ffffff', padding: '2px 8px', borderRadius: 4 }}>
                    {line.tonnage} Tons
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Actual / Target:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0891b2' }}>
                    {line.actual} <span style={{ fontSize: '0.9rem', color: '#64748b' }}>/ {line.target}</span>
                  </span>
                </div>

                <div className="machine-progress-bar" style={{ height: 10, marginBottom: 8 }}>
                  <div 
                    className="machine-progress-fill" 
                    style={{ 
                      width: `${Math.min(100, line.achievement_pct)}%`, 
                      background: line.achievement_pct >= 90 ? '#10b981' : '#0891b2' 
                    }} 
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569' }}>
                  <span>Achievement: <strong>{line.achievement_pct}%</strong></span>
                  <span>Downtime: <strong style={{ color: line.downtime_minutes > 0 ? '#dc2626' : '#475569' }}>{line.downtime_minutes}m</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
