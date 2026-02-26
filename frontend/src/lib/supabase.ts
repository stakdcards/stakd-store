import { supabase as _supabase } from './supabase.js';
export const supabase = _supabase;

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
  label_url: string | null;
  tracking_number: string | null;
  label_created_at: string | null;
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
