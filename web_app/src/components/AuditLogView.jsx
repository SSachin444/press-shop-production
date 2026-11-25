import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, ShieldAlert } from 'lucide-react';
import { getCapabilities } from '../config/roles';
import { cloudApi } from '../services/cloudClient';

export default function AuditLogView({ currentUser }) {
  const caps = getCapabilities(currentUser?.role);
  const [subTab, setSubTab] = useState('activity'); // 'activity' | 'recovery'
  const [logs, setLogs] = useState([]);
  const [recoveryLogs, setRecoveryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadAudit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await cloudApi.getAuditLogs();
      setLogs(res.logs || []);
      setRecoveryLogs(res.recovery_logs || []);
    } catch (err) {
      setError(err?.message || 'Unable to load system audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caps.canViewAuditLog) {
      loadAudit();
    } else {
      setLoading(false);
    }
  }, [caps.canViewAuditLog]);

  const filteredActivity = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      [l.user_name, l.role, l.action, l.record_type, l.record_id, l.details]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [logs, search]);

  const filteredRecovery = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recoveryLogs;
    return recoveryLogs.filter((l) =>
      [l.target_role, l.email, l.event_type, l.detail]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [recoveryLogs, search]);

  if (!caps.canViewAuditLog) {
    return (
      <div className="banner is-err">
        <span>Access restricted. Audit logs are reserved exclusively for Admin.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn ${subTab === 'activity' ? 'btn-navy' : 'btn-secondary'}`}
            onClick={() => setSubTab('activity')}
          >
            Operational & Config Changes ({logs.length})
          </button>
          <button
            type="button"
            className={`btn ${subTab === 'recovery' ? 'btn-navy' : 'btn-secondary'}`}
            onClick={() => setSubTab('recovery')}
          >
            <ShieldAlert size={15} />
            Auth & Recovery Events ({recoveryLogs.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 13, color: 'var(--ink-muted)' }} />
            <input
              type="text"
              className="field-input"
              style={{ paddingLeft: 30, minWidth: 220 }}
              placeholder="Search user, action, target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-secondary" onClick={loadAudit}>
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="banner is-err">
          <span>{error}</span>
        </div>
      )}

      <section className="surface-card">
        {loading ? (
          <div className="skeleton-line" style={{ height: 150, width: '100%' }} />
        ) : subTab === 'activity' ? (
          filteredActivity.length === 0 ? (
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.86rem' }}>No audit log entries match the current filter.</p>
          ) : (
            <div className="table-scroll-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.map((l) => (
                    <tr key={l.id || `${l.created_at}-${l.details}`}>
                      <td className="mono" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                        {l.created_at || '-'}
                      </td>
                      <td>
                        <strong>{l.user_name || '-'}</strong>
                        {l.role && <span style={{ color: 'var(--ink-muted)', marginLeft: 4 }}>({l.role})</span>}
                      </td>
                      <td>
                        <span className={`status-pill ${l.action === 'DELETE' ? 'is-err' : l.action === 'UPDATE' ? 'is-warn' : 'is-ok'}`}>
                          {l.action}
                        </span>
                      </td>
                      <td>{l.record_type || '-'}</td>
                      <td className="mono">{l.record_id || '-'}</td>
                      <td>{l.details || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredRecovery.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.86rem' }}>No authentication or recovery audit events logged.</p>
        ) : (
          <div className="table-scroll-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Event</th>
                  <th>Result</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecovery.map((r) => (
                  <tr key={r.id || `${r.created_at}-${r.event_type}`}>
                    <td className="mono" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                      {r.created_at || '-'}
                    </td>
                    <td>{r.target_role || '-'}</td>
                    <td>{r.email || '-'}</td>
                    <td className="mono">{r.event_type}</td>
                    <td>
                      <span className={`status-pill ${r.success ? 'is-ok' : 'is-err'}`}>
                        {r.success ? 'Success' : 'Failed / Blocked'}
                      </span>
                    </td>
                    <td>{r.detail || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
