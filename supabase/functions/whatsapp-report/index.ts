// Supabase Edge Function: whatsapp-report
// Sends production & downtime reports securely via Meta WhatsApp Business Platform Cloud API.
// Secrets configured via Supabase Edge Function Secrets:
//   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION, WHATSAPP_TEMPLATE_NAME

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeWhatsAppPhone(raw: string): string | null {
  const cleaned = String(raw || '').replace(/[\s\-()]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(cleaned) ? cleaned : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const token = (Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '').trim();
  const phoneNumberId = (Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '').trim();
  const apiVersion = (Deno.env.get('WHATSAPP_API_VERSION') ?? 'v21.0').trim();
  const templateName = (Deno.env.get('WHATSAPP_TEMPLATE_NAME') ?? '').trim();
  const templateLang = (Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'en').trim();

  if (req.method === 'GET') {
    const missing = [];
    if (!token) missing.push('WHATSAPP_ACCESS_TOKEN');
    if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
    return new Response(
      JSON.stringify({
        configured: Boolean(token && phoneNumberId),
        provider: 'Meta WhatsApp Business Platform Cloud API (Supabase Edge)',
        apiVersion,
        hasTemplateConfigured: Boolean(templateName),
        missingEnvVars: missing,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const action = String(body.action || 'send');
    if (action === 'status') {
      const missing = [];
      if (!token) missing.push('WHATSAPP_ACCESS_TOKEN');
      if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
      return new Response(
        JSON.stringify({
          configured: Boolean(token && phoneNumberId),
          provider: 'Meta WhatsApp Business Platform Cloud API',
          apiVersion,
          hasTemplateConfigured: Boolean(templateName),
          missingEnvVars: missing,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recipients = Array.isArray(body.recipients) ? body.recipients.slice(0, 5) : [];
    const messageText = String(body.message || '').trim();
    const clientSendId = String(body.client_send_id || '').trim();

    if (recipients.length === 0 || !messageText) {
      return new Response(JSON.stringify({ error: 'Recipients and message body are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (supabaseUrl && serviceRoleKey && clientSendId) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: existingLog } = await adminClient
        .from('whatsapp_reports_log')
        .select('*')
        .eq('client_send_id', clientSendId)
        .maybeSingle();
      if (existingLog && existingLog.overall_status === 'sent') {
        return new Response(
          JSON.stringify({
            configured: true,
            success: true,
            deduplicated: true,
            overall_status: existingLog.overall_status,
            results: existingLog.recipients_json || [],
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!token || !phoneNumberId) {
      const missing = [];
      if (!token) missing.push('WHATSAPP_ACCESS_TOKEN');
      if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
      return new Response(
        JSON.stringify({
          configured: false,
          error: `WhatsApp Cloud API is not configured. Missing Edge Secret(s): ${missing.join(', ')}.`,
          missingEnvVars: missing,
          results: recipients.map((r: { name?: string; phone_number?: string }) => ({
            name: r.name || '',
            phone_number: r.phone_number || '',
            status: 'failed',
            error: `Missing ${missing.join(', ')}`,
          })),
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    for (const r of recipients) {
      const e164 = normalizeWhatsAppPhone(r.phone_number);
      if (!e164) {
        results.push({
          name: r.name || '',
          phone_number: r.phone_number || '',
          status: 'failed',
          error: 'Invalid E.164 phone number.',
        });
        continue;
      }
      const waTo = e164.replace(/^\+/, '');
      const payload = templateName
        ? {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: waTo,
            type: 'template',
            template: {
              name: templateName,
              language: { code: templateLang },
              components: [{ type: 'body', parameters: [{ type: 'text', text: messageText.slice(0, 1024) }] }],
            },
          }
        : {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: waTo,
            type: 'text',
            text: { preview_url: false, body: messageText.slice(0, 4096) },
          };

      const resp = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        results.push({
          name: r.name || '',
          phone_number: e164,
          status: 'failed',
          error: json?.error?.message || `Meta Graph API error (${resp.status})`,
        });
      } else {
        results.push({
          name: r.name || '',
          phone_number: e164,
          status: 'sent',
          message_id: json?.messages?.[0]?.id || '',
        });
      }
    }

    const sentCount = results.filter((x) => x.status === 'sent').length;
    const overallStatus = sentCount === results.length ? 'sent' : sentCount > 0 ? 'partial' : 'failed';

    return new Response(
      JSON.stringify({
        configured: true,
        success: sentCount > 0,
        overall_status: overallStatus,
        sent_count: sentCount,
        failed_count: results.length - sentCount,
        results,
      }),
      { status: sentCount > 0 ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'WhatsApp dispatch error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
