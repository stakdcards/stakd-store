import { supabase } from '../lib/supabase';
import type { OrderRow, OrderItemRow } from '../lib/supabase';

export type OrderInsert = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  shipping_method: string;
  shipping_cost: number;
  subtotal: number;
  tax: number;
  total: number;
};

export type OrderItemInsert = {
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_time: number;
};

export type OrderWithItems = OrderRow & { order_items: (OrderItemRow & { products?: { name: string; id: string } | null })[] };

/** Create order and its items in a single flow (client-side). Returns new order id. */
export async function createOrder(
  order: OrderInsert,
  items: { product_id: string; quantity: number; price_at_time: number }[]
): Promise<string> {
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert(order)
    .select('id')
    .single();

  if (orderError) throw orderError;
  const orderId = orderData.id;

  if (items.length > 0) {
    const rows = items.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_time: item.price_at_time,
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(rows);
    if (itemsError) throw itemsError;
  }

  return orderId;
}

/** Fetch all orders (admin). */
export async function fetchOrders(): Promise<OrderWithItems[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      order_items (
        id,
        order_id,
        product_id,
        quantity,
        price_at_time,
        created_at,
        products ( id, name )
      )
    `
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as OrderWithItems[];
}

/** Update order status (admin). */
export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) throw error;
}
