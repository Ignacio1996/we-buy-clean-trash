import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { LogoutButton } from '@/components/LogoutButton';

export default async function ProfilePage() {
  const session = await getSession();
  const uid = session!.uid;
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const user = userSnap.data() ?? {};
  const addressId = typeof user.addressId === 'string' ? user.addressId : null;
  const addressSnap = addressId ? await adminDb.collection('addresses').doc(addressId).get() : null;
  const address = addressSnap?.data();

  return (
    <main className="px-4 pt-8">
      <h1 className="text-xl font-semibold text-white">👤 Profile</h1>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="text-xs uppercase tracking-wide text-gray-400">Name</div>
        <div className="mt-1 text-white">{typeof user.name === 'string' ? user.name : '—'}</div>
        <div className="mt-3 text-xs uppercase tracking-wide text-gray-400">Email</div>
        <div className="mt-1 text-white">{session!.email ?? '—'}</div>
      </section>

      <section className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="text-xs uppercase tracking-wide text-gray-400">Pickup address</div>
        <div className="mt-1 text-white">
          {address
            ? [
                address.street,
                address.unit,
                `${address.city}, ${address.state} ${address.postalCode}`,
              ]
                .filter(Boolean)
                .join(' · ')
            : '— (add during signup)'}
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="text-xs uppercase tracking-wide text-gray-400">Pickup day</div>
        <div className="mt-1 text-white">Assigned after your zone is set (coming soon).</div>
      </section>

      <div className="mt-6">
        <LogoutButton />
      </div>
    </main>
  );
}
