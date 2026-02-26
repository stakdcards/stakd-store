import { createClient } from '@supabase/supabase-js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Valid email is required' }, 400);
  }

  const name = (body.name || '').trim() || null;
  const cart = Array.isArray(body.cart) ? body.cart : [];
  const cartSnapshot = cart.map(item => ({
    product_id: item.product_id || item.id,
    name: item.name,
    quantity: Number(item.quantity) || 1,
    price: Number(item.price) || 0,
  }));

  const supabase = createClient(url, key);
  const { error } = await supabase.from('abandoned_cart_reminders').insert({
    email,
    name,
    cart_snapshot: cartSnapshot,
  });

  if (error) {
    console.error('record-cart-reminder insert error:', error);
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ recorded: true });
}
