# Supabase Storage policies (product-images bucket)

Use these in **Storage** → **Policies** (or **New policy** on the `product-images` bucket).  
They allow **authenticated** users (e.g. admins) to update and delete objects; **public** can only read.

## UPDATE (authenticated only)

```sql
create policy "Authenticated can update product images"
on storage.objects for update
to authenticated
using ( bucket_id = 'product-images' )
with check ( bucket_id = 'product-images' );
```

## DELETE (authenticated only)

```sql
create policy "Authenticated can delete product images"
on storage.objects for delete
to authenticated
using ( bucket_id = 'product-images' );
```

**Steps:** Remove the existing **public** INSERT, UPDATE, and DELETE policies, then add the two policies above. Keep your public SELECT policies so product images still load on the site.
