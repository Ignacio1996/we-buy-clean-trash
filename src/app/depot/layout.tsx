import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { DepotNav } from '@/components/depot/DepotNav';
import { DepotBottomNav } from '@/components/depot/DepotBottomNav';

export default async function DepotLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('depot_worker');
  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  const name = (userSnap.exists ? (userSnap.get('name') as string | undefined) : undefined)?.trim();
  const initial = (name || session.email?.split('@')[0] || 'Depot').charAt(0).toUpperCase();
  return (
    <div className="min-h-dvh" style={{ background: '#fff', color: '#111' }}>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col sm:max-w-xl lg:max-w-2xl">
        <DepotNav initial={initial} />
        <div className="flex-1">{children}</div>
        <DepotBottomNav />
      </div>
    </div>
  );
}
