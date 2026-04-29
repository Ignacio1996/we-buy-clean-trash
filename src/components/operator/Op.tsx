import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  IconArrowLeft,
  IconCheck,
  IconClose,
  IconChevR,
} from '@/components/icons/EcoIcons';

/**
 * Editorial Eco shared primitives, tuned for an in-the-truck operator workflow.
 * Larger touch targets, persistent route progress, no marketing chrome.
 */

const SERIF = 'var(--eco-serif)';
const SANS = 'var(--eco-sans)';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

export const OP_TOK = {
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

export function OpPage({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`relative min-h-dvh px-5 pt-12 pb-24 sm:px-6 ${className}`}
      style={{
        background: OP_TOK.bg,
        color: OP_TOK.ink,
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

export function OpMasthead({
  date,
  name,
  initial,
  rightSlot,
}: {
  date?: string;
  name?: string;
  initial?: string;
  rightSlot?: ReactNode;
}) {
  return (
    <div
      className="mb-6 flex items-start justify-between pb-3.5"
      style={{ borderBottom: `1px solid ${OP_TOK.line}` }}
    >
      <div>
        <div
          className="italic"
          style={{
            fontFamily: SERIF,
            fontSize: 14,
            color: OP_TOK.green,
            letterSpacing: 0.5,
          }}
        >
          We Buy Clean Trash
        </div>
        <div
          className="mt-0.5 uppercase"
          style={{ fontSize: 11, color: OP_TOK.inkSoft, letterSpacing: 1.6 }}
        >
          Operator{date ? ` · ${date}` : ''}
        </div>
      </div>
      {rightSlot ?? (
        name && initial && <OpAvatar name={name} initial={initial} />
      )}
    </div>
  );
}

export function OpAvatar({
  name,
  initial,
  signOutSlot,
}: {
  name: string;
  initial: string;
  signOutSlot?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-right">
        <div style={{ fontFamily: SERIF, fontSize: 13, color: OP_TOK.ink }}>{name}</div>
        {signOutSlot}
      </div>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{
          background: OP_TOK.greenSoft,
          color: OP_TOK.green,
          fontFamily: SERIF,
          fontWeight: 600,
        }}
      >
        {initial}
      </div>
    </div>
  );
}

export function OpEyebrow({
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
        color: color ?? OP_TOK.inkSoft,
        letterSpacing: 1.4,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

export function OpDisplay({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={className}
      style={{
        fontFamily: SERIF,
        fontSize: 32,
        fontWeight: 400,
        lineHeight: 1.1,
        letterSpacing: -0.6,
        color: OP_TOK.ink,
      }}
    >
      {children}
    </h1>
  );
}

export function OpPaper({
  children,
  className = '',
  style,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag
      className={className}
      style={{
        background: OP_TOK.paper,
        border: `1px solid ${OP_TOK.line}`,
        borderRadius: 14,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export function OpPrimaryButton({
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
    background: disabled ? OP_TOK.inkFaint : OP_TOK.green,
    color: OP_TOK.paper,
    fontFamily: SERIF,
    fontSize: 17,
    fontWeight: 500,
    letterSpacing: -0.2,
    opacity: disabled ? 0.5 : 1,
  };
  const base =
    'flex w-full items-center justify-center gap-2.5 rounded-[14px] px-5 py-4 transition-opacity disabled:cursor-not-allowed';
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

export function OpGhostButton({
  children,
  onClick,
  type = 'button',
  tone = 'ink',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  tone?: 'ink' | 'rust' | 'green';
  disabled?: boolean;
  className?: string;
}) {
  const palette =
    tone === 'rust'
      ? { fg: OP_TOK.rust, border: OP_TOK.rust }
      : tone === 'green'
        ? { fg: OP_TOK.green, border: OP_TOK.green }
        : { fg: OP_TOK.ink, border: OP_TOK.line };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-2.5 transition-opacity disabled:opacity-40 ${className}`}
      style={{
        background: 'transparent',
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        fontFamily: SANS,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: 0.3,
      }}
    >
      {children}
    </button>
  );
}

export function OpBackRow({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="mb-6 inline-flex items-center gap-3"
      style={{ textDecoration: 'none' }}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{
          background: OP_TOK.paper,
          border: `1px solid ${OP_TOK.line}`,
        }}
      >
        <IconArrowLeft size={14} color={OP_TOK.ink} />
      </span>
      <OpEyebrow>{label}</OpEyebrow>
    </Link>
  );
}

export type StatusKey = 'pending' | 'completed' | 'missed' | 'issue' | 'skipped';

export function StatusPill({ status }: { status: StatusKey }) {
  const map: Record<StatusKey, { bg: string; fg: string; label: string }> = {
    pending: { bg: OP_TOK.paperTint, fg: OP_TOK.inkSoft, label: 'Pending' },
    completed: { bg: OP_TOK.greenSoft, fg: OP_TOK.green, label: 'Done' },
    missed: { bg: OP_TOK.amberSoft, fg: OP_TOK.amber, label: 'Missed' },
    issue: { bg: OP_TOK.rustSoft, fg: OP_TOK.rust, label: 'Issue' },
    skipped: { bg: OP_TOK.paperTint, fg: OP_TOK.inkFaint, label: 'Skipped' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className="inline-block uppercase"
      style={{
        background: s.bg,
        color: s.fg,
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

export function ProgressStrip({
  cells,
}: {
  cells: { label: string; done: number; total: number }[];
}) {
  const visible = cells.filter((c) => c.total > 0);
  if (visible.length === 0) return null;
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${visible.length}, 1fr)`,
        borderTop: `1px solid ${OP_TOK.line}`,
        borderBottom: `1px solid ${OP_TOK.line}`,
        padding: '14px 0',
      }}
    >
      {visible.map((c, i) => (
        <div
          key={c.label}
          className="px-3 text-center"
          style={{
            borderRight:
              i < visible.length - 1 ? `1px solid ${OP_TOK.lineSoft}` : 'none',
          }}
        >
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 22,
              color: OP_TOK.ink,
              letterSpacing: -0.3,
              fontFeatureSettings: '"lnum","tnum"',
            }}
          >
            {c.done}
            <span style={{ color: OP_TOK.inkFaint }}>/{c.total}</span>
          </div>
          <div
            className="mt-0.5 uppercase"
            style={{
              fontFamily: SANS,
              fontSize: 10,
              color: OP_TOK.inkSoft,
              letterSpacing: 1.4,
            }}
          >
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToggleRow({
  label,
  value,
  onChange,
  tone = 'ok',
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  tone?: 'ok' | 'rust';
}) {
  const onColor = tone === 'rust' ? OP_TOK.rust : OP_TOK.green;
  return (
    <div
      className="flex items-center justify-between py-3.5"
      style={{ borderBottom: `1px solid ${OP_TOK.lineSoft}` }}
    >
      <span style={{ fontFamily: SERIF, fontSize: 15, color: OP_TOK.ink }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className="relative cursor-pointer rounded-full p-0 transition-colors"
        style={{
          width: 44,
          height: 24,
          background: value ? onColor : OP_TOK.line,
          border: 'none',
        }}
      >
        <span
          className="absolute rounded-full"
          style={{
            top: 2,
            left: value ? 22 : 2,
            width: 20,
            height: 20,
            background: OP_TOK.paper,
            transition: 'left 0.15s',
            boxShadow: '0 1px 2px rgba(31,42,34,0.2)',
          }}
        />
      </button>
    </div>
  );
}

export function SummaryStat({
  label,
  value,
  tone = 'ink',
}: {
  label: string;
  value: ReactNode;
  tone?: 'ink' | 'green' | 'amber' | 'rust';
}) {
  const colorMap: Record<string, string> = {
    ink: OP_TOK.ink,
    green: OP_TOK.green,
    amber: OP_TOK.amber,
    rust: OP_TOK.rust,
  };
  const c = colorMap[tone];
  return (
    <div style={{ borderTop: `2px solid ${c}`, paddingTop: 10 }}>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 32,
          color: c,
          letterSpacing: -1,
          fontFeatureSettings: '"lnum","tnum"',
        }}
      >
        {value}
      </div>
      <div
        className="mt-1 uppercase"
        style={{
          fontFamily: SANS,
          fontSize: 10,
          color: OP_TOK.inkSoft,
          letterSpacing: 1.4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function OpSheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center"
      style={{ background: 'rgba(31,42,34,0.45)' }}
    >
      <div
        className="w-full max-w-md overflow-y-auto"
        style={{
          background: OP_TOK.bg,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: '20px 20px 28px',
          maxHeight: '80%',
          borderTop: `1px solid ${OP_TOK.line}`,
        }}
      >
        <div
          className="mb-4 flex items-start justify-between pb-3"
          style={{ borderBottom: `1px solid ${OP_TOK.line}` }}
        >
          <div>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 20,
                color: OP_TOK.ink,
                letterSpacing: -0.3,
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                className="mt-1 italic"
                style={{
                  fontFamily: SERIF,
                  fontSize: 12,
                  color: OP_TOK.inkSoft,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-0"
            style={{ background: 'transparent', border: 'none', color: OP_TOK.inkSoft }}
            aria-label="Close"
          >
            <IconClose size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StepDots({
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
    <div className="flex items-start gap-1">
      {order.map((k, i) => {
        const active = i <= idx;
        return (
          <div key={k} className="flex flex-1 items-start">
            <div
              className="flex flex-col items-center gap-1.5"
              style={{ opacity: active ? 1 : 0.4, minWidth: 0 }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: i < idx ? OP_TOK.green : i === idx ? OP_TOK.ink : OP_TOK.paper,
                  color: OP_TOK.paper,
                  fontFamily: SERIF,
                  fontSize: 10,
                  border: `1px solid ${i === idx ? OP_TOK.ink : i < idx ? OP_TOK.green : OP_TOK.line}`,
                }}
              >
                {i < idx ? <IconCheck size={10} color={OP_TOK.paper} stroke={2.5} /> : i + 1}
              </div>
              <span
                className="uppercase whitespace-nowrap"
                style={{
                  fontFamily: SANS,
                  fontSize: 9,
                  color: OP_TOK.inkSoft,
                  letterSpacing: 1.2,
                }}
              >
                {labels[k]}
              </span>
            </div>
            {i < order.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: OP_TOK.line,
                  marginTop: 9,
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

export function OpRow({
  label,
  value,
  valueTone = 'ink',
  onEdit,
}: {
  label: ReactNode;
  value: ReactNode;
  valueTone?: 'ink' | 'rust';
  onEdit?: () => void;
}) {
  return (
    <div
      className="flex items-baseline justify-between py-3"
      style={{ borderBottom: `1px solid ${OP_TOK.lineSoft}` }}
    >
      <OpEyebrow>{label}</OpEyebrow>
      <div className="flex items-baseline gap-3">
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 15,
            color: valueTone === 'rust' ? OP_TOK.rust : OP_TOK.ink,
          }}
        >
          {value}
        </span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="cursor-pointer p-0 italic underline"
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: SERIF,
              fontSize: 11,
              color: OP_TOK.inkSoft,
              textDecorationColor: OP_TOK.line,
            }}
          >
            edit
          </button>
        )}
      </div>
    </div>
  );
}

export function ChevR({ color = OP_TOK.inkFaint, size = 14 }: { color?: string; size?: number }) {
  return <IconChevR size={size} color={color} />;
}
