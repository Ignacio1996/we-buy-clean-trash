'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SS } from '@/components/resident/ss/SS';
import { IconBox, IconTruck, IconUser } from '@/components/icons/EcoIcons';

const ITEMS = [
  { href: '/depot/incoming', label: 'Queue', Icon: IconTruck },
  { href: '/depot/inventory', label: 'Stock', Icon: IconBox },
  { href: '/depot/account', label: 'Account', Icon: IconUser },
] as const;

export function DepotBottomNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      className="sticky bottom-0 z-10 mx-auto w-full max-w-md sm:max-w-xl lg:max-w-2xl"
      style={{
        background: '#fff',
        borderTop: `1px solid ${SS.line}`,
        padding: '8px 4px 24px',
        display: 'grid',
        gridTemplateColumns: `repeat(${ITEMS.length}, minmax(0, 1fr))`,
      }}
    >
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const color = active ? SS.brand : SS.ink;
        return (
          <Link
            key={href}
            href={href}
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
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
