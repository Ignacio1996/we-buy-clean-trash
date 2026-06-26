'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Sparkles,
  Users,
  Mail,
  Map,
  Truck,
  Package,
  Tags,
  DollarSign,
  ClipboardCheck,
  Gift,
  Sprout,
  Building2,
  Route,
  ClipboardList,
  SprayCan,
  BarChart3,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

// Recycling program (Kirk's WBCT). The bulk of the app.
const RECYCLING_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/assistant', label: 'Assistant', icon: Sparkles },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/invites', label: 'Invites', icon: Mail },
  { href: '/admin/zones', label: 'Zones & Depots', icon: Map },
  { href: '/admin/routes', label: 'Routes', icon: Truck },
  { href: '/admin/orders', label: 'Orders', icon: Package },
  { href: '/admin/bags', label: 'Bag stickers', icon: Tags },
  { href: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  { href: '/admin/compliance', label: 'Compliance', icon: ClipboardCheck },
  { href: '/admin/redemptions', label: 'Redemptions', icon: Gift },
] as const;

// Compost (Tia's food-scrap business) — kept separate from the recycling
// program. Commercial-site directory + diversion reporting only.
const COMPOST_ITEMS = [
  { href: '/admin/compost', label: 'Compost home', icon: Sprout },
  { href: '/admin/compost/routes', label: 'Route runs', icon: Route },
  { href: '/admin/commercial-accounts', label: 'Commercial sites', icon: Building2 },
  { href: '/admin/compost/pickups', label: 'Recorded pickups', icon: ClipboardList },
  { href: '/admin/compost/cleaning', label: 'Cleaning queue', icon: SprayCan },
  { href: '/admin/compost/reports', label: 'Diversion reports', icon: BarChart3 },
  { href: '/admin/compost/destinations', label: 'Drop-off destinations', icon: MapPin },
] as const;

type NavItem = { href: string; label: string; icon: LucideIcon };

// Landing pages whose href is a prefix of their own subpages — match exactly so
// they don't stay highlighted while you're on a child route.
const EXACT_MATCH = new Set(['/admin', '/admin/compost']);

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active =
    pathname === item.href || (!EXACT_MATCH.has(item.href) && pathname.startsWith(item.href));
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
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
