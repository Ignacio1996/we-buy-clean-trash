import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { requireConsumerResident } from '@/lib/auth/residentAccount';
import { adminDb } from '@/lib/firebase/admin';
import {
  BAG_SHEET_UNIT_PRICE_DOLLARS,
  BAGS_PER_SHEET,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
} from '@/lib/logic/calculateBagOrderTotal';
import { OrderBagsForm } from './OrderBagsForm';
import {
  SS,
  SSEyebrow,
  SSScreen,
  SSStatusBarSpacer,
} from '@/components/resident/ss/SS';

export default async function OrderBagsPage() {
  const session = await getSession();
  await requireConsumerResident(session!.uid);

  const userSnap = await adminDb.collection('users').doc(session!.uid).get();
  const userData = userSnap.data() ?? {};
  const freeSheetCredits = userData.freeSheetClaimed === true ? 0 : 1;

  return (
    <SSScreen>
      <SSStatusBarSpacer />

      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link
          href="/resident"
          aria-label="Back"
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: SS.ink,
            textDecoration: 'none',
            fontFamily: SS.sans,
          }}
        >
          ←
        </Link>
        <Link
          href="/resident/order-bags/history"
          style={{
            fontSize: 11,
            fontWeight: 900,
            color: SS.ink,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            textDecoration: 'underline',
          }}
        >
          Past orders
        </Link>
      </div>

      <div style={{ padding: '28px 24px 8px' }}>
        <SSEyebrow style={{ color: SS.brand, marginBottom: 8 }}>Bags</SSEyebrow>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: -1.4,
            lineHeight: 0.95,
            color: SS.ink,
            margin: 0,
          }}
        >
          Order your bags.
        </h1>
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: SS.inkSoft,
            lineHeight: 1.4,
            marginTop: 10,
            marginBottom: 0,
          }}
        >
          {BAGS_PER_SHEET} QR-coded bags per sheet — delivered on your next pickup.
        </p>
      </div>

      {freeSheetCredits > 0 && (
        <div style={{ padding: '14px 20px 0' }}>
          <div
            style={{
              background: SS.mint,
              border: `2px solid ${SS.ink}`,
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: SS.green,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              ★
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: SS.ink, lineHeight: 1.3 }}>
              <span style={{ color: SS.green }}>Welcome gift</span> — your first box of bags is on
              us, applied automatically.
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '14px 20px 0' }}>
        <div
          style={{
            background: '#fff',
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <SSEyebrow>Price</SSEyebrow>
          <div style={{ fontSize: 18, fontWeight: 900, color: SS.ink, letterSpacing: -0.3 }}>
            ${BAG_SHEET_UNIT_PRICE_DOLLARS.toFixed(2)}
            <span
              style={{ fontSize: 13, fontWeight: 800, color: SS.inkSoft, marginLeft: 4 }}
            >
              / sheet
            </span>
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: SS.inkSoft,
            lineHeight: 1.4,
            marginTop: 8,
            padding: '0 4px',
          }}
        >
          Free delivery on orders ≥ ${FREE_SHIPPING_THRESHOLD} · otherwise +$
          {SHIPPING_FEE.toFixed(2)} delivery.
        </div>
      </div>

      <OrderBagsForm
        unitPrice={BAG_SHEET_UNIT_PRICE_DOLLARS}
        freeSheetCredits={freeSheetCredits}
      />
    </SSScreen>
  );
}
