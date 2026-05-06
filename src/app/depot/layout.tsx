import { requireRole } from '@/lib/auth/session';
import { DepotNav } from '@/components/depot/DepotNav';
import { DpPage } from '@/components/depot/Dp';

export default async function DepotLayout({ children }: { children: React.ReactNode }) {
  await requireRole('depot_worker');
  return (
    <DpPage>
      <DepotNav />
      {children}
    </DpPage>
  );
}
