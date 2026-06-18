'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Compost program surfaces for the program manager (and admin). Mirrors the
// compost section of the admin nav but scoped to just the program.
const PROGRAM_ITEMS = [
  { href: '/program', label: 'Dashboard', icon: '📊' },
  { href: '/program/reports', label: 'Diversion reports', icon: '📈' },
  { href: '/program/commercial-accounts', label: 'Commercial sites', icon: '🏢' },
  { href: '/program/destinations', label: 'Drop-off destinations', icon: '📍' },
] as const;

type NavItem = { href: string; label: string; icon: string };

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active =
    pathname === item.href || (item.href !== '/program' && pathname.startsWith(item.href));
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

export function ProgramNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3 py-4 text-sm">
      {PROGRAM_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}
