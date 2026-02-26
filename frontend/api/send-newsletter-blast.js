import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { newsletterTemplate } from '../src/email-templates/index.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request) {
  const authHeader = request.headers.get('Authorization');
  const jwt = authHeader?.replace(/^Bearer\s+/i, '')?.trim();
  if (!jwt) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnon);
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(jwt);
  if (userError || !user) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401);
  }

  const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return jsonResponse({ error: 'Admin only' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { subject, headline, bodyHtml, ctaText, ctaUrl } = body;
  if (!subject || !headline) {
    return jsonResponse({ error: 'subject and headline required' }, 400);
  }

  const { data: subscribers } = await admin.from('email_subscribers').select('id, email, name').is('unsubscribed_at', null);
  if (!subscribers?.length) {
    return jsonResponse({ sent: 0, error: 'No active subscribers' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return jsonResponse({ error: 'Email service not configured' }, 500);
  }

  const html = newsletterTemplate({ subject, headline, bodyHtml: bodyHtml || '', ctaText, ctaUrl });
  const resend = new Resend(resendKey);
  let sent = 0;
  for (const sub of subscribers) {
    try {
      await resend.emails.send({
        from: 'STAKD Cards <noreply@stakdcards.com>',
        to: sub.email,
        subject,
        html,
      });
      await admin.from('email_logs').insert({
        to: sub.email,
        subject,
        type: 'newsletter',
        body_html: html,
        status: 'sent',
      });
      sent++;
      await new Promise(r => setTimeout(r, 80));
    } catch (err) {
      console.error('Newsletter send error for', sub.email, err);
    }
  }

  return jsonResponse({ sent, total: subscribers.length });
}
