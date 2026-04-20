import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ROLE_HOME_PATH } from '@/lib/types/role';
import { ScanClient } from './ScanClient';

export const metadata = {
  title: 'See what your trash is worth — We Buy Clean Trash',
  description:
    'Scan your recycling with your camera and see how much cash and points you can earn. No account needed.',
};

export default async function ScanPage() {
  const session = await getSession();
  if (session) redirect(ROLE_HOME_PATH[session.role]);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 text-white">
      <header className="text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
          We Buy Clean Trash
        </div>
        <h1 className="mt-2 text-2xl font-bold">💰 See What Your Trash Is Worth</h1>
        <p className="mt-1 text-sm text-gray-400">No account needed — try it right now.</p>
      </header>
      <ScanClient />
    </main>
  );
}
