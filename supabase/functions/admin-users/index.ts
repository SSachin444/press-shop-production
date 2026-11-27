// Supabase Edge Function: admin-users
// Admin-only user, username/role, and account management endpoint.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration unavailable' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: caller } = await adminClient
      .from('user_profiles')
      .select('id, username, role, is_active')
      .eq('id', userData.user.id)
      .single();

    if (!caller || caller.role !== 'Admin' || !caller.is_active) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const action = String(body.action || 'list');

    if (action === 'list') {
      const { data: users, error } = await adminClient
        .from('user_profiles')
        .select('id, username, auth_email, full_name, role, department, recovery_email, recovery_email_verified, must_change_password, is_active, last_login_at, created_at')
        .order('role')
        .order('username');
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, users }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create') {
      const username = String(body.username || '').trim().toLowerCase();
      const fullName = String(body.full_name || '').trim();
      const role = body.role === 'Admin' ? 'Admin' : 'Supervisor';
      const email = String(body.email || `${username}@phaindia.internal`).trim().toLowerCase();
      const tempPassword = String(body.temp_password || body.password || '');

      if (!USERNAME_RE.test(username)) {
        return new Response(JSON.stringify({ error: 'Username must be 3-32 characters (letters, numbers, ., _, -).' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!fullName || tempPassword.length < 10) {
        return new Response(JSON.stringify({ error: 'Full name and temporary password (min 10 chars) are required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: dupUser } = await adminClient
        .from('user_profiles')
        .select('id')
        .ilike('username', username)
        .maybeSingle();
      if (dupUser) {
        return new Response(JSON.stringify({ error: `User ID "${username}" is already taken.` }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: { role },
        user_metadata: { username, full_name: fullName },
      });
      if (createErr || !created.user) throw createErr;

      const { error: profErr } = await adminClient.from('user_profiles').insert({
        id: created.user.id,
        username,
        auth_email: email,
        full_name: fullName,
        role,
        department: String(body.department || 'Press Shop MFG-2'),
        must_change_password: true,
        is_active: true,
      });
      if (profErr) throw profErr;

      await adminClient.from('activity_logs').insert({
        user_name: caller.username,
        actor_role: 'Admin',
        action: 'CREATE',
        record_type: 'User',
        record_id: username,
        details: `Created ${role} user ${username} (temporary password requires first-login change)`,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update-user' && body.user_id) {
      const targetId = String(body.user_id);
      const { data: existing } = await adminClient
        .from('user_profiles')
        .select('*')
        .eq('id', targetId)
        .single();
      if (!existing) {
        return new Response(JSON.stringify({ error: 'Target user not found.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const nextUsername = body.username ? String(body.username).trim().toLowerCase() : existing.username;
      if (!USERNAME_RE.test(nextUsername)) {
        return new Response(JSON.stringify({ error: 'User ID must be 3-32 characters (letters, numbers, ., _, -).' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (nextUsername !== existing.username) {
        const { data: dup } = await adminClient
          .from('user_profiles')
          .select('id')
          .ilike('username', nextUsername)
          .neq('id', targetId)
          .maybeSingle();
        if (dup) {
          return new Response(JSON.stringify({ error: `User ID "${nextUsername}" is already in use.` }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const nextFullName = body.full_name !== undefined ? String(body.full_name).trim() : existing.full_name;
      const nextRole = targetId === caller.id ? existing.role : body.role === 'Admin' ? 'Admin' : body.role === 'Supervisor' ? 'Supervisor' : existing.role;
      const newPassword = body.new_password ? String(body.new_password) : '';

      const authUpdate: Record<string, unknown> = {
        app_metadata: { role: nextRole },
        user_metadata: { username: nextUsername, full_name: nextFullName },
      };
      if (newPassword) {
        if (newPassword.length < 10) {
          return new Response(JSON.stringify({ error: 'Password must be at least 10 characters.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        authUpdate.password = newPassword;
      }

      const { error: authErr } = await adminClient.auth.admin.updateUserById(targetId, authUpdate);
      if (authErr) throw authErr;

      const { error: profErr } = await adminClient
        .from('user_profiles')
        .update({
          username: nextUsername,
          full_name: nextFullName,
          role: nextRole,
          must_change_password: newPassword ? Boolean(body.must_change_password ?? true) : existing.must_change_password,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);
      if (profErr) throw profErr;

      await adminClient.from('activity_logs').insert({
        user_name: caller.username,
        actor_role: 'Admin',
        action: 'UPDATE',
        record_type: 'User',
        record_id: nextUsername,
        details: `Updated user ${existing.username} -> ${nextUsername} (${nextRole})${newPassword ? ' + password reset' : ''}`,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'toggle-active' && body.user_id) {
      if (body.user_id === caller.id) {
        return new Response(JSON.stringify({ error: 'You cannot deactivate your own active Admin account.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const nextActive = Boolean(body.is_active);
      const { error } = await adminClient
        .from('user_profiles')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', body.user_id);
      if (error) throw error;

      await adminClient.from('activity_logs').insert({
        user_name: caller.username,
        actor_role: 'Admin',
        action: 'UPDATE',
        record_type: 'User',
        record_id: String(body.user_id),
        details: `Set active status to ${nextActive}`,
      });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unsupported action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'User management error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
