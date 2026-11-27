-- ============================================================================
-- Migration: 202611270001_account_management_and_whatsapp.sql
-- PHA INDIA PRIVATE LIMITED - Account Management (Username/Password) & WhatsApp Reports
-- Additive, idempotent, zero-data-loss migration.
-- ============================================================================

-- 1. Ensure user_profiles supports decoupled username + auth_email safely
alter table if exists public.user_profiles
    add column if not exists auth_email text default '';

create unique index if not exists idx_user_profiles_username_lower
    on public.user_profiles(lower(username));

-- Backfill auth_email from auth.users when empty
update public.user_profiles up
set auth_email = lower(au.email)
from auth.users au
where up.id = au.id
  and (up.auth_email is null or up.auth_email = '')
  and au.email is not null;

-- Prevent non-Admin users from escalating their own role, active flag, or auth_email via self-update
create or replace function public.protect_user_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.auth_email is distinct from old.auth_email then
      raise exception 'Permission denied: cannot modify role, activation status, or account identity.' using errcode = '42501';
    end if;
  end if;
  new.username := lower(trim(new.username));
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_protect_user_profile_self_update on public.user_profiles;
create trigger trg_protect_user_profile_self_update
before update on public.user_profiles
for each row execute function public.protect_user_profile_self_update();

drop policy if exists "profiles_self_update" on public.user_profiles;
create policy "profiles_self_update" on public.user_profiles
    for update using (auth.uid() = id)
    with check (auth.uid() = id);

-- Safe login identifier resolver (allows login by changed username OR email without exposing profiles)
create or replace function public.resolve_login_email(
  p_identifier text,
  p_role text default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_clean text := lower(trim(coalesce(p_identifier, '')));
  v_email text;
begin
  if v_clean = '' then
    return null;
  end if;
  if position('@' in v_clean) > 0 then
    return v_clean;
  end if;

  select coalesce(nullif(lower(trim(up.auth_email)), ''), lower(trim(au.email)))
  into v_email
  from public.user_profiles up
  left join auth.users au on au.id = up.id
  where lower(up.username) = v_clean
    and up.is_active = true
    and (p_role is null or p_role = '' or up.role = p_role)
  limit 1;

  return v_email;
end;
$$;

grant execute on function public.resolve_login_email(text, text) to anon, authenticated;

-- Safe RPC for authenticated user to change their own username/user ID
create or replace function public.change_own_username(
  p_new_username text
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new text := lower(trim(coalesce(p_new_username, '')));
  v_old_profile public.user_profiles;
  v_updated public.user_profiles;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if v_new !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then
    raise exception 'User ID must be 3-32 characters using letters, numbers, dots, underscores, or hyphens.' using errcode = '22023';
  end if;

  select * into v_old_profile
  from public.user_profiles
  where id = v_uid
    and is_active = true
  limit 1;

  if not found then
    raise exception 'Active user profile not found.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.user_profiles up
    where lower(up.username) = v_new
      and up.id <> v_uid
  ) then
    raise exception 'Username "%" is already in use. Choose another User ID.', v_new using errcode = '23505';
  end if;

  update public.user_profiles
  set username = v_new,
      updated_at = timezone('utc'::text, now())
  where id = v_uid
  returning * into v_updated;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', v_new)
  where id = v_uid;

  insert into public.recovery_audit_logs (target_role, email, event_type, success, detail)
  values (
    v_old_profile.role,
    coalesce(v_old_profile.auth_email, ''),
    'USERNAME_CHANGED',
    true,
    format('Changed user ID from %s to %s', v_old_profile.username, v_new)
  );

  insert into public.activity_logs (user_name, actor_role, action, record_type, record_id, details)
  values (
    v_new,
    v_old_profile.role,
    'UPDATE',
    'Account',
    v_uid::text,
    format('Updated User ID from %s to %s', v_old_profile.username, v_new)
  );

  return v_updated;
end;
$$;

grant execute on function public.change_own_username(text) to authenticated;

-- 2. WHATSAPP RECIPIENTS (MAX 5 AUTHORIZED RECIPIENTS, ADMIN & SUPERVISOR ONLY)
create table if not exists public.whatsapp_recipients (
    id bigint generated by default as identity primary key,
    name text not null,
    phone_number text unique not null,
    is_active boolean not null default true,
    created_by text default '',
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_whatsapp_recipients_phone on public.whatsapp_recipients(phone_number);

-- 3. WHATSAPP REPORT DISPATCH HISTORY
create table if not exists public.whatsapp_reports_log (
    id bigint generated by default as identity primary key,
    client_send_id text unique,
    report_type text not null,
    report_title text default '',
    filters_json jsonb not null default '{}'::jsonb,
    message_preview text not null default '',
    recipients_json jsonb not null default '[]'::jsonb,
    delivery_mode text not null default 'cloud-api',
    overall_status text not null default 'pending',
    sent_by text default '',
    sent_by_role text default '',
    created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_whatsapp_reports_log_created on public.whatsapp_reports_log(created_at desc);

alter table public.whatsapp_recipients enable row level security;
alter table public.whatsapp_reports_log enable row level security;

drop policy if exists "whatsapp_recipients_supervisor_plus" on public.whatsapp_recipients;
drop policy if exists "whatsapp_reports_log_supervisor_plus" on public.whatsapp_reports_log;

create policy "whatsapp_recipients_supervisor_plus" on public.whatsapp_recipients
    for all using (public.is_supervisor_or_admin())
    with check (public.is_supervisor_or_admin());

create policy "whatsapp_reports_log_supervisor_plus" on public.whatsapp_reports_log
    for all using (public.is_supervisor_or_admin())
    with check (public.is_supervisor_or_admin());

grant select, insert, update, delete on public.whatsapp_recipients to authenticated;
grant select, insert, update, delete on public.whatsapp_reports_log to authenticated;
grant usage, select on all sequences in schema public to authenticated;

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        begin
            alter publication supabase_realtime add table public.whatsapp_recipients;
        exception when duplicate_object then null;
        end;
        begin
            alter publication supabase_realtime add table public.whatsapp_reports_log;
        exception when duplicate_object then null;
        end;
    end if;
end $$;
