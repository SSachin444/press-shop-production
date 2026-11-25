import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

function formatFormalDateTime(dateObj) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = days[dateObj.getDay()];
  const dayNum = String(dateObj.getDate()).padStart(2, '0');
  const monthName = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hh = String(hours).padStart(2, '0');

  return `${dayName}, ${dayNum} ${monthName} ${year} • ${hh}:${minutes}:${seconds} ${ampm}`;
}

export default function LiveClock() {
  const [label, setLabel] = useState(() => formatFormalDateTime(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setLabel(formatFormalDateTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="formal-clock tabular" aria-label="Current date and time">
      <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
