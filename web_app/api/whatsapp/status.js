// Vercel Serverless Function: GET /api/whatsapp/status
// Checks whether Meta WhatsApp Business Platform Cloud API credentials are configured server-side.
// Never exposes tokens or secrets to the frontend.

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const apiVersion = (process.env.WHATSAPP_API_VERSION || 'v21.0').trim();
  const templateName = (process.env.WHATSAPP_TEMPLATE_NAME || '').trim();

  const missing = [];
  if (!token) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');

  return res.status(200).json({
    configured: Boolean(token && phoneNumberId),
    provider: 'Meta WhatsApp Business Platform Cloud API',
    apiVersion,
    hasTemplateConfigured: Boolean(templateName),
    templateName: templateName || null,
    missingEnvVars: missing,
  });
}
