import { requireRole } from '@/lib/auth/session';
import { loadResidentAccount } from '@/lib/auth/residentAccount';
import { BottomNav, CONSUMER_ITEMS, COMMERCIAL_ITEMS } from '@/components/resident/BottomNav';

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('resident');
  const account = await loadResidentAccount(session.uid);
  const items = account.accountType === 'commercial_site' ? COMMERCIAL_ITEMS : CONSUMER_ITEMS;
  return (
    <div className="eco-grain min-h-dvh text-[#1F2A22]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col sm:max-w-xl lg:max-w-2xl">
        <div className="flex-1 pb-24">{children}</div>
        <BottomNav items={items} />
      </div>
    </div>
  );
}
