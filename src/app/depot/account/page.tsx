import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import type { BagProcessingDoc } from '@/lib/types/bagProcessing';
import { SS } from '@/components/resident/ss/SS';
import { SignOutButton } from './SignOutButton';

export const dynamic = 'force-dynamic';

function startOfTodayTs(): Timestamp {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

export default async function DepotAccountPage() {
  const session = await requireRole('depot_worker');
  const depotRes = await loadDepotContext(session.uid);

  if (!depotRes.ok) {
    return (
      <section style={{ padding: 20 }}>
        <div
          style={{
            background: SS.brand,
            color: '#fff',
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            padding: '14px 16px',
            boxShadow: `0 4px 0 ${SS.ink}`,
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          {depotRes.error === 'depot_not_found'
            ? 'No depot is assigned to your account yet.'
            : 'Your user record could not be loaded.'}
        </div>
      </section>
    );
  }

  const { user, depot } = depotRes.context;

  const todaySnap = await adminDb
    .collection('bagProcessing')
    .where('depotWorkerId', '==', user.uid)
    .where('createdAt', '>=', startOfTodayTs())
    .get();
  const todayDocs = todaySnap.docs.map((d) => d.data() as BagProcessingDoc);
  const todayBags = todayDocs.length;
  const todayWeight = todayDocs.reduce(
    (acc, d) =>
      acc +
      Object.values(d.weights ?? {}).reduce((s, w) => s + (Number(w) || 0), 0),
    0,
  );
  const todayPoints = todayDocs.reduce(
    (acc, d) => acc + (d.pointsAwarded ?? 0),
    0,
  );

  const initial = (user.name?.[0] ?? 'D').toUpperCase();
  const address = [depot.street, `${depot.city}, ${depot.state} ${depot.postalCode}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <section>
      {/* Yellow hero — avatar + name + role */}
      <div
        style={{
          background: SS.yellow,
          padding: '22px 20px 22px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: SS.inkSoft,
          }}
        >
          Account
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 12,
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: SS.brand,
              color: '#fff',
              border: `3px solid ${SS.ink}`,
              boxShadow: `0 4px 0 ${SS.ink}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 24,
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: -0.6,
                lineHeight: 1.05,
                color: SS.ink,
              }}
            >
              {user.name}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: SS.ink,
                opacity: 0.75,
                marginTop: 4,
              }}
            >
              Depot worker
            </div>
          </div>
        </div>
      </div>

      {/* Today's stats — sky block */}
      <div
        style={{
          background: SS.sky,
          padding: '20px 20px 18px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
            marginBottom: 10,
          }}
        >
          Today
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
          }}
        >
          <div
            style={{
              background: '#fff',
              border: `2px solid ${SS.ink}`,
              borderRadius: 12,
              padding: '10px 8px',
              textAlign: 'center',
              boxShadow: `0 3px 0 ${SS.ink}`,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: -0.6,
                color: SS.ink,
                lineHeight: 1,
                fontFeatureSettings: '"lnum","tnum"',
              }}
            >
              {todayBags}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: SS.inkSoft,
                marginTop: 4,
              }}
            >
              Bags
            </div>
          </div>
          <div
            style={{
              background: '#fff',
              border: `2px solid ${SS.ink}`,
              borderRadius: 12,
              padding: '10px 8px',
              textAlign: 'center',
              boxShadow: `0 3px 0 ${SS.ink}`,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: -0.6,
                color: SS.ink,
                lineHeight: 1,
                fontFeatureSettings: '"lnum","tnum"',
              }}
            >
              {todayWeight.toFixed(1)}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: SS.inkSoft,
                marginTop: 4,
              }}
            >
              Lbs
            </div>
          </div>
          <div
            style={{
              background: '#fff',
              border: `2px solid ${SS.ink}`,
              borderRadius: 12,
              padding: '10px 8px',
              textAlign: 'center',
              boxShadow: `0 3px 0 ${SS.ink}`,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: -0.6,
                color: SS.ink,
                lineHeight: 1,
                fontFeatureSettings: '"lnum","tnum"',
              }}
            >
              {todayPoints.toLocaleString()}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: SS.inkSoft,
                marginTop: 4,
              }}
            >
              Pts awarded
            </div>
          </div>
        </div>
      </div>

      {/* Depot card */}
      <div style={{ background: '#fff', padding: '18px 20px 8px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
            marginBottom: 10,
          }}
        >
          Assigned depot
        </div>
        <div
          style={{
            background: SS.mint,
            border: `2px solid ${SS.ink}`,
            borderRadius: 16,
            padding: 14,
            boxShadow: `0 4px 0 ${SS.ink}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: SS.green,
            }}
          >
            Depot
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: -0.4,
              color: SS.ink,
              marginTop: 2,
              lineHeight: 1.15,
            }}
          >
            {depot.name}
          </div>
          {address && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: SS.ink,
                opacity: 0.75,
                marginTop: 6,
                lineHeight: 1.4,
              }}
            >
              {address}
            </div>
          )}
        </div>
      </div>

      {/* Account info rows */}
      <div style={{ background: '#fff', padding: '18px 20px 8px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
            marginBottom: 6,
          }}
        >
          Account info
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {[
            { label: 'Name', value: user.name },
            { label: 'Email', value: user.email },
            { label: 'Role', value: 'Depot worker' },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < arr.length - 1 ? `1px solid ${SS.line}` : 'none',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: SS.inkSoft,
                  letterSpacing: 0.3,
                }}
              >
                {row.label}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  letterSpacing: -0.2,
                  color: SS.ink,
                  textAlign: 'right',
                  maxWidth: '60%',
                  overflowWrap: 'anywhere',
                }}
              >
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div style={{ background: '#fff', padding: '18px 20px 28px' }}>
        <SignOutButton />
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: SS.inkSoft,
            marginTop: 12,
            letterSpacing: 0.3,
          }}
        >
          Need help? Reach your depot manager.
        </div>
      </div>
    </section>
  );
}
