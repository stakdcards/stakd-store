import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { nudgeEmail } from '../src/email-templates/index.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(request) {
  const secret = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')?.trim()
    || request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!url || !key || !resendKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const supabase = createClient(url, key);
  const { data: settings } = await supabase.from('email_automation').select('key, value').in('key', ['nudge_enabled', 'nudge_delay_hours']);
  const kv = Object.fromEntries((settings || []).map(s => [s.key, s.value]));
  if (kv.nudge_enabled === 'false') {
    return jsonResponse({ sent: 0, reason: 'nudge_disabled' });
  }

  const delayHours = Math.max(1, parseInt(kv.nudge_delay_hours, 10) || 24);
  const cutoff = new Date(Date.now() - delayHours * 60 * 60 * 1000).toISOString();

  const { data: rows } = await supabase
    .from('abandoned_cart_reminders')
    .select('id, email, name, cart_snapshot, created_at')
    .is('nudge_sent_at', null)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(100);

  if (!rows?.length) {
    return jsonResponse({ sent: 0 });
  }

  const resend = new Resend(resendKey);
  const baseUrl = process.env.VITE_APP_URL || 'https://www.stakdcards.com';
  let sent = 0;
  for (const row of rows) {
    try {
      const items = (row.cart_snapshot || []).map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));
      const html = nudgeEmail({
        name: row.name || undefined,
        items,
        cartUrl: `${baseUrl}/cart`,
      });
      await resend.emails.send({
        from: 'STAKD Cards <noreply@stakdcards.com>',
        to: row.email,
        subject: 'Your cart is waiting — STAKD Cards',
        html,
      });
      await supabase.from('abandoned_cart_reminders').update({ nudge_sent_at: new Date().toISOString() }).eq('id', row.id);
      await supabase.from('email_logs').insert({
        to: row.email,
        subject: 'Your cart is waiting — STAKD Cards',
        type: 'nudge',
        body_html: html,
        status: 'sent',
      });
      sent++;
    } catch (err) {
      console.error('Nudge send error for', row.email, err);
    }
  }

  return jsonResponse({ sent });
}
