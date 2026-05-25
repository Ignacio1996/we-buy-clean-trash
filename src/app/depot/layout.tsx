import { requireRole } from '@/lib/auth/session';
import { DepotNav } from '@/components/depot/DepotNav';
import { DepotBottomNav } from '@/components/depot/DepotBottomNav';

export default async function DepotLayout({ children }: { children: React.ReactNode }) {
  await requireRole('depot_worker');
  return (
    <div className="min-h-dvh" style={{ background: '#fff', color: '#111' }}>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col sm:max-w-xl lg:max-w-2xl">
        <DepotNav />
        <div className="flex-1">{children}</div>
        <DepotBottomNav />
      </div>
    </div>
  );
}
