import Link from 'next/link';
import { adminDb } from '@/lib/firebase/admin';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import type { AddressDoc, UserDoc } from '@/lib/types/user';
import type { ZoneDoc } from '@/lib/types/zone';
import { GuideLink } from '@/components/admin/GuideLink';
import { AdminUsersTable, type UserRow } from '@/components/admin/AdminUsersTable';

function formatAddress(a: AddressDoc | undefined): { address: string | null; zip: string | null } {
  if (!a) return { address: null, zip: null };
  const line1 = [a.street, a.unit].filter(Boolean).join(' ');
  const line2 = [a.city, a.state].filter(Boolean).join(', ');
  const address = [line1, line2].filter(Boolean).join(', ') || null;
  return { address, zip: a.postalCode || null };
}

async function loadUsers(): Promise<{
  users: UserDoc[];
  zones: Map<string, string>;
  addresses: Map<string, AddressDoc>;
}> {
  const [usersSnap, zonesSnap] = await Promise.all([
    adminDb.collection('users').orderBy('createdAt', 'desc').limit(500).get(),
    adminDb.collection('zones').get(),
  ]);
  const zones = new Map<string, string>();
  zonesSnap.docs.forEach((d) => {
    const z = d.data() as ZoneDoc;
    zones.set(d.id, z.name);
  });

  const users = usersSnap.docs.map((d) => d.data() as UserDoc);

  // Batch-load the address docs referenced by these users (residents). getAll
  // tolerates missing docs, so unmatched ids just resolve to a non-existent ref.
  const addressIds = Array.from(
    new Set(users.map((u) => u.addressId).filter((id): id is string => !!id)),
  );
  const addresses = new Map<string, AddressDoc>();
  if (addressIds.length > 0) {
    const addrSnaps = await adminDb.getAll(
      ...addressIds.map((id) => adminDb.collection('addresses').doc(id)),
    );
    for (const snap of addrSnaps) {
      if (snap.exists) addresses.set(snap.id, snap.data() as AddressDoc);
    }
  }

  return { users, zones, addresses };
}

export default async function AdminUsersPage() {
  const { users, zones, addresses } = await loadUsers();
  const zoneOptions = Array.from(zones.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows: UserRow[] = users.map((u) => {
    const { address, zip } = formatAddress(u.addressId ? addresses.get(u.addressId) : undefined);
    return {
      uid: u.uid,
      name: u.name,
      email: u.email,
      role: u.role,
      zoneId: u.zoneId ?? null,
      zoneName: u.zoneId ? (zones.get(u.zoneId) ?? u.zoneId) : '—',
      pointsBalance: u.pointsBalance,
      pointsValue: pointsToDollars(u.pointsBalance).toFixed(2),
      phone: u.phone ?? null,
      address,
      zip,
      isTest: u.isTest === true,
    };
  });
  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Users</h1>
          <p className="mt-1 text-xs text-gray-500">
            {users.length} user{users.length === 1 ? '' : 's'} across all roles
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

      <AdminUsersTable users={rows} zones={zoneOptions} />
    </div>
  );
}
