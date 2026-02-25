import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env for Supabase.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Database types (match Supabase schema) ───────────────────────────────────

export type ProductRow = {
  id: string;
  name: string;
  subtitle: string | null;
  franchise: string | null;
  category: 'video-games' | 'anime' | 'esports';
  price: number;
  limited: boolean;
  in_stock: boolean;
  featured: boolean;
  description: string | null;
  dimensions: string | null;
  materials: string | null;
  bg_color: string | null;
  accent_color: string | null;
  palette: string[];
  images: ProductImage[];
  created_at?: string;
  updated_at?: string;
};

export type ProductImage = { id: string; dataUrl?: string; name?: string };

export type OrderRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  status: string;
  shipping_method: string;
  shipping_cost: number;
  subtotal: number;
  tax: number;
  total: number;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_time: number;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
};
