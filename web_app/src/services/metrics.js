// Single Source of Truth Metrics, Validation, Calculation Engine, and CSV Export Utility
// Used consistently by Dashboard, Live Cell Status, NC & Tandem Entry, Tool Management, Production Summary, and Reports.

export const PLANTS = ['Plant 1'];

export const SHIFTS = [
  { id: 'Shift A', label: 'Shift A (08:00 AM - 04:30 PM)' },
  { id: 'Shift B', label: 'Shift B (04:30 PM - 01:00 AM)' },
  { id: 'Shift C', label: 'Shift C (01:00 AM - 08:00 AM)' },
];

export const HOUR_SLOTS = [
  { key: 'Hour 1', span: '08:00 - 09:00', label: 'Hour 1 (08:00 - 09:00)', shortLabel: 'Hr 1' },
  { key: 'Hour 2', span: '09:00 - 10:00', label: 'Hour 2 (09:00 - 10:00)', shortLabel: 'Hr 2' },
  { key: 'Hour 3', span: '10:00 - 11:00', label: 'Hour 3 (10:00 - 11:00)', shortLabel: 'Hr 3' },
  { key: 'Hour 4', span: '11:00 - 12:00', label: 'Hour 4 (11:00 - 12:00)', shortLabel: 'Hr 4' },
  { key: 'Hour 5', span: '12:30 - 13:30', label: 'Hour 5 (12:30 - 13:30)', shortLabel: 'Hr 5' },
  { key: 'Hour 6', span: '13:30 - 14:30', label: 'Hour 6 (13:30 - 14:30)', shortLabel: 'Hr 6' },
  { key: 'Hour 7', span: '14:30 - 15:30', label: 'Hour 7 (14:30 - 15:30)', shortLabel: 'Hr 7' },
  { key: 'Hour 8', span: '15:30 - 16:30', label: 'Hour 8 (15:30 - 16:30)', shortLabel: 'Hr 8' },
];

export const TANDEM_LINES = [
  { machine_number: 'LP-1', name: 'Low Pressure Line 1', category: 'Low Pressure', tonnage: 1200, production_target: 700 },
  { machine_number: 'LP-2', name: 'Low Pressure Line 2', category: 'Low Pressure', tonnage: 1000, production_target: 650 },
  { machine_number: 'HP-1', name: 'High Pressure Line 1', category: 'High Pressure', tonnage: 1500, production_target: 800 },
  { machine_number: 'HP-2', name: 'High Pressure Line 2', category: 'High Pressure', tonnage: 1500, production_target: 800 },
  { machine_number: 'HP-3', name: 'High Pressure Line 3', category: 'Heavy Stamping', tonnage: 2000, production_target: 900 },
  { machine_number: 'HP-4', name: 'High Pressure Line 4', category: 'Heavy Stamping', tonnage: 2000, production_target: 900 },
];

export const DEFAULT_SCRAP_REASONS = [
  'Burr / Sharp Edge',
  'Crack / Tear',
  'Wrinkle / Dent',
  'Dimension Out of Spec',
  'Setup / Trial Scrap',
  'Material / Coil Defect',
  'Surface Scratch / Mark',
  'Double Hit / Miss-Feed',
];

export const DEFAULT_DOWNTIME_CODES = [
  { code: 'D01', name: 'Machine Breakdown', description: 'Mechanical or electrical failure', display_order: 1, is_active: true },
  { code: 'D02', name: 'Tool Problem', description: 'Tool wear, breakage, or die alignment', display_order: 2, is_active: true },
  { code: 'D03', name: 'Material Shortage', description: 'Raw material, blank, or coil unavailability', display_order: 3, is_active: true },
  { code: 'D04', name: 'Power Failure', description: 'Electrical grid, power outage, or generator fault', display_order: 4, is_active: true },
  { code: 'D05', name: 'Quality Problem', description: 'Defects, burr, crack, or dimensional issues', display_order: 5, is_active: true },
  { code: 'D06', name: 'Other Issues', description: 'Maintenance, safety, air pressure, or miscellaneous', display_order: 6, is_active: true },
  { code: 'D07', name: 'Die Changeover / Setup', description: 'Scheduled or unscheduled die change and trial setup', display_order: 7, is_active: true },
  { code: 'D08', name: 'Planned Maintenance', description: 'Preventive check, lubrication, or scheduled PM', display_order: 8, is_active: true },
  { code: 'D09', name: 'Safety / Sensor Fault', description: 'Light curtain, interlock, or safety sensor trip', display_order: 9, is_active: true },
  { code: 'D10', name: 'Air / Hydraulic Pressure', description: 'Pneumatic or hydraulic pressure drop', display_order: 10, is_active: true },
];

export function getDefaultMachinesList() {
  return [
    { machine_number: 'NC-01', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 1000, production_target: 600, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-02', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 800, production_target: 550, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-03', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 800, production_target: 550, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-04', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 600, production_target: 500, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-05', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 600, production_target: 500, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-06', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 500, production_target: 450, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-07', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 500, production_target: 450, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-08', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 400, production_target: 400, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-09', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 400, production_target: 400, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-10', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 300, production_target: 350, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-11', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 300, production_target: 350, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-12', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 300, production_target: 350, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-13', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 250, production_target: 300, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-14', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 250, production_target: 300, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-15', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 200, production_target: 250, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'NC-16', machine_type: 'NC', machine_group: 'NC', plant_id: 'Plant 1', tonnage: 200, production_target: 250, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'LP-1', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 1200, production_target: 700, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'LP-2', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 1000, production_target: 650, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'HP-1', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 1500, production_target: 800, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'HP-2', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 1500, production_target: 800, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'HP-3', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 2000, production_target: 900, status: 'Idle', assigned_operator: '', version: 1 },
    { machine_number: 'HP-4', machine_type: 'Tandem', machine_group: 'Tandem', plant_id: 'Plant 1', tonnage: 2000, production_target: 900, status: 'Idle', assigned_operator: '', version: 1 },
  ];
}

export function getCurrentShiftName(now = new Date()) {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${mm}`;
  if (timeStr >= '08:00' && timeStr < '16:30') return 'Shift A';
  if (timeStr >= '16:30' || timeStr < '01:00') return 'Shift B';
  return 'Shift C';
}

export function getAchievementTone(pct, targetQty = 1, threshold = 85) {
  if (!targetQty || Number(targetQty) <= 0) return 'neutral';
  const val = Number(pct) || 0;
  if (val >= threshold) return 'green';
  if (val >= 60) return 'orange';
  return 'red';
}

// ------------------------------------------------------------------
// VALIDATION HELPERS (MANPOWER, UPH TARGET, SCRAP, DOWNTIME)
// ------------------------------------------------------------------
export function validatePhoneNumber(phone) {
  const clean = String(phone || '').trim();
  if (!clean) return { valid: true, normalized: '' };
  const digits = clean.replace(/[\s\-().+]/g, '');
  if (!/^\d{7,15}$/.test(digits)) {
    return { valid: false, error: 'Phone number must contain 7 to 15 digits (e.g. +91 9876543210).' };
  }
  return { valid: true, normalized: clean };
}

export function validateEmailAddress(email) {
  const clean = String(email || '').trim();
  if (!clean) return { valid: true, normalized: '' };
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRe.test(clean)) {
    return { valid: false, error: 'Enter a valid email address (e.g. name@phaindia.com).' };
  }
  return { valid: true, normalized: clean.toLowerCase() };
}

export function calculateTargetFromUph(uph, runningMinutes = 60) {
  const u = Math.max(0, Number(uph) || 0);
  const mins = Math.max(0, Number(runningMinutes) || 0);
  return Math.round(u * (mins / 60));
}

export function parseTimeToMinutes(hhmm) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function calculateTimeDurationMinutes(startTime, endTime) {
  const s = parseTimeToMinutes(startTime);
  const e = parseTimeToMinutes(endTime);
  if (s === null || e === null) return null;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60; // Handles midnight crossover (Shift B)
  if (diff === 0) return 0;
  return diff;
}

export function validateScrapReasons(scrapQty, reasons = [], maxReasons = 5) {
  const qtyNum = Math.max(0, Number(scrapQty) || 0);
  const active = (reasons || []).filter((r) => String(r?.reason_name || '').trim() || Number(r?.qty) > 0);
  if (active.length > maxReasons) {
    return { valid: false, totalReasonQty: 0, remaining: qtyNum, error: `Maximum ${maxReasons} scrap reasons allowed per part.` };
  }

  const seen = new Set();
  let sum = 0;
  for (let i = 0; i < active.length; i++) {
    const r = active[i];
    const name = String(r.reason_name || '').trim();
    const rQty = Number(r.qty);
    if (!name) {
      return { valid: false, totalReasonQty: sum, remaining: qtyNum - sum, error: `Scrap reason #${i + 1} requires a reason name.` };
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return { valid: false, totalReasonQty: sum, remaining: qtyNum - sum, error: `Duplicate scrap reason "${name}" on the same part.` };
    }
    seen.add(key);

    if (!Number.isInteger(rQty) || rQty <= 0) {
      return { valid: false, totalReasonQty: sum, remaining: qtyNum - sum, error: `Scrap reason "${name}" must have a whole quantity greater than 0.` };
    }
    sum += rQty;
  }

  if (sum > qtyNum) {
    return {
      valid: false,
      totalReasonQty: sum,
      remaining: qtyNum - sum,
      error: `Combined scrap reason quantities (${sum}) cannot exceed total part scrap quantity (${qtyNum}).`,
    };
  }

  return {
    valid: true,
    totalReasonQty: sum,
    remaining: qtyNum - sum,
    normalized: active.map((r, idx) => ({
      reason_index: idx + 1,
      reason_name: String(r.reason_name).trim(),
      is_custom: Boolean(r.is_custom),
      qty: Number(r.qty),
    })),
  };
}

export function validateDowntimeProblems(problems = [], maxProblems = 5, maxHourMinutes = 60) {
  const active = (problems || []).filter(
    (p) =>
      String(p?.start_time || '').trim() ||
      String(p?.end_time || '').trim() ||
      String(p?.problem_description || '').trim() ||
      Number(p?.duration_minutes) > 0
  );

  if (active.length === 0) {
    return { valid: true, totalMinutes: 0, normalized: [] };
  }

  if (active.length > maxProblems) {
    return { valid: false, totalMinutes: 0, normalized: [], error: `Maximum ${maxProblems} downtime problems allowed per hour.` };
  }

  const intervals = [];
  const normalized = [];
  let totalMinutes = 0;

  for (let i = 0; i < active.length; i++) {
    const p = active[i];
    const startMin = parseTimeToMinutes(p.start_time);
    const endMinRaw = parseTimeToMinutes(p.end_time);
    if (startMin === null || endMinRaw === null) {
      return {
        valid: false,
        totalMinutes: 0,
        normalized: [],
        error: `Downtime problem #${i + 1}: valid Start Time and End Time (HH:MM) are required.`,
      };
    }

    let endMin = endMinRaw;
    if (endMin <= startMin) {
      // Allow midnight crossing only when diff <= 60 mins
      if (startMin >= 23 * 60 && endMinRaw <= 60) {
        endMin += 24 * 60;
      } else {
        return {
          valid: false,
          totalMinutes: 0,
          normalized: [],
          error: `Downtime problem #${i + 1}: End Time must be later than Start Time.`,
        };
      }
    }

    const duration = endMin - startMin;
    if (duration <= 0 || duration > maxHourMinutes) {
      return {
        valid: false,
        totalMinutes: 0,
        normalized: [],
        error: `Downtime problem #${i + 1}: duration (${duration} min) must be between 1 and ${maxHourMinutes} minutes.`,
      };
    }

    const reason = String(p.downtime_reason || p.reason || '').trim();
    const code = String(p.downtime_code || 'D01').trim().toUpperCase();
    if (!reason) {
      return {
        valid: false,
        totalMinutes: 0,
        normalized: [],
        error: `Downtime problem #${i + 1}: select a downtime reason.`,
      };
    }

    // Check duplicate & overlapping intervals
    for (let j = 0; j < intervals.length; j++) {
      const prev = intervals[j];
      if (prev.start === startMin && prev.end === endMin) {
        return {
          valid: false,
          totalMinutes: 0,
          normalized: [],
          error: `Duplicate downtime interval ${p.start_time}–${p.end_time} detected between problem #${j + 1} and #${i + 1}.`,
        };
      }
      if (startMin < prev.end && prev.start < endMin) {
        return {
          valid: false,
          totalMinutes: 0,
          normalized: [],
          error: `Overlapping downtime intervals: problem #${j + 1} (${prev.label}) overlaps with #${i + 1} (${p.start_time}–${p.end_time}).`,
        };
      }
    }

    intervals.push({ start: startMin, end: endMin, label: `${p.start_time}–${p.end_time}` });
    totalMinutes += duration;
    normalized.push({
      problem_index: i + 1,
      start_time: p.start_time,
      end_time: p.end_time,
      duration_minutes: duration,
      downtime_code: code,
      downtime_reason: reason,
      problem_description: String(p.problem_description || '').trim(),
    });
  }

  if (totalMinutes > maxHourMinutes) {
    return {
      valid: false,
      totalMinutes,
      normalized: [],
      error: `Total combined downtime (${totalMinutes} min) cannot exceed ${maxHourMinutes} minutes in a single hour.`,
    };
  }

  return { valid: true, totalMinutes, normalized };
}

// ------------------------------------------------------------------
// RECORD NORMALIZATION & DEDUPLICATION
// ------------------------------------------------------------------
function parseJsonArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function extractBaseHourAndPart(hourInterval, explicitPartIndex) {
  const rawHour = String(hourInterval || '').trim();
  const partMatch = /^(.*?)\s*\[Part\s+(\d+)\]\s*$/i.exec(rawHour);
  const baseHour = partMatch ? partMatch[1].trim() : rawHour;
  const partIndex = Number(explicitPartIndex) || (partMatch ? Number(partMatch[2]) : 1) || 1;
  return { baseHour, partIndex };
}

export function getHourSortOrder(hourStr) {
  const { baseHour } = extractBaseHourAndPart(hourStr);
  const idx = HOUR_SLOTS.findIndex(
    (s) => baseHour === s.label || baseHour.includes(s.key) || baseHour.includes(s.span)
  );
  if (idx >= 0) return idx;
  const m = /Hour\s+(\d+)/i.exec(baseHour);
  return m ? Number(m[1]) - 1 : 99;
}

export function normalizeRecord(raw) {
  const { baseHour, partIndex } = extractBaseHourAndPart(raw?.hour_interval, raw?.part_index);
  const actual = Math.max(0, Number(raw?.actual_qty) || 0);
  const rejected = Math.max(0, Number(raw?.rejected_qty) || 0);
  const good =
    raw?.good_qty !== undefined && raw?.good_qty !== null
      ? Math.max(0, Number(raw.good_qty) || 0)
      : Math.max(0, actual - rejected);

  const runningMinutes =
    raw?.running_minutes !== undefined && raw?.running_minutes !== null && Number(raw.running_minutes) > 0
      ? Number(raw.running_minutes)
      : 60;
  const uph = Math.max(0, Number(raw?.uph) || 0);
  const storedTarget = Math.max(0, Number(raw?.target_qty) || 0);
  const target = storedTarget > 0 ? storedTarget : uph > 0 ? calculateTargetFromUph(uph, runningMinutes) : 0;

  const downtime = Math.max(0, Number(raw?.downtime_minutes) || 0);
  const machine = String(raw?.machine_or_line || raw?.machine || '').trim().toUpperCase();
  const group =
    raw?.production_type ||
    (machine.startsWith('LP') || machine.startsWith('HP') ? 'Tandem' : 'NC');

  // Parse optional embedded metadata from remarks when pre-migration fallback was used
  let cleanRemarks = String(raw?.remarks || '');
  let embeddedScrap = [];
  let embeddedDt = [];
  let embeddedPartName = raw?.part_name || '';
  let embeddedRunMins = runningMinutes;
  const metaIdx = cleanRemarks.indexOf('||META:');
  if (metaIdx !== -1) {
    try {
      const metaJson = JSON.parse(cleanRemarks.slice(metaIdx + 7));
      if (Array.isArray(metaJson.scrap_breakdown)) embeddedScrap = metaJson.scrap_breakdown;
      if (Array.isArray(metaJson.downtime_problems)) embeddedDt = metaJson.downtime_problems;
      if (metaJson.part_name) embeddedPartName = metaJson.part_name;
      if (metaJson.running_minutes) embeddedRunMins = Number(metaJson.running_minutes) || runningMinutes;
      cleanRemarks = cleanRemarks.slice(0, metaIdx).trim();
    } catch {
      // Ignore malformed trailing metadata
    }
  }

  const scrapBreakdown = parseJsonArray(raw?.scrap_breakdown);
  const downtimeProblems = parseJsonArray(raw?.downtime_problems);

  return {
    ...raw,
    plant_id: raw?.plant_id || 'Plant 1',
    machine_or_line: machine,
    production_type: group,
    hour_interval: baseHour,
    raw_hour_interval: raw?.hour_interval || baseHour,
    part_index: partIndex,
    part_name: embeddedPartName,
    running_minutes: embeddedRunMins,
    running_hours: Number((embeddedRunMins / 60).toFixed(2)),
    uph,
    actual_qty: actual,
    target_qty: target,
    rejected_qty: rejected,
    good_qty: good,
    downtime_minutes: downtime,
    scrap_breakdown: scrapBreakdown.length > 0 ? scrapBreakdown : embeddedScrap,
    downtime_problems: downtimeProblems.length > 0 ? downtimeProblems : embeddedDt,
    remarks: cleanRemarks,
    achievement_pct: target > 0 ? Number(((actual / target) * 100).toFixed(1)) : 0,
  };
}

/**
 * Prevents double counting downtime when multiple parts run simultaneously
 * in the same (date, shift, machine_or_line, base_hour_interval) slot.
 */
export function deduplicateSlotDowntime(normalizedRecords) {
  const slotMap = new Map();
  (normalizedRecords || []).forEach((r) => {
    const key = `${r.date}|${r.shift}|${r.machine_or_line}|${r.hour_interval}`;
    if (!slotMap.has(key)) slotMap.set(key, []);
    slotMap.get(key).push(r);
  });

  let totalDowntimeMinutes = 0;
  let totalProblems = 0;
  const slotDowntimes = new Map();

  slotMap.forEach((slotRecs, key) => {
    // Prefer explicit non-overlapping downtime_problems if recorded on any part (normally part_index=1)
    const problemMap = new Map();
    slotRecs.forEach((r) => {
      (r.downtime_problems || []).forEach((p) => {
        const pKey = `${p.start_time || ''}|${p.end_time || ''}|${p.downtime_code || ''}|${p.problem_description || ''}`;
        if (!problemMap.has(pKey)) {
          problemMap.set(pKey, p);
        }
      });
    });

    let slotMinutes = 0;
    let slotProblems = [];
    if (problemMap.size > 0) {
      slotProblems = Array.from(problemMap.values());
      slotMinutes = slotProblems.reduce((s, p) => s + (Number(p.duration_minutes) || 0), 0);
    } else {
      // If part_index=1 holds the slot downtime and part_index>1 holds 0, or legacy equal copies exist, take max
      slotMinutes = slotRecs.reduce((mx, r) => Math.max(mx, Number(r.downtime_minutes) || 0), 0);
      const anyReason = slotRecs.find((r) => r.downtime_minutes > 0 && r.downtime_reason);
      if (slotMinutes > 0) {
        slotProblems = [
          {
            downtime_code: anyReason?.downtime_code || 'D01',
            downtime_reason: anyReason?.downtime_reason || 'Downtime',
            duration_minutes: slotMinutes,
          },
        ];
      }
    }

    totalDowntimeMinutes += slotMinutes;
    totalProblems += slotProblems.length;
    slotDowntimes.set(key, {
      minutes: slotMinutes,
      problems: slotProblems,
    });
  });

  return { totalDowntimeMinutes, totalProblems, slotDowntimes };
}

export function filterProductionRecords(records, filters = {}) {
  const {
    plant = 'ALL',
    date = '',
    fromDate = '',
    toDate = '',
    shift = '',
    machineGroup = 'ALL',
    machine = '',
    tool = '',
    operator = '',
    search = '',
  } = filters;

  const groupUpper = String(machineGroup || 'ALL').toUpperCase();
  const machineUpper = String(machine || '').trim().toUpperCase();
  const toolUpper = String(tool || '').trim().toUpperCase();
  const operatorLower = String(operator || '').trim().toLowerCase();
  const searchLower = String(search || '').trim().toLowerCase();

  return (records || []).map(normalizeRecord).filter((r) => {
    if (plant && plant !== 'ALL' && (r.plant_id || 'Plant 1') !== plant) return false;
    if (date && r.date !== date) return false;
    if (fromDate && r.date < fromDate) return false;
    if (toDate && r.date > toDate) return false;
    if (shift && shift !== 'ALL' && r.shift !== shift) return false;
    if (groupUpper !== 'ALL' && String(r.production_type || '').toUpperCase() !== groupUpper) return false;
    if (machineUpper && machineUpper !== 'ALL' && r.machine_or_line !== machineUpper) return false;
    if (toolUpper && toolUpper !== 'ALL' && String(r.tool_number || '').trim().toUpperCase() !== toolUpper) return false;
    if (operatorLower && !String(r.operator_name || '').toLowerCase().includes(operatorLower)) return false;
    if (searchLower) {
      const hay = [
        r.date,
        r.shift,
        r.machine_or_line,
        r.production_type,
        r.tool_number,
        r.part_name,
        r.operator_name,
        r.hour_interval,
        r.downtime_reason,
        r.remarks,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(searchLower)) return false;
    }
    return true;
  });
}

function summarizeRecordSet(recs) {
  const actual = recs.reduce((s, r) => s + r.actual_qty, 0);
  const target = recs.reduce((s, r) => s + r.target_qty, 0);
  const good = recs.reduce((s, r) => s + r.good_qty, 0);
  const rejected = recs.reduce((s, r) => s + r.rejected_qty, 0);
  const { totalDowntimeMinutes, totalProblems } = deduplicateSlotDowntime(recs);

  return {
    actual,
    target,
    good,
    rejected,
    downtimeMinutes: totalDowntimeMinutes,
    problemCount: totalProblems,
    achievementPct: target > 0 ? Number(((actual / target) * 100).toFixed(1)) : 0,
    qualityPct: actual > 0 ? Number(((good / actual) * 100).toFixed(1)) : 0,
    scrapPct: actual > 0 ? Number(((rejected / actual) * 100).toFixed(1)) : 0,
    recordCount: recs.length,
  };
}

export function computeProductionMetrics(records, machines, downtimes = [], filters = {}) {
  const groupUpper = String(filters.machineGroup || 'ALL').toUpperCase();
  const plantFilter = filters.plant || 'Plant 1';

  const normalizedMachines = (machines || []).filter((m) => {
    if (plantFilter && plantFilter !== 'ALL' && (m.plant_id || 'Plant 1') !== plantFilter) return false;
    if (groupUpper === 'ALL') return true;
    return String(m.machine_type || m.machine_group || 'NC').toUpperCase() === groupUpper;
  });

  const filteredRecords = filterProductionRecords(records, {
    plant: plantFilter,
    date: filters.date,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    shift: filters.shift,
    machineGroup: groupUpper,
    machine: filters.machine,
    tool: filters.tool,
    operator: filters.operator,
    search: filters.search,
  });

  const openDowntimes = (downtimes || []).filter((d) => {
    if (d.status !== 'Open') return false;
    if (groupUpper === 'ALL') return true;
    return normalizedMachines.some(
      (m) => m.machine_number.toUpperCase() === String(d.machine_number || '').toUpperCase()
    );
  });

  const baseTotals = summarizeRecordSet(filteredRecords);
  const { slotDowntimes } = deduplicateSlotDowntime(filteredRecords);

  const ncRecs = filteredRecords.filter((r) => String(r.production_type).toUpperCase() === 'NC');
  const tandemRecs = filteredRecords.filter((r) => String(r.production_type).toUpperCase() === 'TANDEM');
  const ncTotals = summarizeRecordSet(ncRecs);
  const tandemTotals = summarizeRecordSet(tandemRecs);

  const affectedMachinesSet = new Set();
  slotDowntimes.forEach((val, key) => {
    if (val.minutes > 0) {
      const mName = key.split('|')[2];
      if (mName) affectedMachinesSet.add(mName);
    }
  });
  openDowntimes.forEach((d) => {
    if (d.machine_number) affectedMachinesSet.add(String(d.machine_number).toUpperCase());
  });

  let runningCount = 0;
  let maintenanceCount = 0;
  let stoppedCount = 0;

  const machineRows = normalizedMachines.map((m) => {
    const mNum = String(m.machine_number).toUpperCase();
    const mRecs = filteredRecords
      .filter((r) => r.machine_or_line === mNum)
      .sort(
        (a, b) =>
          String(a.date || '').localeCompare(String(b.date || '')) ||
          getHourSortOrder(a.hour_interval) - getHourSortOrder(b.hour_interval) ||
          (Number(a.part_index) || 1) - (Number(b.part_index) || 1) ||
          (Number(a.id) || 0) - (Number(b.id) || 0)
      );

    const mSummary = summarizeRecordSet(mRecs);
    const activeDt = openDowntimes.find((d) => String(d.machine_number || '').toUpperCase() === mNum) || null;
    const status = activeDt ? 'Breakdown' : (m.status || (mSummary.actual > 0 ? 'Running' : 'Idle'));

    if (status === 'Running') runningCount += 1;
    else if (status === 'Maintenance') maintenanceCount += 1;
    else stoppedCount += 1;

    // Latest hour aggregates all parts produced in the latest logged hour slot
    const latestRec = mRecs.length > 0 ? mRecs[mRecs.length - 1] : null;
    const latestSlotRecs = latestRec
      ? mRecs.filter(
          (r) => r.date === latestRec.date && r.shift === latestRec.shift && r.hour_interval === latestRec.hour_interval
        )
      : [];
    const hourlyActual = latestSlotRecs.reduce((s, r) => s + r.actual_qty, 0);
    const hourlyTarget = latestSlotRecs.reduce((s, r) => s + r.target_qty, 0);
    const hourlyPct = hourlyTarget > 0 ? Number(((hourlyActual / hourlyTarget) * 100).toFixed(1)) : 0;

    const distinctTools = Array.from(new Set(mRecs.map((r) => r.tool_number).filter(Boolean)));

    return {
      ...m,
      machine_number: m.machine_number,
      machine_type: m.machine_type || 'NC',
      machine_group: m.machine_group || m.machine_type || 'NC',
      plant_id: m.plant_id || 'Plant 1',
      tonnage: Number(m.tonnage) || 0,
      configured_target: Number(m.production_target) || 0,
      target: mSummary.target,
      actual: mSummary.actual,
      good: mSummary.good,
      rejected: mSummary.rejected,
      downtime: mSummary.downtimeMinutes,
      problem_count: mSummary.problemCount,
      achievement_pct: mSummary.achievementPct,
      total_output_pct: mSummary.achievementPct,
      hourly_actual: hourlyActual,
      hourly_target: hourlyTarget,
      hourly_output_pct: hourlyPct,
      status,
      is_stopped: status === 'Breakdown' || status === 'Idle',
      active_downtime: activeDt,
      operator: (latestRec && latestRec.operator_name) || m.assigned_operator || '',
      tool_number: distinctTools.join(', '),
      tools_used: distinctTools,
      records_count: mRecs.length,
    };
  });

  const hourlySeries = HOUR_SLOTS.map((slot) => {
    const slotRecs = filteredRecords.filter(
      (r) => r.hour_interval === slot.label || String(r.hour_interval || '').includes(slot.key) || String(r.hour_interval || '').includes(slot.span)
    );
    const slotActual = slotRecs.reduce((s, r) => s + r.actual_qty, 0);
    const slotTarget = slotRecs.reduce((s, r) => s + r.target_qty, 0);
    const slotScrap = slotRecs.reduce((s, r) => s + r.rejected_qty, 0);
    const { totalDowntimeMinutes } = deduplicateSlotDowntime(slotRecs);
    return {
      hour: slot.key,
      shortLabel: slot.shortLabel,
      hour_interval: slot.label,
      actual: slotActual,
      target: slotTarget,
      scrap: slotScrap,
      downtime: totalDowntimeMinutes,
      partsCount: slotRecs.length,
      pct: slotTarget > 0 ? Number(((slotActual / slotTarget) * 100).toFixed(1)) : 0,
    };
  });

  // Shift Breakdown (without shift filter when analyzing day, or respecting all other filters)
  const dayRecsWithoutShift = filterProductionRecords(records, {
    plant: plantFilter,
    date: filters.date,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    shift: 'ALL',
    machineGroup: groupUpper,
    machine: filters.machine,
    tool: filters.tool,
    operator: filters.operator,
    search: filters.search,
  });

  const shiftBreakdown = SHIFTS.map((s) => {
    const sRecs = dayRecsWithoutShift.filter((r) => r.shift === s.id);
    return {
      ...s,
      ...summarizeRecordSet(sRecs),
    };
  });

  // Scrap Breakdown by Reason
  const scrapReasonMap = new Map();
  filteredRecords.forEach((r) => {
    const bd = r.scrap_breakdown || [];
    const allocated = bd.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    bd.forEach((item) => {
      const name = String(item.reason_name || '').trim() || 'Unspecified';
      scrapReasonMap.set(name, (scrapReasonMap.get(name) || 0) + (Number(item.qty) || 0));
    });
    const unallocated = Math.max(0, r.rejected_qty - allocated);
    if (unallocated > 0) {
      scrapReasonMap.set('General / Uncategorized', (scrapReasonMap.get('General / Uncategorized') || 0) + unallocated);
    }
  });
  const totalScrapAll = baseTotals.rejected || 0;
  const scrapByReason = Array.from(scrapReasonMap.entries())
    .map(([reason, qty]) => ({
      reason,
      qty,
      pct: totalScrapAll > 0 ? Number(((qty / totalScrapAll) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.qty - a.qty);

  // Downtime Analysis by Reason (deduplicated per slot)
  const dtReasonMap = new Map();
  slotDowntimes.forEach((slotVal) => {
    (slotVal.problems || []).forEach((p) => {
      const code = p.downtime_code || 'D01';
      const reason = p.downtime_reason || p.reason || 'Other Issues';
      const key = `${code}|${reason}`;
      const curr = dtReasonMap.get(key) || { code, reason, minutes: 0, count: 0 };
      curr.minutes += Number(p.duration_minutes) || 0;
      curr.count += 1;
      dtReasonMap.set(key, curr);
    });
  });
  const totalDtAll = baseTotals.downtimeMinutes || 0;
  const downtimeByReason = Array.from(dtReasonMap.values())
    .map((item) => ({
      ...item,
      pct: totalDtAll > 0 ? Number(((item.minutes / totalDtAll) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  // Tool Summary across NC and Tandem
  const toolMap = new Map();
  filteredRecords.forEach((r) => {
    const tNum = String(r.tool_number || '').trim().toUpperCase();
    if (!tNum) return;
    if (!toolMap.has(tNum)) toolMap.set(tNum, []);
    toolMap.get(tNum).push(r);
  });
  const toolSummary = Array.from(toolMap.entries())
    .map(([tool_number, tRecs]) => {
      const sum = summarizeRecordSet(tRecs);
      const ncUsed = Array.from(new Set(tRecs.filter((x) => x.production_type === 'NC').map((x) => x.machine_or_line)));
      const tandemUsed = Array.from(new Set(tRecs.filter((x) => x.production_type === 'Tandem').map((x) => x.machine_or_line)));
      return {
        tool_number,
        ...sum,
        ncMachines: ncUsed,
        tandemLines: tandemUsed,
        records: tRecs,
      };
    })
    .sort((a, b) => b.actual - a.actual);

  const activeMachinesWithRecords = machineRows.filter((m) => m.records_count > 0);
  const sortedByPerf = [...activeMachinesWithRecords].sort((a, b) => b.achievement_pct - a.achievement_pct || b.actual - a.actual);
  const topMachine = sortedByPerf.length > 0 ? sortedByPerf[0] : null;
  const bottleneckMachine = sortedByPerf.length > 1 ? sortedByPerf[sortedByPerf.length - 1] : null;

  return {
    totals: {
      ...baseTotals,
      machinesAffected: affectedMachinesSet.size,
    },
    ncTotals,
    tandemTotals,
    machineCounts: {
      total: normalizedMachines.length,
      running: runningCount,
      maintenance: maintenanceCount,
      stopped: stoppedCount,
    },
    machines: machineRows,
    hourlySeries,
    shiftBreakdown,
    scrapByReason,
    downtimeByReason,
    toolSummary,
    filteredRecords,
    topMachine,
    bottleneckMachine,
  };
}

/**
 * Groups records chronologically by (date, shift, machine_or_line, hour_interval)
 * so Production Summary can show each individual part + combined hourly total.
 */
export function groupHourlyMachineEntries(records) {
  const normalized = (records || []).map(normalizeRecord);
  const groups = new Map();

  normalized.forEach((r) => {
    const key = `${r.date}|${r.shift}|${r.machine_or_line}|${r.hour_interval}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        date: r.date,
        shift: r.shift,
        machine_or_line: r.machine_or_line,
        production_type: r.production_type,
        hour_interval: r.hour_interval,
        parts: [],
      });
    }
    groups.get(key).parts.push(r);
  });

  const result = Array.from(groups.values()).map((g) => {
    g.parts.sort((a, b) => (Number(a.part_index) || 1) - (Number(b.part_index) || 1));
    const totalActual = g.parts.reduce((s, p) => s + p.actual_qty, 0);
    const totalTarget = g.parts.reduce((s, p) => s + p.target_qty, 0);
    const totalGood = g.parts.reduce((s, p) => s + p.good_qty, 0);
    const totalScrap = g.parts.reduce((s, p) => s + p.rejected_qty, 0);
    const { totalDowntimeMinutes, totalProblems, slotDowntimes } = deduplicateSlotDowntime(g.parts);
    const slotKey = `${g.date}|${g.shift}|${g.machine_or_line}|${g.hour_interval}`;
    const slotDt = slotDowntimes.get(slotKey) || { minutes: 0, problems: [] };
    const operators = Array.from(new Set(g.parts.map((p) => p.operator_name).filter(Boolean)));
    const tools = Array.from(new Set(g.parts.map((p) => p.tool_number).filter(Boolean)));

    return {
      ...g,
      operators,
      tools,
      totalActual,
      totalTarget,
      totalGood,
      totalScrap,
      downtimeMinutes: totalDowntimeMinutes,
      problemCount: totalProblems,
      downtimeProblems: slotDt.problems,
      achievementPct: totalTarget > 0 ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : 0,
    };
  });

  return result.sort(
    (a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      String(a.shift || '').localeCompare(String(b.shift || '')) ||
      getHourSortOrder(a.hour_interval) - getHourSortOrder(b.hour_interval) ||
      String(a.machine_or_line || '').localeCompare(String(b.machine_or_line || ''))
  );
}

export function escapeCsvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildCsvDocument(columns, rows, summaryRow = null) {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(typeof c.accessor === 'function' ? c.accessor(row) : row[c.key])).join(',')
  );
  if (summaryRow) {
    dataLines.push(columns.map((c) => escapeCsvCell(summaryRow[c.key] ?? '')).join(','));
  }
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
}
