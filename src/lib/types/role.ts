export const ROLES = [
  'resident',
  'operator',
  'depot_worker',
  'depot_manager',
  'program_manager',
  'admin',
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export const INVITABLE_ROLES = [
  'operator',
  'depot_worker',
  'depot_manager',
  'program_manager',
  'admin',
] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(value: unknown): value is InvitableRole {
  return isRole(value) && value !== 'resident';
}

/**
 * Roles allowed to manage the compost program (sites, destinations, reports).
 * Admin has global access; program_manager is the compost-only manager.
 */
export const COMPOST_MANAGER_ROLES = ['admin', 'program_manager'] as const;

export function isCompostManagerRole(value: unknown): value is Role {
  return (
    typeof value === 'string' && (COMPOST_MANAGER_ROLES as readonly string[]).includes(value)
  );
}

export const ROLE_HOME_PATH: Record<Role, string> = {
  resident: '/resident',
  operator: '/operator',
  depot_worker: '/depot',
  depot_manager: '/manager',
  // Compost program manager — scoped to the compost program surfaces only.
  program_manager: '/program',
  admin: '/admin',
};
