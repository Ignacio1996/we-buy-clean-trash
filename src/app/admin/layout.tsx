import { requireRole } from '@/lib/auth/session';
import { AdminNav } from '@/components/admin/AdminNav';
import { AssistantDock } from '@/components/admin/AssistantDock';
import { AssistantProvider } from '@/components/admin/AssistantProvider';
import { LogoutButton } from '@/components/LogoutButton';
import { guideChatIsLive } from '@/lib/ai/guide-chat';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('admin');
  return (
    // The provider sits above the page content so the assistant's conversation
    // and open/closed state survive navigation between admin screens.
    <AssistantProvider>
      <div className="min-h-dvh bg-neutral-950 text-gray-100 print:bg-white print:text-black">
        <div className="mx-auto flex min-h-dvh max-w-7xl print:max-w-none">
          <aside className="hidden w-60 shrink-0 border-r border-white/10 md:flex md:flex-col print:hidden">
            <div className="px-5 py-5">
              <div className="text-[10px] uppercase tracking-widest text-gray-500">
                We Buy Clean Trash
              </div>
              <div className="mt-1 text-sm font-semibold text-white">Admin</div>
            </div>
            <AdminNav />
            <div className="mt-auto border-t border-white/10 px-4 py-3">
              <div className="truncate text-[11px] text-gray-500">
                {session.email ?? session.uid}
              </div>
              <div className="mt-2">
                <LogoutButton />
              </div>
            </div>
          </aside>
          <main className="flex-1 px-6 py-8 pb-24 print:px-0 print:py-0">{children}</main>
        </div>
        <AssistantDock live={guideChatIsLive()} />
      </div>
    </AssistantProvider>
  );
}
