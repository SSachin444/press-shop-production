import React from 'react';
import { Menu, Calendar, Clock, RefreshCw, MapPin, Wifi, ShieldCheck, UserCheck, Users, LogOut, Coffee, Download, Smartphone, Bell } from 'lucide-react';
import { getServerUrl } from '../api';
import LiveClock from './LiveClock';

export default function Header({ 
  pageTitle, 
  selectedDate, 
  setSelectedDate, 
  selectedShift, 
  setSelectedShift, 
  currentShift, 
  onRefresh, 
  loading,
  currentUser,
  onOpenLogin,
  onOpenWifiModal,
  onToggleSidebar,
  notificationCount = 0,
  onOpenNotifications
}) {
  const serverDisplay = getServerUrl().replace(/^https?:\/\//, '');

  const shiftBreakInfo = {
    'Shift A': 'Tea: 10:00-10:10 AM | Lunch: 12:00-12:30 PM | Tea: 03:00-03:10 PM',
    'Shift B': 'Tea: 06:30-06:40 PM | Dinner: 08:30-09:00 PM | Tea: 11:00-11:10 PM',
    'Shift C': 'Tea: 01:30-01:40 AM | Lunch: 03:00-03:30 AM | Tea: 06:00-06:10 AM'
  };

  return (
    <header className="top-header">
      {/* BRANDING HEADER LEFT */}
      <div className="header-left">
        {/* Left Sidebar Hamburger Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          title="Open Left Sidebar Menu"
          style={{
            background: '#1E88E5',
            color: '#ffffff',
            border: 'none',
            borderRadius: 10,
            width: 38,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginRight: 10,
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(30,136,229,0.35)'
          }}
        >
          <Menu size={20} />
        </button>

        <div className="header-brand-block">
          <div className="header-pha-logo-row">
            <span className="pha-logo-mini">PHA</span>
            <span className="pha-company-name">PHA INDIA PRIVATE LIMITED</span>
          </div>
          <div className="header-press-shop-name">PRESS SHOP MFG-2</div>
        </div>

        <div className="header-divider-v" />

        <div className="header-page-info">
          <h2 className="header-active-page-title">{pageTitle}</h2>
          <div className="header-location-pill">
            <MapPin size={11} color="#2563eb" />
            <span>Plant 1 (Sriperumbudur)</span>
          </div>
        </div>
      </div>

      {/* LIVE CLOCK DISPLAY */}
      <div className="header-clock-center">
        <LiveClock showDate={true} />
      </div>

      {/* HEADER CONTROLS RIGHT */}
      <div className="header-controls">
        {/* Direct APK Download Button */}
        <a
          href="/download-apk"
          download="PRESS_SHOP_MFG-2.apk"
          className="header-apk-btn"
          title="Download Android APK (PRESS_SHOP_MFG-2.apk)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '5px 10px',
            borderRadius: 20,
            textDecoration: 'none',
            fontSize: '0.76rem',
            fontWeight: 800,
            whiteSpace: 'nowrap'
          }}
        >
          <Smartphone size={13} color="#059669" />
          <span>APK</span>
          <Download size={12} color="#059669" />
        </a>

        {/* WiFi Server Status Button */}
        <button
          type="button"
          className="header-wifi-pill"
          onClick={onOpenWifiModal}
          title="WiFi Backend Server Settings (Click to configure or test connection)"
        >
          <div className="pulse-indicator" style={{ background: '#10b981', width: 7, height: 7 }} />
          <Wifi size={13} color="#10b981" />
          <span className="wifi-text">WiFi: {serverDisplay}</span>
        </button>

        {/* Notifications Bell Button */}
        <button
          type="button"
          onClick={onOpenNotifications}
          title="Plant Notifications & Alerts"
          style={{
            position: 'relative',
            background: '#ffffff',
            border: '1px solid #CBD5E1',
            borderRadius: 12,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#102A43',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <Bell size={16} />
          {notificationCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -3,
              right: -3,
              background: '#EF4444',
              color: '#ffffff',
              fontSize: '0.62rem',
              fontWeight: 900,
              width: 17,
              height: 17,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #ffffff'
            }}>
              {notificationCount}
            </span>
          )}
        </button>

        {/* Date Selector */}
        <div className="header-input-pill">
          <Calendar size={14} color="#475569" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="header-date-input"
          />
        </div>

        {/* Shift Selector (12-Hour Format: 08:00 AM - 04:30 PM, etc.) */}
        <div className="header-input-pill" title={shiftBreakInfo[selectedShift]}>
          <Clock size={14} color="#475569" />
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="header-shift-select"
          >
            <option value="Shift A">Shift A (08:00 AM - 04:30 PM)</option>
            <option value="Shift B">Shift B (04:30 PM - 01:00 AM)</option>
            <option value="Shift C">Shift C (01:00 AM - 08:00 AM)</option>
          </select>
        </div>

        {/* Active Live Shift Indicator */}
        <div className={`shift-pill ${selectedShift === currentShift ? 'active-shift' : ''}`} title={`Breaks: ${shiftBreakInfo[selectedShift]}`}>
          <div className="pulse-indicator" />
          <span>Live: {currentShift || 'Shift A'}</span>
        </div>

        {/* Refresh button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          title="Reload shopfloor data"
          disabled={loading}
          style={{ padding: '6px 10px', gap: 4 }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Sync</span>
        </button>

        {/* User Role Badge / Switch Role */}
        <button
          type="button"
          className="header-role-pill"
          onClick={onOpenLogin}
          title="Click to Switch User / Role"
        >
          <span className="user-role-dot" />
          <span className="user-role-label">{currentUser?.role || 'Supervisor'}</span>
        </button>
      </div>
    </header>
  );
}
