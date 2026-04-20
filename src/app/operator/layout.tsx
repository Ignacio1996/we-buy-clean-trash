import { requireRole } from '@/lib/auth/session';

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  await requireRole('operator');
  return <>{children}</>;
}
