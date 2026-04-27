import { getSession } from '@/lib/auth/session';
import { requireConsumerResident } from '@/lib/auth/residentAccount';
import { ScanBagClient } from './ScanBagClient';

export default async function ScanBagPage() {
  const session = await getSession();
  await requireConsumerResident(session!.uid);
  return (
    <main className="px-4 pt-8">
      <h1 className="text-xl font-semibold text-white">📷 Scan a bag</h1>
      <p className="mt-1 text-xs text-gray-400">
        Point at the QR sticker or type the number printed below it.
      </p>
      <ScanBagClient />
    </main>
  );
}
