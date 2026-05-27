import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadManagerDepots } from '@/lib/auth/managerAccess';
import { MATERIAL_DISPLAY_NAMES, type MaterialId } from '@/lib/types/material';
import type { InventoryDoc } from '@/lib/types/inventory';
import {
  SSMG,
  SSMgEyebrow,
  SSMgHeader,
  SSMgShell,
  SSMgStat,
  SSMgStatusBadge,
  type MgStatus,
} from '@/components/manager/SSMg';
import { ManagerLogout } from '@/components/manager/ManagerLogout';

const DEPOT_CAPACITY_LBS_PER_MATERIAL = 1500;
const CRITICAL_PCT = 95;
const LOW_PCT = 25;

export default async function ManagerHome() {
  const session = await requireRole('depot_manager');
  const depots = await loadManagerDepots(session.uid);

  if (depots.length === 0) {
    return (
      <SSMgShell active="depots">
        <SSMgHeader
          kicker="Depot manager"
          title={
            <>
              No depots
              <br />
              assigned.
            </>
          }
          right={<ManagerLogout />}
        />
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: SSMG.inkSoft,
              lineHeight: 1.5,
            }}
          >
            Ask an admin to link a depot to your account.
          </div>
        </div>
      </SSMgShell>
    );
  }

  const invSnaps = await Promise.all(
    depots.map((d) => adminDb.collection('inventory').where('depotId', '==', d.id).get()),
  );

  type Row = {
    depot: (typeof depots)[number];
    total: number;
    critical: { id: MaterialId; pct: number }[];
    minPct: number;
    minMaterial: MaterialId | null;
    status: MgStatus;
  };

  const rows: Row[] = depots.map((depot, i) => {
    const invMap = new Map<MaterialId, number>();
    invSnaps[i].docs.forEach((snap) => {
      const doc = snap.data() as InventoryDoc;
      invMap.set(doc.materialId, doc.weight ?? 0);
    });
    const total = Array.from(invMap.values()).reduce((a, b) => a + b, 0);
    const critical: { id: MaterialId; pct: number }[] = [];
    let minPct = 200;
    let minMaterial: MaterialId | null = null;
    invMap.forEach((w, id) => {
      const pct = Math.round((w / DEPOT_CAPACITY_LBS_PER_MATERIAL) * 100);
      if (pct >= CRITICAL_PCT) critical.push({ id, pct });
      if (pct < minPct) {
        minPct = pct;
        minMaterial = id;
      }
    });
    const status: MgStatus =
      critical.length > 0 ? 'FULL' : minPct <= LOW_PCT ? 'LOW' : 'OK';
    return { depot, total, critical, minPct: minPct === 200 ? 0 : minPct, minMaterial, status };
  });

  const totalAllDepots = rows.reduce((a, r) => a + r.total, 0);
  const totalTons = totalAllDepots / 2000;
  const urgent = rows.find((r) => r.critical.length > 0);

  return (
    <SSMgShell active="depots">
      <SSMgHeader
        kicker="Depot manager"
        title={
          <>
            Your
            <br />
            depots.
          </>
        }
        sub={`${depots.length} location${depots.length === 1 ? '' : 's'} · ${totalTons.toFixed(1)}t in stock`}
        right={<ManagerLogout />}
      />

      {/* KPI sticker row — sky */}
      <div style={{ background: SSMG.sky, padding: '20px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
          }}
        >
          <SSMgStat value={depots.length} label="Depots" />
          <SSMgStat
            value={`${totalTons.toFixed(1)}t`}
            label="In stock"
            color={SSMG.yellow}
          />
          <SSMgStat value={rows.filter((r) => r.critical.length > 0).length} label="Full" />
        </div>

        {urgent && (
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#fff',
              border: `2px solid ${SSMG.brand}`,
              borderRadius: 14,
              padding: '12px 14px',
              boxShadow: `0 4px 0 ${SSMG.brand}`,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: SSMG.brand,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              !
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: SSMG.ink,
                  letterSpacing: -0.2,
                }}
              >
                {MATERIAL_DISPLAY_NAMES[urgent.critical[0].id]} near capacity at {urgent.depot.name}.
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: SSMG.inkSoft,
                  marginTop: 2,
                }}
              >
                Schedule a mill pickup today.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* List — white */}
      <div style={{ background: '#fff', padding: '18px 20px 24px' }}>
        <SSMgEyebrow>Locations</SSMgEyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r, i) => {
            const swatch = [SSMG.peach, SSMG.sky, SSMG.mint, SSMG.yellow][i % 4];
            const subtitle =
              r.critical.length > 0
                ? `${MATERIAL_DISPLAY_NAMES[r.critical[0].id]} ${r.critical[0].pct}%`
                : r.status === 'LOW' && r.minMaterial
                  ? `${MATERIAL_DISPLAY_NAMES[r.minMaterial]} ${r.minPct}%`
                  : 'All normal';
            return (
              <Link
                key={r.depot.id}
                href={`/manager/depots/${r.depot.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#fff',
                  border: `2px solid ${SSMG.ink}`,
                  borderRadius: 16,
                  padding: 14,
                  boxShadow: `0 4px 0 ${SSMG.ink}`,
                  textDecoration: 'none',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: swatch,
                    border: `2px solid ${SSMG.ink}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: SSMG.ink,
                      letterSpacing: -0.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {r.depot.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: SSMG.inkSoft,
                      marginTop: 2,
                    }}
                  >
                    {r.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs · {subtitle}
                  </div>
                </div>
                <SSMgStatusBadge status={r.status} />
              </Link>
            );
          })}
        </div>
      </div>
    </SSMgShell>
  );
}
