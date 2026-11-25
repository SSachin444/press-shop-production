import React, { useEffect, useMemo, useState } from 'react';
import { Save, CheckSquare, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { getCapabilities } from '../config/roles';
import { cloudApi } from '../services/cloudClient';
import { SHIFTS } from '../services/metrics';

const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Half-Day', 'On-Duty', 'Week-Off'];

export default function AttendanceView({ selectedDate, setSelectedDate, selectedShift, setSelectedShift, currentUser }) {
  const caps = getCapabilities(currentUser?.role);
  const [roster, setRoster] = useState([]);
  const [marks, setMarks] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [empList, attList] = await Promise.all([
        cloudApi.getOperationalRoster(),
        cloudApi.getAttendance(selectedDate, selectedShift),
      ]);
      setRoster(empList || []);
      const nextMarks = {};
      const nextNotes = {};
      (attList || []).forEach((a) => {
        nextMarks[a.emp_id] = a.status || 'Present';
        nextNotes[a.emp_id] = a.notes || '';
      });
      setMarks(nextMarks);
      setNotes(nextNotes);
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Unable to load shift attendance.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caps.canManageAttendance) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [caps.canManageAttendance, selectedDate, selectedShift]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let pending = 0;
    roster.forEach((emp) => {
      const st = marks[emp.emp_id];
      if (!st) pending += 1;
      else if (st === 'Present' || st === 'On-Duty' || st === 'Late') present += 1;
      else absent += 1;
    });
    return { total: roster.length, present, absent, pending };
  }, [roster, marks]);

  if (!caps.canManageAttendance) {
    return (
      <div className="banner is-err">
        <span>Access restricted. Attendance is available only to Admin and Supervisor roles.</span>
      </div>
    );
  }

  const markAllPresent = () => {
    const next = { ...marks };
    roster.forEach((e) => {
      if (!next[e.emp_id]) next[e.emp_id] = 'Present';
    });
    setMarks(next);
  };

  const handleSave = async () => {
    const rows = roster
      .filter((e) => marks[e.emp_id])
      .map((e) => ({
        emp_id: e.emp_id,
        date: selectedDate,
        shift: selectedShift === 'ALL' ? 'Shift A' : selectedShift,
        status: marks[e.emp_id],
        notes: notes[e.emp_id] || '',
      }));

    if (rows.length === 0) {
      setNotice({ type: 'err', text: 'Select status for at least one employee before saving.' });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      await cloudApi.saveAttendance(rows);
      setNotice({ type: 'ok', text: `Saved attendance for ${rows.length} workers (${selectedDate} • ${selectedShift}).` });
      await loadData();
    } catch (err) {
      setNotice({ type: 'err', text: err?.message || 'Failed to save attendance.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="surface-card">
        <div className="filter-bar">
          <div className="field-group">
            <label className="field-label" htmlFor="att-date">Date</label>
            <input
              id="att-date"
              type="date"
              className="field-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="att-shift">Shift</label>
            <select
              id="att-shift"
              className="field-select"
              value={selectedShift === 'ALL' ? 'Shift A' : selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
            >
              {SHIFTS.map((s) => (
                <option key={s.id} value={s.id}>{s.id}</option>
              ))}
            </select>
          </div>

          <div className="field-group" style={{ justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={markAllPresent}>
                <CheckSquare size={15} />
                Mark Unset Present
              </button>
              <button type="button" className="btn btn-secondary" onClick={loadData}>
                <RefreshCw size={15} />
                Reload
              </button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
                <Save size={15} />
                {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {notice && (
        <div className={`banner ${notice.type === 'ok' ? 'is-ok' : 'is-err'}`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {notice.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {notice.text}
          </span>
        </div>
      )}

      <div className="kpi-grid-4">
        <div className="kpi-box" style={{ cursor: 'default' }}>
          <div className="kpi-label">Active Roster</div>
          <div className="kpi-number tabular">{counts.total}</div>
        </div>
        <div className="kpi-box" style={{ cursor: 'default' }}>
          <div className="kpi-label">Present / On-Duty</div>
          <div className="kpi-number tabular" style={{ color: 'var(--status-ok-ink)' }}>{counts.present}</div>
        </div>
        <div className="kpi-box" style={{ cursor: 'default' }}>
          <div className="kpi-label">Absent / Week-Off</div>
          <div className="kpi-number tabular" style={{ color: 'var(--status-err-ink)' }}>{counts.absent}</div>
        </div>
        <div className="kpi-box" style={{ cursor: 'default' }}>
          <div className="kpi-label">Not Yet Marked</div>
          <div className="kpi-number tabular">{counts.pending}</div>
        </div>
      </div>

      <section className="surface-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Shift Attendance Register</h2>
            <p className="section-subtitle">{selectedDate} — {selectedShift}</p>
          </div>
        </div>

        {loading ? (
          <div className="skeleton-line" style={{ height: 140, width: '100%' }} />
        ) : roster.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.86rem' }}>No active workers found in roster.</p>
        ) : (
          <>
            <div className="desktop-table-only table-scroll-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Operator</th>
                    <th>Department</th>
                    <th>Machine</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((emp) => (
                    <tr key={emp.emp_id}>
                      <td className="mono" style={{ fontWeight: 700 }}>{emp.emp_id}</td>
                      <td>{emp.name}</td>
                      <td>{emp.department}</td>
                      <td className="mono">{emp.assigned_machine || '-'}</td>
                      <td>
                        <select
                          aria-label={`Attendance status for ${emp.name}`}
                          className="field-select"
                          style={{ minWidth: 140 }}
                          value={marks[emp.emp_id] || ''}
                          onChange={(e) => setMarks({ ...marks, [emp.emp_id]: e.target.value })}
                        >
                          <option value="">-- Select --</option>
                          {ATTENDANCE_STATUSES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="field-input"
                          placeholder="Shift remarks..."
                          value={notes[emp.emp_id] || ''}
                          onChange={(e) => setNotes({ ...notes, [emp.emp_id]: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-card-list">
              {roster.map((emp) => (
                <div key={emp.emp_id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                  <div style={{ marginBottom: 6 }}>
                    <strong className="mono">{emp.emp_id}</strong> — {emp.name} ({emp.assigned_machine || 'Unassigned'})
                  </div>
                  <select
                    className="field-select"
                    value={marks[emp.emp_id] || ''}
                    onChange={(e) => setMarks({ ...marks, [emp.emp_id]: e.target.value })}
                  >
                    <option value="">-- Select Status --</option>
                    {ATTENDANCE_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
