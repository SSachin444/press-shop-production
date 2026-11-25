// Supabase Edge Function: operator-entry
// Validates passwordless Operator requests server-side without granting Operator access to Admin/Supervisor tables.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration unavailable' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const machine = String(body.machine_or_line || '').trim().toUpperCase();
    const dateVal = String(body.date || '').trim();
    const shift = String(body.shift || '').trim();
    const hourInterval = String(body.hour_interval || '').trim();
    const actualQty = Number(body.actual_qty);
    const rejectedQty = Number(body.rejected_qty ?? 0);
    const targetQty = Number(body.target_qty ?? 0);
    const uph = Number(body.uph ?? 0);
    const downtimeMinutes = Number(body.downtime_minutes ?? 0);
    const clientSubmissionId = String(body.client_submission_id || '').trim();

    if (!machine || !dateVal || !shift || !hourInterval || !Number.isFinite(actualQty)) {
      return new Response(JSON.stringify({ error: 'Required production entry fields are missing.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (actualQty < 0 || actualQty > 100000 || rejectedQty < 0 || rejectedQty > actualQty || downtimeMinutes < 0 || downtimeMinutes > 480) {
      return new Response(JSON.stringify({ error: 'Numeric values are outside valid shopfloor ranges.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (clientSubmissionId) {
      const { data: existing } = await adminClient
        .from('production_records')
        .select('*')
        .eq('client_submission_id', clientSubmissionId)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ success: true, record: existing, deduplicated: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const goodQty = Math.max(0, actualQty - rejectedQty);
    const pct = targetQty > 0 ? Number(((actualQty / targetQty) * 100).toFixed(1)) : 0;

    const { data: saved, error } = await adminClient
      .from('production_records')
      .upsert(
        {
          plant_id: String(body.plant_id || 'Plant 1'),
          production_type: machine.startsWith('NC') ? 'NC' : 'Tandem',
          machine_or_line: machine,
          date: dateVal,
          shift,
          hour_interval: hourInterval,
          operator_name: String(body.operator_name || 'Line Operator').trim(),
          tool_number: String(body.tool_number || '').trim(),
          uph,
          target_qty: targetQty,
          actual_qty: actualQty,
          good_qty: goodQty,
          rejected_qty: rejectedQty,
          downtime_minutes: downtimeMinutes,
          downtime_code: String(body.downtime_code || 'D01'),
          downtime_reason: String(body.downtime_reason || ''),
          remarks: String(body.remarks || ''),
          production_pct: pct,
          hourly_output_pct: pct,
          entry_time: String(body.entry_time || ''),
          client_submission_id: clientSubmissionId || null,
          submitted_by_role: 'Operator',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'machine_or_line,date,shift,hour_interval' }
      )
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, record: saved }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Entry rejected' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
