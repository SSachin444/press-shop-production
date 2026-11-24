// Supabase Cloud Database Client & Persistence Layer for PHA INDIA
import { createClient } from '@supabase/supabase-js';

// Default / Injected Credentials (from Vite Environment or LocalStorage)
const ENV_URL = import.meta.env.VITE_SUPABASE_URL || 'https://oyjefyeueetxboifukyr.supabase.co';
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_yd1zp9Wcufa-ZYpKv4DBbQ_wL-3xzhp';

let supabaseInstance = null;
let currentUrl = '';
let currentKey = '';

export function getSupabaseConfig() {
  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('pha_supabase_url') : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('pha_supabase_key') : '';

  let url = (storedUrl && storedUrl.trim()) || ENV_URL.trim();
  let anonKey = (storedKey && storedKey.trim()) || ENV_KEY.trim();

  // Self-healing guard: If URL was mistakenly set to vyvrzrururndbfmfmhqp with oyjefyeueetxboifukyr's publishable key
  if (url.includes('vyvrzrururndbfmfmhqp') && anonKey.startsWith('sb_publishable_yd1zp9Wcufa')) {
    url = 'https://oyjefyeueetxboifukyr.supabase.co';
    if (typeof window !== 'undefined') {
      localStorage.setItem('pha_supabase_url', url);
    }
  }

  return { url, anonKey };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(
    url &&
    anonKey &&
    url.startsWith('https://') &&
    url.includes('.supabase.co') &&
    anonKey.length > 20
  );
}

export function getSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;

  if (supabaseInstance && currentUrl === url && currentKey === anonKey) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    currentUrl = url;
    currentKey = anonKey;
    return supabaseInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export function saveSupabaseConfig(url, anonKey) {
  if (typeof window === 'undefined') return;

  if (!url || !url.trim() || !anonKey || !anonKey.trim()) {
    localStorage.removeItem('pha_supabase_url');
    localStorage.removeItem('pha_supabase_key');
    supabaseInstance = null;
    currentUrl = '';
    currentKey = '';
    return;
  }

  localStorage.setItem('pha_supabase_url', url.trim());
  localStorage.setItem('pha_supabase_key', anonKey.trim());
  supabaseInstance = null;
  return getSupabaseClient();
}

export async function testSupabaseConnection(urlToTest, keyToTest) {
  const url = urlToTest || getSupabaseConfig().url;
  const anonKey = keyToTest || getSupabaseConfig().anonKey;

  if (!url || !anonKey) {
    throw new Error('Supabase URL and Anon Key are required');
  }

  const testClient = createClient(url.trim(), anonKey.trim());
  
  // Try querying app_state or machines
  const { data, error } = await testClient
    .from('app_state')
    .select('id, updated_at')
    .limit(1);

  if (error) {
    // If app_state table doesn't exist yet, query something else or return informative error
    if (error.code === '42P01') {
      throw new Error('Connected to Supabase, but tables are not created yet! Please run supabase_schema.sql in your Supabase SQL Editor.');
    }
    throw new Error(error.message || `Supabase error (${error.code})`);
  }

  return { success: true, message: 'Connected successfully to Supabase database!' };
}

// ============================================================================
// SUPABASE DATA OPERATIONS (Fallbacks & Sync)
// ============================================================================

export async function supabaseGetAppState() {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('app_state')
      .select('state_json')
      .eq('id', 1)
      .single();

    if (error) {
      console.warn('Supabase getAppState notice:', error.message);
      return null;
    }
    return data?.state_json || null;
  } catch (e) {
    console.error('Supabase getAppState error:', e);
    return null;
  }
}

export async function supabaseSaveAppState(stateObj) {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('app_state')
      .upsert({
        id: 1,
        state_json: stateObj,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase saveAppState notice:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Supabase saveAppState error:', e);
    return false;
  }
}

// EMPLOYEES
export async function supabaseGetEmployees() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('employees').select('*').order('emp_id');
  if (error) {
    console.warn('supabaseGetEmployees error:', error.message);
    return null;
  }
  return data;
}

export async function supabaseSaveEmployee(emp) {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('employees')
    .upsert({
      emp_id: emp.emp_id,
      name: emp.name,
      department: emp.department || 'Press Shop MFG-2',
      designation: emp.designation || 'Operator',
      phone: emp.phone || '',
      email: emp.email || '',
      shift: emp.shift || 'Shift A',
      assigned_machine: emp.assigned_machine || '',
      status: emp.status || 'Active',
      updated_at: new Date().toISOString()
    }, { onConflict: 'emp_id' })
    .select();
  if (error) throw error;
  return data?.[0] || emp;
}

export async function supabaseDeleteEmployee(empId) {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('employees').delete().eq('emp_id', empId);
  if (error) throw error;
  return true;
}

// ATTENDANCE
export async function supabaseGetAttendance(date, shift) {
  const client = getSupabaseClient();
  if (!client) return null;
  let q = client.from('attendance').select('*');
  if (date) q = q.eq('date', date);
  if (shift) q = q.eq('shift', shift);
  const { data, error } = await q;
  if (error) {
    console.warn('supabaseGetAttendance error:', error.message);
    return null;
  }
  return data;
}

export async function supabaseSaveAttendance(records) {
  const client = getSupabaseClient();
  if (!client) return false;
  const rows = records.map(r => ({
    emp_id: r.emp_id,
    date: r.date,
    shift: r.shift,
    status: r.status,
    check_in_time: r.check_in_time || '',
    notes: r.notes || ''
  }));
  const { error } = await client
    .from('attendance')
    .upsert(rows, { onConflict: 'emp_id,date,shift' });
  if (error) throw error;
  return true;
}

// MACHINES
export async function supabaseGetMachines(type = '') {
  const client = getSupabaseClient();
  if (!client) return null;
  let q = client.from('machines').select('*').order('machine_number');
  if (type) q = q.eq('machine_type', type);
  const { data, error } = await q;
  if (error) return null;
  return data;
}

export async function supabaseSaveMachine(m) {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('machines')
    .upsert({
      machine_number: m.machine_number,
      machine_type: m.machine_type || 'NC',
      tonnage: Number(m.tonnage) || 0,
      production_target: Number(m.production_target) || 500,
      status: m.status || 'Idle',
      assigned_operator: m.assigned_operator || '',
      assigned_shift: m.assigned_shift || 'Shift A',
      maintenance_notes: m.maintenance_notes || ''
    }, { onConflict: 'machine_number' })
    .select();
  if (error) throw error;
  return data?.[0] || m;
}

// PRODUCTION RECORDS
export async function supabaseGetProductionRecords(params = {}) {
  const client = getSupabaseClient();
  if (!client) return null;
  let q = client.from('production_records').select('*').order('created_at', { ascending: false });
  if (params.date) q = q.eq('date', params.date);
  if (params.shift) q = q.eq('shift', params.shift);
  if (params.machine || params.machine_or_line) q = q.eq('machine_or_line', params.machine || params.machine_or_line);
  if (params.production_type) q = q.eq('production_type', params.production_type);
  const { data, error } = await q;
  if (error) return null;
  return data;
}

export async function supabaseSaveProductionRecord(record) {
  const client = getSupabaseClient();
  if (!client) return null;
  const row = {
    production_type: record.production_type || 'NC',
    machine_or_line: record.machine_or_line || record.machine || '',
    date: record.date,
    shift: record.shift,
    hour_interval: record.hour_interval || 'Shift Total',
    operator_name: record.operator_name || '',
    supervisor_name: record.supervisor_name || '',
    tool_number: record.tool_number || '',
    tonnage: Number(record.tonnage) || 0,
    target_qty: Number(record.target_qty) || 0,
    actual_qty: Number(record.actual_qty) || 0,
    good_qty: Number(record.good_qty) || 0,
    rejected_qty: Number(record.rejected_qty) || 0,
    downtime_minutes: Number(record.downtime_minutes) || 0,
    downtime_reason: record.downtime_reason || '',
    remarks: record.remarks || '',
    uph: Number(record.uph) || 0,
    production_pct: Number(record.production_pct) || 0,
    hourly_output_pct: Number(record.hourly_output_pct) || 0,
    entry_time: record.entry_time || ''
  };
  const { data, error } = await client
    .from('production_records')
    .upsert(row, { onConflict: 'machine_or_line,date,shift,hour_interval' })
    .select();
  if (error) throw error;
  return data?.[0] || row;
}

export async function supabaseDeleteProductionRecord(recordId) {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('production_records').delete().eq('id', recordId);
  if (error) throw error;
  return true;
}

export async function supabaseUpdateProductionRecord(recordId, updateData) {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('production_records').update(updateData).eq('id', recordId);
  if (error) throw error;
  return true;
}

// DOWNTIME CODES & MANAGEMENT
export async function supabaseGetDowntimeCodes() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('downtime_codes')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) return null;
  return data;
}

export async function supabaseSaveDowntimeCode(codeObj) {
  const client = getSupabaseClient();
  if (!client) return null;
  const row = {
    code: codeObj.code,
    name: codeObj.name,
    description: codeObj.description || '',
    display_order: Number(codeObj.display_order) || 1,
    is_active: codeObj.is_active !== false,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await client
    .from('downtime_codes')
    .upsert(row, { onConflict: 'code' })
    .select();
  if (error) throw error;
  return data?.[0] || row;
}

export async function supabaseGetMachineDowntime(params = {}) {
  const client = getSupabaseClient();
  if (!client) return null;
  let q = client.from('machine_downtime').select('*').order('created_at', { ascending: false });
  if (params.machine) q = q.eq('machine_number', params.machine);
  if (params.status) q = q.eq('status', params.status);
  if (params.date) q = q.eq('date', params.date);
  const { data, error } = await q;
  if (error) return null;
  return data;
}

export async function supabaseSaveMachineDowntime(dt) {
  const client = getSupabaseClient();
  if (!client) return null;
  const row = {
    machine_number: dt.machine_number,
    downtime_code: dt.downtime_code || 'D01',
    reason: dt.reason || dt.breakdown_reason || 'Machine Breakdown',
    operator_name: dt.operator_name || dt.reported_by || '',
    start_time: dt.start_time || dt.breakdown_start || new Date().toISOString(),
    end_time: dt.end_time || dt.breakdown_end || '',
    duration_minutes: Number(dt.duration_minutes || dt.total_downtime_minutes) || 0,
    date: dt.date || new Date().toISOString().split('T')[0],
    shift: dt.shift || 'Shift A',
    status: dt.status || 'Open'
  };
  const { data, error } = await client
    .from('machine_downtime')
    .insert(row)
    .select();
  if (error) throw error;
  return data?.[0] || row;
}

export async function supabaseResolveMachineDowntime(id, updateData) {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('machine_downtime')
    .update({
      status: 'Resolved',
      end_time: updateData.end_time || new Date().toISOString(),
      duration_minutes: Number(updateData.duration_minutes) || 0
    })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data?.[0] || null;
}

// HANDOVERS
export async function supabaseGetHandovers(params = {}) {
  const client = getSupabaseClient();
  if (!client) return null;
  let q = client.from('shift_handovers').select('*').order('date', { ascending: false });
  if (params.date) q = q.eq('date', params.date);
  const { data, error } = await q;
  if (error) return null;
  return data;
}

export async function supabaseSaveHandover(h) {
  const client = getSupabaseClient();
  if (!client) return null;
  const row = {
    date: h.date,
    outgoing_shift: h.outgoing_shift,
    incoming_shift: h.incoming_shift,
    department_or_machine: h.department_or_machine || 'All Shopfloor',
    handover_notes: h.handover_notes || '',
    production_status: h.production_status || '',
    pending_work: h.pending_work || '',
    machine_problems: h.machine_problems || '',
    downtime_info: h.downtime_info || '',
    quality_issues: h.quality_issues || '',
    follow_up_actions: h.follow_up_actions || '',
    responsible_person: h.responsible_person || 'Supervisor',
    completion_status: h.completion_status || 'Open'
  };
  if (h.id) row.id = h.id;
  const { data, error } = await client.from('shift_handovers').upsert(row).select();
  if (error) throw error;
  return data?.[0] || row;
}

// MACHINE PLANS
export async function supabaseGetPlans(machine = '') {
  const client = getSupabaseClient();
  if (!client) return null;
  let q = client.from('machine_plans').select('*').order('plan_index');
  if (machine) q = q.eq('machine_number', machine);
  const { data, error } = await q;
  if (error) return null;
  return data;
}

export async function supabaseSavePlan(plan) {
  const client = getSupabaseClient();
  if (!client) return null;
  const row = {
    machine_number: plan.machine_number,
    plan_index: Number(plan.plan_index) || 1,
    tool_number: plan.tool_number || '',
    plan_quantity: Number(plan.plan_quantity) || 0,
    part_name: plan.part_name || '',
    status: plan.status || 'Queued',
    target_date: plan.target_date || '',
    target_shift: plan.target_shift || '',
    remarks: plan.remarks || '',
    updated_at: new Date().toISOString()
  };
  const { data, error } = await client
    .from('machine_plans')
    .upsert(row, { onConflict: 'machine_number,plan_index' })
    .select();
  if (error) throw error;
  return data?.[0] || row;
}

// ACTIVITY LOGS
export async function supabaseGetActivityLogs() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return null;
  return data;
}

export async function supabaseLogActivity(user_name, action, record_type, details = '') {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    await client.from('activity_logs').insert({
      user_name,
      action,
      record_type,
      details
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function supabaseDeleteMachine(machineNumber) {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('machines').delete().eq('machine_number', machineNumber);
  if (error) throw error;
  return true;
}

export async function supabaseDeletePlan(planId) {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('machine_plans').delete().eq('id', planId);
  if (error) throw error;
  return true;
}

export async function supabaseUpdatePlan(planId, data) {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('machine_plans').update(data).eq('id', planId);
  if (error) throw error;
  return true;
}

// APPLICATION SETTINGS
export async function supabaseGetSettings() {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from('app_settings').select('*');
    if (error) return null;
    const settings = {};
    (data || []).forEach(row => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch (e) {
        settings[row.key] = row.value;
      }
    });
    return settings;
  } catch (err) {
    return null;
  }
}

export async function supabaseSaveSettings(key, value) {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const { error } = await client.from('app_settings').upsert({
      key,
      value: stringVal
    }, { onConflict: 'key' });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('supabaseSaveSettings error:', err.message);
    return false;
  }
}

// REALTIME MULTI-DEVICE BROADCAST LISTENER
export function subscribeToCloudChanges(callback) {
  const client = getSupabaseClient();
  if (!client) return () => {};

  try {
    const channel = client
      .channel('pha_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'production_records' },
        (p) => callback && callback('production_records', p)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        (p) => callback && callback('attendance', p)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        (p) => callback && callback('employees', p)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines' },
        (p) => callback && callback('machines', p)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machine_downtime' },
        (p) => callback && callback('machine_downtime', p)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machine_plans' },
        (p) => callback && callback('machine_plans', p)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_handovers' },
        (p) => callback && callback('shift_handovers', p)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_state' },
        (p) => callback && callback('app_state', p)
      )
      .subscribe();

    return () => {
      try {
        client.removeChannel(channel);
      } catch (e) {}
    };
  } catch (err) {
    console.warn('Realtime subscription notice:', err);
    return () => {};
  }
}
