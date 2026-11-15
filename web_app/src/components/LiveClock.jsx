import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function LiveClock({ showDate = true, compact = false }) {
  const [timeState, setTimeState] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeState(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function formatTime(d) {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // '0' should be '12'
    const strHours = String(hours).padStart(2, '0');

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

    return {
      timeStr: `${strHours}:${minutes}:${seconds}`,
      ampm,
      dateStr
    };
  }

  if (compact) {
    return (
      <div className="live-clock-badge compact">
        <Clock size={12} color="#38bdf8" />
        <span className="live-clock-time">{timeState.timeStr}</span>
        <span className="live-clock-ampm">{timeState.ampm}</span>
      </div>
    );
  }

  return (
    <div className="live-clock-badge">
      <div className="live-clock-glow-dot" />
      <Clock size={14} color="#38bdf8" />
      <div className="live-clock-digits">
        <span className="live-clock-time">{timeState.timeStr}</span>
        <span className="live-clock-ampm">{timeState.ampm}</span>
      </div>
      {showDate && (
        <>
          <div className="live-clock-divider" />
          <span className="live-clock-date">{timeState.dateStr}</span>
        </>
      )}
    </div>
  );
}
