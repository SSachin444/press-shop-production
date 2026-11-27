// Vercel Serverless Function: POST /api/whatsapp/send
// Sends production & downtime reports directly via Meta WhatsApp Business Platform Cloud API.
// Credentials come exclusively from server-side environment variables.

const recentSendCache = new Map();

function normalizeWhatsAppPhone(raw) {
  const cleaned = String(raw || '').replace(/[\s\-()]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) return null;
  return cleaned;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const apiVersion = (process.env.WHATSAPP_API_VERSION || 'v21.0').trim();
  const templateName = (process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
  const templateLang = (process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim();

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const recipients = Array.isArray(body.recipients) ? body.recipients.slice(0, 5) : [];
  const messageText = String(body.message || '').trim();
  const clientSendId = String(body.client_send_id || '').trim();

  if (recipients.length === 0) {
    return res.status(400).json({ error: 'Select at least one valid WhatsApp recipient (up to 5).' });
  }
  if (!messageText) {
    return res.status(400).json({ error: 'Report message body cannot be empty.' });
  }

  // Prevent accidental duplicate sends within short window
  if (clientSendId && recentSendCache.has(clientSendId)) {
    return res.status(200).json({ ...recentSendCache.get(clientSendId), deduplicated: true });
  }

  if (!token || !phoneNumberId) {
    const missing = [];
    if (!token) missing.push('WHATSAPP_ACCESS_TOKEN');
    if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
    return res.status(503).json({
      configured: false,
      error: `WhatsApp Business Cloud API is not configured on the server. Missing environment variable(s): ${missing.join(', ')}.`,
      missingEnvVars: missing,
      results: recipients.map((r) => ({
        name: r.name || '',
        phone_number: r.phone_number || '',
        status: 'failed',
        error: `Server missing ${missing.join(', ')}`,
      })),
    });
  }

  const results = [];
  for (const r of recipients) {
    const e164 = normalizeWhatsAppPhone(r.phone_number);
    if (!e164) {
      results.push({
        name: r.name || '',
        phone_number: r.phone_number || '',
        status: 'failed',
        error: 'Invalid international E.164 phone number (expected e.g. +919876543210).',
      });
      continue;
    }

    // Meta Cloud API expects digits without leading '+'
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
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: messageText.slice(0, 1024) }],
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: waTo,
          type: 'text',
          text: {
            preview_url: false,
            body: messageText.slice(0, 4096),
          },
        };

    try {
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
        const errMsg = json?.error?.message || `Meta Cloud API error (${resp.status})`;
        results.push({
          name: r.name || '',
          phone_number: e164,
          status: 'failed',
          error: errMsg,
        });
      } else {
        results.push({
          name: r.name || '',
          phone_number: e164,
          status: 'sent',
          message_id: json?.messages?.[0]?.id || '',
        });
      }
    } catch (err) {
      results.push({
        name: r.name || '',
        phone_number: e164,
        status: 'failed',
        error: err?.message || 'Network failure contacting Meta Graph API',
      });
    }
  }

  const sentCount = results.filter((x) => x.status === 'sent').length;
  const overallStatus = sentCount === results.length ? 'sent' : sentCount > 0 ? 'partial' : 'failed';
  const responseBody = {
    configured: true,
    success: sentCount > 0,
    overall_status: overallStatus,
    sent_count: sentCount,
    failed_count: results.length - sentCount,
    results,
  };

  if (clientSendId) {
    recentSendCache.set(clientSendId, responseBody);
    if (recentSendCache.size > 100) {
      const oldest = recentSendCache.keys().next().value;
      recentSendCache.delete(oldest);
    }
  }

  return res.status(sentCount > 0 ? 200 : 502).json(responseBody);
}
