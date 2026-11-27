import React, { useEffect, useMemo, useState } from 'react';
import {
  Send,
  UserPlus,
  Trash2,
  Edit3,
  CheckSquare,
  Square,
  ExternalLink,
  Copy,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Phone,
  FileText,
  X,
} from 'lucide-react';
import { getCapabilities } from '../config/roles';
import {
  SHIFTS,
  WHATSAPP_REPORT_TYPES,
  generateWhatsAppReportText,
  normalizeWhatsAppPhone,
} from '../services/metrics';
import { cloudApi } from '../services/cloudClient';

export default function WhatsAppReportsView({
  selectedDate,
  selectedShift,
  machines = [],
  tools = [],
  records = [],
  downtimes = [],
  currentUser,
}) {
  const caps = getCapabilities(currentUser?.role);

  const [recipients, setRecipients] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [history, setHistory] = useState([]);
  const [apiStatus, setApiStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  // Recipient form modal / inline editor
  const [editingRecipient, setEditingRecipient] = useState(null);
  const [recName, setRecName] = useState('');
  const [recPhone, setRecPhone] = useState('');
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [deleteConfirmRec, setDeleteConfirmRec] = useState(null);
  const [deletingRecipient, setDeletingRecipient] = useState(false);

  // Report Builder & Filters
  const [reportType, setReportType] = useState('hourly');
  const [filterDate, setFilterDate] = useState(selectedDate || new Date().toISOString().slice(0, 10));
  const [filterShift, setFilterShift] = useState(selectedShift || 'ALL');
  const [filterMachine, setFilterMachine] = useState('ALL');
  const [filterTool, setFilterTool] = useState('ALL');
  const [customMessage, setCustomMessage] = useState('');
  const [isCustomEdited, setIsCustomEdited] = useState(false);
  const [liveRecords, setLiveRecords] = useState(records);

  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setFilterDate(selectedDate || filterDate);
  }, [selectedDate]);

  useEffect(() => {
    setLiveRecords(records);
  }, [records]);

  const loadAll = async () => {
    if (!caps.canSendWhatsAppReports) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [recList, histList, statusRes, fetchedRecs] = await Promise.all([
        cloudApi.getWhatsAppRecipients().catch(() => []),
        cloudApi.getWhatsAppHistory().catch(() => []),
        cloudApi.getWhatsAppStatus().catch(() => null),
        cloudApi.getProductionRecords({ date: filterDate }).catch(() => records),
      ]);
      setRecipients(recList || []);
      setSelectedIds((prev) => {
        const validPrev = prev.filter((id) => (recList || []).some((r) => String(r.id) === String(id)));
        return validPrev.length > 0 ? validPrev : (recList || []).map((r) => r.id);
      });
      setHistory(histList || []);
      setApiStatus(statusRes);
      if (Array.isArray(fetchedRecs)) setLiveRecords(fetchedRecs);
    } catch (err) {
      setNotice({ type: 'err', text: err.message || 'Unable to load WhatsApp reporting state.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [caps.canSendWhatsAppReports, filterDate]);

  const toolOptions = useMemo(() => {
    const set = new Set();
    (tools || []).forEach((t) => t?.tool_number && set.add(String(t.tool_number).toUpperCase()));
    (liveRecords || []).forEach((r) => r?.tool_number && set.add(String(r.tool_number).toUpperCase()));
    return Array.from(set).sort();
  }, [tools, liveRecords]);

  const generatedReportText = useMemo(
    () =>
      generateWhatsAppReportText({
        reportType,
        date: filterDate,
        shift: filterShift,
        machine: filterMachine,
        tool: filterTool,
        records: liveRecords,
        machines,
        downtimes,
      }),
    [reportType, filterDate, filterShift, filterMachine, filterTool, liveRecords, machines, downtimes]
  );

  useEffect(() => {
    if (!isCustomEdited) {
      setCustomMessage(generatedReportText);
    }
  }, [generatedReportText, isCustomEdited]);

  if (!caps.canSendWhatsAppReports) {
    return (
      <div className="banner is-err" role="alert">
        <span>Access restricted. WhatsApp production reporting is reserved for Admin and Supervisor roles.</span>
      </div>
    );
  }

  const activeMessage = isCustomEdited ? customMessage : generatedReportText;

  const selectedRecipients = recipients.filter((r) => selectedIds.some((id) => String(id) === String(r.id)));
  const allSelected = recipients.length > 0 && selectedRecipients.length === recipients.length;

  const toggleRecipient = (id) => {
    setSelectedIds((prev) =>
      prev.some((x) => String(x) === String(id))
        ? prev.filter((x) => String(x) !== String(id))
        : prev.length >= 5
          ? prev
          : [...prev, id]
    );
  };

  const toggleAllRecipients = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(recipients.slice(0, 5).map((r) => r.id));
    }
  };

  const resetRecipientForm = () => {
    setEditingRecipient(null);
    setRecName('');
    setRecPhone('');
  };

  const handleSaveRecipient = async (e) => {
    e.preventDefault();
    setNotice(null);
    const phoneCheck = normalizeWhatsAppPhone(recPhone);
    if (!recName.trim()) {
      setNotice({ type: 'err', text: 'Enter recipient contact name.' });
      return;
    }
    if (!phoneCheck.valid) {
      setNotice({ type: 'err', text: phoneCheck.error });
      return;
    }

    setSavingRecipient(true);
    try {
      const saved = await cloudApi.saveWhatsAppRecipient(
        editingRecipient
          ? { id: editingRecipient.id, name: recName.trim(), phone_number: phoneCheck.normalized }
          : { name: recName.trim(), phone_number: phoneCheck.normalized },
        Boolean(editingRecipient)
      );
      const updated = await cloudApi.getWhatsAppRecipients();
      setRecipients(updated || []);
      if (!editingRecipient && saved?.id) {
        setSelectedIds((prev) => [...new Set([...prev, saved.id])].slice(0, 5));
      }
      setNotice({
        type: 'ok',
        text: `${editingRecipient ? 'Updated' : 'Saved'} WhatsApp recipient ${recName.trim()} (${phoneCheck.normalized}).`,
      });
      resetRecipientForm();
    } catch (err) {
      setNotice({ type: 'err', text: err.message || 'Unable to save WhatsApp recipient.' });
    } finally {
      setSavingRecipient(false);
    }
  };

  const handleDeleteRecipient = async () => {
    if (!deleteConfirmRec) return;
    setDeletingRecipient(true);
    setNotice(null);
    try {
      await cloudApi.deleteWhatsAppRecipient(deleteConfirmRec.id);
      setRecipients((prev) => prev.filter((r) => String(r.id) !== String(deleteConfirmRec.id)));
      setSelectedIds((prev) => prev.filter((id) => String(id) !== String(deleteConfirmRec.id)));
      setNotice({ type: 'ok', text: `Deleted recipient ${deleteConfirmRec.name}.` });
      setDeleteConfirmRec(null);
    } catch (err) {
      setNotice({ type: 'err', text: err.message || 'Unable to delete recipient.' });
    } finally {
      setDeletingRecipient(false);
    }
  };

  const handleSendCloudApi = async () => {
    if (sending) return;
    setNotice(null);
    setSendResults(null);
    if (selectedRecipients.length === 0) {
      setNotice({ type: 'err', text: 'Select at least 1 saved WhatsApp recipient before sending.' });
      return;
    }
    if (!activeMessage.trim()) {
      setNotice({ type: 'err', text: 'Report preview cannot be empty.' });
      return;
    }

    const reportMeta = WHATSAPP_REPORT_TYPES.find((t) => t.id === reportType) || WHATSAPP_REPORT_TYPES[0];
    const sendId = `wa-${reportType}-${filterDate}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    setSending(true);
    try {
      const res = await cloudApi.sendWhatsAppReport({
        report_type: reportType,
        report_label: reportMeta.label,
        report_text: activeMessage,
        filters: {
          date: filterDate,
          shift: filterShift,
          machine: filterMachine,
          tool: filterTool,
        },
        recipients: selectedRecipients,
        client_send_id: sendId,
      });

      setSendResults(res);
      if (res.ok) {
        setNotice({
          type: res.failed_count > 0 ? 'warn' : 'ok',
          text:
            res.failed_count > 0
              ? `Sent to ${res.sent_count} recipient(s), ${res.failed_count} failed. Review delivery status below.`
              : `Successfully delivered ${reportMeta.label} to ${res.sent_count} WhatsApp recipient(s) via Cloud API.`,
        });
      } else {
        setNotice({
          type: 'err',
          text: res.error || 'WhatsApp Cloud API did not complete delivery. Review configuration/error details below.',
        });
      }

      const freshHistory = await cloudApi.getWhatsAppHistory().catch(() => []);
      setHistory(freshHistory || []);
    } catch (err) {
      setNotice({ type: 'err', text: err.message || 'Failed to send WhatsApp report.' });
    } finally {
      setSending(false);
    }
  };

  const handleManualFallbackOpen = () => {
    const first = selectedRecipients[0];
    const digits = first ? String(first.phone_number || '').replace(/\D/g, '') : '';
    const encoded = encodeURIComponent(activeMessage);
    const url = digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice({ type: 'warn', text: 'Clipboard permission denied; copy manually from preview box.' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Server Integration Status Banner */}
      <div className={`banner ${apiStatus?.configured ? 'is-ok' : 'is-warn'}`} role="status">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {apiStatus?.configured ? <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} /> : <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />}
          <div>
            <strong>
              {apiStatus?.configured
                ? `Meta WhatsApp Business Cloud API Connected (${apiStatus.apiVersion || 'v21.0'})`
                : 'Meta WhatsApp Business Cloud API Credentials Needed on Server'}
            </strong>
            <div style={{ fontSize: '0.82rem', marginTop: 2 }}>
              {apiStatus?.configured
                ? 'Authorized Admin and Supervisor accounts can dispatch automated messages directly from this dashboard.'
                : `Configure server environment variables ${(apiStatus?.missingEnvVars || ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']).join(', ')} in Vercel or Supabase Edge Functions (whatsapp-report) for automated server delivery. Use Manual Fallback below meanwhile.`}
            </div>
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={loadAll} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {notice && (
        <div className={`banner is-${notice.type}`} role="alert">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={16} />
            {notice.text}
          </span>
        </div>
      )}

      {/* Top Two-Column Workspace: Saved Recipients + Report Configuration */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
        {/* Left: Saved WhatsApp Recipients (Max 5) */}
        <section className="surface-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">Saved WhatsApp Recipients ({recipients.length}/5)</h2>
              <p className="section-subtitle">Manage up to 5 authorized shopfloor & management contacts</p>
            </div>
            {recipients.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={toggleAllRecipients}>
                {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSaveRecipient} className="zone-panel zone-blue" style={{ padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
              {editingRecipient ? `Editing Recipient: ${editingRecipient.name}` : 'Add New WhatsApp Number'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field-group">
                <label className="field-label" htmlFor="wa-rec-name">Contact Name</label>
                <input
                  id="wa-rec-name"
                  type="text"
                  className="field-input"
                  value={recName}
                  onChange={(e) => setRecName(e.target.value)}
                  placeholder="Plant Manager / Shift Head"
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="wa-rec-phone">WhatsApp Number (E.164)</label>
                <input
                  id="wa-rec-phone"
                  type="tel"
                  className="field-input mono"
                  value={recPhone}
                  onChange={(e) => setRecPhone(e.target.value)}
                  placeholder="+919876543210"
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 }}>
              <span className="field-help">Include country code (e.g. +91 for India)</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {editingRecipient && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={resetRecipientForm}>
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={savingRecipient || (!editingRecipient && recipients.length >= 5)}
                >
                  <UserPlus size={14} />
                  {savingRecipient ? 'Saving...' : editingRecipient ? 'Save Changes' : 'Add Recipient'}
                </button>
              </div>
            </div>
          </form>

          {loading ? (
            <div className="skeleton-line" style={{ height: 120, width: '100%' }} />
          ) : recipients.length === 0 ? (
            <div className="empty-state" style={{ padding: '22px 12px' }}>
              <Phone size={24} style={{ margin: '0 auto 6px', color: 'var(--blue)' }} />
              <div className="empty-state-title">No recipients saved yet</div>
              <div className="empty-state-sub">Add up to 5 management or supervisor WhatsApp numbers above.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recipients.map((r) => {
                const checked = selectedIds.some((id) => String(id) === String(r.id));
                return (
                  <div
                    key={r.id || r.phone_number}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1.5px solid ${checked ? 'var(--blue)' : 'var(--border)'}`,
                      background: checked ? 'var(--blue-soft)' : 'var(--bg-surface)',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecipient(r.id)}
                        style={{ width: 17, height: 17, accentColor: 'var(--blue)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink-primary)' }}>{r.name}</div>
                        <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>{r.phone_number}</div>
                      </div>
                    </label>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        aria-label={`Edit ${r.name}`}
                        onClick={() => {
                          setEditingRecipient(r);
                          setRecName(r.name);
                          setRecPhone(r.phone_number);
                        }}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        aria-label={`Delete ${r.name}`}
                        onClick={() => setDeleteConfirmRec(r)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Report Type Selection & Filters */}
        <section className="surface-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">Select Report Type & Filters</h2>
              <p className="section-subtitle">Operational production, target, scrap & downtime summary (excludes payroll)</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 14 }}>
            {WHATSAPP_REPORT_TYPES.map((rt) => {
              const active = reportType === rt.id;
              return (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => {
                    setReportType(rt.id);
                    setIsCustomEdited(false);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1.5px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
                    background: active ? 'var(--blue-soft)' : 'var(--bg-subtle)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: active ? 'var(--blue-deep)' : 'var(--navy)' }}>
                    {rt.label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: 2 }}>{rt.description}</div>
                </button>
              );
            })}
          </div>

          <div className="filter-bar">
            <div className="field-group">
              <label className="field-label" htmlFor="wa-f-date">Date</label>
              <input
                id="wa-f-date"
                type="date"
                className="field-input"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setIsCustomEdited(false);
                }}
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="wa-f-shift">Shift</label>
              <select
                id="wa-f-shift"
                className="field-select"
                value={filterShift}
                onChange={(e) => {
                  setFilterShift(e.target.value);
                  setIsCustomEdited(false);
                }}
              >
                <option value="ALL">All Shifts</option>
                {SHIFTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.id}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="wa-f-machine">Machine</label>
              <select
                id="wa-f-machine"
                className="field-select"
                value={filterMachine}
                onChange={(e) => {
                  setFilterMachine(e.target.value);
                  setIsCustomEdited(false);
                }}
              >
                <option value="ALL">All Machines</option>
                {machines.map((m) => (
                  <option key={m.machine_number} value={m.machine_number}>{m.machine_number}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="wa-f-tool">Tool Number</label>
              <select
                id="wa-f-tool"
                className="field-select"
                value={filterTool}
                onChange={(e) => {
                  setFilterTool(e.target.value);
                  setIsCustomEdited(false);
                }}
              >
                <option value="ALL">All Tools</option>
                {toolOptions.map((tn) => (
                  <option key={tn} value={tn}>{tn}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="field-label" htmlFor="wa-msg-preview" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} /> Formatted Report Preview
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {isCustomEdited && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setIsCustomEdited(false);
                      setCustomMessage(generatedReportText);
                    }}
                  >
                    Reset to Live Data
                  </button>
                )}
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyText}>
                  <Copy size={13} /> {copied ? 'Copied' : 'Copy Text'}
                </button>
              </div>
            </div>
            <textarea
              id="wa-msg-preview"
              rows={10}
              className="field-textarea mono"
              value={activeMessage}
              onChange={(e) => {
                setIsCustomEdited(true);
                setCustomMessage(e.target.value);
              }}
              style={{ fontSize: '0.8rem', lineHeight: 1.48 }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
              Target recipients: <strong>{selectedRecipients.length}</strong> selected ({selectedRecipients.map((r) => r.name).join(', ') || 'None'})
            </span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleManualFallbackOpen}
                title="Opens WhatsApp app/web manually for the first selected recipient"
              >
                <ExternalLink size={15} />
                Manual Share via WhatsApp App (Fallback)
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleSendCloudApi}
                disabled={sending || selectedRecipients.length === 0}
              >
                <Send size={15} />
                {sending ? 'Dispatching Report...' : `Send Report via WhatsApp API (${selectedRecipients.length})`}
              </button>
            </div>
          </div>

          {sendResults?.results && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="kpi-label" style={{ marginBottom: 8 }}>Delivery Attempt Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sendResults.results.map((r, i) => (
                  <div
                    key={`${r.phone_number}-${i}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: r.status === 'sent' ? 'var(--green-soft)' : 'var(--red-soft)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span>
                      <strong>{r.name}</strong> (<span className="mono">{r.phone_number}</span>)
                    </span>
                    <span className={`status-pill ${r.status === 'sent' ? 'is-ok' : 'is-err'}`}>
                      {r.status === 'sent' ? `Sent (${r.message_id || 'OK'})` : r.error || 'Failed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Report History */}
      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={17} /> WhatsApp Report Delivery History ({history.length})
            </h2>
            <p className="section-subtitle">Synced audit trail of automated WhatsApp report dispatches</p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <div className="empty-state-title">No report dispatches recorded yet</div>
            <div className="empty-state-sub">Every API send attempt (successful or failed) will appear here with per-recipient details.</div>
          </div>
        ) : (
          <div className="table-scroll-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Report Type</th>
                  <th>Sent By</th>
                  <th>Recipients</th>
                  <th>Status</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id || h.client_send_id}>
                    <td className="mono" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                      {String(h.created_at || '').slice(0, 19).replace('T', ' ')}
                    </td>
                    <td><strong>{h.report_label || h.report_type}</strong></td>
                    <td>{h.sent_by || '-'}</td>
                    <td className="tabular">{h.sent_count}/{h.recipient_count} sent</td>
                    <td>
                      <span
                        className={`status-pill ${
                          h.overall_status === 'sent'
                            ? 'is-ok'
                            : h.overall_status === 'partial'
                              ? 'is-warn'
                              : 'is-err'
                        }`}
                      >
                        {h.overall_status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 360, fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                      {String(h.message_preview || '').slice(0, 120)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Delete Recipient Confirmation Modal */}
      {deleteConfirmRec && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="wa-del-title">
          <div className="modal-dialog" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 id="wa-del-title" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--status-err)' }}>
                Remove WhatsApp Recipient?
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirmRec(null)}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem' }}>
                Remove <strong>{deleteConfirmRec.name}</strong> (<span className="mono">{deleteConfirmRec.phone_number}</span>) from saved WhatsApp report recipients?
              </p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteConfirmRec(null)} disabled={deletingRecipient}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteRecipient} disabled={deletingRecipient}>
                <Trash2 size={14} /> {deletingRecipient ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
