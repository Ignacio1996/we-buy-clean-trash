// Standalone Twilio smoke test. Mirrors what src/lib/sms/send.ts does in
// SMS_MODE=twilio, but avoids importing it (that module is `server-only`
// and only loads inside Next).
import twilio from 'twilio';

function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

async function main() {
  const toRaw = process.argv[2];
  if (!toRaw) {
    console.error('usage: npm run test:sms -- <phone>   e.g. +15551234567 or 5551234567');
    process.exit(1);
  }
  const to = toE164(toRaw);
  if (!to) {
    console.error(`Could not parse "${toRaw}" as E.164.`);
    process.exit(1);
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.error(
      'Missing one of TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER in .env.local',
    );
    process.exit(1);
  }

  console.log(`SMS_MODE=${process.env.SMS_MODE ?? '(unset)'}  from=${from}  to=${to}`);
  const client = twilio(sid, token);
  const msg = await client.messages.create({
    to,
    from,
    body: `WBCT test — ${new Date().toLocaleTimeString()}`,
  });
  console.log(`OK  sid=${msg.sid}  status=${msg.status}`);
}

main().catch((err) => {
  console.error('FAILED:', err?.message ?? err);
  process.exit(1);
});
