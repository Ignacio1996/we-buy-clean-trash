import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import { sendEmail } from '@/lib/email/send';
import {
  REDEMPTION_BRANDS,
  type RedemptionBrand,
  type RedemptionDoc,
} from '@/lib/types/redemption';
import type { AddressDoc, UserDoc } from '@/lib/types/user';

export const runtime = 'nodejs';

const ACTIVE_BRANDS: RedemptionBrand[] = ['amazon', 'walmart'];
const GIFT_CARD_POINTS = 1_000;
// Pilot marketing budget: $10 gift card × 100 users = $1,000.
// One redemption per resident, hard cap on total at 100.
export const PILOT_GIFT_CARD_CAP = 100;

function isBrand(value: unknown): value is RedemptionBrand {
  return typeof value === 'string' && (REDEMPTION_BRANDS as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'resident') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const raw = (json ?? {}) as Record<string, unknown>;
  const brand = isBrand(raw.brand) ? raw.brand : null;
  if (!brand || !ACTIVE_BRANDS.includes(brand)) {
    return NextResponse.json({ error: 'invalid_brand' }, { status: 400 });
  }
  const pointsSpent = GIFT_CARD_POINTS;

  // Pilot gating runs OUTSIDE the transaction (Firestore transactions can't run
  // queries, only doc gets). Concurrent requests at exactly the cap could each
  // pass this check before either commits — acceptable at pilot scale; revisit
  // when we open to a wider audience.
  const [existingForUserSnap, totalSnap] = await Promise.all([
    adminDb
      .collection('redemptions')
      .where('userId', '==', session.uid)
      .where('status', 'in', ['pending', 'fulfilled'])
      .limit(1)
      .get(),
    adminDb
      .collection('redemptions')
      .where('status', 'in', ['pending', 'fulfilled'])
      .count()
      .get(),
  ]);
  if (!existingForUserSnap.empty) {
    return NextResponse.json({ error: 'already_redeemed_pilot' }, { status: 403 });
  }
  if (totalSnap.data().count >= PILOT_GIFT_CARD_CAP) {
    return NextResponse.json({ error: 'pilot_cap_reached' }, { status: 403 });
  }

  const userRef = adminDb.collection('users').doc(session.uid);
  const redemptionRef = adminDb.collection('redemptions').doc();
  const transactionRef = adminDb.collection('transactions').doc();

  const result = await adminDb.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return { error: 'user_not_found', status: 404 } as const;
    const balance =
      typeof userSnap.get('pointsBalance') === 'number'
        ? (userSnap.get('pointsBalance') as number)
        : 0;
    if (balance < pointsSpent) {
      return { error: 'insufficient_balance', status: 402 } as const;
    }
    const balanceAfter = balance - pointsSpent;
    const dollarValue = pointsToDollars(pointsSpent);

    const redemption: RedemptionDoc = {
      id: redemptionRef.id,
      userId: session.uid,
      brand,
      pointsSpent,
      dollarValue,
      status: 'pending',
      fulfillmentCode: null,
      fulfilledBy: null,
      fulfilledAt: null,
      createdAt: FieldValue.serverTimestamp() as unknown as RedemptionDoc['createdAt'],
    };
    tx.set(redemptionRef, redemption);
    tx.update(userRef, {
      pointsBalance: balanceAfter,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(transactionRef, {
      id: transactionRef.id,
      userId: session.uid,
      type: 'redemption',
      pointsDelta: -pointsSpent,
      balanceAfter,
      relatedDocId: redemptionRef.id,
      description: `${brand === 'amazon' ? 'Amazon' : 'Walmart'} gift card — $${dollarValue.toFixed(2)}`,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, balanceAfter, dollarValue } as const;
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Best-effort notifications. A queue failure must not roll back the
  // already-committed redemption — admin can resend manually if needed.
  void sendRedemptionEmails({
    userId: session.uid,
    redemptionId: redemptionRef.id,
    brand,
    dollarValue: result.dollarValue,
  }).catch((err) => {
    console.error('[redemptions] sendRedemptionEmails failed', err);
  });

  return NextResponse.json({
    ok: true,
    balanceAfter: result.balanceAfter,
    dollarValue: result.dollarValue,
  });
}

function brandLabel(brand: RedemptionBrand): string {
  switch (brand) {
    case 'amazon':
      return 'Amazon';
    case 'walmart':
      return 'Walmart';
    case 'pay_trash_bill':
      return 'Trash bill credit';
    case 'donate':
      return 'Donation';
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAddress(addr: AddressDoc | null): string {
  if (!addr) return 'No shipping address on file — contact resident before fulfilling.';
  const line1 = [addr.street, addr.unit].filter(Boolean).join(' ');
  const line2 = [addr.city, addr.state].filter(Boolean).join(', ');
  return [line1, `${line2} ${addr.postalCode}`.trim()].filter(Boolean).join('\n');
}

async function sendRedemptionEmails(args: {
  userId: string;
  redemptionId: string;
  brand: RedemptionBrand;
  dollarValue: number;
}): Promise<void> {
  const { userId, redemptionId, brand, dollarValue } = args;

  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) return;
  const user = userSnap.data() as UserDoc;

  let address: AddressDoc | null = null;
  if (user.addressId) {
    const addrSnap = await adminDb.collection('addresses').doc(user.addressId).get();
    if (addrSnap.exists) address = addrSnap.data() as AddressDoc;
  }

  const adminSnap = await adminDb.collection('users').where('role', '==', 'admin').get();
  const adminEmails = adminSnap.docs
    .map((d) => (d.data() as UserDoc).email)
    .filter((e): e is string => typeof e === 'string' && e.length > 0);

  const brandName = brandLabel(brand);
  const dollarStr = dollarValue.toFixed(2);
  const firstName = user.name?.split(/\s+/)[0] || 'there';

  if (user.email) {
    const subject = `Your $${dollarStr} ${brandName} gift card is on the way`;
    const text =
      `Hi ${firstName},\n\n` +
      `Congrats — we got your redemption request. We'll email you your $${dollarStr} ${brandName} gift card within a few business days.\n\n` +
      `Thanks for recycling with us.\n\n— We Buy Clean Trash`;
    const html =
      `<p>Hi ${escapeHtml(firstName)},</p>` +
      `<p>Congrats — we got your redemption request. We'll email you your <strong>$${dollarStr} ${brandName} gift card</strong> within a few business days.</p>` +
      `<p>Thanks for recycling with us.</p>` +
      `<p>— We Buy Clean Trash</p>`;
    try {
      await sendEmail({
        to: user.email,
        subject,
        text,
        html,
        purpose: 'other',
        relatedDocId: redemptionId,
      });
    } catch (err) {
      console.error('[redemptions] resident email failed', err);
    }
  }

  if (adminEmails.length > 0) {
    const addressBlock = formatAddress(address);
    const subject = `Gift card redemption: ${user.name || user.email} — $${dollarStr} ${brandName}`;
    const text =
      `A resident just redeemed a gift card.\n\n` +
      `Resident: ${user.name || '(no name)'}\n` +
      `Email: ${user.email}\n` +
      `Phone: ${user.phone || '(none)'}\n` +
      `Card: $${dollarStr} ${brandName}\n` +
      `Redemption ID: ${redemptionId}\n\n` +
      `Send the gift card to:\n${addressBlock}\n\n` +
      `Mark as fulfilled in the admin redemptions queue once sent.`;
    const html =
      `<p>A resident just redeemed a gift card.</p>` +
      `<ul>` +
      `<li><strong>Resident:</strong> ${escapeHtml(user.name || '(no name)')}</li>` +
      `<li><strong>Email:</strong> ${escapeHtml(user.email)}</li>` +
      `<li><strong>Phone:</strong> ${escapeHtml(user.phone || '(none)')}</li>` +
      `<li><strong>Card:</strong> $${dollarStr} ${brandName}</li>` +
      `<li><strong>Redemption ID:</strong> ${escapeHtml(redemptionId)}</li>` +
      `</ul>` +
      `<p><strong>Send the gift card to:</strong></p>` +
      `<pre style="font-family:inherit;white-space:pre-wrap;">${escapeHtml(addressBlock)}</pre>` +
      `<p>Mark as fulfilled in the admin redemptions queue once sent.</p>`;
    await Promise.all(
      adminEmails.map((to) =>
        sendEmail({
          to,
          subject,
          text,
          html,
          purpose: 'other',
          relatedDocId: redemptionId,
        }).catch((err) => {
          console.error(`[redemptions] admin email to ${to} failed`, err);
        }),
      ),
    );
  }
}
