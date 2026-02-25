import { supabase } from '../lib/supabase';
import type { ProductRow } from '../lib/supabase';

/** Frontend product shape (camelCase) used by ProductStore and components */
export type Product = {
  id: string;
  name: string;
  subtitle?: string;
  franchise?: string;
  category: string;
  price: number;
  limited: boolean;
  inStock: boolean;
  featured: boolean;
  description?: string;
  dimensions?: string;
  materials?: string;
  bgColor?: string;
  accentColor?: string;
  palette?: string[];
  images?: { id: string; dataUrl?: string; name?: string }[];
};

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle ?? undefined,
    franchise: row.franchise ?? undefined,
    category: row.category,
    price: Number(row.price),
    limited: row.limited,
    inStock: row.in_stock,
    featured: row.featured,
    description: row.description ?? undefined,
    dimensions: row.dimensions ?? undefined,
    materials: row.materials ?? undefined,
    bgColor: row.bg_color ?? undefined,
    accentColor: row.accent_color ?? undefined,
    palette: Array.isArray(row.palette) ? row.palette : [],
    images: Array.isArray(row.images) ? row.images : [],
  };
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(rowToProduct);
}

export async function updateProduct(
  id: string,
  patch: Partial<{
    price: number;
    in_stock: boolean;
    featured: boolean;
    limited: boolean;
    name: string;
    subtitle: string | null;
    franchise: string | null;
    description: string | null;
    dimensions: string | null;
    materials: string | null;
    bg_color: string | null;
    accent_color: string | null;
    palette: string[];
    images: { id: string; dataUrl?: string; name?: string }[];
  }>
): Promise<Product> {
  const payload: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return rowToProduct(data as ProductRow);
}

export async function upsertProduct(row: Partial<ProductRow> & { id: string }): Promise<Product> {
  const payload = {
    ...row,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('products')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return rowToProduct(data as ProductRow);
}
