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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return jsonResponse({ error: 'Webhook secret not configured' }, 500);
  }

  let event;
  try {
    const rawBody = await request.text();
    const sig = request.headers.get('stripe-signature');
    if (!sig) {
      return jsonResponse({ error: 'Missing stripe-signature header' }, 400);
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return jsonResponse({ error: `Webhook Error: ${err.message}` }, 400);
  }

  if (event.type !== 'checkout.session.completed') {
    return jsonResponse({ received: true });
  }

  const session = event.data.object;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return jsonResponse({ error: 'Supabase not configured' }, 500);
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
      return jsonResponse({ error: orderError.message }, 500);
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
      return jsonResponse({ error: itemsError.message }, 500);
    }

    return jsonResponse({ received: true, order_id: orderId });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}
