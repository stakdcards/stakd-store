-- STAKD (stakdcards.com) — Supabase schema
-- Products, orders, order_items, profiles. RLS: public read products; only admin writes.

-- ─── Profiles (links auth.users to app role) ───────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger: create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: true if current user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ─── Products (all fields from products.js) ────────────────────────────────────
create table if not exists public.products (
  id text primary key,
  name text not null,
  subtitle text,
  franchise text,
  category text not null check (category in ('video-games', 'anime', 'esports')),
  price numeric(10,2) not null check (price >= 0),
  limited boolean not null default false,
  in_stock boolean not null default true,
  featured boolean not null default false,
  description text,
  dimensions text,
  materials text,
  bg_color text,
  accent_color text,
  palette jsonb default '[]'::jsonb,
  images jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Orders ───────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  country text not null default 'US',
  status text not null default 'pending' check (status in (
    'pending', 'accepted', 'files_generated', 'printed_cut', 'assembled', 'packed', 'shipped', 'cancelled'
  )),
  shipping_method text not null,
  shipping_cost numeric(10,2) not null default 0,
  subtotal numeric(10,2) not null,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Order items (line items per order) ───────────────────────────────────────
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  product_id text not null references public.products on delete restrict,
  quantity int not null check (quantity >= 1),
  price_at_time numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Profiles: users can read/update own row (role updates typically done in dashboard)
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Products: everyone can read; only admin can insert/update/delete
create policy "Anyone can read products"
  on public.products for select
  using (true);

create policy "Admin can insert products"
  on public.products for insert
  with check (public.is_admin());

create policy "Admin can update products"
  on public.products for update
  using (public.is_admin());

create policy "Admin can delete products"
  on public.products for delete
  using (public.is_admin());

-- Orders: anyone can insert (guest checkout); only admin can select/update
create policy "Anyone can create orders"
  on public.orders for insert
  with check (true);

create policy "Admin can read orders"
  on public.orders for select
  using (public.is_admin());

create policy "Admin can update orders"
  on public.orders for update
  using (public.is_admin());

-- Order items: anyone can insert; only admin can select (orders imply items)
create policy "Anyone can create order items"
  on public.order_items for insert
  with check (true);

create policy "Admin can read order items"
  on public.order_items for select
  using (public.is_admin());

-- ─── Seed products (from products.js) ─────────────────────────────────────────
-- Run after migration; optional. Uncomment and run in SQL editor if you want DB to own initial data.
-- Alternatively, use the Admin UI to sync or run a one-off script.
-- INSERT INTO public.products (id, name, subtitle, franchise, category, price, limited, in_stock, featured, description, dimensions, materials, bg_color, accent_color, palette) VALUES
-- ('vg-geralt', 'Geralt of Rivia', 'The White Wolf', 'The Witcher 3', 'video-games', 89.99, false, true, true, '...', '2.5" × 3.5"', 'Silhouette-cut cardstock layers · ...', '#0D1420', '#B8A878', '["#0D1420","#1A2540","#B8A878"]'),
-- ... (full seed can be generated from products.js);

-- Grant usage for anon/authenticated (Supabase default roles)
grant usage on schema public to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant insert on public.order_items to anon, authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
-- RLS will further restrict orders/order_items to admin for select/update.
