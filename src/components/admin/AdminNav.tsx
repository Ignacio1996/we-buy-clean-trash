'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Recycling program (Kirk's WBCT). The bulk of the app.
const RECYCLING_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/assistant', label: 'Assistant', icon: '💬' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/invites', label: 'Invites', icon: '✉️' },
  { href: '/admin/zones', label: 'Zones & Depots', icon: '🗺️' },
  { href: '/admin/routes', label: 'Routes', icon: '🚚' },
  { href: '/admin/orders', label: 'Orders', icon: '📦' },
  { href: '/admin/bags', label: 'Bag stickers', icon: '🏷️' },
  { href: '/admin/pricing', label: 'Pricing', icon: '💲' },
  { href: '/admin/compliance', label: 'Compliance', icon: '📋' },
  { href: '/admin/redemptions', label: 'Redemptions', icon: '🎁' },
] as const;

// Compost (Tia's food-scrap business) — kept separate from the recycling
// program. Commercial-site directory + diversion reporting only.
const COMPOST_ITEMS = [
  { href: '/admin/commercial-accounts', label: 'Commercial sites', icon: '🏢' },
  { href: '/admin/compost/routes', label: 'Route runs', icon: '🛻' },
  { href: '/admin/compost/cleaning', label: 'Cleaning queue', icon: '🧼' },
  { href: '/admin/compost/reports', label: 'Diversion reports', icon: '📈' },
  { href: '/admin/compost/destinations', label: 'Drop-off destinations', icon: '📍' },
] as const;

type NavItem = { href: string; label: string; icon: string };

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active =
    pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className="text-base leading-none">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3 py-4 text-sm">
      {RECYCLING_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}

      <div className="mt-4 mb-1 flex items-center gap-2 px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70">
          Compost · Tia
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      {COMPOST_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}
