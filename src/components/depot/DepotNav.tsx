'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';

const TABS = [
  { href: '/depot/incoming', label: 'Incoming' },
  { href: '/depot/inventory', label: 'Inventory' },
] as const;

export function DepotNav() {
  const pathname = usePathname() ?? '';
  return (
    <header className="flex items-center justify-between border-b border-white/10 pb-3">
      <div className="flex items-center gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors ${
                active
                  ? 'bg-white text-black'
                  : 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <LogoutButton />
    </header>
  );
}
