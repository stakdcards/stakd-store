# STAKD — Functionality testing guide

Use this checklist to verify the site and integrations work end-to-end. Test on **production** (www.stakdcards.com) when possible; use **Stripe test mode** for payments until you’re ready to go live.

---

## 1. Public site & navigation

- [ ] **Home (Landing)** — Load `/`. Hero, featured products, newsletter section, footer. No console errors.
- [ ] **Shop** — Click Shop or go to `/products`. Product grid loads; category filter works; clicking a product opens detail/modal.
- [ ] **Gallery** — `/gallery` loads and shows products as expected.
- [ ] **About** — `/about` loads.
- [ ] **Header** — Logo goes to `/`. Shop, Gallery, About, Cart, and account (or Login) work. Cart count updates when you add items.
- [ ] **Footer** — Links (Shop, Cart, About, etc.) work. Sticky on long pages (e.g. Cart).
- [ ] **Mobile** — Resize or use a phone. Menu, cart, and account/login are usable; layout doesn’t break.

---

## 2. Auth (sign in & account)

- [ ] **Login page** — Go to `/login` (or click account when logged out). Page loads; email and “Send magic link” / Google are visible.
- [ ] **Magic link** — Enter an email you can access → “Send magic link”. Check inbox (and spam). Email is from your SMTP (e.g. noreply@stakdcards.com), uses your template (STAKD styling, Big Shoulders Display / Inter). Click link → you land on the site and are signed in (e.g. redirected to `/account` or home).
- [ ] **Google sign-in** — Click Google, complete flow. You end up signed in on the site (correct redirect to production, not localhost).
- [ ] **Account page** — While signed in, go to `/account`. “Welcome back, [name]” (or similar), order history if any, link to Shop. No errors.
- [ ] **Sign out** — Sign out from account/header. You’re logged out and can go to `/login` again.
- [ ] **Protected routes** — Logged out, open `/account` directly. You should be redirected to `/login`.

---

## 3. Welcome email (automation)

- [ ] **New user** — Sign in with a **new** email (magic link or Google) that has never had a welcome email. Within a short time, that inbox should receive a “Welcome to STAKD Cards” email (from noreply@, same styling as other app emails).
- [ ] **Existing user** — Sign in with an email that already received the welcome email. You should **not** get a second welcome email.
- [ ] **Admin** — In Admin → Emails → Automation, “Send welcome email after sign-up” is on. Check “Recent automated emails” for a `welcome` entry after the new-user test.

---

## 4. Cart & checkout (Stripe test mode)

- [ ] **Add to cart** — On `/products`, add one or more items. Cart count in header increases.
- [ ] **Cart page** — Go to `/cart`. Items, quantities, subtotal, and “Proceed to Checkout” are correct.
- [ ] **Cart reminder (nudge)** — On `/cart`, in “Want a reminder?”, enter an email and click “Remind me”. You see success message. (Nudge will send after the delay set in Admin → Automation, when the cron runs.)
- [ ] **Checkout** — Click “Proceed to Checkout” then “Pay with Stripe”. You’re on Stripe Checkout (test mode). Use test card `4242 4242 4242 4242`, any future expiry, any CVC, any billing/shipping. Complete payment.
- [ ] **Success page** — You’re redirected to `/checkout/success` (or your success URL). Message and order summary look correct.
- [ ] **Order confirmation email** — Inbox receives “Order Confirmed” (from orders@ or your configured sender), STAKD styling, order details and link to account.
- [ ] **Account order history** — On `/account`, the new order appears with status (e.g. Pending).

---

## 5. Newsletter

- [ ] **Subscribe (landing)** — On `/`, enter email in the newsletter block and submit. Success message or no error.
- [ ] **Admin subscribers** — In Admin → Emails → Subscribers, the new email appears as active.
- [ ] **Newsletter blast (optional)** — In Admin → Emails → Newsletter Blast, fill subject/headline/body, click “Send to all subscribers”. Confirm; check inbox for the newsletter (from noreply@). “Recent automated emails” shows type `newsletter`.

---

## 6. Admin dashboard & orders

- [ ] **Admin access** — Log in with an account that has `role = 'admin'` in Supabase `profiles`. Go to `/admin`. You see the dashboard (not redirect to login).
- [ ] **Non-admin** — Log in with a normal user; open `/admin`. You should be redirected or see access denied (no dashboard).
- [ ] **Orders list** — Admin → Orders. Your test order appears with correct status, customer, total.
- [ ] **Order detail** — Click the order. Details and status are correct. If the order is in a “shipped” state and has tracking, “Send Shipping Notification” is available.
- [ ] **Send shipping email** — For a test order, set status to Shipped and add a tracking number if needed. Click “Send Shipping Notification”. Inbox receives “Your order has shipped” with tracking link.

---

## 7. Admin — Emails tab

- [ ] **Sent log** — Admin → Emails → Sent Log. Recent emails (order confirmation, welcome, nudge, newsletter, etc.) appear with to, subject, type, status, date.
- [ ] **Compose** — Compose a one-off email to your address. Send. It arrives and is logged.
- [ ] **Automation** — Automation tab shows toggles (welcome, nudge) and nudge delay. “Recent automated emails” lists welcome/nudge/newsletter. Toggling and saving works.
- [ ] **Newsletter Blast** — As in section 5; subject/headline/body/CTA and “Send to all” work.
- [ ] **Templates** — Templates tab lists Order Confirmation, Order Shipped, Welcome, Cart Reminder (Nudge), Newsletter. Preview and “Send test email” work; test arrives with correct styling.
- [ ] **Subscribers** — Subscribers tab lists signups; unsubscribing a user updates status.

---

## 8. Nudge cron (cart reminder)

- [ ] **Request reminder** — Add items to cart, go to `/cart`, submit “Want a reminder?” with your email.
- [ ] **Cron runs** — Either wait until the next cron run (e.g. hourly) or trigger it manually (e.g. cron-job.org “Execute now”). After the configured delay (e.g. 24h) from when you requested the reminder, the nudge should send. (For a quick test, temporarily set “Nudge delay” to 1 hour in Admin → Automation, wait an hour, then run the cron.)
- [ ] **Nudge email** — Inbox receives “Your cart is waiting” with cart summary and “Finish my order” link. Admin → Emails → Sent Log shows type `nudge`.

---

## 9. Unsubscribe (if you have a page)

- [ ] If you have an `/unsubscribe` (or similar) page or link in emails, open it and confirm it marks the user unsubscribed and shows the right message. Admin → Subscribers should show that user as Unsubscribed.

---

## 10. Quick smoke checks

- [ ] **404** — Open a bad URL (e.g. `/foo`). You’re redirected to home (or your 404 behavior).
- [ ] **Links in emails** — From magic link, order confirmation, welcome, nudge, and newsletter emails, click main CTAs (e.g. “Sign in”, “Track your order”, “Finish my order”). They go to the correct pages on www.stakdcards.com.
- [ ] **Stripe test vs live** — Confirm you’re on **test keys** until you’re ready; then switch to live keys and run one real payment before announcing.

---

## Notes

- **Stripe test cards:** [Stripe Testing](https://docs.stripe.com/testing#cards) (e.g. 4242… for success).
- **Supabase:** Ensure Site URL and Redirect URLs in Auth settings point to `https://www.stakdcards.com` (and any custom domains).
- **Resend:** All app-sent emails use your verified domain; confirm SPF/DKIM so inbox delivery is good.
- **Cron:** Nudge cron must run on schedule with the correct `Authorization: Bearer CRON_SECRET` (or `x-cron-secret`) so nudges send after the delay.

Mark items as you go; fix any failures before launch.
