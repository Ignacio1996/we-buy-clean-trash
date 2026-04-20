import { requireRole } from '@/lib/auth/session';
import { LogoutButton } from '@/components/LogoutButton';

export default async function OperatorHome() {
  const session = await requireRole('operator');
  return (
    <main className="mx-auto mt-16 max-w-xl px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Operator home</h1>
        <LogoutButton />
      </div>
      <p className="mt-4 text-gray-700">Signed in as {session.email ?? session.uid}.</p>
      <p className="mt-2 text-sm text-gray-500">Route screen lands in Phase 6.</p>
    </main>
  );
}
