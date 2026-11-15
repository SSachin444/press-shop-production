import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  RefreshCw, 
  Clock, 
  User, 
  FileText, 
  Activity, 
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';

export default function ActivityLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getActivityLogs();
      setLogs(res.logs || []);
    } catch (e) {
      console.warn('Failed to load activity logs:', e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (typeFilter !== 'ALL' && log.record_type !== typeFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchUser = log.user_name?.toLowerCase().includes(q);
      const matchDetails = log.details?.toLowerCase().includes(q);
      const matchType = log.record_type?.toLowerCase().includes(q);
      if (!matchUser && !matchDetails && !matchType) return false;
    }
    return true;
  });

  const getActionBadge = (action) => {
    const act = (action || '').toUpperCase();
    if (act === 'CREATE') {
      return <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800 }}>CREATE</span>;
    }
    if (act === 'UPDATE') {
      return <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800 }}>UPDATE</span>;
    }
    if (act === 'DELETE') {
      return <span style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800 }}>DELETE</span>;
    }
    return <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800 }}>{act}</span>;
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px', background: '#f8fafc', minHeight: '100%' }}>
      {/* Header Banner */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        padding: '20px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Audit Activity Log
                </h1>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0' }}>
                  Complete traceability of record creations, updates, and shopfloor modifications
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={loadLogs}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Log</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 18, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search user, record type or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b' }}>Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b' }}>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
            >
              <option value="ALL">All Record Types</option>
              <option value="Production Record">Production Record</option>
              <option value="Employee">Employee</option>
              <option value="Machine">Machine</option>
              <option value="Handover">Handover</option>
              <option value="Settings">Settings</option>
            </select>
          </div>
        </div>
      </div>

      {/* Log Table Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
            System Audit Trail ({filteredLogs.length} events recorded)
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
            Permanent database record
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <Activity size={38} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#334155', margin: 0 }}>No Activity Events Yet</h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0' }}>
              When production entries, employee modifications, or machine adjustments are made, they will automatically be logged here.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 800 }}>ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800 }}>Timestamp</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800 }}>User</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800 }}>Action</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800 }}>Record Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800 }}>Reference ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800 }}>Event Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontWeight: 700 }}>#{log.id}</td>
                    <td style={{ padding: '12px 16px', color: '#334155', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={13} color="#94a3b8" />
                        <span>{log.created_at || 'Just now'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={13} color="#3b82f6" />
                        <span>{log.user_name || 'System'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{getActionBadge(log.action)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e40af' }}>{log.record_type}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{log.record_id || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#334155', maxWidth: 380 }}>{log.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
