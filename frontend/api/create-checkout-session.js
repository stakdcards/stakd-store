import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY is not configured' });
  }

  try {
    const { items, successUrlBase, subtotal, tax, shipping_cost, shipping_method } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required and must not be empty' });
    }

    const base = successUrlBase || process.env.VITE_APP_URL || (req.headers.origin || '').replace(/\/$/, '') || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');
    const successUrl = base.startsWith('http') ? `${base}/checkout/success` : `https://${base}/checkout/success`;
    const cancelUrl = base.startsWith('http') ? `${base}/cart` : `https://${base}/cart`;

    const line_items = items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: item.image_url ? [item.image_url] : undefined,
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    }));

    const cartItemsForMetadata = items.map((item) => ({
      product_id: item.product_id,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      price_at_time: Number(item.price),
    }));
    const metadata = {
      cart_items: JSON.stringify(cartItemsForMetadata),
      subtotal: String(Number(subtotal) || 0),
      tax: String(Number(tax) || 0),
      shipping_cost: String(Number(shipping_cost) || 0),
      shipping_method: String(shipping_method || 'standard'),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      shipping_address_collection: { allowed_countries: ['US'] },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
