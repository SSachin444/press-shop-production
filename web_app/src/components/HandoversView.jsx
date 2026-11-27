import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle2, AlertCircle, RefreshCw, Trash2, ShieldAlert, X } from 'lucide-react';
import { getCapabilities } from '../config/roles';
import { cloudApi } from '../services/cloudClient';
import { SHIFTS } from '../services/metrics';

export default function HandoversView({ selectedDate, selectedShift, currentUser }) {
  const caps = getCapabilities(currentUser?.role);
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    date: selectedDate,
    from_shift: selectedShift === 'ALL' ? 'Shift A' : selectedShift,
    to_shift: 'Shift B',
    machine_summary: '',
    pending_issues: '',
    tooling_status: '',
    manpower_notes: '',
    safety_notes: '',
  });

  const loadHandovers = async () => {
    setLoading(true);
    try {
      const list = await cloudApi.getHandovers();
      setHandovers(list || []);
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Unable to load shift handovers.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caps.canManageHandovers) {
      loadHandovers();
    } else {
      setLoading(false);
    }
  }, [caps.canManageHandovers]);

  if (!caps.canManageHandovers) {
    return (
      <div className="banner is-err">
        <span>Access restricted. Shift handovers require Admin or Supervisor role.</span>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.machine_summary.trim() && !form.pending_issues.trim()) {
      setNotice({ type: 'err', text: 'Enter at least machine summary or pending issues for the incoming shift.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await cloudApi.saveHandover({
        ...form,
        handover_by: currentUser?.full_name || currentUser?.username || 'Supervisor',
        status: 'Open',
      });
      setNotice({ type: 'ok', text: `Logged shift handover (${form.from_shift} -> ${form.to_shift}).` });
      setForm((prev) => ({
        ...prev,
        machine_summary: '',
        pending_issues: '',
        tooling_status: '',
        manpower_notes: '',
        safety_notes: '',
      }));
      await loadHandovers();
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Failed to save shift handover.' });
    } finally {
      setSaving(false);
    }
  };

  const acknowledgeHandover = async (h) => {
    try {
      await cloudApi.saveHandover({
        ...h,
        status: 'Acknowledged',
        acknowledged_by: currentUser?.full_name || currentUser?.username,
      });
      setNotice({ type: 'ok', text: `Handover #${h.id} acknowledged.` });
      await loadHandovers();
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Unable to update handover.' });
    }
  };

  const handleConfirmDeleteHandover = async () => {
    if (!caps.canDeleteHandovers || !deleteTarget?.id) return;
    setDeleting(true);
    try {
      await cloudApi.deleteHandover(deleteTarget.id);
      setHandovers((prev) => prev.filter((x) => String(x.id) !== String(deleteTarget.id)));
      setNotice({ type: 'ok', text: `Deleted shift handover #${deleteTarget.id} (${deleteTarget.date}).` });
      setDeleteTarget(null);
      await loadHandovers();
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Unable to delete shift handover.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {notice && (
        <div className={`banner ${notice.type === 'ok' ? 'is-ok' : 'is-err'}`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {notice.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {notice.text}
          </span>
        </div>
      )}

      <form className="surface-card" onSubmit={handleSubmit}>
        <div className="section-header">
          <div>
            <h2 className="section-title">New Shift Handover Note</h2>
            <p className="section-subtitle">Document machine status, die issues, and open actions for the next shift</p>
          </div>
        </div>

        <div className="filter-bar" style={{ marginBottom: 12 }}>
          <div className="field-group">
            <label className="field-label" htmlFor="ho-date">Date</label>
            <input
              id="ho-date"
              type="date"
              className="field-input"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="ho-from">Outgoing Shift</label>
            <select
              id="ho-from"
              className="field-select"
              value={form.from_shift}
              onChange={(e) => setForm({ ...form, from_shift: e.target.value })}
            >
              {SHIFTS.map((s) => (
                <option key={s.id} value={s.id}>{s.id}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="ho-to">Incoming Shift</label>
            <select
              id="ho-to"
              className="field-select"
              value={form.to_shift}
              onChange={(e) => setForm({ ...form, to_shift: e.target.value })}
            >
              {SHIFTS.map((s) => (
                <option key={s.id} value={s.id}>{s.id}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <div className="field-group">
            <label className="field-label" htmlFor="ho-machine">Machine & Line Summary</label>
            <textarea
              id="ho-machine"
              rows={2}
              className="field-textarea"
              value={form.machine_summary}
              onChange={(e) => setForm({ ...form, machine_summary: e.target.value })}
              placeholder="Running status, stopped machines, stroke rates..."
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="ho-issues">Pending Issues / Maintenance</label>
            <textarea
              id="ho-issues"
              rows={2}
              className="field-textarea"
              value={form.pending_issues}
              onChange={(e) => setForm({ ...form, pending_issues: e.target.value })}
              placeholder="Open breakdowns or pending maintenance follow-ups..."
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="ho-tooling">Tooling & Die Notes</label>
            <textarea
              id="ho-tooling"
              rows={2}
              className="field-textarea"
              value={form.tooling_status}
              onChange={(e) => setForm({ ...form, tooling_status: e.target.value })}
              placeholder="Die changes completed or queued..."
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="ho-safety">Manpower & Safety Notes</label>
            <textarea
              id="ho-safety"
              rows={2}
              className="field-textarea"
              value={form.safety_notes}
              onChange={(e) => setForm({ ...form, safety_notes: e.target.value })}
              placeholder="Safety observations or relief staffing..."
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Plus size={15} />
            {saving ? 'Logging Handover...' : 'Submit Handover'}
          </button>
        </div>
      </form>

      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Shift Handover Log ({handovers.length})</h2>
            <p className="section-subtitle">Recent outgoing-to-incoming shift records</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadHandovers}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="skeleton-line" style={{ height: 120, width: '100%' }} />
        ) : handovers.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.86rem' }}>No handover records logged yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {handovers.map((h) => (
              <div key={h.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <div>
                    <strong className="mono">{h.date}</strong> — {h.from_shift} → {h.to_shift}
                    <span style={{ color: 'var(--ink-muted)', marginLeft: 8, fontSize: '0.8rem' }}>
                      by {h.handover_by || 'Supervisor'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`status-pill ${h.status === 'Acknowledged' || h.status === 'Resolved' ? 'is-ok' : 'is-warn'}`}>
                      {h.status || 'Open'}
                    </span>
                    {h.status !== 'Acknowledged' && h.status !== 'Resolved' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => acknowledgeHandover(h)}
                      >
                        Acknowledge
                      </button>
                    )}
                    {caps.canDeleteHandovers && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        aria-label={`Delete handover ${h.id}`}
                        onClick={() => setDeleteTarget(h)}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </div>
                </div>
                {h.machine_summary && <p style={{ fontSize: '0.85rem', marginBottom: 4 }}><strong>Machines:</strong> {h.machine_summary}</p>}
                {h.pending_issues && <p style={{ fontSize: '0.85rem', marginBottom: 4 }}><strong>Pending:</strong> {h.pending_issues}</p>}
                {h.tooling_status && <p style={{ fontSize: '0.85rem', marginBottom: 4 }}><strong>Tooling:</strong> {h.tooling_status}</p>}
                {h.safety_notes && <p style={{ fontSize: '0.85rem' }}><strong>Safety / Staff:</strong> {h.safety_notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {deleteTarget && caps.canDeleteHandovers && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="del-ho-title">
          <div className="modal-dialog" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 id="del-ho-title" className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-err-ink)' }}>
                <ShieldAlert size={18} />
                Delete Shift Handover?
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Delete handover note <strong className="mono">#{deleteTarget.id}</strong> ({deleteTarget.date} • {deleteTarget.from_shift} → {deleteTarget.to_shift})?
              </p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmDeleteHandover} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
