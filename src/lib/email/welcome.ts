import 'server-only';

export interface ResidentWelcomeEmailArgs {
  firstName: string;
  orderBagsUrl: string;
}

export function buildResidentWelcomeEmail(args: ResidentWelcomeEmailArgs): {
  subject: string;
  text: string;
  html: string;
} {
  const { firstName, orderBagsUrl } = args;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';

  const subject = 'Welcome to We Buy Clean Trash — get your first box of bags';

  const text =
    `${greeting}\n\n` +
    `Welcome to We Buy Clean Trash. We turn your clean recyclables into gift cards — no sorting, no bins to lug.\n\n` +
    `Your first box of 10 bags is on us. Order it here and we'll deliver on your next pickup route:\n${orderBagsUrl}\n\n` +
    `Quick how-it-works:\n` +
    `  1. Order bags — first box of 10 is free, free delivery on orders over $20.\n` +
    `  2. Fill clean — rinse what goes in, caps off bottles, no glass shards.\n` +
    `  3. Pickup day — leave bags at your designated pickup area.\n` +
    `  4. Redeem — 1,000 points = $10 gift card.\n\n` +
    `You already have 100 signup-bonus points in your account.\n\n` +
    `— The We Buy Clean Trash team`;

  const html = `<!doctype html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#1F2A22; background:#F4F0E8; margin:0; padding:24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background:#ffffff; border:2px solid #1F2A22; border-radius:18px;">
    <tr>
      <td style="padding:28px 28px 8px;">
        <div style="font-size:11px; font-weight:900; letter-spacing:1.4px; text-transform:uppercase; color:#2D5A3D;">We Buy Clean Trash</div>
        <h1 style="font-family:Georgia,serif; font-style:italic; font-size:30px; line-height:1.1; color:#1F2A22; margin:14px 0 8px;">Your trash is <span style="color:#2D5A3D;">worth money.</span></h1>
        <p style="font-size:15px; line-height:1.5; color:#1F2A22; margin:8px 0 0;">${greeting}</p>
        <p style="font-size:15px; line-height:1.5; color:#1F2A22; margin:8px 0 0;">Welcome — we turn your clean recyclables into gift cards. No sorting machines, no bins to lug.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 8px;">
        <a href="${orderBagsUrl}" style="display:inline-block; background:#2D5A3D; color:#ffffff; text-decoration:none; font-weight:700; font-size:15px; padding:14px 22px; border-radius:999px; border:2px solid #1F2A22;">Order your first box of bags →</a>
        <div style="font-size:12px; color:#5A6358; margin-top:10px;">First box of 10 is on us · Free delivery on orders over $20</div>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 8px;">
        <div style="font-size:12px; font-weight:900; letter-spacing:1.2px; text-transform:uppercase; color:#5A6358; margin-bottom:10px;">How it works</div>
        <ol style="padding-left:18px; margin:0; font-size:14px; line-height:1.55; color:#1F2A22;">
          <li>Order bags — first box of 10 free, free delivery over $20.</li>
          <li>Fill clean — rinse, caps off, no glass shards.</li>
          <li>Pickup day — leave bags at your designated pickup area.</li>
          <li>Redeem — 1,000 points = $10 gift card.</li>
        </ol>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 28px;">
        <div style="background:#E8EFE6; border:2px solid #1F2A22; border-radius:14px; padding:14px 16px; font-size:14px; color:#1F2A22;">
          You already have <strong>100 signup-bonus points</strong> in your account.
        </div>
      </td>
    </tr>
  </table>
  <div style="text-align:center; font-size:11px; color:#5A6358; margin-top:18px;">— The We Buy Clean Trash team</div>
</body>
</html>`;

  return { subject, text, html };
}
