// Order emails (plain text) sent over SMTP. Works with Gmail (app password), Brevo, Resend SMTP, etc.
const nodemailer = require('nodemailer');
const E = process.env;
const PHONES = '067 772 2105 / 082 665 0024';
const on = () => !!(E.SMTP_HOST && E.SMTP_USER && E.SMTP_PASS && E.MAIL_FROM);
let tx = null;
async function send(m) {
  if (!on() || !m || !m.to) return false;
  const port = +E.SMTP_PORT || 587;
  tx = tx || nodemailer.createTransport({ host: E.SMTP_HOST, port, secure: port === 465, auth: { user: E.SMTP_USER, pass: E.SMTP_PASS }, connectionTimeout: 15000, socketTimeout: 20000 });
  await tx.sendMail({ from: E.MAIL_FROM, to: m.to, subject: m.subject, text: m.text });
  return true;
}
const R = n => 'R' + Math.round(n).toLocaleString('en-ZA');
const clean = s => String(s || '').replace(/[\r\n]+/g, ' ').slice(0, 200);
const items = o => o.lines.map(l => '- ' + l.qty + ' x ' + clean(l.n) + ' (' + R(l.unit) + ' each)').join('\n');
const first = o => clean(o.customer.name).split(' ')[0] || 'there';
const FOOT = '\nKFE (Kits FastExpress) is a trading name of NXTDRV EV (Pty) Ltd, reg. 2026/492988/07.\n5423 Ramkoka Drive, Riverside Kagiso 2 Ext 8, Krugersdorp, Gauteng, 1754\n';
const trackUrl = n => 'https://t.17track.net/en#nums=' + encodeURIComponent(n);

// Plain-English status for customers, from CJ's order status and tracking number
function friendly(c) {
  const s = String(c.status || '').toUpperCase();
  if (/DELIVER/.test(s)) return 'Delivered';
  if (/CANCEL/.test(s)) return 'Cancelled - we will contact you about a refund';
  if (/SHIPPED|DISPATCH/.test(s) || c.trackNumber) return 'Shipped';
  if (/UNSHIPPED|PROCESS|PENDING/.test(s)) return 'Being prepared for dispatch';
  return 'Order received - being processed';
}
function customerPaid(o, front) {
  return { to: o.customer.email, subject: 'KFE order ' + o.ref + ' confirmed', text:
`Hi ${first(o)},

Thank you for your KFE order ${o.ref}. We have received your payment of ${R(o.total)}.

Items:
${items(o)}${o.shipping ? '\nShipping: ' + R(o.shipping) : ''}

Delivery to: ${clean(o.customer.address)}, ${o.customer.province}

What happens next:
1. We place your order with our China fulfilment partner.
2. Your parcel is shipped to South Africa. The estimated delivery time is shown on each product and is usually several weeks.
3. We will email you a tracking number as soon as it ships.

Track your order any time: ${front}/track.html (you will need your order reference and this email address).
Returns and refunds: ${front}/returns.html

Questions? Reply to this email or call ${PHONES}.
${FOOT}` };
}
function shipped(o, c, front) {
  return { to: o.customer.email, subject: 'Your KFE order ' + o.ref + ' has shipped', text:
`Hi ${first(o)},

Good news: your KFE order ${o.ref} has shipped.

Tracking number: ${c.trackNumber}
Track it here: ${trackUrl(c.trackNumber)}

Tracking can take a few days to start showing movement, and international parcels can take several weeks. You can also check your order at ${front}/track.html

Questions? Reply to this email or call ${PHONES}.
${FOOT}` };
}
function owner(o, front, fx) {
  const cost = o.lines.reduce((a, l) => a + ((l.costUsd || 0) + (l.freightUsd || 0)) * l.qty, 0) * fx;
  const cj = (o.cj || []).map(c => 'CJ order ' + (c.orderId || '?') + ' (' + (c.status || '?') + ') amount ' + (c.amount || '?') + '\nPAY HERE: ' + (c.payUrl || '(no pay link: open CJ > Orders)')).join('\n') || 'CJ order NOT created: ' + (o.cjError || 'CJ is not enabled');
  return { to: E.OWNER_EMAIL || 'nextdriveev1@gmail.com', subject: 'NEW PAID ORDER ' + o.ref + ' ' + R(o.total), text:
`New paid order ${o.ref}

Total paid: ${R(o.total)}${o.shipping ? ' (includes shipping ' + R(o.shipping) + ')' : ''}
Estimated CJ product + shipping cost: ${R(cost)} (before duty, VAT and PayFast fees)

Customer: ${clean(o.customer.name)}
Phone: ${clean(o.customer.phone)}
Email: ${clean(o.customer.email)}
Address: ${clean(o.customer.address)}, ${o.customer.province}
ID: ${o.idType === 'id' ? 'SA ID' : 'Passport'} ending ${o.idLast4}

Items:
${items(o)}

${cj}
${o.unverified ? '\nWARNING: stock and price could not be re-checked with CJ before payment.\n' : ''}
Next step: check the address, then pay the CJ order using the link above.
Admin page: ${E.BACKEND_URL || ''}/admin
` };
}
module.exports = { on, send, friendly, trackUrl, customerPaid, shipped, owner };
