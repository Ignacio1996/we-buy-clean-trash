import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { LogoutButton } from '@/components/LogoutButton';
import { PhoneField } from './PhoneField';
import { EcoH1, EcoMasthead } from '@/components/resident/eco/Eco';

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
    <main className="relative px-5 pt-12 sm:px-8 sm:pt-14">
      <EcoMasthead backHref="/resident" />

      <section className="mb-6">
        <div className="eco-eyebrow mb-2">Account</div>
        <EcoH1>Profile.</EcoH1>
      </section>

      <section className="rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
        <div className="eco-eyebrow">Name</div>
        <div
          className="mt-1"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 16,
            color: '#1F2A22',
          }}
        >
          {typeof user.name === 'string' ? user.name : '—'}
        </div>

        <div
          className="my-3.5"
          style={{ borderTop: '1px solid #E8E2D0' }}
        />

        <div className="eco-eyebrow">Email</div>
        <div
          className="mt-1"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 16,
            color: '#1F2A22',
          }}
        >
          {session!.email ?? '—'}
        </div>

        <div
          className="my-3.5"
          style={{ borderTop: '1px solid #E8E2D0' }}
        />

        <div className="eco-eyebrow">Phone</div>
        <PhoneField initial={phone} />
      </section>

      <section className="mt-3 rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
        <div className="eco-eyebrow">Pickup address</div>
        <div
          className="mt-1"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 15,
            color: '#1F2A22',
            lineHeight: 1.4,
          }}
        >
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

      <section className="mt-3 rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
        <div className="eco-eyebrow">Pickup day</div>
        <div
          className="mt-1"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 15,
            color: '#1F2A22',
            lineHeight: 1.4,
          }}
        >
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
