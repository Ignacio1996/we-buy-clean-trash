import { requireRole } from '@/lib/auth/session';
import { loadResidentAccount } from '@/lib/auth/residentAccount';
import { BottomNav, CONSUMER_ITEMS, COMMERCIAL_ITEMS } from '@/components/resident/BottomNav';

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('resident');
  const account = await loadResidentAccount(session.uid);
  const items = account.accountType === 'commercial_site' ? COMMERCIAL_ITEMS : CONSUMER_ITEMS;
  return (
    <div className="min-h-dvh bg-neutral-950 text-gray-100">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <div className="flex-1 pb-24">{children}</div>
        <BottomNav items={items} />
      </div>
    </div>
  );
}
