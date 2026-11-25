-- ============================================================================
-- Migration 003: Strict Role-Based Row Level Security (RLS) & Operational Views
-- Replaces permissive `using (true)` policies with least-privilege role enforcement.
-- ============================================================================

-- 1. Operational employee roster view (NO personal phone/email/salary PII)
create or replace view public.employees_operational_roster as
select
    id,
    emp_id,
    name,
    department,
    designation,
    shift,
    assigned_machine,
    status,
    plant_id
from public.employees
where status = 'Active';

grant select on public.employees_operational_roster to anon, authenticated;

-- 2. Drop all legacy permissive policies
drop policy if exists "Allow anon full access to app_state" on public.app_state;
drop policy if exists "Allow anon full access to employees" on public.employees;
drop policy if exists "Allow anon full access to attendance" on public.attendance;
drop policy if exists "Allow anon full access to overtime" on public.overtime;
drop policy if exists "Allow anon full access to machines" on public.machines;
drop policy if exists "Allow anon full access to production_records" on public.production_records;
drop policy if exists "Allow anon full access to shift_handovers" on public.shift_handovers;
drop policy if exists "Allow anon full access to machine_plans" on public.machine_plans;
drop policy if exists "Allow anon full access to machine_downtime" on public.machine_downtime;
drop policy if exists "Allow anon full access to activity_logs" on public.activity_logs;
drop policy if exists "Allow anon full access to app_settings" on public.app_settings;
drop policy if exists "Allow anon full access to downtime_codes" on public.downtime_codes;

-- Enable RLS on all tables (including new auth/recovery tables)
alter table public.user_profiles enable row level security;
alter table public.password_recovery_tokens enable row level security;
alter table public.recovery_audit_logs enable row level security;

-- Revoke blanket write privileges from anon; keep explicit RLS policies in control
revoke all on all tables in schema public from anon;
grant select on public.machines, public.production_records, public.machine_downtime, public.machine_plans, public.downtime_codes, public.app_settings to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.submit_production_entry(text,text,text,text,text,text,text,text,text,numeric,integer,integer,integer,integer,text,text,text,text) to authenticated;
grant execute on function public.update_machine_config(bigint,integer,text,text,numeric,integer,text,text,text,text) to authenticated;

-- 3. MACHINES: All roles (including read-only Dashboard) can SELECT; ONLY Admin can INSERT/UPDATE/DELETE
create policy "machines_select_all" on public.machines
    for select using (true);
create policy "machines_admin_insert" on public.machines
    for insert with check (public.is_admin());
create policy "machines_admin_update" on public.machines
    for update using (public.is_admin()) with check (public.is_admin());
create policy "machines_admin_delete" on public.machines
    for delete using (public.is_admin());

-- 4. PRODUCTION RECORDS: All roles can SELECT for live status; Operator/Supervisor/Admin can INSERT/UPDATE; ONLY Admin can DELETE
create policy "production_select_all" on public.production_records
    for select using (true);
create policy "production_write_operator_plus" on public.production_records
    for insert with check (public.is_operator_or_above());
create policy "production_update_operator_plus" on public.production_records
    for update using (public.is_operator_or_above()) with check (public.is_operator_or_above());
create policy "production_delete_admin_only" on public.production_records
    for delete using (public.is_admin());

-- 5. MACHINE DOWNTIME: All roles can SELECT; Operator/Supervisor/Admin can log/resolve downtime; ONLY Admin can delete
create policy "downtime_select_all" on public.machine_downtime
    for select using (true);
create policy "downtime_insert_operator_plus" on public.machine_downtime
    for insert with check (public.is_operator_or_above());
create policy "downtime_update_operator_plus" on public.machine_downtime
    for update using (public.is_operator_or_above()) with check (public.is_operator_or_above());
create policy "downtime_delete_admin_only" on public.machine_downtime
    for delete using (public.is_admin());

-- 6. DOWNTIME CODES: Read by all, write ONLY Admin
create policy "dt_codes_select_all" on public.downtime_codes
    for select using (true);
create policy "dt_codes_admin_write" on public.downtime_codes
    for all using (public.is_admin()) with check (public.is_admin());

-- 7. MACHINE PLANS: Read by all; write by Supervisor or Admin
create policy "plans_select_all" on public.machine_plans
    for select using (true);
create policy "plans_supervisor_plus_write" on public.machine_plans
    for all using (public.is_supervisor_or_admin()) with check (public.is_supervisor_or_admin());

-- 8. EMPLOYEES: Full table restricted to Admin & Supervisor (Operational roster view used for general selection; PII/salary excluded in app queries for Supervisor)
create policy "employees_supervisor_select" on public.employees
    for select using (public.is_supervisor_or_admin());
create policy "employees_admin_write" on public.employees
    for all using (public.is_admin()) with check (public.is_admin());

-- 9. ATTENDANCE & OVERTIME: Supervisor & Admin only (Operator & Dashboard denied!)
create policy "attendance_supervisor_plus" on public.attendance
    for all using (public.is_supervisor_or_admin()) with check (public.is_supervisor_or_admin());
create policy "overtime_supervisor_plus" on public.overtime
    for all using (public.is_supervisor_or_admin()) with check (public.is_supervisor_or_admin());

-- 10. SHIFT HANDOVERS: Supervisor & Admin only
create policy "handovers_supervisor_plus" on public.shift_handovers
    for all using (public.is_supervisor_or_admin()) with check (public.is_supervisor_or_admin());

-- 11. APP SETTINGS: Public read ONLY for non-sensitive operational keys; write ONLY Admin
create policy "settings_public_operational_read" on public.app_settings
    for select using (key in ('company_name', 'plant_location', 'shift_a_start', 'shift_a_end', 'shift_b_start', 'shift_b_end', 'shift_c_start', 'shift_c_end', 'hours_per_shift', 'target_efficiency_threshold'));
create policy "settings_admin_all" on public.app_settings
    for all using (public.is_admin()) with check (public.is_admin());

-- 12. ACTIVITY LOGS: Read ONLY Admin; append allowed by Supervisor/Admin (and triggers)
create policy "activity_logs_admin_select" on public.activity_logs
    for select using (public.is_admin());
create policy "activity_logs_insert_auth" on public.activity_logs
    for insert with check (public.is_supervisor_or_admin());

-- 13. APP_STATE (legacy sync blob): Admin only to prevent unauthenticated overwrite
create policy "app_state_admin_only" on public.app_state
    for all using (public.is_admin()) with check (public.is_admin());

-- 14. USER PROFILES & RECOVERY LOGS: Users can view own profile; Admin manages all; recovery tokens service-role only
create policy "profiles_self_or_admin_select" on public.user_profiles
    for select using (auth.uid() = id or public.is_admin());
create policy "profiles_admin_write" on public.user_profiles
    for all using (public.is_admin()) with check (public.is_admin());

-- No client policies on password_recovery_tokens (Edge Functions use service_role only)
create policy "recovery_audit_admin_select" on public.recovery_audit_logs
    for select using (public.is_admin());
