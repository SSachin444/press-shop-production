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
    green: { stroke: '#16a34a', track: '#dcfce7', text: '#166534', badgeBg: '#f0fdf4' },
    orange: { stroke: '#ea580c', track: '#ffedd5', text: '#c2410c', badgeBg: '#fff7ed' },
    red: { stroke: '#dc2626', track: '#fee2e2', text: '#991b1b', badgeBg: '#fef2f2' },
    neutral: { stroke: '#94a3b8', track: '#e2e8f0', text: '#475569', badgeBg: '#f8fafc' },
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
