import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { InviteDoc } from '@/lib/types/invite';
import type { ZoneDoc } from '@/lib/types/zone';
import type { DepotDoc } from '@/lib/types/depot';
import { InviteForm } from './InviteForm';
import { InviteRowActions } from './InviteRowActions';
import { TestSmsForm } from './TestSmsForm';
import { GuideLink } from '@/components/admin/GuideLink';

export const dynamic = 'force-dynamic';

interface InviteRow {
  invite: InviteDoc;
  status: { label: string; tone: string };
  canRevoke: boolean;
}

async function loadInvitesData() {
  const [invitesSnap, zonesSnap, depotsSnap] = await Promise.all([
    adminDb.collection('invites').orderBy('createdAt', 'desc').limit(100).get(),
    adminDb.collection('zones').orderBy('name').get(),
    adminDb.collection('depots').orderBy('name').get(),
  ]);
  const nowMs = Date.now();
  const invites: InviteRow[] = invitesSnap.docs.map((d) => {
    const invite = d.data() as InviteDoc;
    const expired = invite.expiresAt.toMillis() < nowMs;
    let status: { label: string; tone: string };
    if (invite.status === 'consumed') status = { label: 'Accepted', tone: 'text-green-400' };
    else if (invite.status === 'revoked') status = { label: 'Revoked', tone: 'text-gray-500' };
    else if (expired) status = { label: 'Expired', tone: 'text-gray-500' };
    else status = { label: 'Pending', tone: 'text-yellow-400' };
    return { invite, status, canRevoke: invite.status === 'pending' && !expired };
  });
  const zones = zonesSnap.docs.map((d) => {
    const { createdAt: _c, ...rest } = d.data() as ZoneDoc;
    return rest;
  });
  const depots = depotsSnap.docs.map((d) => {
    const { createdAt: _c, updatedAt: _u, ...rest } = d.data() as DepotDoc;
    return rest;
  });
  return { invites, zones, depots };
}

function formatTimestamp(ts: Timestamp | null): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function roleLabel(role: string): string {
  switch (role) {
    case 'operator':
      return 'Operator';
    case 'depot_worker':
      return 'Depot worker';
    case 'depot_manager':
      return 'Depot manager';
    case 'admin':
      return 'Admin';
    default:
      return role;
  }
}

export default async function AdminInvitesPage() {
  const { invites, zones, depots } = await loadInvitesData();
  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Staff invites</h1>
          <p className="mt-1 text-xs text-gray-500">
            Operators, depot workers, managers, and admins are invite-only.
          </p>
        </div>
        <GuideLink href="/user-guides/phase-1-auth.html" />
      </header>

      <InviteForm zones={zones} depots={depots} />

      <TestSmsForm />

      <h2 className="mt-10 text-sm font-semibold text-white">Recent invites</h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Sent</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {invites.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-500">
                  No invites yet.
                </td>
              </tr>
            ) : (
              invites.map(({ invite: inv, status, canRevoke }) => (
                <tr key={inv.token} className="text-gray-300">
                  <td className="px-4 py-3 text-white">
                    {inv.email && <div>{inv.email}</div>}
                    {inv.phone && (
                      <div className={inv.email ? 'text-xs text-gray-400' : ''}>{inv.phone}</div>
                    )}
                    {!inv.email && !inv.phone && <span className="text-gray-500">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{roleLabel(inv.role)}</td>
                  <td className="px-4 py-3 text-gray-400">{formatTimestamp(inv.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-400">{formatTimestamp(inv.expiresAt)}</td>
                  <td className={`px-4 py-3 ${status.tone}`}>{status.label}</td>
                  <td className="px-4 py-3 text-right">
                    <InviteRowActions
                      token={inv.token}
                      canRevoke={canRevoke}
                      canEmail={canRevoke && !!inv.email}
                      canSms={canRevoke && !!inv.phone}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
