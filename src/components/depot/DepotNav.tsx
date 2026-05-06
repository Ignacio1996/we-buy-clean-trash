'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutLink } from '@/app/depot/LogoutLink';
import { DP_TOK } from '@/components/depot/Dp';

const TABS = [
  { href: '/depot/incoming', label: 'Incoming' },
  { href: '/depot/inventory', label: 'Inventory' },
] as const;

export function DepotNav() {
  const pathname = usePathname() ?? '';
  return (
    <header
      className="mb-6 flex items-start justify-between pb-3.5"
      style={{ borderBottom: `1px solid ${DP_TOK.line}` }}
    >
      <div>
        <div
          className="italic"
          style={{
            fontFamily: DP_TOK.serif,
            fontSize: 14,
            color: DP_TOK.green,
            letterSpacing: 0.5,
          }}
        >
          We Buy Clean Trash
        </div>
        <div
          className="mt-2 flex gap-1.5"
          aria-label="Depot sections"
        >
          {TABS.map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="uppercase transition-opacity"
                style={{
                  fontFamily: DP_TOK.sans,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  fontWeight: 500,
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: active ? DP_TOK.green : 'transparent',
                  color: active ? DP_TOK.paper : DP_TOK.inkSoft,
                  border: `1px solid ${active ? DP_TOK.green : DP_TOK.line}`,
                  textDecoration: 'none',
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      <LogoutLink />
    </header>
  );
}
