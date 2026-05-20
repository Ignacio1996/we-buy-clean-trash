import { notFound } from 'next/navigation';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { isInvitableRole, type Role } from '@/lib/types/role';
import { InviteAcceptForm } from './InviteAcceptForm';

interface InviteSummary {
  token: string;
  email: string | null;
  phone: string | null;
  role: Exclude<Role, 'resident'>;
  status: string;
  expired: boolean;
}

async function loadInvite(token: string): Promise<InviteSummary | null> {
  const snap = await adminDb.collection('invites').doc(token).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  const role = data.role;
  if (!isInvitableRole(role)) return null;
  const expiresAt = data.expiresAt as Timestamp | undefined;
  const expired = Boolean(expiresAt && expiresAt.toMillis() < Date.now());
  const email = typeof data.email === 'string' && data.email ? data.email : null;
  const phone = typeof data.phone === 'string' && data.phone ? data.phone : null;
  return {
    token,
    email,
    phone,
    role,
    status: String(data.status ?? 'unknown'),
    expired,
  };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await loadInvite(token);
  if (!invite) notFound();

  if (invite.status !== 'pending' || invite.expired) {
    const reason =
      invite.status === 'consumed'
        ? 'already been accepted'
        : invite.expired
          ? 'expired'
          : invite.status === 'revoked'
            ? 'been revoked'
            : 'no longer valid';
    return (
      <main className="mx-auto mt-24 max-w-md px-4">
        <h1 className="text-2xl font-semibold">Invite unavailable</h1>
        <p className="mt-3 text-gray-700">
          This invite has {reason}. Ask your admin for a new link.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto mt-16 max-w-md px-4 pb-16">
      <h1 className="text-2xl font-semibold">Accept invite</h1>
      <p className="mt-1 text-sm text-gray-600">
        You&apos;ve been invited as <span className="font-medium">{invite.role}</span>
        {invite.email ? (
          <>
            {' '}for <span className="font-medium">{invite.email}</span>.
          </>
        ) : invite.phone ? (
          <>
            {' '}at <span className="font-medium">{invite.phone}</span>. Sign in with your email to
            accept.
          </>
        ) : (
          '.'
        )}
      </p>
      <InviteAcceptForm token={invite.token} email={invite.email} role={invite.role} />
    </main>
  );
}
