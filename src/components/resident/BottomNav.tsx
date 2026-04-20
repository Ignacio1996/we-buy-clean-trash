'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/resident', label: 'Home', icon: '🏠' },
  { href: '/resident/scan-bag', label: 'Scan', icon: '📷' },
  { href: '/resident/order-bags', label: 'Bags', icon: '🛍️' },
  { href: '/resident/rewards', label: 'Rewards', icon: '🎁' },
  { href: '/resident/profile', label: 'Profile', icon: '👤' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 mx-auto grid max-w-md grid-cols-5 border-t border-white/10 bg-black/90 px-2 py-2 backdrop-blur">
      {ITEMS.map((item) => {
        const active =
          pathname === item.href || (item.href !== '/resident' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 rounded py-1 text-[11px] ${
              active ? 'text-white' : 'text-gray-500'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
