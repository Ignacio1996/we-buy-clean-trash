import { getSession } from '@/lib/auth/session';
import { requireConsumerResident } from '@/lib/auth/residentAccount';
import { ScanBagClient } from './ScanBagClient';
import { SSScreen, SSStatusBarSpacer } from '@/components/resident/ss/SS';

export default async function ScanBagPage() {
  const session = await getSession();
  await requireConsumerResident(session!.uid);
  return (
    <SSScreen>
      <SSStatusBarSpacer />
      <ScanBagClient />
    </SSScreen>
  );
}
