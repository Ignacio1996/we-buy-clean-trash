import Link from 'next/link';
import { adminDb } from '@/lib/firebase/admin';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import type { UserDoc } from '@/lib/types/user';
import type { ZoneDoc } from '@/lib/types/zone';
import { GuideLink } from '@/components/admin/GuideLink';
import { AdminUsersTable, type ResidentRow } from '@/components/admin/AdminUsersTable';

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
  const rows: ResidentRow[] = users.map((u) => ({
    uid: u.uid,
    name: u.name,
    email: u.email,
    zoneName: u.zoneId ? (zones.get(u.zoneId) ?? u.zoneId) : '—',
    pointsBalance: u.pointsBalance,
    pointsValue: pointsToDollars(u.pointsBalance).toFixed(2),
  }));
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

      <AdminUsersTable residents={rows} />
    </div>
  );
}
