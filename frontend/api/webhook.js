import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request) {
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return jsonResponse({ error: 'Missing stripe-signature header' }, 400);
  }

  const testSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST;
  const liveSecret =
    process.env.STRIPE_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET_LIVE;
  const secrets = [testSecret, liveSecret].filter(Boolean);
  if (secrets.length === 0) {
    const msg =
      'Set STRIPE_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET_TEST for test mode) in your environment. On Vercel: Project → Settings → Environment Variables.';
    console.error(msg);
    return jsonResponse({ code: 'WEBHOOK_SECRET_MISSING', error: 'Webhook secret not configured', hint: msg }, 500);
  }

  let event;
  let lastError;
  for (const webhookSecret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError || !event) {
    console.error('Webhook signature verification failed:', lastError?.message);
    return jsonResponse({ error: `Webhook Error: ${lastError?.message}` }, 400);
  }

  if (event.type !== 'checkout.session.completed') {
    return jsonResponse({ received: true });
  }

  const session = event.data.object;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return jsonResponse(
      { code: 'SUPABASE_CONFIG_MISSING', error: 'Supabase not configured', missing: [!supabaseUrl && 'SUPABASE_URL or VITE_SUPABASE_URL', !supabaseServiceKey && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean) },
      500
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const metadata = session.metadata || {};
    const cartItemsJson = metadata.cart_items;
    if (!cartItemsJson) {
      console.error('No cart_items in session metadata');
      return jsonResponse({ error: 'Missing cart_items in metadata' }, 400);
    }

    let cartItems;
    try {
      cartItems = JSON.parse(cartItemsJson);
    } catch (e) {
      console.error('Invalid cart_items JSON:', e);
      return jsonResponse({ error: 'Invalid cart_items in metadata' }, 400);
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      console.error('cart_items is empty');
      return jsonResponse({ error: 'Empty cart_items' }, 400);
    }

    const details = session.customer_details || {};
    const address = details.address || {};
    const name = (details.name || '').trim();
    const nameParts = name ? name.split(/\s+/) : [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const totalCents = session.amount_total ?? 0;
    const total = totalCents / 100;
    const subtotal = parseFloat(metadata.subtotal) || total;
    const tax = parseFloat(metadata.tax) || 0;
    const shippingCost = parseFloat(metadata.shipping_cost) || 0;
    const shippingMethod = metadata.shipping_method || 'standard';

    const orderRow = {
      first_name: firstName,
      last_name: lastName,
      email: (details.email || '').trim() || 'unknown@stripe.customer',
      phone: (details.phone || '').trim() || null,
      address: [address.line1, address.line2].filter(Boolean).join(', ') || '',
      city: (address.city || '').trim() || '',
      state: (address.state || '').trim() || '',
      zip: (address.postal_code || '').trim() || '',
      country: (address.country || '').trim() || 'US',
      status: 'pending',
      shipping_method: shippingMethod,
      shipping_cost: shippingCost,
      subtotal,
      tax,
      total,
    };

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert(orderRow)
      .select('id')
      .single();

    if (orderError) {
      console.error('Order insert error:', orderError);
      return jsonResponse({ code: 'ORDER_INSERT_FAILED', error: orderError.message }, 500);
    }

    const orderId = orderData.id;
    const orderItemRows = cartItems.map((item) => ({
      order_id: orderId,
      product_id: String(item.product_id),
      quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
      price_at_time: parseFloat(item.price_at_time) || 0,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItemRows);
    if (itemsError) {
      console.error('Order items insert error:', itemsError);
      return jsonResponse({ code: 'ORDER_ITEMS_INSERT_FAILED', error: itemsError.message }, 500);
    }

    // Send order confirmation email (fire-and-forget — don't fail order creation if email fails)
    try {
      const customerEmail = orderRow.email;
      const shortId = orderId.replace(/-/g, '').slice(0, 6).toUpperCase();
      const itemsHtml = cartItems
        .map(item => `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${item.product_id}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;">$${Number(item.price_at_time).toFixed(2)}</td>
        </tr>`)
        .join('');

      const confirmationHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0E11;font-family:'Inter',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0E11;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#13141a;border-radius:16px;border:1px solid #2a2b3a;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a1b2e 0%,#13141a 100%);padding:36px 40px 28px;text-align:center;border-bottom:1px solid #2a2b3a;">
          <div style="font-family:'Big Shoulders Display',system-ui,sans-serif;font-size:28px;font-weight:900;letter-spacing:3px;color:#fff;text-transform:uppercase;">STAKD</div>
          <div style="margin-top:16px;font-size:22px;font-weight:700;color:#fff;">Order Confirmed</div>
          <div style="margin-top:6px;font-size:14px;color:#8b8fa8;">Order #${shortId}</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <p style="font-size:16px;color:#d1d5db;margin:0 0 8px;">Hi ${firstName || 'there'},</p>
          <p style="font-size:14px;color:#9ca3af;line-height:1.7;margin:0 0 28px;">
            Thank you for your order! We're already getting started on your custom shadowbox. You'll receive updates as it progresses through production.
          </p>
          <!-- Order items -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2a2b3a;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            <tr style="background:#1e1f2e;">
              <th style="padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;text-align:left;">Item</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;text-align:center;">Qty</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;text-align:right;">Price</th>
            </tr>
            ${itemsHtml}
          </table>
          <!-- Totals -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="padding:4px 0;font-size:13px;color:#9ca3af;">Subtotal</td><td style="padding:4px 0;font-size:13px;color:#d1d5db;text-align:right;">$${subtotal.toFixed(2)}</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#9ca3af;">Shipping (${shippingMethod})</td><td style="padding:4px 0;font-size:13px;color:#d1d5db;text-align:right;">${shippingCost > 0 ? '$' + shippingCost.toFixed(2) : 'Free'}</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#9ca3af;">Tax</td><td style="padding:4px 0;font-size:13px;color:#d1d5db;text-align:right;">$${tax.toFixed(2)}</td></tr>
            <tr><td style="padding:8px 0 4px;font-size:16px;font-weight:700;color:#fff;border-top:1px solid #2a2b3a;">Total</td><td style="padding:8px 0 4px;font-size:16px;font-weight:700;color:#6d81bb;border-top:1px solid #2a2b3a;text-align:right;">$${total.toFixed(2)}</td></tr>
          </table>
          <!-- Shipping address -->
          <div style="background:#1e1f2e;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:8px;">Shipping To</div>
            <div style="font-size:14px;color:#d1d5db;line-height:1.7;">
              ${firstName} ${lastName}<br>
              ${orderRow.address}<br>
              ${orderRow.city}, ${orderRow.state} ${orderRow.zip}<br>
              ${orderRow.country}
            </div>
          </div>
          <p style="font-size:13px;color:#6b7280;line-height:1.7;margin:0;">
            Questions? Reply to this email or contact us at <a href="mailto:hello@stakdcards.com" style="color:#6d81bb;">hello@stakdcards.com</a>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #2a2b3a;text-align:center;">
          <div style="font-size:11px;color:#4b5563;">© ${new Date().getFullYear()} STAKD Cards · stakdcards.com</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const appUrl = process.env.VITE_APP_URL || 'https://www.stakdcards.com';
      await fetch(`${appUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customerEmail,
          subject: `Order Confirmed — #${shortId}`,
          bodyHtml: confirmationHtml,
          type: 'order_confirmation',
          orderId,
        }),
      });
    } catch (emailErr) {
      console.error('Order confirmation email error (non-fatal):', emailErr.message);
    }

    return jsonResponse({ received: true, order_id: orderId });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return jsonResponse({ code: 'WEBHOOK_HANDLER_ERROR', error: err.message }, 500);
  }
}
