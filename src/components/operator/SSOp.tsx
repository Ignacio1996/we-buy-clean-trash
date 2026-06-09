import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { SSWordmarkBar } from '@/components/resident/ss/SS';

/**
 * Sticker Sections — Operator (driver) app primitives.
 * White base broken into pastel section blocks (yellow / mint / sky / peach).
 * Chunky pill buttons with hard 4px offset shadows. Heavy 900-weight sans.
 *
 * Mirrors the design in planning/sticker-sections (operator) — same palette
 * as resident SS but with operator-specific shells, progress strip and review
 * rows. Use these in /operator/* in place of the cream + serif Op.tsx tokens.
 */

export const SSOP = {
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
  greenDark: '#13643A',
  amber: '#E89B1A',
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
} as const;

export function SSOpShell({
  children,
  active = 'route',
  nav = true,
  right,
}: {
  children: ReactNode;
  active?: 'route' | 'compost' | 'me';
  nav?: boolean;
  /** Right-side content for the shared wordmark bar (avatar, sign-out, …). */
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        background: SSOP.bg,
        minHeight: '100dvh',
        fontFamily: SSOP.sans,
        color: SSOP.ink,
        paddingBottom: nav ? 96 : 0,
        position: 'relative',
      }}
    >
      <SSWordmarkBar right={right} />
      {children}
      {nav && <SSOpNav active={active} />}
    </div>
  );
}

function NavIcon({ kind, color }: { kind: 'route' | 'compost' | 'me'; color: string }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2.25,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (kind === 'route') {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="6" cy="5" r="2.25" />
        <circle cx="18" cy="19" r="2.25" />
        <path d="M8.25 5h7.25a3.25 3.25 0 0 1 0 6.5h-7.5a3.25 3.25 0 0 0 0 6.5h7.75" />
      </svg>
    );
  }
  if (kind === 'compost') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M5 20c0-7 5-13 14-13-0.5 8-6 13-14 13Z" />
        <path d="M5 20c3-4 6-6.5 10-8" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20c1.5-3.75 5-5.5 7.5-5.5s6 1.75 7.5 5.5" />
    </svg>
  );
}

export function SSOpNav({ active }: { active: 'route' | 'compost' | 'me' }) {
  const items: Array<{ k: 'route' | 'compost' | 'me'; l: string; href: string }> = [
    { k: 'route', l: 'Route', href: '/operator' },
    { k: 'compost', l: 'Compost', href: '/operator/compost' },
    { k: 'me', l: 'Account', href: '/operator/account' },
  ];
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: `2px solid ${SSOP.ink}`,
        padding: '8px 4px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        zIndex: 20,
      }}
    >
      {items.map(({ k, l, href }) => {
        const on = active === k;
        const color = on ? SSOP.brand : SSOP.ink;
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
              color,
              textDecoration: 'none',
            }}
          >
            <NavIcon kind={k} color={color} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.2 }}>{l}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function SSOpEyebrow({
  children,
  color = SSOP.inkSoft,
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

export function SSOpHeader({
  kicker,
  title,
  sub,
  back,
  backHref,
  headerBg = SSOP.yellow,
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
        borderBottom: `2px solid ${SSOP.ink}`,
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
          {back ? (
            backHref ? (
              <Link
                href={backHref}
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: SSOP.ink,
                  opacity: 0.7,
                  textDecoration: 'none',
                }}
              >
                ← {back}
              </Link>
            ) : (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: SSOP.ink,
                  opacity: 0.7,
                }}
              >
                ← {back}
              </span>
            )
          ) : (
            <span />
          )}
          {right}
        </div>
      )}
      {kicker && <SSOpEyebrow mb={6}>{kicker}</SSOpEyebrow>}
      <div
        style={{
          fontSize: 30,
          fontWeight: 900,
          letterSpacing: -1.3,
          lineHeight: 1,
          color: SSOP.ink,
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
            color: SSOP.ink,
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

export function SSOpCard({
  children,
  color = '#fff',
  pad = 16,
  border = SSOP.ink,
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

export function SSOpStat({
  value,
  label,
  color = '#fff',
  flex = 1,
}: {
  value: ReactNode;
  label: ReactNode;
  color?: string;
  flex?: number;
}) {
  return (
    <div
      style={{
        flex,
        background: color,
        border: `2px solid ${SSOP.ink}`,
        borderRadius: 14,
        padding: '12px 12px',
        boxShadow: `0 4px 0 ${SSOP.ink}`,
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: -1,
          lineHeight: 1,
          color: SSOP.ink,
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
          color: SSOP.inkSoft,
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function SSOpBadge({
  children,
  bg = SSOP.yellow,
  fg = SSOP.ink,
  border = SSOP.ink,
}: {
  children: ReactNode;
  bg?: string;
  fg?: string;
  border?: string;
}) {
  return (
    <span
      style={{
        background: bg,
        color: fg,
        border: `2px solid ${border}`,
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        boxShadow: `0 2px 0 ${border}`,
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

type PillVariant = 'ink' | 'brand' | 'white' | 'yellow' | 'green';

const PILL_VARIANTS: Record<PillVariant, { bg: string; fg: string; border: string; sh: string }> = {
  ink: { bg: SSOP.ink, fg: '#fff', border: SSOP.ink, sh: SSOP.ink },
  brand: { bg: SSOP.brand, fg: '#fff', border: SSOP.brand, sh: SSOP.brandDark },
  white: { bg: '#fff', fg: SSOP.ink, border: SSOP.ink, sh: SSOP.ink },
  yellow: { bg: SSOP.yellow, fg: SSOP.ink, border: SSOP.ink, sh: SSOP.ink },
  green: { bg: SSOP.green, fg: '#fff', border: SSOP.green, sh: SSOP.greenDark },
};

interface PillCommon {
  children: ReactNode;
  variant?: PillVariant;
  size?: 'md' | 'lg';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: CSSProperties;
}

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
    fontFamily: SSOP.sans,
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

export function SSOpPillButton({
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
      {rightIcon && <span style={{ fontSize: size === 'lg' ? 22 : 18, lineHeight: 1 }}>{rightIcon}</span>}
    </button>
  );
}

export function SSOpPillLink({
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
      {rightIcon && <span style={{ fontSize: size === 'lg' ? 22 : 18, lineHeight: 1 }}>{rightIcon}</span>}
    </Link>
  );
}

export function SSOpGhostButton({
  children,
  onClick,
  disabled,
  tone = 'ink',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'ink' | 'brand';
  type?: 'button' | 'submit';
}) {
  const c = tone === 'brand' ? SSOP.brand : SSOP.ink;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: '#fff',
        border: `2px solid ${c}`,
        color: c,
        borderRadius: 999,
        padding: '10px 12px',
        fontSize: 13,
        fontWeight: 900,
        letterSpacing: -0.2,
        fontFamily: SSOP.sans,
        boxShadow: `0 3px 0 ${c}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        width: '100%',
      }}
    >
      {children}
    </button>
  );
}

export function SSOpProgress({
  stopsDone,
  stopsTotal,
  bagsDone,
  bagsTotal,
  deliveriesDone,
  deliveriesTotal,
}: {
  stopsDone: number;
  stopsTotal: number;
  bagsDone: number;
  bagsTotal: number;
  deliveriesDone?: number;
  deliveriesTotal?: number;
}) {
  const pct = stopsTotal ? Math.round((stopsDone / stopsTotal) * 100) : 0;
  return (
    <div style={{ background: SSOP.sky, padding: '20px 20px 22px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}
      >
        <SSOpEyebrow mb={0}>Today&rsquo;s progress</SSOpEyebrow>
        <div
          style={{
            fontSize: 13,
            fontWeight: 900,
            color: SSOP.ink,
            fontFamily: SSOP.mono,
          }}
        >
          {pct}%
        </div>
      </div>
      <div
        style={{
          height: 14,
          background: '#fff',
          borderRadius: 999,
          border: `2px solid ${SSOP.ink}`,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div style={{ height: '100%', width: `${pct}%`, background: SSOP.brand }} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <SSOpStat value={`${stopsDone}/${stopsTotal}`} label="Stops" color="#fff" />
        <SSOpStat value={`${bagsDone}/${bagsTotal}`} label="Bags" color={SSOP.yellow} />
        {deliveriesTotal !== undefined && deliveriesTotal > 0 && (
          <SSOpStat
            value={`${deliveriesDone ?? 0}/${deliveriesTotal}`}
            label="Deliver"
            color={SSOP.mint}
          />
        )}
      </div>
    </div>
  );
}

export function SSOpSteps({
  step,
}: {
  step: 'scan' | 'condition' | 'photo' | 'review' | 'submitting' | 'done';
}) {
  const order: Array<'scan' | 'condition' | 'photo' | 'review'> = [
    'scan',
    'condition',
    'photo',
    'review',
  ];
  const labels = {
    scan: 'Scan',
    condition: 'Condition',
    photo: 'Photo',
    review: 'Confirm',
  } as const;
  const collapsed = step === 'submitting' || step === 'done' ? 'review' : step;
  const idx = order.indexOf(collapsed);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, padding: '0 4px' }}>
      {order.map((k, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={k} style={{ display: 'flex', flex: 1, alignItems: 'flex-start' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: done ? SSOP.brand : active ? SSOP.ink : '#fff',
                  color: done || active ? '#fff' : SSOP.ink,
                  border: `2px solid ${SSOP.ink}`,
                  boxShadow: `0 2px 0 ${SSOP.ink}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: SSOP.sans,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  color: active ? SSOP.ink : SSOP.inkSoft,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {labels[k]}
              </span>
            </div>
            {i < order.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: i < idx ? SSOP.brand : SSOP.ink,
                  marginTop: 13,
                  minWidth: 8,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SSOpToggle({
  on,
  onChange,
  danger,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
  label: string;
}) {
  const onColor = danger ? SSOP.brand : SSOP.green;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        width: 54,
        height: 30,
        borderRadius: 999,
        background: on ? onColor : '#fff',
        border: `2px solid ${SSOP.ink}`,
        display: 'flex',
        alignItems: 'center',
        padding: 2,
        justifyContent: on ? 'flex-end' : 'flex-start',
        boxShadow: `0 3px 0 ${SSOP.ink}`,
        cursor: 'pointer',
      }}
    >
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: SSOP.ink, display: 'block' }} />
    </button>
  );
}

export function SSOpReviewRow({
  label,
  value,
  color = SSOP.ink,
  onEdit,
  last,
}: {
  label: ReactNode;
  value: ReactNode;
  color?: string;
  onEdit?: () => void;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: last ? 'none' : `1px solid ${SSOP.line}`,
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: SSOP.inkSoft,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 900, color, letterSpacing: -0.2 }}>
          {value}
        </span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            style={{
              background: '#fff',
              border: `2px solid ${SSOP.ink}`,
              color: SSOP.ink,
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 1,
              textTransform: 'uppercase',
              fontFamily: SSOP.sans,
              boxShadow: `0 2px 0 ${SSOP.ink}`,
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

export function SSOpError({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: SSOP.brand,
        border: `2px solid ${SSOP.ink}`,
        borderRadius: 14,
        padding: 14,
        color: '#fff',
        fontFamily: SSOP.sans,
        fontSize: 13,
        fontWeight: 900,
        boxShadow: `0 4px 0 ${SSOP.ink}`,
        margin: '14px 20px 0',
      }}
    >
      {children}
    </div>
  );
}
