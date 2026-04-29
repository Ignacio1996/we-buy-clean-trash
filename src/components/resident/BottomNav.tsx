'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import {
  IconHome,
  IconScan,
  IconBag,
  IconGift,
  IconUser,
} from '@/components/icons/EcoIcons';

interface IconProps {
  size?: number;
  color?: string;
  stroke?: number;
}

export interface BottomNavItem {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
}

const CONSUMER_ITEMS: readonly BottomNavItem[] = [
  { href: '/resident', label: 'Home', icon: IconHome },
  { href: '/resident/scan-bag', label: 'Scan', icon: IconScan },
  { href: '/resident/order-bags', label: 'Bags', icon: IconBag },
  { href: '/resident/rewards', label: 'Rewards', icon: IconGift },
  { href: '/resident/profile', label: 'Profile', icon: IconUser },
];

const COMMERCIAL_ITEMS: readonly BottomNavItem[] = [
  { href: '/resident', label: 'Home', icon: IconHome },
  { href: '/resident/profile', label: 'Profile', icon: IconUser },
];

export function BottomNav({ items }: { items?: readonly BottomNavItem[] }) {
  const pathname = usePathname();
  const list = items ?? CONSUMER_ITEMS;
  return (
    <nav
      className="sticky bottom-0 z-10 mx-auto grid w-full max-w-md border-t border-[#D9D2C2] bg-[#FBF7EE] px-2 pt-2.5 pb-7 sm:max-w-xl lg:max-w-2xl"
      style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}
    >
      {list.map((item) => {
        const active =
          pathname === item.href || (item.href !== '/resident' && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 rounded py-1.5"
            style={{ color: active ? '#2D5A3D' : '#5A6358' }}
          >
            <Icon size={20} stroke={active ? 2 : 1.5} />
            <span
              className="text-[10px]"
              style={{
                fontFamily:
                  'ui-serif, Georgia, "Iowan Old Style", "Apple Garamond", serif',
                fontWeight: active ? 600 : 400,
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
