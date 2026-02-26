# Email setup (Resend, automation, and sender addresses)

## 1. Resend domain and sender addresses

### Domain (stakdcards.com)

- In **Resend**: [Domains](https://resend.com/domains) → Add **stakdcards.com**.
- Add the DNS records Resend shows (TXT for verification/SPF, TXT for DKIM, MX for return path) at your DNS provider (e.g. Squarespace).
- Verify the domain in Resend. Once verified, you can send from **any** address at that domain (e.g. `noreply@stakdcards.com`, `orders@stakdcards.com`) — no extra setup in Resend for each address.

### Where “from” addresses are set in code

| Sender address | Used for | File |
|----------------|----------|------|
| **orders@stakdcards.com** | Order confirmation, order shipped, Admin Compose, template test emails | `frontend/api/send-email.js` (line ~43) |
| **noreply@stakdcards.com** | Welcome, cart nudge, newsletter blast | `frontend/api/send-welcome.js`, `frontend/api/send-nudges.js`, `frontend/api/send-newsletter-blast.js` |

To change the **orders** sender (e.g. to `noreply@stakdcards.com` or another address):

1. Open `frontend/api/send-email.js`.
2. Edit the `from` field in the `resend.emails.send(...)` call, e.g.  
   `from: 'STAKD Cards <orders@stakdcards.com>'`  
   to  
   `from: 'STAKD Cards <noreply@stakdcards.com>'`  
   (or whatever address you want).
3. Redeploy. No Resend dashboard change is needed as long as the domain is verified.

---

## 2. Cron for cart reminder nudges (step-by-step)

Nudge emails are sent only when something calls your nudge API. A **cron job** is a scheduled task that hits a URL on a timer (e.g. every hour). You’ll use a free external service to call your API and pass a secret so only it can trigger nudges.

---

### Step 1: Generate the secret

You need a long random string that only your app and the cron service know. Two ways:

**Option A – Terminal / command line**

- **On Mac or Linux:** Open the **Terminal** app and run:
  ```bash
  openssl rand -hex 32
  ```
  You’ll get one line of random characters (e.g. `a1b2c3d4e5f6...`). That’s your secret. Copy the whole line and save it somewhere safe (e.g. a password manager or a temporary note).

- **On Windows:** Open **PowerShell** (search “PowerShell” in the Start menu). Run:
  ```powershell
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
  ```
  Or use Option B below if that’s easier.

**Option B – Website**

- Go to https://www.random.org/strings/ (or any “random string generator”).
- Generate one string, at least 32 characters, and copy it. That’s your secret.

**Important:** Use this exact same value in both (1) Vercel and (2) the cron service below. Don’t share it publicly.

---

### Step 2: Add the secret to Vercel

So your app can check that incoming cron requests are legitimate:

1. Go to **https://vercel.com** and log in.
2. Open your **project** (the one that hosts stakdcards.com).
3. Click the **Settings** tab at the top.
4. In the left sidebar, click **Environment Variables**.
5. Under “Key”, type: `CRON_SECRET`
6. Under “Value”, paste the secret you generated in Step 1.
7. Select **Production** (and **Preview** if you want to test on preview deployments).
8. Click **Save**.
9. Redeploy the project once so the new variable is active (Deployments → … on latest → Redeploy).

---

### Step 3: Create the cron job (using cron-job.org)

This is a free service that will call your API every hour and send the secret in a header.

1. **Sign up**
   - Go to **https://cron-job.org**.
   - Click **Sign up** and create a free account (email + password). Confirm your email if asked.

2. **Create a new cron job**
   - After login, click **Create cronjob** (or “Cronjobs” in the menu, then “Create cronjob”).

3. **Title**
   - **Title:** e.g. `STAKD send cart nudges`

4. **URL**
   - **Address:** `https://www.stakdcards.com/api/send-nudges`  
     (Use your real production URL if different.)
   - Leave **Request method** as **GET**.

5. **Schedule**
   - Set **Every hour** (or “Every 1 hour”).  
   - Or under “Advanced”, use cron expression: `0 * * * *` (runs at minute 0 of every hour).

6. **Send the secret in a header**
   - Find the section for **Request headers** or **Advanced** → **Headers**.
   - Add a header:
     - **Name:** `Authorization`
     - **Value:** `Bearer YOUR_SECRET_HERE`  
       Replace `YOUR_SECRET_HERE` with the exact same secret you put in Vercel as `CRON_SECRET`.  
       There is a single space between `Bearer` and the secret. No quotes.
   - If the site only allows one header name/value pair, use:
     - **Name:** `x-cron-secret`
     - **Value:** (paste your secret only, no “Bearer”).

7. **Save**
   - Click **Create cronjob** or **Save**.

8. **Test once**
   - On the cron job’s page, look for **Execute now** or **Run once**. Click it.
   - After a few seconds, open your site → **Admin** → **Emails** → **Automation** and check “Recent automated emails” for type **nudge** (if there were any pending reminders). You can also check the cron service’s “Last run” / “History” to see that the request succeeded (e.g. HTTP 200).

---

### Step 4: Confirm it’s working

- Wait for the next scheduled run (e.g. top of the hour) or run “Execute now” again.
- In **Admin** → **Emails** → **Automation**, the table “Recent automated emails” will list any **nudge** emails sent.
- If someone had requested a cart reminder and the delay (e.g. 24 hours) has passed, they’ll receive the nudge after the next cron run.

---

### Troubleshooting

- **401 Unauthorized:** The header value doesn’t match `CRON_SECRET` in Vercel. Check for typos, extra spaces, and that you used the same value in both places. For `Authorization`, the value must be exactly `Bearer ` + your secret (one space).
- **No nudge emails:** Nudges only send when there are rows in `abandoned_cart_reminders` older than your “Nudge delay” (e.g. 24h) and not yet sent. Add a test reminder from the cart page, then either wait or temporarily set the delay to 1 hour and run the cron after an hour.

---

## 3. Supabase SMTP (auth emails)

For magic link, password reset, etc.:

1. **Supabase** → Project → **Authentication** → **Email Templates** (and paste your HTML templates as needed).
2. **Project Settings** → **Auth** → **SMTP**:
   - Enable **Custom SMTP**.
   - **Sender email:** `noreply@stakdcards.com`
   - **Sender name:** e.g. `STAKD Cards`
   - **Host:** `smtp.resend.com`
   - **Port:** 465 (SSL)
   - **Username:** `resend`
   - **Password:** your Resend API key

Auth emails will then be sent via Resend from `noreply@stakdcards.com`.

---

## 4. Admin access (RLS)

Automation settings and newsletter blast use Supabase tables with RLS:

- **email_automation:** only users with `profiles.role = 'admin'` can read/update.
- **email_subscribers:** admin can read; newsletter blast uses the API with the logged-in admin’s JWT.

Ensure the account you use for the Admin dashboard has a **profiles** row with `role = 'admin'` in Supabase (e.g. set in Table Editor or SQL).

---

## 5. Quick checklist

- [ ] Domain **stakdcards.com** added and verified in Resend; DNS (SPF, DKIM, MX) correct.
- [ ] `RESEND_API_KEY` set in hosting env (e.g. Vercel).
- [ ] `orders@` / `noreply@`: no setup in Resend beyond domain verification; change `from` in code if desired (`frontend/api/send-email.js` for orders).
- [ ] Cron for nudges: `CRON_SECRET` in env; cron job (Vercel or external) calling `GET /api/send-nudges` with `Authorization: Bearer CRON_SECRET` (or `x-cron-secret`).
- [ ] Supabase SMTP configured with Resend (sender `noreply@stakdcards.com`, host `smtp.resend.com`, port 465, password = Resend API key).
- [ ] Admin user has `role = 'admin'` in `profiles`.
