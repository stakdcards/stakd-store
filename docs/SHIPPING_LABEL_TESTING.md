# Testing shipping label creation

The app uses **EasyPost** to create shipping labels. Labels are generated from **Admin → Orders & Fulfillment**.

## Prerequisites

1. **EasyPost API key**
   - Sign up at [easypost.com](https://www.easypost.com).
   - For testing, use a **test API key** (Dashboard → API Keys → Test key). Test keys create labels that are not real postage; EasyPost provides test tracking numbers and label PDFs.
   - Add the key to your deployment environment as **`EASYPOST_API_KEY`** (e.g. in Vercel → Project → Settings → Environment Variables). Redeploy after adding.

2. **Origin address (optional)**
   - The API uses env vars for your “from” address if set: `STAKD_FROM_ADDRESS`, `STAKD_FROM_CITY`, `STAKD_FROM_STATE`, `STAKD_FROM_ZIP`. If unset, it falls back to defaults in `frontend/api/create-label.js`.

3. **At least one order with a shipping address**
   - You need an order in the database with `address`, `city`, `state`, `zip`, `country` (and `first_name`, `last_name`, `email`). Create a test order through the store checkout, or insert one via Supabase (Table Editor or SQL) so it has a valid US-style address.

## Steps to test

1. **Log in as admin** and go to **Admin → Orders & Fulfillment**.
2. **Open an order** by clicking a row (or the order ID). The order detail panel opens.
3. In the order panel, click **“Generate Shipping Label”**.
4. The app calls `POST /api/create-label` with that order’s ID. The API:
   - Loads the order from Supabase.
   - Creates an EasyPost shipment (your origin + order’s shipping address, with default parcel size/weight).
   - Buys the cheapest rate.
   - Saves `label_url`, `tracking_number`, and `label_created_at` on the order.
5. When it succeeds:
   - The order panel shows a **“View label”** link (opens the label PDF in a new tab) and the **tracking number**.
   - You can refresh the order list; the order row will show that a label exists.

## If something fails

- **“EASYPOST_API_KEY is not configured”**  
  Add `EASYPOST_API_KEY` in your host’s environment variables and redeploy.

- **“Order not found”**  
  The `orderId` sent to the API doesn’t match an order in the `orders` table. Confirm you’re generating the label for an order that exists in Supabase.

- **“No shipping rates available”**  
  EasyPost couldn’t get rates for the address (e.g. invalid or unsupported). Use a real US address format for testing; with a test key, no real postage is purchased.

- **Other EasyPost errors**  
  Check the deployment logs (e.g. Vercel → Project → Logs) for the full error. Common issues: invalid API key, bad address format, or EasyPost account/verification limits.

## Test mode vs production

- **Test API key:** Labels and tracking numbers are fake; no postage is charged. Use this for all testing.
- **Production API key:** Real postage is purchased and charged to your EasyPost account. Switch to the live key only when you’re ready to ship real orders.
