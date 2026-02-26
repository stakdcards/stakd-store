import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('RESEND_API_KEY is not set');
    return jsonResponse({ error: 'Email service not configured' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { to, subject, bodyHtml, type = 'transactional', orderId = null } = body;
  if (!to || !subject || !bodyHtml) {
    return jsonResponse({ error: 'Missing required fields: to, subject, bodyHtml' }, 400);
  }

  const resend = new Resend(resendKey);
  let status = 'sent';
  let sendError = null;

  try {
    await resend.emails.send({
      from: 'STAKD Cards <orders@stakdcards.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: bodyHtml,
    });
  } catch (err) {
    console.error('Resend send error:', err);
    status = 'failed';
    sendError = err.message;
  }

  const supabase = getSupabase();
  if (supabase) {
    const { error: logError } = await supabase.from('email_logs').insert({
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      type,
      order_id: orderId || null,
      body_html: bodyHtml,
      status,
    });
    if (logError) console.error('Failed to log email:', logError);
  }

  if (status === 'failed') {
    return jsonResponse({ error: `Failed to send email: ${sendError}` }, 500);
  }

  return jsonResponse({ sent: true });
}
