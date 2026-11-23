// Supabase Cloud Database Client & Persistence Layer for PHA INDIA
import { createClient } from '@supabase/supabase-js';

// Default / Injected Credentials (from Vite Environment or LocalStorage)
const ENV_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance = null;
let currentUrl = '';
let currentKey = '';

export function getSupabaseConfig() {
  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('pha_supabase_url') : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('pha_supabase_key') : '';

  const url = (storedUrl && storedUrl.trim()) || ENV_URL.trim();
  const anonKey = (storedKey && storedKey.trim()) || ENV_KEY.trim();

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
    remarks: record.remarks || ''
  };
  const { data, error } = await client
    .from('production_records')
    .upsert(row, { onConflict: 'machine_or_line,date,shift,hour_interval' })
    .select();
  if (error) throw error;
  return data?.[0] || row;
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
