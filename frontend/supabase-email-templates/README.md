# STAKD Cards — Supabase Email Templates

All auth and security emails use the same STAKD styling (light theme: gray background, white card, indigo header) so they match app-sent emails and work well in all clients.

## How to use

1. Open **Supabase Dashboard** → **Authentication** → **Email Templates** (or **Auth** → **Email** in some layouts).
2. Click the template you want to customize (e.g. **Magic link**, **Confirm sign up**).
3. Set the **Subject** line to the value suggested in the table below.
4. Replace the **Message body** with the full HTML from the corresponding `.html` file (copy from `<!DOCTYPE>` through `</html>`).
5. Click **Save**.

Do **not** remove or change the Supabase template variables (e.g. `{{ .ConfirmationURL }}`, `{{ .Email }}`). They are replaced by Supabase when the email is sent.

## Authentication templates

| Template             | File                          | Suggested subject                    |
|----------------------|-------------------------------|--------------------------------------|
| Confirm sign up      | `confirm-signup.html`         | Confirm your STAKD account           |
| Invite user          | `invite-user.html`           | You're invited to STAKD Cards         |
| Magic link           | `magic-link.html`            | Sign in to STAKD Cards                |
| Change email address | `change-email.html`          | Confirm your new email — STAKD       |
| Reset password       | `reset-password.html`        | Reset your STAKD password            |
| Reauthentication     | `reauthentication.html`      | Your STAKD sign-in code              |

## Security notification templates

Under **Authentication** → **Notifications** (or similar), you can enable and customize these. Use the matching HTML file for the message body.

| Notification              | File                                  | Suggested subject                    |
|---------------------------|---------------------------------------|--------------------------------------|
| Password changed          | `notification-password-changed.html` | Your STAKD password was changed     |
| Email address changed     | `notification-email-changed.html`     | Your STAKD email was changed        |
| Phone number changed      | `notification-phone-changed.html`    | Your STAKD phone was changed        |
| Identity linked           | `notification-identity-linked.html`  | New sign-in method linked — STAKD    |
| Identity unlinked         | `notification-identity-unlinked.html`| Sign-in method removed — STAKD      |
| MFA method added          | `notification-mfa-added.html`        | New sign-in step added — STAKD      |
| MFA method removed        | `notification-mfa-removed.html`      | Sign-in step removed — STAKD        |

## Design tokens (light theme)

- Background: `#e5e7eb`, card: `#ffffff`, border: `#e5e7eb`
- Header: `#2A2A69` (indigo)
- Button: `#434EA1`
- Text: `#1f2937`, muted: `#4b5563` / `#6b7280`
- Footer includes: Shop, Cart, About, Contact, FAQ, Terms, Privacy, hello@stakdcards.com
