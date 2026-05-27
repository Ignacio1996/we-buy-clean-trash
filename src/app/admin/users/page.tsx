import Link from 'next/link';
import { adminDb } from '@/lib/firebase/admin';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import type { UserDoc } from '@/lib/types/user';
import type { ZoneDoc } from '@/lib/types/zone';
import { GuideLink } from '@/components/admin/GuideLink';

async function loadResidents(): Promise<{ users: UserDoc[]; zones: Map<string, string> }> {
  const [usersSnap, zonesSnap] = await Promise.all([
    adminDb
      .collection('users')
      .where('role', '==', 'resident')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get(),
    adminDb.collection('zones').get(),
  ]);
  const zones = new Map<string, string>();
  zonesSnap.docs.forEach((d) => {
    const z = d.data() as ZoneDoc;
    zones.set(d.id, z.name);
  });
  return { users: usersSnap.docs.map((d) => d.data() as UserDoc), zones };
}

export default async function AdminUsersPage() {
  const { users, zones } = await loadResidents();
  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Residents</h1>
          <p className="mt-1 text-xs text-gray-500">
            {users.length} resident{users.length === 1 ? '' : 's'} signed up
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GuideLink href="/user-guides/generating-users.html" />
          <Link
            href="/admin/invites"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
          >
            Manage staff invites →
          </Link>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 text-right font-medium">Points</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
                  No residents yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.uid} className="text-gray-300">
                  <td className="px-4 py-3 text-white">{u.name}</td>
                  <td className="px-4 py-3 text-gray-400">{u.email}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {u.zoneId ? (zones.get(u.zoneId) ?? u.zoneId) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-white">
                    {u.pointsBalance.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    ${pointsToDollars(u.pointsBalance).toFixed(2)}
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
