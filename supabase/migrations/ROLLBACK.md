# Supabase Migrations & Rollback Guide

## Applied Order (Non-Production Staging First!)
1. `202611250001_security_roles_and_auth.sql` — Creates `user_profiles`, `password_recovery_tokens`, `recovery_audit_logs`, and server-enforced SQL role helper functions.
2. `202611250002_versioning_idempotency_audit.sql` — Adds additive columns (`plant_id`, `machine_group`, `version`, `updated_at`, `updated_by` on `machines`; `client_submission_id`, `submitted_by_role`, `downtime_code` on `production_records`), idempotent `submit_production_entry`, and version-checked `update_machine_config` with automatic audit triggers.
3. `202611250003_rls_policies.sql` — Creates `employees_operational_roster` view and enforces strict role-based RLS across all tables.

All migrations are **additive** and **preserve all existing production rows**.

## Safe Rollback Procedure

If rollback is required after applying migrations:

### Rollback Step 3 (`202611250003_rls_policies.sql`)
```sql
drop view if exists public.employees_operational_roster;
-- Re-evaluate temporary policies only if emergency fallback is required:
-- NOTE: Do not leave tables unprotected in production. Restore prior policy snapshots from pg_policies backup.
```

### Rollback Step 2 (`202611250002_versioning_idempotency_audit.sql`)
```sql
drop trigger if exists trg_machines_audit_version on public.machines;
drop function if exists public.handle_machine_config_update();
drop function if exists public.update_machine_config(bigint,integer,text,text,numeric,integer,text,text,text,text);
drop function if exists public.submit_production_entry(text,text,text,text,text,text,text,text,text,numeric,integer,integer,integer,integer,text,text,text,text);
drop index if exists public.idx_production_client_submission_id;
-- Additive columns (plant_id, machine_group, version, client_submission_id, etc.) are harmless and backward-compatible; drop only if strictly required.
```

### Rollback Step 1 (`202611250001_security_roles_and_auth.sql`)
```sql
drop function if exists public.is_operator_or_above();
drop function if exists public.is_supervisor_or_admin();
drop function if exists public.is_admin();
drop function if exists public.current_app_role();
drop table if exists public.recovery_audit_logs;
drop table if exists public.password_recovery_tokens;
drop table if exists public.user_profiles;
```
