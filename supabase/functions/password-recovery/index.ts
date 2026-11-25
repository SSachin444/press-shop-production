// Supabase Edge Function: password-recovery
// Handles:
// - set-recovery-email (Admin only)
// - verify-recovery-email (Admin only)
// - request-reset (rate-limited, verified email required, short-lived single-use code, audited, generic response)
// - confirm-reset (single-use, expiry check, strong password validation, audited)
// - complete-first-login-password (enforces replacement of temporary credentials)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSixDigitCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

function isStrongPassword(pw: string): string | null {
  if (!pw || pw.length < 10) return 'Password must be at least 10 characters long.';
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'Password must include uppercase, lowercase, and numeric characters.';
  }
  return null;
}

async function sendRecoveryEmail(to: string, subject: string, textBody: string): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const fromEmail = Deno.env.get('RECOVERY_FROM_EMAIL') ?? '';
  if (!resendKey || !fromEmail) {
    return false;
  }
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      text: textBody,
    }),
  });
  return resp.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const tokenSecret = Deno.env.get('RECOVERY_TOKEN_PEPPER') ?? serviceRoleKey;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration unavailable' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  try {
    const body = await req.json();
    const action = body.action as string;

    // Actions requiring an authenticated session
    if (['set-recovery-email', 'verify-recovery-email', 'complete-password-change'].includes(action)) {
      const authHeader = req.headers.get('Authorization') ?? '';
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile } = await adminClient
        .from('user_profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single();

      if (!profile || !profile.is_active) {
        return new Response(JSON.stringify({ error: 'Account inactive' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'complete-password-change') {
        const pwErr = isStrongPassword(body.new_password);
        if (pwErr) {
          return new Response(JSON.stringify({ error: pwErr }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { error: updErr } = await adminClient.auth.admin.updateUserById(profile.id, {
          password: body.new_password,
        });
        if (updErr) throw updErr;

        await adminClient
          .from('user_profiles')
          .update({ must_change_password: false, updated_at: new Date().toISOString() })
          .eq('id', profile.id);

        await adminClient.from('recovery_audit_logs').insert({
          target_role: profile.role,
          event_type: 'PASSWORD_CHANGED',
          success: true,
          ip_address: ipAddress,
          detail: `${profile.username} updated password`,
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Admin-only recovery email actions
      if (profile.role !== 'Admin') {
        return new Response(JSON.stringify({ error: 'Admin permission required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'set-recovery-email') {
        const email = String(body.recovery_email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return new Response(JSON.stringify({ error: 'Enter a valid recovery email address.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const code = generateSixDigitCode();
        const codeHash = await sha256Hex(`${profile.id}:${email}:${code}:${tokenSecret}`);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        await adminClient
          .from('user_profiles')
          .update({
            recovery_email: email,
            recovery_email_verified: false,
            recovery_verify_code_hash: codeHash,
            recovery_verify_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        const sent = await sendRecoveryEmail(
          email,
          'PHA INDIA Press Shop — Verify Recovery Email',
          `Your verification code is: ${code}\n\nThis code expires in 15 minutes and can be used once.`
        );

        await adminClient.from('recovery_audit_logs').insert({
          target_role: 'Admin',
          email,
          event_type: 'RECOVERY_EMAIL_VERIFICATION_SENT',
          success: sent,
          ip_address: ipAddress,
          detail: sent ? 'Verification code emailed' : 'Email provider not configured',
        });

        if (!sent) {
          return new Response(
            JSON.stringify({
              error: 'Recovery email saved as pending verification, but email delivery provider is not configured on the server.',
              pending_verification: true,
            }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Verification code sent. Verify before using email recovery.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'verify-recovery-email') {
        const code = String(body.code || '').trim();
        if (!profile.recovery_email || !profile.recovery_verify_code_hash || !profile.recovery_verify_expires_at) {
          return new Response(JSON.stringify({ error: 'No pending recovery email verification found.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (new Date(profile.recovery_verify_expires_at).getTime() < Date.now()) {
          return new Response(JSON.stringify({ error: 'Verification code expired. Request a new code.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const expectedHash = await sha256Hex(`${profile.id}:${profile.recovery_email}:${code}:${tokenSecret}`);
        if (expectedHash !== profile.recovery_verify_code_hash) {
          await adminClient.from('recovery_audit_logs').insert({
            target_role: 'Admin',
            email: profile.recovery_email,
            event_type: 'RECOVERY_EMAIL_VERIFY_FAILED',
            success: false,
            ip_address: ipAddress,
          });
          return new Response(JSON.stringify({ error: 'Invalid verification code.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await adminClient
          .from('user_profiles')
          .update({
            recovery_email_verified: true,
            recovery_verify_code_hash: '',
            recovery_verify_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        await adminClient.from('recovery_audit_logs').insert({
          target_role: 'Admin',
          email: profile.recovery_email,
          event_type: 'RECOVERY_EMAIL_VERIFIED',
          success: true,
          ip_address: ipAddress,
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Public unauthenticated recovery actions (rate-limited, generic responses)
    if (action === 'request-reset') {
      const targetRole = body.role === 'Supervisor' ? 'Supervisor' : 'Admin';
      const email = String(body.email || '').trim().toLowerCase();

      // Rate limit: max 3 requests in last 15 minutes per IP or role
      const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count } = await adminClient
        .from('recovery_audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'RESET_REQUEST')
        .eq('ip_address', ipAddress)
        .gte('created_at', windowStart);

      if ((count ?? 0) >= 3) {
        return new Response(
          JSON.stringify({ error: 'Too many recovery requests. Please wait 15 minutes before trying again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generic non-enumerating success message
      const genericMsg = 'If a verified recovery email matches this account, a short-lived reset code has been sent.';

      const { data: targetProfile } = await adminClient
        .from('user_profiles')
        .select('id, role, recovery_email, recovery_email_verified, is_active')
        .eq('role', targetRole)
        .eq('is_active', true)
        .eq('recovery_email_verified', true)
        .eq('recovery_email', email)
        .maybeSingle();

      if (!targetProfile) {
        await adminClient.from('recovery_audit_logs').insert({
          target_role: targetRole,
          email,
          event_type: 'RESET_REQUEST',
          success: false,
          ip_address: ipAddress,
          detail: 'No matching verified recovery email',
        });
        return new Response(JSON.stringify({ success: true, message: genericMsg }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const code = generateSixDigitCode();
      const codeHash = await sha256Hex(`${targetProfile.id}:${code}:${tokenSecret}`);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await adminClient.from('password_recovery_tokens').insert({
        user_id: targetProfile.id,
        target_role: targetRole,
        email,
        code_hash: codeHash,
        expires_at: expiresAt,
        requested_ip: ipAddress,
      });

      const sent = await sendRecoveryEmail(
        email,
        'PHA INDIA Press Shop — Password Reset Code',
        `Your single-use password reset code is: ${code}\n\nThis code expires in 15 minutes. Never share this code.`
      );

      await adminClient.from('recovery_audit_logs').insert({
        target_role: targetRole,
        email,
        event_type: 'RESET_REQUEST',
        success: sent,
        ip_address: ipAddress,
        detail: sent ? 'Reset code emailed' : 'Email provider not configured',
      });

      return new Response(JSON.stringify({ success: true, message: genericMsg }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'confirm-reset') {
      const targetRole = body.role === 'Supervisor' ? 'Supervisor' : 'Admin';
      const email = String(body.email || '').trim().toLowerCase();
      const code = String(body.code || '').trim();
      const newPassword = String(body.new_password || '');

      const pwErr = isStrongPassword(newPassword);
      if (pwErr) {
        return new Response(JSON.stringify({ error: pwErr }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokenRow } = await adminClient
        .from('password_recovery_tokens')
        .select('*')
        .eq('target_role', targetRole)
        .eq('email', email)
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenRow || new Date(tokenRow.expires_at).getTime() < Date.now() || tokenRow.attempt_count >= 5) {
        await adminClient.from('recovery_audit_logs').insert({
          target_role: targetRole,
          email,
          event_type: 'RESET_CONFIRM',
          success: false,
          ip_address: ipAddress,
          detail: 'Token missing, expired, or max attempts exceeded',
        });
        return new Response(JSON.stringify({ error: 'Invalid or expired reset code.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const providedHash = await sha256Hex(`${tokenRow.user_id}:${code}:${tokenSecret}`);
      if (providedHash !== tokenRow.code_hash) {
        await adminClient
          .from('password_recovery_tokens')
          .update({ attempt_count: tokenRow.attempt_count + 1 })
          .eq('id', tokenRow.id);

        await adminClient.from('recovery_audit_logs').insert({
          target_role: targetRole,
          email,
          event_type: 'RESET_CONFIRM',
          success: false,
          ip_address: ipAddress,
          detail: 'Code mismatch',
        });
        return new Response(JSON.stringify({ error: 'Invalid or expired reset code.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Single-use invalidation + password update
      await adminClient
        .from('password_recovery_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenRow.id);

      const { error: updErr } = await adminClient.auth.admin.updateUserById(tokenRow.user_id, {
        password: newPassword,
      });
      if (updErr) throw updErr;

      await adminClient
        .from('user_profiles')
        .update({ must_change_password: false, updated_at: new Date().toISOString() })
        .eq('id', tokenRow.user_id);

      await adminClient.from('recovery_audit_logs').insert({
        target_role: targetRole,
        email,
        event_type: 'RESET_CONFIRM',
        success: true,
        ip_address: ipAddress,
        detail: 'Password reset completed',
      });

      return new Response(JSON.stringify({ success: true, message: 'Password has been reset. You can now sign in.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unsupported action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Recovery error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
