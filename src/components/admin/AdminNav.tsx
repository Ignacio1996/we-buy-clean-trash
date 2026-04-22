'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/invites', label: 'Invites', icon: '✉️' },
  { href: '/admin/zones', label: 'Zones & Depots', icon: '🗺️' },
  { href: '/admin/routes', label: 'Routes', icon: '🚚' },
  { href: '/admin/pricing', label: 'Pricing', icon: '💲' },
  { href: '/admin/compliance', label: 'Compliance', icon: '📋' },
  { href: '/admin/redemptions', label: 'Redemptions', icon: '🎁' },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3 py-4 text-sm">
      {ITEMS.map((item) => {
        const active =
          pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
              active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
