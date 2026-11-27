import React from 'react';
import { getAchievementTone } from '../services/metrics';

export default function CircularGauge({
  value = 0,
  target = 1,
  label = '',
  sublabel = '',
  size = 112,
  strokeWidth = 10,
  threshold = 85,
}) {
  const numVal = Math.max(0, Number(value) || 0);
  const clamped = Math.min(100, numVal);
  const tone = getAchievementTone(numVal, target, threshold);

  const colorMap = {
    green: { stroke: '#16A34A', track: '#DCFCE7', text: '#166534', badgeBg: '#F0FDF4' },
    orange: { stroke: '#F97316', track: '#FFEDD5', text: '#C2410C', badgeBg: '#FFF7ED' },
    red: { stroke: '#DC2626', track: '#FEE2E2', text: '#991B1B', badgeBg: '#FEF2F2' },
    neutral: { stroke: '#64748B', track: '#E2E8F0', text: '#14243A', badgeBg: '#F4F7FB' },
  };
  const palette = colorMap[tone] || colorMap.neutral;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="gauge-card">
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${label}: ${numVal}%`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={palette.track}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={palette.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={target > 0 ? offset : circumference}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.55s ease, stroke 0.3s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span className="tabular" style={{ fontSize: size >= 110 ? '1.15rem' : '0.92rem', fontWeight: 800, color: palette.text }}>
            {target > 0 ? `${numVal.toFixed(1).replace(/\.0$/, '')}%` : '—'}
          </span>
        </div>
      </div>

      {label && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-primary)' }}>{label}</div>
          {sublabel && (
            <div className="tabular" style={{ fontSize: '0.73rem', color: 'var(--ink-muted)', marginTop: 2 }}>
              {sublabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
