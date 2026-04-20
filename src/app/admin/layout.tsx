import { requireRole } from '@/lib/auth/session';
import { AdminNav } from '@/components/admin/AdminNav';
import { LogoutButton } from '@/components/LogoutButton';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('admin');
  return (
    <div className="min-h-dvh bg-neutral-950 text-gray-100">
      <div className="mx-auto flex min-h-dvh max-w-7xl">
        <aside className="hidden w-60 shrink-0 border-r border-white/10 md:flex md:flex-col">
          <div className="px-5 py-5">
            <div className="text-[10px] uppercase tracking-widest text-gray-500">
              We Buy Clean Trash
            </div>
            <div className="mt-1 text-sm font-semibold text-white">Admin</div>
          </div>
          <AdminNav />
          <div className="mt-auto border-t border-white/10 px-4 py-3">
            <div className="truncate text-[11px] text-gray-500">{session.email ?? session.uid}</div>
            <div className="mt-2">
              <LogoutButton />
            </div>
          </div>
        </aside>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
