/**
 * STAKD Cards — Email Templates
 * All functions return an HTML string ready for Resend.
 */

const BASE_URL = 'https://www.stakdcards.com';

const BRAND = {
    indigo: '#2A2A69',
    indigoMid: '#434EA1',
    indigoLt: '#6D81BB',
    offWhite: '#F3F1E4',
    charcoal: '#181C1D',
    bg: '#0D0E11',
    surface: '#191B20',
    border: '#2C303A',
};

function wrapper(title, body) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:${BRAND.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:${BRAND.offWhite}; }
    .wrap { max-width:560px; margin:0 auto; padding:40px 20px; }
    .card { background:${BRAND.surface}; border:1px solid ${BRAND.border}; border-radius:16px; overflow:hidden; }
    .header { background:${BRAND.indigo}; padding:28px 32px; text-align:center; }
    .header img { height:28px; }
    .body { padding:32px; }
    h1 { font-size:22px; font-weight:800; margin:0 0 8px; color:${BRAND.offWhite}; }
    p { font-size:14px; line-height:1.7; color:#BEBBAC; margin:0 0 16px; }
    .btn { display:inline-block; padding:12px 28px; border-radius:10px; background:${BRAND.indigoMid}; color:#fff !important; font-weight:700; font-size:14px; text-decoration:none; margin-top:4px; }
    .divider { border:none; border-top:1px solid ${BRAND.border}; margin:24px 0; }
    .row { display:flex; justify-content:space-between; font-size:13px; padding:6px 0; border-bottom:1px solid ${BRAND.border}; }
    .label { color:#898675; }
    .val { font-weight:600; color:${BRAND.offWhite}; }
    .footer { text-align:center; padding:24px 20px 8px; font-size:11px; color:#565349; line-height:1.8; }
    .footer a { color:#565349; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header">
        <img src="${BASE_URL}/stakd-wordmark-offwhite.png" alt="STAKD Cards" />
      </div>
      <div class="body">
        ${body}
      </div>
    </div>
    <div class="footer">
      STAKD Cards &bull; Handmade with care<br/>
      <a href="${BASE_URL}/account">My Account</a> &bull;
      <a href="mailto:hello@stakdcards.com">hello@stakdcards.com</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Order confirmation email sent right after checkout.
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.orderId
 * @param {Array}  params.items  - [{ name, quantity, price }]
 * @param {number} params.subtotal
 * @param {number} params.tax
 * @param {number} params.shipping
 * @param {number} params.total
 * @param {string} params.address
 */
export function orderConfirmation({ name, orderId, items = [], subtotal, tax, shipping, total, address }) {
    const shortId = (orderId || '').replace(/-/g, '').slice(0, 6).toUpperCase();
    const itemRows = items.map(item => `
      <div class="row">
        <span class="label">${item.name || item.product_id} × ${item.quantity}</span>
        <span class="val">$${Number(item.price * item.quantity).toFixed(2)}</span>
      </div>`).join('');

    return wrapper('Order Confirmed — STAKD Cards', `
      <h1>Order Confirmed! 🎉</h1>
      <p>Hey ${name || 'there'}, thanks for your order. We'll start crafting it right away.</p>
      <p style="font-size:13px; color:#898675;">Order <strong style="color:${BRAND.offWhite}">#${shortId}</strong></p>
      <hr class="divider" />
      ${itemRows}
      <hr class="divider" />
      <div class="row"><span class="label">Subtotal</span><span class="val">$${Number(subtotal).toFixed(2)}</span></div>
      <div class="row"><span class="label">Shipping</span><span class="val">${Number(shipping) > 0 ? '$' + Number(shipping).toFixed(2) : 'Free'}</span></div>
      <div class="row"><span class="label">Tax</span><span class="val">$${Number(tax).toFixed(2)}</span></div>
      <div class="row" style="border:none"><span class="label" style="font-weight:700;color:${BRAND.offWhite}">Total</span><span class="val" style="font-size:16px">$${Number(total).toFixed(2)}</span></div>
      ${address ? `<p style="margin-top:20px;font-size:12px;color:#898675;">Ships to: <strong style="color:${BRAND.offWhite}">${address}</strong></p>` : ''}
      <div style="margin-top:24px"><a class="btn" href="${BASE_URL}/account">Track Your Order</a></div>
    `);
}

/**
 * Shipped notification email with tracking info.
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.orderId
 * @param {string} params.trackingNumber
 * @param {string} params.labelUrl
 * @param {string} params.carrier  - e.g. "USPS"
 */
export function orderShipped({ name, orderId, trackingNumber, labelUrl, carrier = 'USPS' }) {
    const shortId = (orderId || '').replace(/-/g, '').slice(0, 6).toUpperCase();
    return wrapper('Your Order Has Shipped — STAKD Cards', `
      <h1>It's on its way! 📦</h1>
      <p>Hey ${name || 'there'}, your STAKD Cards order <strong style="color:${BRAND.offWhite}">#${shortId}</strong> has been shipped via <strong style="color:${BRAND.offWhite}">${carrier}</strong>.</p>
      <hr class="divider" />
      <div class="row"><span class="label">Tracking Number</span><span class="val" style="font-family:monospace">${trackingNumber || '—'}</span></div>
      <hr class="divider" />
      <p>Track your package with your carrier's website or visit your account for order details.</p>
      <div style="margin-top:8px;display:flex;gap:12px;flex-wrap:wrap">
        <a class="btn" href="${BASE_URL}/account">View Order</a>
        ${labelUrl ? `<a class="btn" style="background:#22c55e" href="${labelUrl}" target="_blank">View Label</a>` : ''}
      </div>
    `);
}

/**
 * Welcome email for new accounts / newsletter subscribers.
 * @param {object} params
 * @param {string} params.name
 */
export function welcomeEmail({ name }) {
    return wrapper('Welcome to STAKD Cards', `
      <h1>Welcome to STAKD!</h1>
      <p>Hey ${name || 'there'} 👋 — Thanks for joining the STAKD Cards community.</p>
      <p>We make <strong style="color:${BRAND.offWhite}">handcrafted shadowbox cards</strong> that turn any playing card into a one-of-a-kind piece of art. Every order is made by hand, just for you.</p>
      <hr class="divider" />
      <p>Here's what you can do with your new account:</p>
      <ul style="font-size:14px;color:#BEBBAC;line-height:2;padding-left:20px">
        <li>Track all your orders in one place</li>
        <li>Get early access to limited drops</li>
        <li>Manage your profile and shipping preferences</li>
      </ul>
      <div style="margin-top:24px"><a class="btn" href="${BASE_URL}/products">Shop the Collection</a></div>
    `);
}

/**
 * Newsletter / announcement template.
 * @param {object} params
 * @param {string} params.subject
 * @param {string} params.headline
 * @param {string} params.bodyHtml  - Inner HTML for the message body (pre-sanitized)
 * @param {string} params.ctaText
 * @param {string} params.ctaUrl
 */
export function newsletterTemplate({ subject, headline, bodyHtml, ctaText, ctaUrl }) {
    return wrapper(subject || 'STAKD Cards Newsletter', `
      <h1>${headline || 'News from STAKD'}</h1>
      <div style="font-size:14px;line-height:1.8;color:#BEBBAC">${bodyHtml || ''}</div>
      ${ctaText && ctaUrl ? `<div style="margin-top:28px"><a class="btn" href="${ctaUrl}">${ctaText}</a></div>` : ''}
      <hr class="divider" />
      <p style="font-size:11px;color:#565349">You're receiving this because you subscribed to STAKD Cards updates. 
      <a href="${BASE_URL}/unsubscribe" style="color:#565349">Unsubscribe</a></p>
    `);
}
