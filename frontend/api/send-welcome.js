import { createClient } from '@supabase/supabase-js';
import { welcomeEmail } from '../src/email-templates/index.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
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
  if (userError || !user?.email) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const { data: settings } = await admin.from('email_automation').select('key, value').in('key', ['welcome_enabled']);
  const welcomeEnabled = (settings || []).find(s => s.key === 'welcome_enabled')?.value !== 'false';

  if (!welcomeEnabled) {
    return jsonResponse({ sent: false, reason: 'welcome_disabled' });
  }

  const { data: profile } = await admin.from('profiles').select('welcome_email_sent_at, name, created_at').eq('id', user.id).single();
  if (profile?.welcome_email_sent_at) {
    return jsonResponse({ sent: false, reason: 'already_sent' });
  }

  const name = profile?.name || user.user_metadata?.name || user.user_metadata?.full_name || null;
  const html = welcomeEmail({ name: name || undefined });
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return jsonResponse({ error: 'Email service not configured' }, 500);
  }

  const { Resend } = await import('resend');
  const resend = new Resend(resendKey);
  try {
    await resend.emails.send({
      from: 'STAKD Cards <noreply@stakdcards.com>',
      to: user.email,
      subject: 'Welcome to STAKD Cards',
      html,
    });
  } catch (err) {
    console.error('Resend welcome send error:', err);
    return jsonResponse({ error: `Failed to send: ${err.message}` }, 500);
  }

  await admin.from('profiles').update({ welcome_email_sent_at: new Date().toISOString() }).eq('id', user.id);
  await admin.from('email_logs').insert({
    to: user.email,
    subject: 'Welcome to STAKD Cards',
    type: 'welcome',
    body_html: html,
    status: 'sent',
  });

  return jsonResponse({ sent: true });
}
