# How to Place Test Orders

Test orders let you create orders **without payment** so you can try checkout, test the production pipeline, and develop against a real order payload.

---

## Quick steps

1. **Create cards and add them to a box**
   - Go to **Builder**, design a card, then **Save** and add it to a box (or create a new box).
   - From **Collection**, add more cards to the box if you want.

2. **Add the box to the cart**
   - On the **Collection** page, open a box and click **Add to Cart** (or use the cart action on the box).
   - You can add multiple boxes and change quantities in the cart.

3. **Go to Checkout**
   - Click **Cart** in the nav (or go to `/cart`).

4. **Place a test order**
   - Click **"Place test order (no payment)"**.
   - Backend must be running at `http://localhost:8000` (or your `VITE_API_URL`).
   - On success you’ll see an **Order ID** and the cart will clear.
   - The same order is stored in the backend (in memory for now) and in `localStorage` under `snapshot-test-orders`.

---

## What the test order sends

The frontend sends a payload like:

```json
{
  "test": true,
  "total_cents": 2499,
  "items": [
    {
      "box_id": "...",
      "box_name": "Box 1",
      "is_mega": false,
      "quantity": 1,
      "cards": [
        {
          "design_snapshot": {
            "templateId": "slimline",
            "templateName": "Slimline",
            "playerName": "John Doe",
            "teamName": "Eagles",
            "primaryColor": "#00D9FF",
            "secondaryColor": "#000000",
            "foil": "none",
            "thumbnailFront": "data:image/...",
            "playerImageUrl": "http://...",
            "playerTransform": { ... },
            "logoTransform": { ... },
            "quantity": 1
          },
          "quantity": 1
        }
      ]
    }
  ]
}
```

---

## Backend

- **Endpoint:** `POST http://localhost:8000/api/test-order`
- **Body:** JSON above (must include `"test": true`).
- **Response:** `201` with `order_id`, `message`, `total_cents`.
- No payment is processed; the endpoint only creates a test order and returns an ID.

---

## Using the order ID

- **Production pipeline:** Later you can call  
  `POST /api/orders/{order_id}/production/generate`  
  with this `order_id` to generate Holo Base PDF, Hero Sheet PDF, and Cut file (when the pipeline is wired to real order storage).
- **Local history:** Test orders are appended to `localStorage['snapshot-test-orders']` so you can inspect or replay them in the browser.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Test order failed" | Start the backend: `cd backend && python main.py` |
| CORS errors | Backend allows `*`; if using another host/port, add it to CORS in `main.py` |
| Wrong API URL | Set `VITE_API_URL` in `.env` (e.g. `VITE_API_URL=http://localhost:8000`) |
| Cart empty after test order | Expected; test order clears the cart on success |

---

## Live payments (later)

The red **"Place Order"** button is for real payments. Right now it shows an alert. When you add Stripe (or another provider), wire that button to your payment flow and create the order only after successful payment.
