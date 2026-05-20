import 'server-only';
import type { Timestamp } from 'firebase-admin/firestore';
import type { Role } from '@/lib/types/role';

type InvitableRole = Exclude<Role, 'resident'>;

export function roleLabel(role: InvitableRole): string {
  switch (role) {
    case 'operator':
      return 'Operator';
    case 'depot_worker':
      return 'Depot Worker';
    case 'depot_manager':
      return 'Depot Manager';
    case 'admin':
      return 'Admin';
  }
}

export function formatExpiresOn(expiresAt: Timestamp): string {
  return expiresAt.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function buildInviteEmail(args: {
  acceptUrl: string;
  role: InvitableRole;
  expiresAt: Timestamp;
}): { subject: string; text: string; html: string } {
  const role = roleLabel(args.role);
  const expiresOn = formatExpiresOn(args.expiresAt);
  const subject = `Your We Buy Clean Trash ${role} invite`;
  const text =
    `You've been invited to join We Buy Clean Trash as a ${role}.\n\n` +
    `Accept your invite:\n${args.acceptUrl}\n\n` +
    `This link expires on ${expiresOn}.`;
  const html =
    `<p>You&rsquo;ve been invited to join <strong>We Buy Clean Trash</strong> as a <strong>${role}</strong>.</p>` +
    `<p><a href="${args.acceptUrl}">Accept your invite</a></p>` +
    `<p style="color:#666;font-size:12px">This link expires on ${expiresOn}.</p>`;
  return { subject, text, html };
}

export function buildInviteSms(args: {
  acceptUrl: string;
  role: InvitableRole;
}): string {
  const role = roleLabel(args.role);
  return `We Buy Clean Trash: you're invited as a ${role}. Accept here: ${args.acceptUrl}`;
}
