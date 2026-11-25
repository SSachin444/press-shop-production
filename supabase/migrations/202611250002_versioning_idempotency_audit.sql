-- ============================================================================
-- Migration 002: Optimistic Versioning, Idempotency Keys, and Audit Trail
-- Backward-compatible & additive. Safe for existing production records.
-- ============================================================================

-- 1. Add plant_id, machine_group, optimistic version, updated_at/by on machines
alter table public.machines add column if not exists plant_id text not null default 'Plant 1';
alter table public.machines add column if not exists machine_group text not null default 'NC';
alter table public.machines add column if not exists version integer not null default 1;
alter table public.machines add column if not exists updated_at timestamp with time zone not null default timezone('utc'::text, now());
alter table public.machines add column if not exists updated_by text default '';

update public.machines
set machine_group = case when machine_type = 'Tandem' then 'Tandem' else 'NC' end
where machine_group is null or machine_group = '';

-- 2. Add plant_id, client_submission_id idempotency, submitted_by_role, updated_at on production_records
alter table public.production_records add column if not exists plant_id text not null default 'Plant 1';
alter table public.production_records add column if not exists client_submission_id text;
alter table public.production_records add column if not exists submitted_by_role text default '';
alter table public.production_records add column if not exists downtime_code text default 'D01';
alter table public.production_records add column if not exists updated_at timestamp with time zone not null default timezone('utc'::text, now());

create unique index if not exists idx_production_client_submission_id
    on public.production_records(client_submission_id)
    where client_submission_id is not null;

-- 3. Add plant_id on employees and audit columns on activity_logs
alter table public.employees add column if not exists plant_id text not null default 'Plant 1';
alter table public.activity_logs add column if not exists record_id text default '';
alter table public.activity_logs add column if not exists actor_role text default '';
alter table public.activity_logs add column if not exists old_value jsonb;
alter table public.activity_logs add column if not exists new_value jsonb;

-- 4. Automatic Machine Configuration Audit Trigger + Version Increment
create or replace function public.handle_machine_config_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  actor_role_val text;
begin
  actor_role_val := public.current_app_role();
  select coalesce(up.full_name, up.username, actor_role_val)
  into actor_name
  from public.user_profiles up
  where up.id = auth.uid()
  limit 1;

  if actor_name is null then
    actor_name := actor_role_val;
  end if;

  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := timezone('utc'::text, now());
    new.updated_by := actor_name;

    if (old.machine_number is distinct from new.machine_number)
       or (old.machine_type is distinct from new.machine_type)
       or (old.machine_group is distinct from new.machine_group)
       or (old.tonnage is distinct from new.tonnage)
       or (old.production_target is distinct from new.production_target)
       or (old.status is distinct from new.status)
       or (old.assigned_operator is distinct from new.assigned_operator)
       or (old.maintenance_notes is distinct from new.maintenance_notes) then
      insert into public.activity_logs (user_name, actor_role, action, record_type, record_id, details, old_value, new_value)
      values (
        actor_name,
        actor_role_val,
        'UPDATE',
        'Machine',
        new.machine_number,
        format('Updated machine %s configuration (v%s -> v%s)', new.machine_number, old.version, new.version),
        to_jsonb(old),
        to_jsonb(new)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_machines_audit_version on public.machines;
create trigger trg_machines_audit_version
before update on public.machines
for each row execute function public.handle_machine_config_update();

-- 5. Safe Admin RPC for Optimistic Concurrency Machine Configuration Updates
create or replace function public.update_machine_config(
  p_id bigint,
  p_expected_version integer,
  p_machine_number text,
  p_machine_type text,
  p_tonnage numeric,
  p_production_target integer,
  p_status text,
  p_assigned_operator text,
  p_assigned_shift text,
  p_maintenance_notes text
)
returns public.machines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.machines;
begin
  if not public.is_admin() then
    raise exception 'Permission denied: only Admin can modify machine configuration' using errcode = '42501';
  end if;

  if p_tonnage < 0 or p_tonnage > 20000 then
    raise exception 'Validation error: tonnage must be between 0 and 20000' using errcode = '22023';
  end if;

  if p_production_target < 0 or p_production_target > 100000 then
    raise exception 'Validation error: production target must be between 0 and 100000' using errcode = '22023';
  end if;

  update public.machines
  set machine_number = trim(p_machine_number),
      machine_type = p_machine_type,
      machine_group = p_machine_type,
      tonnage = p_tonnage,
      production_target = p_production_target,
      status = p_status,
      assigned_operator = coalesce(p_assigned_operator, ''),
      assigned_shift = coalesce(p_assigned_shift, 'Shift A'),
      maintenance_notes = coalesce(p_maintenance_notes, '')
  where id = p_id
    and version = p_expected_version
  returning * into v_row;

  if not found then
    raise exception 'Conflict: machine record was modified by another user or does not exist. Reload and review before saving.' using errcode = '40001';
  end if;

  return v_row;
end;
$$;

-- 6. Safe Idempotent Production Entry RPC (Operator, Supervisor, Admin)
create or replace function public.submit_production_entry(
  p_client_submission_id text,
  p_plant_id text,
  p_production_type text,
  p_machine_or_line text,
  p_date text,
  p_shift text,
  p_hour_interval text,
  p_operator_name text,
  p_tool_number text,
  p_uph numeric,
  p_target_qty integer,
  p_actual_qty integer,
  p_rejected_qty integer,
  p_downtime_minutes integer,
  p_downtime_code text,
  p_downtime_reason text,
  p_remarks text,
  p_entry_time text
)
returns public.production_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_existing public.production_records;
  v_saved public.production_records;
  v_good integer;
  v_pct numeric;
begin
  v_role := public.current_app_role();
  if v_role not in ('Admin', 'Supervisor', 'Operator') then
    raise exception 'Permission denied: read-only sessions cannot submit production entries' using errcode = '42501';
  end if;

  if p_actual_qty < 0 or p_actual_qty > 100000 then
    raise exception 'Validation error: actual_qty out of range' using errcode = '22023';
  end if;
  if p_rejected_qty < 0 or p_rejected_qty > p_actual_qty then
    raise exception 'Validation error: rejected_qty cannot exceed actual_qty' using errcode = '22023';
  end if;
  if p_downtime_minutes < 0 or p_downtime_minutes > 480 then
    raise exception 'Validation error: downtime_minutes out of range' using errcode = '22023';
  end if;

  -- Check idempotency key first so retries never create duplicates
  if p_client_submission_id is not null and trim(p_client_submission_id) <> '' then
    select * into v_existing
    from public.production_records
    where client_submission_id = trim(p_client_submission_id)
    limit 1;
    if found then
      return v_existing;
    end if;
  end if;

  v_good := greatest(0, p_actual_qty - p_rejected_qty);
  v_pct := case when p_target_qty > 0 then round((p_actual_qty::numeric / p_target_qty::numeric) * 100, 1) else 0 end;

  insert into public.production_records (
    plant_id, production_type, machine_or_line, date, shift, hour_interval,
    operator_name, tool_number, uph, target_qty, actual_qty, good_qty, rejected_qty,
    downtime_minutes, downtime_code, downtime_reason, remarks,
    production_pct, hourly_output_pct, entry_time, client_submission_id, submitted_by_role, updated_at
  ) values (
    coalesce(nullif(trim(p_plant_id), ''), 'Plant 1'),
    p_production_type,
    upper(trim(p_machine_or_line)),
    p_date,
    p_shift,
    p_hour_interval,
    coalesce(p_operator_name, ''),
    coalesce(p_tool_number, ''),
    coalesce(p_uph, 0),
    p_target_qty,
    p_actual_qty,
    v_good,
    p_rejected_qty,
    p_downtime_minutes,
    coalesce(p_downtime_code, 'D01'),
    coalesce(p_downtime_reason, ''),
    coalesce(p_remarks, ''),
    v_pct,
    v_pct,
    coalesce(p_entry_time, ''),
    nullif(trim(coalesce(p_client_submission_id, '')), ''),
    v_role,
    timezone('utc'::text, now())
  )
  on conflict (machine_or_line, date, shift, hour_interval) do update set
    plant_id = excluded.plant_id,
    production_type = excluded.production_type,
    operator_name = excluded.operator_name,
    tool_number = excluded.tool_number,
    uph = excluded.uph,
    target_qty = excluded.target_qty,
    actual_qty = excluded.actual_qty,
    good_qty = excluded.good_qty,
    rejected_qty = excluded.rejected_qty,
    downtime_minutes = excluded.downtime_minutes,
    downtime_code = excluded.downtime_code,
    downtime_reason = excluded.downtime_reason,
    remarks = excluded.remarks,
    production_pct = excluded.production_pct,
    hourly_output_pct = excluded.hourly_output_pct,
    entry_time = excluded.entry_time,
    client_submission_id = coalesce(excluded.client_submission_id, public.production_records.client_submission_id),
    submitted_by_role = excluded.submitted_by_role,
    updated_at = timezone('utc'::text, now())
  returning * into v_saved;

  return v_saved;
end;
$$;
