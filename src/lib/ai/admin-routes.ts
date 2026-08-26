/**
 * Admin screens the assistant is allowed to link to. Fed into the guide-chat
 * system prompt so answers can say "go to [Pricing](/admin/pricing)" instead of
 * describing where a screen lives. Keep in sync with `AdminNav`.
 *
 * Links must stay inside the admin app: the assistant dock survives client-side
 * navigation, so an in-app link keeps the panel open next to the screen it just
 * sent the admin to.
 */
export interface AdminRoute {
  path: string;
  label: string;
  /** What the admin does there — helps the model pick the right link. */
  purpose: string;
}

export const ADMIN_ROUTES: AdminRoute[] = [
  { path: '/admin', label: 'Dashboard', purpose: 'week-at-a-glance metrics and activity' },
  {
    path: '/admin/users',
    label: 'Users',
    purpose: 'find a resident or staff member, change their zone, flag test accounts, delete users',
  },
  {
    path: '/admin/invites',
    label: 'Staff invites',
    purpose:
      'invite an operator, depot worker, depot manager, or admin (the only way non-residents get accounts)',
  },
  {
    path: '/admin/zones',
    label: 'Zones & depots',
    purpose: 'create/edit service zones, their accepted zip codes, and depots',
  },
  {
    path: '/admin/routes',
    label: 'Routes',
    purpose: 'build, optimize, and assign pickup routes to operators',
  },
  {
    path: '/admin/orders',
    label: 'Orders this week',
    purpose: 'see bag-sheet orders placed by residents and how they were queued onto routes',
  },
  {
    path: '/admin/bags',
    label: 'Bag stickers',
    purpose: 'generate printable QR sticker sheets and look up which resident a bag belongs to',
  },
  {
    path: '/admin/pricing',
    label: 'Yellow sheet — commodity pricing',
    purpose: 'edit market price and customer percentage per commodity, and run campaign multipliers',
  },
  {
    path: '/admin/compliance',
    label: 'Compliance notices',
    purpose: 'generate contamination notice PDFs and mark them as mailed',
  },
  {
    path: '/admin/redemptions',
    label: 'Redemption queue',
    purpose: 'fulfill gift-card redemptions residents have requested',
  },
  {
    path: '/admin/assistant',
    label: 'Assistant',
    purpose: 'this assistant, full screen',
  },
  // Compost program (separate from recycling).
  { path: '/admin/compost', label: 'Compost home', purpose: 'compost program overview' },
  {
    path: '/admin/compost/routes',
    label: 'Route runs',
    purpose: 'plan and review compost collection route runs',
  },
  {
    path: '/admin/commercial-accounts',
    label: 'Commercial accounts',
    purpose: 'commercial compost sites, their bins, and bin capacity',
  },
  {
    path: '/admin/compost/pickups',
    label: 'Recorded pickups',
    purpose: 'every logged compost pickup and its weight',
  },
  {
    path: '/admin/compost/cleaning',
    label: 'Cleaning queue',
    purpose: 'bins waiting to be cleaned',
  },
  {
    path: '/admin/compost/reconcile',
    label: 'Weekly reconciliation',
    purpose: 'reconcile a week of compost pickups against destination weights',
  },
  {
    path: '/admin/compost/reports',
    label: 'Diversion reports',
    purpose: 'diversion tonnage reporting for compost accounts',
  },
  {
    path: '/admin/compost/destinations',
    label: 'Drop-off destinations',
    purpose: 'where compost loads get delivered',
  },
  { path: '/user-guides', label: 'User guides', purpose: 'the full written guides for every role' },
];

/** Route table rendered for the system prompt. */
export function adminRouteMap(): string {
  return ADMIN_ROUTES.map((r) => `- [${r.label}](${r.path}) — ${r.purpose}`).join('\n');
}

const ALLOWED = new Set(ADMIN_ROUTES.map((r) => r.path));

/**
 * True when an assistant-generated href is an in-app admin link we can render as
 * a client-side <Link>. Accepts known routes plus deeper paths under them (e.g.
 * `/admin/bags/abc123`), and rejects anything else so a hallucinated or external
 * URL never renders as a trusted in-app link.
 */
export function isInternalAdminHref(href: string): boolean {
  if (!href.startsWith('/')) return false;
  const path = href.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (ALLOWED.has(path)) return true;
  return ADMIN_ROUTES.some((r) => r.path !== '/admin' && path.startsWith(`${r.path}/`));
}
