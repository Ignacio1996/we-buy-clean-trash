import 'server-only';

// Welcome email for new resident signups.
//
// Visual: "Sticker Sections" — white base broken into pastel section blocks
// (yellow / sky / mint), heavy sans-serif headings, pill button with a hard
// offset shadow. Built with a single 600px-wide table so it renders the same
// in Gmail, Apple Mail, and Outlook (no flex / grid / external CSS).
//
// Deliverability notes (why the markup looks the way it does):
//   - Plain-text alternative mirrors the HTML body, so spam scoring engines
//     don't ding us for an HTML-only message.
//   - Subject is short, sentence case, no exclamation points or money emojis
//     (avoids common Bayesian spam triggers).
//   - Preheader is real, human-readable copy — not hidden keyword stuffing.
//   - Inline CSS only; no <style>, no web fonts, no remote images. The whole
//     message is text, so the text:image ratio stays at 100%.
//   - Pure ASCII in the subject (no emoji), modest link count (one CTA),
//     and a CAN-SPAM-style footer with a physical mailing address and
//     unsubscribe hint.
//   - Sender authentication (SPF / DKIM / DMARC) and the From: domain are
//     configured on the SMTP side of the Firestore Send Email extension —
//     they are the other half of staying out of spam.

const PHYSICAL_ADDRESS =
  process.env.WBCT_PHYSICAL_ADDRESS ||
  'We Buy Clean Trash, Oakland, CA';

const SUPPORT_EMAIL =
  process.env.WBCT_SUPPORT_EMAIL || 'support@webuycleantrash.com';

const SIGNUP_BONUS_POINTS = 100;
const SIGNUP_BONUS_DOLLARS = '1.00'; // 1,000 pts = $10  →  100 pts = $1

function fmtPts(n: number): string {
  return n.toLocaleString('en-US');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildResidentWelcomeEmail(args: {
  name: string;
  dashboardUrl: string;
  orderBagsUrl: string;
}): { subject: string; text: string; html: string } {
  const name = args.name.trim() || 'there';
  const firstName = name.split(/\s+/)[0];

  const subject = `Welcome to We Buy Clean Trash, ${firstName}`;
  const preheader = `Your ${fmtPts(
    SIGNUP_BONUS_POINTS,
  )}-point signup bonus is ready. Here is what happens next.`;

  const text = [
    `Welcome to We Buy Clean Trash, ${firstName}.`,
    ``,
    `Your account is set up and your ${fmtPts(SIGNUP_BONUS_POINTS)}-point signup bonus`,
    `(worth $${SIGNUP_BONUS_DOLLARS}) is already in your balance.`,
    ``,
    `Open your dashboard:`,
    args.dashboardUrl,
    ``,
    `How it works:`,
    `  1. Order bags. Your first box of 10 is on us.`,
    `  2. Fill them with clean recyclables and leave them at your designated`,
    `     pickup area on your pickup day.`,
    `  3. We weigh and grade them at the depot. Points land in your account`,
    `     within a day. 1,000 points = a $10 gift card.`,
    ``,
    `Order your first box of bags:`,
    args.orderBagsUrl,
    ``,
    `Questions? Reply to this email or write us at ${SUPPORT_EMAIL}.`,
    ``,
    `--`,
    `${PHYSICAL_ADDRESS}`,
    `You are receiving this because you just created a We Buy Clean Trash`,
    `account. To stop receiving messages, reply with "unsubscribe".`,
  ].join('\n');

  const safeName = escapeHtml(firstName);
  const safeDashboardUrl = encodeURI(args.dashboardUrl);
  const safeOrderBagsUrl = encodeURI(args.orderBagsUrl);
  const safeSupport = escapeHtml(SUPPORT_EMAIL);
  const safeAddress = escapeHtml(PHYSICAL_ADDRESS);
  const safePreheader = escapeHtml(preheader);

  const ink = '#111111';
  const inkSoft = '#6B6B6B';
  const brand = '#E11D2A';
  const brandDark = '#A6121C';
  const yellow = '#FFEB52';
  const mint = '#D9F2D9';
  const sky = '#E4EEFB';
  const line = '#ECECEC';
  const sans = '"Helvetica Neue", Helvetica, Arial, sans-serif';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light only">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f1ec;font-family:${sans};color:${ink};">
    <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${safePreheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f1ec;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:2px solid ${ink};border-radius:18px;overflow:hidden;">
            <!-- Wordmark header -->
            <tr>
              <td style="padding:24px 28px 16px;border-bottom:1px solid ${line};">
                <div style="font-family:${sans};font-size:20px;font-weight:900;letter-spacing:-0.6px;text-transform:uppercase;color:${ink};line-height:1;">
                  We Buy Clean <span style="color:${brand};">Trash.</span>
                </div>
              </td>
            </tr>

            <!-- Yellow hero block: balance -->
            <tr>
              <td style="background:${yellow};padding:32px 28px 28px;">
                <div style="font-family:${sans};font-size:12px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:${ink};opacity:0.7;margin:0 0 8px;">
                  Hello, ${safeName}
                </div>
                <div style="font-family:${sans};font-size:48px;font-weight:900;letter-spacing:-1.8px;line-height:0.95;color:${ink};margin:0 0 8px;">
                  $${SIGNUP_BONUS_DOLLARS}
                </div>
                <div style="font-family:${sans};font-size:16px;font-weight:800;color:${ink};margin:0;">
                  ${fmtPts(SIGNUP_BONUS_POINTS)} points credited to your account
                </div>
              </td>
            </tr>

            <!-- Dashboard CTA -->
            <tr>
              <td style="padding:28px 28px 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="border-radius:999px;background:${brand};box-shadow:0 4px 0 ${brandDark};">
                      <a href="${safeDashboardUrl}" style="display:block;padding:18px 24px;font-family:${sans};font-size:18px;font-weight:900;letter-spacing:-0.2px;color:#ffffff;text-decoration:none;border-radius:999px;">
                        Open your dashboard &nbsp;&rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Sky block: what the bonus does -->
            <tr>
              <td style="background:${sky};padding:24px 28px;">
                <div style="font-family:${sans};font-size:12px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:${inkSoft};margin:0 0 8px;">
                  Your signup bonus
                </div>
                <div style="font-family:${sans};font-size:22px;font-weight:900;letter-spacing:-0.5px;line-height:1.2;color:${ink};margin:0 0 6px;">
                  ${fmtPts(SIGNUP_BONUS_POINTS)} points is a head start.
                </div>
                <div style="font-family:${sans};font-size:14px;font-weight:700;color:${ink};opacity:0.75;line-height:1.45;margin:0;">
                  1,000 points cashes out as a $10 gift card. You are already 10% of the way to your first one.
                </div>
              </td>
            </tr>

            <!-- Mint block: how it works (3 steps) -->
            <tr>
              <td style="background:${mint};padding:28px 28px 24px;">
                <div style="font-family:${sans};font-size:22px;font-weight:900;letter-spacing:-0.6px;color:${ink};margin:0 0 16px;">
                  How it works
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="40" valign="top" style="padding:6px 14px 6px 0;">
                      <div style="width:36px;height:36px;border-radius:50%;background:${ink};color:#ffffff;font-family:${sans};font-size:16px;font-weight:900;line-height:36px;text-align:center;">1</div>
                    </td>
                    <td valign="top" style="padding:6px 0;">
                      <div style="font-family:${sans};font-size:16px;font-weight:900;color:${ink};letter-spacing:-0.2px;">Order bags</div>
                      <div style="font-family:${sans};font-size:13px;font-weight:600;color:${ink};opacity:0.7;line-height:1.4;">Your first box of 10 is on us. Free delivery over $20.</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="40" valign="top" style="padding:6px 14px 6px 0;">
                      <div style="width:36px;height:36px;border-radius:50%;background:${ink};color:#ffffff;font-family:${sans};font-size:16px;font-weight:900;line-height:36px;text-align:center;">2</div>
                    </td>
                    <td valign="top" style="padding:6px 0;">
                      <div style="font-family:${sans};font-size:16px;font-weight:900;color:${ink};letter-spacing:-0.2px;">Fill and set out</div>
                      <div style="font-family:${sans};font-size:13px;font-weight:600;color:${ink};opacity:0.7;line-height:1.4;">Clean recyclables. Leave bags at your designated pickup area on pickup day.</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="40" valign="top" style="padding:6px 14px 6px 0;">
                      <div style="width:36px;height:36px;border-radius:50%;background:${ink};color:#ffffff;font-family:${sans};font-size:16px;font-weight:900;line-height:36px;text-align:center;">3</div>
                    </td>
                    <td valign="top" style="padding:6px 0;">
                      <div style="font-family:${sans};font-size:16px;font-weight:900;color:${ink};letter-spacing:-0.2px;">Return and redeem</div>
                      <div style="font-family:${sans};font-size:13px;font-weight:600;color:${ink};opacity:0.7;line-height:1.4;">Points land in your account within a day. Cash out as gift cards anytime.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Secondary CTA -->
            <tr>
              <td style="padding:24px 28px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="border-radius:999px;background:#ffffff;border:2px solid ${ink};box-shadow:0 4px 0 ${ink};">
                      <a href="${safeOrderBagsUrl}" style="display:block;padding:16px 24px;font-family:${sans};font-size:16px;font-weight:900;letter-spacing:-0.2px;color:${ink};text-decoration:none;border-radius:999px;">
                        Order your first box &nbsp;&rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 28px 28px;border-top:1px solid ${line};background:#ffffff;">
                <div style="font-family:${sans};font-size:12px;font-weight:700;color:${inkSoft};line-height:1.6;">
                  Questions? Reply to this email or write us at <a href="mailto:${safeSupport}" style="color:${ink};text-decoration:underline;">${safeSupport}</a>.
                </div>
                <div style="font-family:${sans};font-size:11px;font-weight:600;color:${inkSoft};line-height:1.6;margin-top:12px;">
                  ${safeAddress}<br>
                  You are receiving this because you just created a We Buy Clean Trash account. To stop receiving messages, reply with &ldquo;unsubscribe&rdquo;.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
