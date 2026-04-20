export const ROLES = ['resident', 'operator', 'depot_worker', 'depot_manager', 'admin'] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export const INVITABLE_ROLES = ['operator', 'depot_worker', 'depot_manager', 'admin'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(value: unknown): value is InvitableRole {
  return isRole(value) && value !== 'resident';
}

export const ROLE_HOME_PATH: Record<Role, string> = {
  resident: '/resident',
  operator: '/operator',
  depot_worker: '/depot',
  depot_manager: '/manager',
  admin: '/admin',
};
