import { requireRole } from '@/lib/auth/session';
import { DepotNav } from '@/components/depot/DepotNav';

export default async function DepotLayout({ children }: { children: React.ReactNode }) {
  await requireRole('depot_worker');
  return (
    <main className="mx-auto min-h-dvh max-w-md bg-neutral-950 px-4 pb-16 pt-6 text-gray-100">
      <DepotNav />
      {children}
    </main>
  );
}
