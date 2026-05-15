'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  IconBag,
  IconGift,
  IconHome,
  IconScan,
  IconUser,
} from '@/components/icons/EcoIcons';

import { SS } from './ss/SS';

const NAV_ICONS = {
  home: IconHome,
  scan: IconScan,
  bags: IconBag,
  rewards: IconGift,
  profile: IconUser,
} as const;

export interface BottomNavItem {
  href: string;
  label: string;
  key: 'home' | 'scan' | 'bags' | 'rewards' | 'profile';
}

const CONSUMER_ITEMS: readonly BottomNavItem[] = [
  { href: '/resident', label: 'Home', key: 'home' },
  { href: '/resident/scan-bag', label: 'Scan', key: 'scan' },
  { href: '/resident/order-bags', label: 'Bags', key: 'bags' },
  { href: '/resident/rewards', label: 'Rewards', key: 'rewards' },
  { href: '/resident/profile', label: 'Profile', key: 'profile' },
];

const COMMERCIAL_ITEMS: readonly BottomNavItem[] = [
  { href: '/resident', label: 'Home', key: 'home' },
  { href: '/resident/profile', label: 'Profile', key: 'profile' },
];

export function BottomNav({ items }: { items?: readonly BottomNavItem[] }) {
  const pathname = usePathname();
  const list = items ?? CONSUMER_ITEMS;
  return (
    <nav
      className="sticky bottom-0 z-10 mx-auto w-full max-w-md sm:max-w-xl lg:max-w-2xl"
      style={{
        background: '#fff',
        borderTop: `1px solid ${SS.line}`,
        padding: '8px 4px 24px',
        display: 'grid',
        gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))`,
      }}
    >
      {list.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/resident' && pathname.startsWith(item.href));
        const color = active ? SS.brand : SS.ink;
        const Icon = NAV_ICONS[item.key];
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: 6,
              color,
              textDecoration: 'none',
            }}
          >
            <Icon size={22} stroke={active ? 2.5 : 2} color={color} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.2,
                color,
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export { CONSUMER_ITEMS, COMMERCIAL_ITEMS };
