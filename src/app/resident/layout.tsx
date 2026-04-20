import { requireRole } from '@/lib/auth/session';
import { BottomNav } from '@/components/resident/BottomNav';

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  await requireRole('resident');
  return (
    <div className="min-h-dvh bg-neutral-950 text-gray-100">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <div className="flex-1 pb-24">{children}</div>
        <BottomNav />
      </div>
    </div>
  );
}
