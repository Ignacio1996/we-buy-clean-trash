import { requireRole } from '@/lib/auth/session';

export default async function DepotLayout({ children }: { children: React.ReactNode }) {
  await requireRole('depot_worker');
  return <>{children}</>;
}
