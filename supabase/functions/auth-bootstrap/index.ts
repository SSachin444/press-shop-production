// Supabase Edge Function: auth-bootstrap
// Provisions initial Admin and Supervisor accounts securely from server-side secrets.
// NEVER hardcodes passwords in source or client bundles.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bootstrap-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const bootstrapSecret = Deno.env.get('BOOTSTRAP_SETUP_SECRET') ?? '';
    const adminInitialPassword = Deno.env.get('ADMIN_INITIAL_PASSWORD') ?? '';
    const supervisorInitialPassword = Deno.env.get('SUPERVISOR_INITIAL_PASSWORD') ?? '';

    if (!supabaseUrl || !serviceRoleKey || !bootstrapSecret) {
      return new Response(
        JSON.stringify({ error: 'Server setup environment secrets are missing.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const providedSecret = req.headers.get('x-bootstrap-secret') ?? '';
    if (!providedSecret || providedSecret !== bootstrapSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized setup request.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!adminInitialPassword || !supervisorInitialPassword) {
      return new Response(
        JSON.stringify({ error: 'ADMIN_INITIAL_PASSWORD and SUPERVISOR_INITIAL_PASSWORD secrets must be configured.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));

    const accounts = [
      {
        email: body.admin_email || 'admin@phaindia.internal',
        username: 'admin',
        full_name: 'Plant Administrator',
        role: 'Admin',
        password: adminInitialPassword,
      },
      {
        email: body.supervisor_email || 'supervisor@phaindia.internal',
        username: 'supervisor',
        full_name: 'Shift Supervisor',
        role: 'Supervisor',
        password: supervisorInitialPassword,
      },
    ];

    const results = [];
    for (const acc of accounts) {
      const { data: existingProfile } = await adminClient
        .from('user_profiles')
        .select('id')
        .eq('username', acc.username)
        .maybeSingle();

      if (existingProfile) {
        results.push({ username: acc.username, status: 'already_provisioned' });
        continue;
      }

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        app_metadata: { role: acc.role },
        user_metadata: { username: acc.username, full_name: acc.full_name },
      });

      if (createErr || !created.user) {
        throw new Error(`Failed creating ${acc.username}: ${createErr?.message || 'unknown error'}`);
      }

      const { error: profErr } = await adminClient.from('user_profiles').insert({
        id: created.user.id,
        username: acc.username,
        full_name: acc.full_name,
        role: acc.role,
        department: acc.role === 'Admin' ? 'Plant Management' : 'Press Shop MFG-2',
        must_change_password: true,
        is_active: true,
      });

      if (profErr) throw profErr;

      await adminClient.from('recovery_audit_logs').insert({
        target_role: acc.role,
        event_type: 'BOOTSTRAP_TEMP_ACCOUNT',
        success: true,
        detail: `Provisioned temporary ${acc.role} account requiring initial password replacement`,
      });

      results.push({ username: acc.username, status: 'provisioned_temporary' });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Setup failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
