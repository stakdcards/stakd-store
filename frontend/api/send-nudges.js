import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const BASE_URL = 'https://www.stakdcards.com';

function buildNudgeHtml({ name, items = [], cartUrl }) {
  const url = cartUrl || `${BASE_URL}/cart`;
  const itemRows = items.slice(0, 5).map(item => `
    <div class="row"><span class="label">${item.name || 'Item'} × ${item.quantity || 1}</span><span class="val">$${Number((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span></div>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Your cart is waiting — STAKD Cards</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Inter:wght@400;600;700;800&display=swap"/>
<style>
body{margin:0;padding:0;background:#0D0E11;font-family:'Inter',-apple-system,sans-serif;color:#F3F1E4;}
.wrap{max-width:560px;margin:0 auto;padding:40px 20px;}
.card{background:#191B20;border:1px solid #2C303A;border-radius:16px;overflow:hidden;}
.header{background:#2A2A69;padding:28px 32px;text-align:center;}
.header img{height:28px;display:block;margin:0 auto;}
.body{padding:32px;}
h1{font-size:22px;font-weight:800;margin:0 0 8px;color:#F3F1E4;font-family:'Big Shoulders Display',sans-serif;text-transform:uppercase;}
p{font-size:14px;line-height:1.7;color:#BEBBAC;margin:0 0 16px;}
.btn{display:inline-block;padding:12px 28px;border-radius:10px;background:#434EA1;color:#fff!important;font-weight:700;font-size:14px;text-decoration:none;margin-top:24px;}
.row{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #2C303A;}
.label{color:#898675;}.val{font-weight:600;color:#F3F1E4;}
</style></head>
<body><div class="wrap"><div class="card"><div class="header"><img src="${BASE_URL}/stakd-wordmark-offwhite.png" alt="STAKD Cards"/></div>
<div class="body"><h1>Still thinking it over?</h1>
<p>Hey ${name || 'there'}, you left some items in your cart. We've saved them for you.</p>
${itemRows ? `<hr style="border:none;border-top:1px solid #2C303A;margin:24px 0"/>${itemRows}<hr style="border:none;border-top:1px solid #2C303A;margin:24px 0"/>` : ''}
<p>Come back anytime to finish your order — we'll keep crafting until you're ready.</p>
<a class="btn" href="${url}">Finish my order</a></div></div></div></body></html>`;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(request) {
  try {
    const secret = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')?.trim()
      || request.headers.get('x-cron-secret');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && secret !== cronSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!url || !key) {
      return jsonResponse({ error: 'Server configuration error: missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
    }
    if (!resendKey) {
      return jsonResponse({ error: 'Server configuration error: missing RESEND_API_KEY' }, 500);
    }

    const supabase = createClient(url, key);
    const { data: settings, error: settingsError } = await supabase.from('email_automation').select('key, value').in('key', ['nudge_enabled', 'nudge_delay_hours']);
    if (settingsError) {
      console.error('send-nudges email_automation error:', settingsError);
      return jsonResponse({ error: 'Database error (email_automation). Check Supabase tables and env.', detail: settingsError.message }, 500);
    }
    const kv = Object.fromEntries((settings || []).map(s => [s.key, s.value]));
    if (kv.nudge_enabled === 'false') {
      return jsonResponse({ sent: 0, reason: 'nudge_disabled' });
    }

    const delayHours = Math.max(1, parseInt(kv.nudge_delay_hours, 10) || 24);
    const cutoff = new Date(Date.now() - delayHours * 60 * 60 * 1000).toISOString();

    const { data: rows, error: rowsError } = await supabase
      .from('abandoned_cart_reminders')
      .select('id, email, name, cart_snapshot, created_at')
      .is('nudge_sent_at', null)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(100);

    if (rowsError) {
      console.error('send-nudges abandoned_cart_reminders error:', rowsError);
      return jsonResponse({ error: 'Database error (abandoned_cart_reminders). Check Supabase tables.', detail: rowsError.message }, 500);
    }
    if (!rows?.length) {
      return jsonResponse({ sent: 0 });
    }

    const resend = new Resend(resendKey);
    const baseUrl = process.env.VITE_APP_URL || process.env.SUPABASE_SITE_URL || 'https://www.stakdcards.com';
    let sent = 0;
    for (const row of rows) {
      try {
        const items = (row.cart_snapshot || []).map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        }));
        const html = buildNudgeHtml({
          name: row.name || undefined,
          items,
          cartUrl: `${baseUrl.replace(/\/$/, '')}/cart`,
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
  } catch (err) {
    console.error('send-nudges handler error:', err);
    return jsonResponse({ error: 'Internal error', detail: err.message }, 500);
  }
}
