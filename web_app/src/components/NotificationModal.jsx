import React from 'react';
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Trash2, 
  X, 
  CheckCheck, 
  Clock, 
  Wrench, 
  Users, 
  TrendingUp 
} from 'lucide-react';

export default function NotificationModal({ 
  isOpen, 
  onClose, 
  notifications, 
  onClearAll, 
  onDismiss 
}) {
  if (!isOpen) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} color="#10B981" />;
      case 'warning':
        return <AlertTriangle size={18} color="#F59E0B" />;
      case 'maintenance':
        return <Wrench size={18} color="#3B82F6" />;
      case 'manpower':
        return <Users size={18} color="#8B5CF6" />;
      default:
        return <Info size={18} color="#0284C7" />;
    }
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'success':
        return { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' };
      case 'warning':
        return { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' };
      case 'maintenance':
        return { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' };
      case 'manpower':
        return { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' };
      default:
        return { bg: '#F0F9FF', text: '#075985', border: '#BAE6FD' };
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: 16
    }} onClick={onClose}>
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 500,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#F8FAFC'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#EFF6FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1E88E5'
            }}>
              <Bell size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#102A43', margin: 0 }}>
                Notifications & Alerts
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B' }}>
                {notifications.length} active notification{notifications.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                style={{
                  background: '#FEF2F2',
                  color: '#DC2626',
                  border: '1px solid #FECACA',
                  borderRadius: 10,
                  padding: '6px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <Trash2 size={13} />
                <span>Clear All</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#F1F5F9',
                border: 'none',
                borderRadius: 8,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748B',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List Body */}
        <div style={{
          padding: '16px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {notifications.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 20px',
              color: '#64748B'
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#ECFDF5',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <CheckCheck size={28} />
              </div>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
                All Caught Up!
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>
                No active notifications or alerts. All notices cleared.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const badge = getBadgeStyle(item.type);
              return (
                <div
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #E2E8F0',
                    borderRadius: 14,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    marginTop: 2,
                    padding: 6,
                    borderRadius: 8,
                    background: badge.bg,
                    border: `1px solid ${badge.border}`
                  }}>
                    {getIcon(item.type)}
                  </div>

                  <div style={{ flex: 1, paddingRight: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`
                      }}>
                        {item.category || 'General'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} />
                        {item.time || 'Just now'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.86rem', fontWeight: 800, color: '#102A43', margin: '0 0 3px' }}>
                      {item.title}
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0, lineHeight: 1.4 }}>
                      {item.message}
                    </p>
                  </div>

                  {/* Dismiss Single */}
                  <button
                    type="button"
                    onClick={() => onDismiss(item.id)}
                    title="Dismiss notification"
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      background: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #E2E8F0',
          background: '#F8FAFC',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#1E88E5',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              padding: '7px 18px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
