import EasyPost from '@easypost/api';
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
  const apiKey = process.env.EASYPOST_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'EASYPOST_API_KEY is not configured' }, 500);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return jsonResponse({ error: 'Supabase not configured' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const {
    orderId,
    // Shipment from address (your warehouse/origin)
    fromName = 'STAKD Cards',
    fromStreet1 = process.env.STAKD_FROM_ADDRESS || '123 Main St',
    fromCity = process.env.STAKD_FROM_CITY || 'Des Moines',
    fromState = process.env.STAKD_FROM_STATE || 'IA',
    fromZip = process.env.STAKD_FROM_ZIP || '50309',
    fromCountry = 'US',
    // Parcel dimensions (shadowbox defaults)
    weightOz = 48,
    lengthIn = 14,
    widthIn = 14,
    heightIn = 3,
  } = body;

  if (!orderId) {
    return jsonResponse({ error: 'orderId is required' }, 400);
  }

  // Fetch order to get shipping address
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, first_name, last_name, address, city, state, zip, country, email')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    return jsonResponse({ error: 'Order not found' }, 404);
  }

  const client = new EasyPost(apiKey);

  try {
    const shipment = await client.Shipment.create({
      from_address: {
        name: fromName,
        street1: fromStreet1,
        city: fromCity,
        state: fromState,
        zip: fromZip,
        country: fromCountry,
      },
      to_address: {
        name: `${order.first_name} ${order.last_name}`,
        street1: order.address,
        city: order.city,
        state: order.state,
        zip: order.zip,
        country: order.country || 'US',
        email: order.email,
      },
      parcel: {
        weight: weightOz,
        length: lengthIn,
        width: widthIn,
        height: heightIn,
      },
    });

    // Sort rates by price and pick the cheapest
    const rates = (shipment.rates || []).sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
    if (!rates.length) {
      return jsonResponse({ error: 'No shipping rates available for this address' }, 422);
    }

    const cheapestRate = rates[0];
    const bought = await client.Shipment.buy(shipment.id, cheapestRate.id);

    const labelUrl = bought.postage_label?.label_url || null;
    const trackingCode = bought.tracking_code || null;

    // Persist label info back to the order
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        label_url: labelUrl,
        tracking_number: trackingCode,
        label_created_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Failed to update order with label info:', updateError);
    }

    return jsonResponse({
      success: true,
      label_url: labelUrl,
      tracking_number: trackingCode,
      carrier: cheapestRate.carrier,
      service: cheapestRate.service,
      rate: cheapestRate.rate,
    });
  } catch (err) {
    console.error('EasyPost error:', err);
    return jsonResponse({ error: err.message || 'Failed to create shipping label' }, 500);
  }
}
