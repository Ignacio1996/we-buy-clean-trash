import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Sticker Sections — Depot Manager primitives.
 * Same yellow / sky / mint / peach palette as the resident + operator SS,
 * with a 4-tab bottom nav (Depots · Pickups · Reports · Account).
 */

export const SSMG = {
  bg: '#FFFFFF',
  ink: '#111111',
  inkSoft: '#6B6B6B',
  line: '#ECECEC',
  brand: '#E11D2A',
  brandDark: '#A6121C',
  yellow: '#FFEB52',
  mint: '#D9F2D9',
  sky: '#E4EEFB',
  peach: '#FFD9C7',
  green: '#1F8A5B',
  amber: '#E89B1A',
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
} as const;

export type MgrTab = 'depots' | 'ships' | 'reports' | 'me';

export function SSMgShell({
  children,
  active = 'depots',
  nav = true,
}: {
  children: ReactNode;
  active?: MgrTab;
  nav?: boolean;
}) {
  return (
    <div
      style={{
        background: SSMG.bg,
        minHeight: '100dvh',
        fontFamily: SSMG.sans,
        color: SSMG.ink,
        paddingBottom: nav ? 96 : 0,
        position: 'relative',
      }}
    >
      <div style={{ height: 50 }} />
      {children}
      {nav && <SSMgNav active={active} />}
    </div>
  );
}

export function SSMgNav({ active }: { active: MgrTab }) {
  const items: Array<{ k: MgrTab; l: string; href: string }> = [
    { k: 'depots', l: 'Depots', href: '/manager' },
    { k: 'ships', l: 'Pickups', href: '/manager?tab=pickups' },
    { k: 'reports', l: 'Reports', href: '/manager/reports' },
    { k: 'me', l: 'Account', href: '/manager?tab=account' },
  ];
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: `2px solid ${SSMG.ink}`,
        padding: '8px 4px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)',
        zIndex: 20,
      }}
    >
      {items.map(({ k, l, href }) => {
        const on = active === k;
        return (
          <Link
            key={k}
            href={href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: 6,
              color: on ? SSMG.brand : SSMG.ink,
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: on ? SSMG.brand : 'transparent',
                border: `2px solid ${on ? SSMG.brand : SSMG.ink}`,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.2 }}>{l}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function SSMgEyebrow({
  children,
  color = SSMG.inkSoft,
  mb = 8,
  style,
}: {
  children: ReactNode;
  color?: string;
  mb?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        color,
        marginBottom: mb,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SSMgHeader({
  kicker,
  title,
  sub,
  back,
  backHref,
  headerBg = SSMG.yellow,
  right,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  back?: string;
  backHref?: string;
  headerBg?: string;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        background: headerBg,
        padding: '20px 20px 22px',
        borderBottom: `2px solid ${SSMG.ink}`,
      }}
    >
      {(back || right) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          {back && backHref ? (
            <Link
              href={backHref}
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: SSMG.ink,
                opacity: 0.7,
                textDecoration: 'none',
              }}
            >
              ← {back}
            </Link>
          ) : (
            <span />
          )}
          {right}
        </div>
      )}
      {kicker && <SSMgEyebrow mb={6}>{kicker}</SSMgEyebrow>}
      <div
        style={{
          fontSize: 30,
          fontWeight: 900,
          letterSpacing: -1.3,
          lineHeight: 1,
          color: SSMG.ink,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: SSMG.ink,
            opacity: 0.75,
            marginTop: 8,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export function SSMgCard({
  children,
  color = '#fff',
  pad = 16,
  border = SSMG.ink,
  shadow,
  radius = 16,
  style,
}: {
  children: ReactNode;
  color?: string;
  pad?: number | string;
  border?: string;
  shadow?: string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: color,
        border: `2px solid ${border}`,
        borderRadius: radius,
        padding: pad,
        boxShadow: `0 4px 0 ${shadow ?? border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SSMgStat({
  value,
  label,
  color = '#fff',
}: {
  value: ReactNode;
  label: ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        background: color,
        border: `2px solid ${SSMG.ink}`,
        borderRadius: 14,
        padding: '12px 12px',
        boxShadow: `0 4px 0 ${SSMG.ink}`,
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: -1,
          lineHeight: 1,
          color: SSMG.ink,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: SSMG.inkSoft,
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export type MgStatus = 'FULL' | 'OK' | 'LOW' | 'SCHEDULED' | 'SHIPPED' | 'CANCELLED';

export function SSMgStatusBadge({ status }: { status: MgStatus }) {
  const map: Record<MgStatus, { bg: string; fg: string }> = {
    FULL: { bg: SSMG.brand, fg: '#fff' },
    OK: { bg: SSMG.mint, fg: SSMG.ink },
    LOW: { bg: SSMG.yellow, fg: SSMG.ink },
    SCHEDULED: { bg: SSMG.sky, fg: SSMG.ink },
    SHIPPED: { bg: SSMG.mint, fg: SSMG.ink },
    CANCELLED: { bg: '#fff', fg: SSMG.inkSoft },
  };
  const s = map[status];
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        border: `2px solid ${SSMG.ink}`,
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        boxShadow: `0 2px 0 ${SSMG.ink}`,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {status}
    </span>
  );
}

export function SSMgBar({
  pct,
  color,
  height = 14,
}: {
  pct: number;
  color?: string;
  height?: number;
}) {
  const c =
    color ??
    (pct >= 95 ? SSMG.brand : pct >= 80 ? SSMG.amber : pct >= 40 ? SSMG.ink : SSMG.mint);
  return (
    <div
      style={{
        height,
        background: '#fff',
        borderRadius: 999,
        overflow: 'hidden',
        border: `2px solid ${SSMG.ink}`,
      }}
    >
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: c }} />
    </div>
  );
}

type PillVariant = 'ink' | 'brand' | 'white' | 'yellow';

const PILL_VARIANTS: Record<PillVariant, { bg: string; fg: string; border: string; sh: string }> = {
  ink: { bg: SSMG.ink, fg: '#fff', border: SSMG.ink, sh: SSMG.ink },
  brand: { bg: SSMG.brand, fg: '#fff', border: SSMG.brand, sh: SSMG.brandDark },
  white: { bg: '#fff', fg: SSMG.ink, border: SSMG.ink, sh: SSMG.ink },
  yellow: { bg: SSMG.yellow, fg: SSMG.ink, border: SSMG.ink, sh: SSMG.ink },
};

function pillStyle(variant: PillVariant, size: 'md' | 'lg', disabled = false): CSSProperties {
  const v = PILL_VARIANTS[variant];
  const sz = size === 'lg' ? { pad: '18px 22px', fs: 18 } : { pad: '14px 18px', fs: 15 };
  return {
    width: '100%',
    background: v.bg,
    color: v.fg,
    opacity: disabled ? 0.4 : 1,
    border: `2px solid ${v.border}`,
    borderRadius: 999,
    padding: sz.pad,
    fontFamily: SSMG.sans,
    fontSize: sz.fs,
    fontWeight: 900,
    letterSpacing: -0.3,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: `0 4px 0 ${v.sh}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    textDecoration: 'none',
    boxSizing: 'border-box',
  };
}

interface PillCommon {
  children: ReactNode;
  variant?: PillVariant;
  size?: 'md' | 'lg';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: CSSProperties;
}

export function SSMgPillButton({
  type = 'button',
  onClick,
  disabled,
  children,
  variant = 'brand',
  size = 'md',
  leftIcon,
  rightIcon = '→',
  style,
}: PillCommon & {
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...pillStyle(variant, size, disabled), ...style }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {leftIcon}
        {children}
      </span>
      {rightIcon && (
        <span style={{ fontSize: size === 'lg' ? 22 : 18, lineHeight: 1 }}>{rightIcon}</span>
      )}
    </button>
  );
}

export function SSMgPillLink({
  href,
  children,
  variant = 'brand',
  size = 'md',
  leftIcon,
  rightIcon = '→',
  style,
}: PillCommon & { href: string }) {
  return (
    <Link href={href} style={{ ...pillStyle(variant, size, false), ...style }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {leftIcon}
        {children}
      </span>
      {rightIcon && (
        <span style={{ fontSize: size === 'lg' ? 22 : 18, lineHeight: 1 }}>{rightIcon}</span>
      )}
    </Link>
  );
}

export function SSMgError({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: SSMG.brand,
        border: `2px solid ${SSMG.ink}`,
        borderRadius: 14,
        padding: 14,
        color: '#fff',
        fontFamily: SSMG.sans,
        fontSize: 13,
        fontWeight: 900,
        boxShadow: `0 4px 0 ${SSMG.ink}`,
        margin: '14px 20px 0',
      }}
    >
      {children}
    </div>
  );
}

export function SSMgLogoutButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        background: '#fff',
        border: `2px solid ${SSMG.ink}`,
        color: SSMG.ink,
        borderRadius: 999,
        padding: '6px 12px',
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontFamily: SSMG.sans,
        boxShadow: `0 2px 0 ${SSMG.ink}`,
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.5 : 1,
      }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
