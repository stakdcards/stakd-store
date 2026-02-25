import { supabase } from '../lib/supabase';

const BUCKET = 'product-images';

/**
 * Upload a product image file to Supabase Storage and return its public URL.
 * Path format: {productId}/{uniqueId}.{ext} — use 'new' for productId when adding a product not yet saved.
 */
export async function uploadProductImage(
  productId: string,
  file: File
): Promise<{ id: string; url: string; name?: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const folder = (productId && productId.trim()) || 'new';
  const path = `${folder}/${id}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return { id, url: publicUrl, name: file.name };
}

/**
 * Delete an object from product-images bucket by path.
 * Path should be productId/filename.ext (as stored when uploading).
 */
export async function deleteProductImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
