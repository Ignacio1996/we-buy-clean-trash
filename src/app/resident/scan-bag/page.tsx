import { getSession } from '@/lib/auth/session';
import { requireConsumerResident } from '@/lib/auth/residentAccount';
import { ScanBagClient } from './ScanBagClient';
import { EcoH1, EcoMasthead } from '@/components/resident/eco/Eco';

export default async function ScanBagPage() {
  const session = await getSession();
  await requireConsumerResident(session!.uid);
  return (
    <main className="relative px-5 pt-12 sm:px-8 sm:pt-14">
      <EcoMasthead backHref="/resident" />
      <section className="mb-5">
        <div className="eco-eyebrow mb-2">Scan a bag</div>
        <EcoH1>Mark a bag ready for pickup.</EcoH1>
        <p
          className="mt-2.5 italic"
          style={{ fontSize: 13, color: '#5A6358', fontFamily: 'var(--eco-serif)' }}
        >
          Point at the QR sticker, or type the number printed below it.
        </p>
      </section>
      <ScanBagClient />
    </main>
  );
}
