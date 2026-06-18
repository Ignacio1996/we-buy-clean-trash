import { requireAnyRole } from '@/lib/auth/session';
import { ProgramNav } from '@/components/program/ProgramNav';
import { LogoutButton } from '@/components/LogoutButton';

// Compost program area — accessible to the program manager (Dominique / Tia's
// appointee) and admins. Gated here so the individual /program pages can stay
// thin and reuse the admin compost components.
export default async function ProgramLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAnyRole(['program_manager', 'admin']);
  return (
    <div className="min-h-dvh bg-neutral-950 text-gray-100 print:bg-white print:text-black">
      <div className="mx-auto flex min-h-dvh max-w-7xl print:max-w-none">
        <aside className="hidden w-60 shrink-0 border-r border-white/10 md:flex md:flex-col print:hidden">
          <div className="px-5 py-5">
            <div className="text-[10px] uppercase tracking-widest text-emerald-400/70">
              Compost Clubhouse
            </div>
            <div className="mt-1 text-sm font-semibold text-white">Program manager</div>
          </div>
          <ProgramNav />
          <div className="mt-auto border-t border-white/10 px-4 py-3">
            <div className="truncate text-[11px] text-gray-500">{session.email ?? session.uid}</div>
            <div className="mt-2">
              <LogoutButton />
            </div>
          </div>
        </aside>
        <main className="flex-1 px-6 py-8 print:px-0 print:py-0">{children}</main>
      </div>
    </div>
  );
}
