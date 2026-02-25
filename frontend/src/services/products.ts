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
  images?: { id: string; url?: string; dataUrl?: string; name?: string }[];
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

/** Insert a new product (admin). */
export async function createProduct(
  product: Partial<Product> & {
    id: string;
    name: string;
    category: 'video-games' | 'anime' | 'esports';
    price: number;
  }
): Promise<Product> {
  const payload: ProductRow = {
    id: product.id,
    name: product.name,
    subtitle: product.subtitle ?? null,
    franchise: product.franchise ?? null,
    category: product.category,
    price: product.price,
    limited: product.limited ?? false,
    in_stock: product.inStock ?? true,
    featured: product.featured ?? false,
    description: product.description ?? null,
    dimensions: product.dimensions ?? null,
    materials: product.materials ?? null,
    bg_color: product.bgColor ?? null,
    accent_color: product.accentColor ?? null,
    palette: Array.isArray(product.palette) ? product.palette : [],
    images: Array.isArray(product.images) ? product.images : [],
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return rowToProduct(data as ProductRow);
}

/** Delete a product by id (admin). */
export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}
