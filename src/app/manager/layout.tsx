import { requireRole } from '@/lib/auth/session';
import { ManagerNav } from '@/components/manager/ManagerNav';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  await requireRole('depot_manager');
  return (
    <main className="mx-auto min-h-dvh max-w-md bg-neutral-950 px-4 pb-16 pt-6 text-gray-100 print:max-w-none print:bg-white print:text-black">
      <div className="print:hidden">
        <ManagerNav />
      </div>
      {children}
    </main>
  );
}
