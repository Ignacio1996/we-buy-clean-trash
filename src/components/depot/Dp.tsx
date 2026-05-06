import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconArrowLeft, IconChevR } from '@/components/icons/EcoIcons';

/**
 * Editorial Eco primitives, tuned for the depot-floor workflow:
 * receive routes, process bags, track inventory. Reads in artificial
 * light at a weighing table, so type sizes lean a hair larger than
 * resident; controls stay touch-comfortable with gloves on.
 */

const SERIF = 'var(--eco-serif)';
const SANS = 'var(--eco-sans)';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

export const DP_TOK = {
  bg: '#F4F0E8',
  paper: '#FBF7EE',
  paperTint: '#F8F3E5',
  ink: '#1F2A22',
  inkSoft: '#5A6358',
  inkFaint: '#8A8A7A',
  line: '#D9D2C2',
  lineSoft: '#E8E2D0',
  green: '#2D5A3D',
  greenSoft: '#E8EFE6',
  greenDeep: '#1F4029',
  amber: '#A0682A',
  amberSoft: '#F2E8D6',
  rust: '#9A4B26',
  rustSoft: '#F0DCC8',
  serif: SERIF,
  sans: SANS,
  mono: MONO,
};

export function DpPage({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`relative mx-auto min-h-dvh max-w-md px-5 pt-6 pb-16 ${className}`}
      style={{
        background: DP_TOK.bg,
        color: DP_TOK.ink,
        fontFamily: SANS,
        backgroundImage:
          'radial-gradient(circle at 20% 30%, rgba(160,140,100,0.06) 1px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(160,140,100,0.05) 1px, transparent 2px)',
        backgroundSize: '14px 14px, 22px 22px',
      }}
    >
      {children}
    </main>
  );
}

export function DpMasthead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5">
      {eyebrow && <DpEyebrow>{eyebrow}</DpEyebrow>}
      {title && (
        <h1
          className="mt-1.5"
          style={{
            fontFamily: SERIF,
            fontSize: 28,
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: -0.4,
            color: DP_TOK.ink,
          }}
        >
          {title}
        </h1>
      )}
      {children}
    </div>
  );
}

export function DpEyebrow({
  children,
  color,
  className = '',
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <div
      className={`uppercase ${className}`}
      style={{
        fontFamily: SANS,
        fontSize: 11,
        color: color ?? DP_TOK.inkSoft,
        letterSpacing: 1.4,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

export function DpPaper({
  children,
  className = '',
  style,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'section' | 'article' | 'li' | 'label';
}) {
  return (
    <Tag
      className={className}
      style={{
        background: DP_TOK.paper,
        border: `1px solid ${DP_TOK.line}`,
        borderRadius: 14,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export function DpPrimaryButton({
  children,
  onClick,
  href,
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const style: React.CSSProperties = {
    background: disabled ? DP_TOK.inkFaint : DP_TOK.green,
    color: DP_TOK.paper,
    fontFamily: SERIF,
    fontSize: 16,
    fontWeight: 500,
    letterSpacing: -0.2,
    opacity: disabled ? 0.5 : 1,
  };
  const base =
    'flex w-full items-center justify-center gap-2.5 rounded-[14px] px-5 py-3.5 transition-opacity disabled:cursor-not-allowed';
  if (href && !disabled) {
    return (
      <Link href={href} className={`${base} ${className}`} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${className}`}
      style={{ ...style, border: 'none' }}
    >
      {children}
    </button>
  );
}

export function DpGhostButton({
  children,
  onClick,
  href,
  type = 'button',
  tone = 'ink',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  type?: 'button' | 'submit';
  tone?: 'ink' | 'rust' | 'green';
  disabled?: boolean;
  className?: string;
}) {
  const palette =
    tone === 'rust'
      ? { fg: DP_TOK.rust, border: DP_TOK.rust }
      : tone === 'green'
        ? { fg: DP_TOK.green, border: DP_TOK.green }
        : { fg: DP_TOK.ink, border: DP_TOK.line };
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-2 transition-opacity disabled:opacity-40';
  const style: React.CSSProperties = {
    background: 'transparent',
    border: `1px solid ${palette.border}`,
    color: palette.fg,
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: 0.3,
  };
  if (href && !disabled) {
    return (
      <Link href={href} className={`${base} ${className}`} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}

export function DpBackRow({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-3"
      style={{ textDecoration: 'none' }}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{
          background: DP_TOK.paper,
          border: `1px solid ${DP_TOK.line}`,
        }}
      >
        <IconArrowLeft size={14} color={DP_TOK.ink} />
      </span>
      <DpEyebrow>{label}</DpEyebrow>
    </Link>
  );
}

export type DpStatusKey = 'new' | 'in_progress' | 'done' | 'pending' | 'processed';

export function DpStatusPill({ status }: { status: DpStatusKey }) {
  const map: Record<
    DpStatusKey,
    { bg: string; fg: string; border: string; label: string }
  > = {
    new: {
      bg: DP_TOK.green,
      fg: DP_TOK.paper,
      border: DP_TOK.green,
      label: 'New',
    },
    in_progress: {
      bg: DP_TOK.amberSoft,
      fg: DP_TOK.amber,
      border: 'rgba(160,104,42,0.3)',
      label: 'In progress',
    },
    done: {
      bg: DP_TOK.paperTint,
      fg: DP_TOK.inkFaint,
      border: DP_TOK.lineSoft,
      label: 'Done',
    },
    pending: {
      bg: DP_TOK.paperTint,
      fg: DP_TOK.inkSoft,
      border: DP_TOK.line,
      label: 'Pending',
    },
    processed: {
      bg: DP_TOK.greenSoft,
      fg: DP_TOK.green,
      border: 'rgba(45,90,61,0.25)',
      label: 'Processed',
    },
  };
  const s = map[status];
  return (
    <span
      className="inline-block uppercase"
      style={{
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        fontFamily: SANS,
        fontSize: 10,
        letterSpacing: 1.2,
        fontWeight: 500,
        padding: '3px 9px',
        borderRadius: 999,
      }}
    >
      {s.label}
    </span>
  );
}

export function DpRow({
  label,
  value,
  valueTone = 'ink',
}: {
  label: ReactNode;
  value: ReactNode;
  valueTone?: 'ink' | 'rust' | 'green' | 'mono';
}) {
  const color =
    valueTone === 'rust'
      ? DP_TOK.rust
      : valueTone === 'green'
        ? DP_TOK.green
        : DP_TOK.ink;
  const fontFamily = valueTone === 'mono' ? MONO : SERIF;
  return (
    <div
      className="flex items-baseline justify-between py-2.5"
      style={{ borderBottom: `1px solid ${DP_TOK.lineSoft}` }}
    >
      <DpEyebrow>{label}</DpEyebrow>
      <span
        style={{
          fontFamily,
          fontSize: 15,
          color,
          letterSpacing: valueTone === 'mono' ? 0 : -0.2,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function DpProgressBar({
  pct,
  tone = 'ink',
}: {
  pct: number;
  tone?: 'ink' | 'green' | 'amber' | 'rust';
}) {
  const fill =
    tone === 'green'
      ? DP_TOK.green
      : tone === 'amber'
        ? DP_TOK.amber
        : tone === 'rust'
          ? DP_TOK.rust
          : DP_TOK.ink;
  return (
    <div
      className="overflow-hidden rounded-full"
      style={{ height: 4, background: DP_TOK.lineSoft }}
    >
      <div
        className="h-full"
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: fill,
        }}
      />
    </div>
  );
}

export function DpListLink({
  href,
  icon,
  title,
  subtitle,
  rightSlot,
  footer,
}: {
  href: string;
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  rightSlot?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block transition-opacity hover:opacity-80"
      style={{
        background: DP_TOK.paper,
        border: `1px solid ${DP_TOK.line}`,
        borderRadius: 14,
        padding: 14,
        textDecoration: 'none',
        color: DP_TOK.ink,
      }}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px]"
            style={{ background: DP_TOK.greenSoft, color: DP_TOK.green }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 16,
              color: DP_TOK.ink,
              lineHeight: 1.2,
              letterSpacing: -0.2,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              className="mt-0.5"
              style={{ fontSize: 12, color: DP_TOK.inkSoft, lineHeight: 1.4 }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {rightSlot ?? <IconChevR size={16} color={DP_TOK.inkFaint} />}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </Link>
  );
}

export function DpEmpty({
  title,
  body,
}: {
  title: ReactNode;
  body?: ReactNode;
}) {
  return (
    <div
      className="rounded-[14px] px-4 py-7 text-center"
      style={{
        background: DP_TOK.paper,
        border: `1px solid ${DP_TOK.line}`,
      }}
    >
      <div
        className="italic"
        style={{
          fontFamily: SERIF,
          fontSize: 16,
          color: DP_TOK.ink,
        }}
      >
        {title}
      </div>
      {body && (
        <div
          className="mt-1.5 italic"
          style={{
            fontFamily: SERIF,
            fontSize: 12,
            color: DP_TOK.inkSoft,
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>
      )}
    </div>
  );
}

export function DpAlert({
  tone,
  children,
}: {
  tone: 'green' | 'amber' | 'rust';
  children: ReactNode;
}) {
  const palette =
    tone === 'green'
      ? { bg: DP_TOK.greenSoft, border: 'rgba(45,90,61,0.3)', fg: DP_TOK.green }
      : tone === 'amber'
        ? { bg: DP_TOK.amberSoft, border: 'rgba(160,104,42,0.3)', fg: DP_TOK.amber }
        : { bg: DP_TOK.rustSoft, border: 'rgba(154,75,38,0.3)', fg: DP_TOK.rust };
  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        borderRadius: 12,
        padding: '10px 14px',
        fontFamily: SERIF,
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}
