import { SSAvatarLink, SSWordmarkBar } from '@/components/resident/ss/SS';

export function DepotNav({ initial }: { initial: string }) {
  return <SSWordmarkBar right={<SSAvatarLink initial={initial} href="/depot/account" />} />;
}
