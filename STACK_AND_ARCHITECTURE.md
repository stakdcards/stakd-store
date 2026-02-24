# STAKD Store — Tech Stack & How It Works

Brief reference for keeping AI assistants (e.g. Gemini) in the loop.

---

## Framework & Languages

| Layer | Tech |
|-------|------|
| **Frontend** | **React 18** (JSX), **Vite 7** (build tool, dev server) |
| **Routing** | **React Router DOM v7** (client-side SPA routing) |
| **Styling** | **Inline styles** (no Tailwind/CSS-in-JS libs), **global CSS** in `index.css`, **Google Fonts** (Inter, Big Shoulders Display) |
| **Data** | Static product catalog in **JavaScript** (`src/data/products.js`); **localStorage** / **sessionStorage** for cart, theme, admin key, and product overrides |
| **Backend (optional)** | **FastAPI** (Python) at `localhost:8000` — used by Admin for API key–protected endpoints (e.g. production/order status). Storefront works without it. |

**Notable dependencies:** `react`, `react-dom`, `react-router-dom`, `vite`, `@vitejs/plugin-react`. `axios`, `fabric`, `jspdf` may still be in `package.json` but PDF/canvas generation was removed from the app; the site is a static storefront + admin UI.

---

## How It Functions

1. **Entry**  
   `index.html` → `main.jsx` mounts `<App />` into `#root`. `App.jsx` wraps the app in providers and defines all routes.

2. **Providers (context)**  
   - **DarkModeProvider** — Supplies theme tokens `t` (colors, surfaces, borders). App is **dark-only**; no theme toggle.  
   - **ProductStoreProvider** — Merges base products from `data/products.js` with **localStorage** overrides (price, stock, featured, limited, images). Admin edits write to localStorage.  
   - **CartProvider** — Cart state + persistence in **localStorage**; `addToCart`, `updateQuantity`, `removeFromCart`, `clearCart`, `cartCount`, `cartSubtotal`.

3. **Routes**  
   - `/` — Landing (hero, featured products strip, categories, newsletter, footer).  
   - `/products` — Product grid, category/sort filters, product detail modal; supports `?id=...` for deep link.  
   - `/gallery` — Masonry-style gallery with category filter and hover overlays.  
   - `/cart` — Cart review and checkout (shipping + payment form); order “confirmation” is client-only (no real payment backend).  
   - `/about` — Static about + contact (email: hello@stakdcards.com).  
   - `/admin` — Admin panel (sessionStorage API key). Tabs: Dashboard, Listings (edit price/stock/featured/limited/images), Orders & Fulfillment, Customers. No PDF/cut-file generation in the UI anymore.

4. **Shared UI**  
   - **SiteHeader** — Logo (offwhite wordmark), nav links (desktop), cart icon + badge, mobile hamburger menu.  
   - **Footer** — Wordmark, nav links, socials (@stakdcards — Instagram, TikTok, X), copyright + stakdcards.com. Used on every page.  
   - **ShadowboxPreview** — Card preview component (product image/placeholder, watermark `/stakd-icon-offwhite.png`, limited badge, etc.).

5. **Product data**  
   Products have: `id`, `name`, `price`, `category`, `limited`, `inStock`, `featured`, `description`, `dimensions`, `materials`, `bgColor`, `accentColor`, `palette`, `franchise`, optional `images` array (admin-managed, base64 in overrides).

6. **Brand / domain**  
   - Domain: **stakdcards.com**  
   - Social handles: **@stakdcards**  
   - Dark theme only; assets under `frontend/public/` (e.g. `stakd-wordmark-offwhite.png`, `stakd-icon-offwhite.png`).

---

## File Layout (high level)

- `frontend/` — Vite + React app.  
- `frontend/index.html` — Single HTML entry; favicon and font links.  
- `frontend/src/main.jsx` — React mount.  
- `frontend/src/App.jsx` — Providers + `<Routes>`.  
- `frontend/src/pages/*.jsx` — One component per route (Landing, Products, Gallery, Cart, About, Admin).  
- `frontend/src/components/*.jsx` — SiteHeader, Footer, ShadowboxPreview.  
- `frontend/src/contexts/*.jsx` — DarkMode, ProductStore, Cart.  
- `frontend/src/data/products.js` — Base product list.  
- `frontend/public/` — Static assets (images, fonts).  

No database or server-side rendering; everything is client-side React with localStorage/sessionStorage and optional FastAPI backend for admin features.
