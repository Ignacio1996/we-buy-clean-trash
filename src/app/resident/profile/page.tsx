import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { LogoutButton } from '@/components/LogoutButton';
import { PhoneField } from './PhoneField';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function ProfilePage() {
  const session = await getSession();
  const uid = session!.uid;
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const user = userSnap.data() ?? {};
  const addressId = typeof user.addressId === 'string' ? user.addressId : null;
  const zoneId = typeof user.zoneId === 'string' ? user.zoneId : null;
  const [addressSnap, zoneSnap] = await Promise.all([
    addressId ? adminDb.collection('addresses').doc(addressId).get() : Promise.resolve(null),
    zoneId ? adminDb.collection('zones').doc(zoneId).get() : Promise.resolve(null),
  ]);
  const address = addressSnap?.data();
  const zone = zoneSnap?.data();
  const pickupDayIdx =
    typeof zone?.pickupDayOfWeek === 'number' ? (zone.pickupDayOfWeek as number) : null;
  const phone = typeof user.phone === 'string' ? user.phone : null;

  return (
    <main className="px-4 pt-8">
      <h1 className="text-xl font-semibold text-white">👤 Profile</h1>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="text-xs uppercase tracking-wide text-gray-400">Name</div>
        <div className="mt-1 text-white">{typeof user.name === 'string' ? user.name : '—'}</div>
        <div className="mt-3 text-xs uppercase tracking-wide text-gray-400">Email</div>
        <div className="mt-1 text-white">{session!.email ?? '—'}</div>
        <div className="mt-3 text-xs uppercase tracking-wide text-gray-400">Phone</div>
        <PhoneField initial={phone} />
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
        <div className="mt-1 text-white">
          {pickupDayIdx !== null && pickupDayIdx >= 0 && pickupDayIdx <= 6
            ? `${DAYS[pickupDayIdx]} (${typeof zone?.name === 'string' ? zone.name : 'your zone'})`
            : 'Not assigned — your ZIP isn’t in a pickup zone yet.'}
        </div>
      </section>

      <div className="mt-6">
        <LogoutButton />
      </div>
    </main>
  );
}
