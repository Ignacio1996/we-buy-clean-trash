import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Sticker Sections — shared primitives for the WBCT resident app.
 * White base broken into pastel section blocks (yellow / mint / sky / peach).
 * Chunky pill buttons with hard offset shadows. Heavy sans-serif, 900 weight.
 *
 * Palette mirrors src/app/globals.css `--ss-*` tokens; this file inlines hex
 * values so the same primitives can be used inside `style` attributes and
 * Tailwind arbitrary values consistently.
 */

export const SS = {
  bg: '#FFFFFF',
  ink: '#111111',
  inkSoft: '#6B6B6B',
  line: '#ECECEC',
  brand: '#E11D2A',
  brandDark: '#A6121C',
  green: '#1F8A4C',
  greenDark: '#13643A',
  yellow: '#FFEB52',
  mint: '#D9F2D9',
  sky: '#E4EEFB',
  peach: '#FFD9C7',
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;

export function SSScreen({
  children,
  background = SS.bg,
}: {
  children: ReactNode;
  background?: string;
}) {
  return (
    <div
      style={{
        background,
        minHeight: '100%',
        fontFamily: SS.sans,
        color: SS.ink,
        paddingBottom: 100,
      }}
    >
      {children}
    </div>
  );
}

export function SSWordmark({
  size = 22,
  inline = false,
}: {
  size?: number;
  inline?: boolean;
}) {
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 900,
        letterSpacing: -0.8,
        lineHeight: 1,
        color: SS.ink,
        textTransform: 'uppercase',
        flex: inline ? 1 : undefined,
      }}
    >
      We Buy Clean <span style={{ color: SS.brand }}>Trash.</span>
    </div>
  );
}

/**
 * Shared role header bar — a flush, white wordmark strip used identically by
 * resident, operator, and depot worker. Sits at the very top of the screen
 * (no preceding spacer): the top padding clears the device status bar / notch
 * via `env(safe-area-inset-top)` and falls back to a small inset in browsers.
 * Each role supplies its own `right` slot (avatar link, sign-out, etc.).
 */
export function SSWordmarkBar({ right }: { right?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        background: '#fff',
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 14,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
      }}
    >
      <SSWordmark inline />
      {right}
    </div>
  );
}

/** Circular avatar pill showing the user's initial; links to their account. */
export function SSAvatarLink({ initial, href }: { initial: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: SS.ink,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: 13,
        flexShrink: 0,
        textDecoration: 'none',
      }}
    >
      {initial}
    </Link>
  );
}

export function SSHeader({
  initial,
  href = '/resident/profile',
}: {
  initial: string;
  href?: string;
}) {
  return <SSWordmarkBar right={<SSAvatarLink initial={initial} href={href} />} />;
}

export function SSStepBar({
  back,
  step,
  total,
  right,
}: {
  back?: string;
  step: number;
  total: number;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: '16px 20px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {back ? (
        <Link
          href={back}
          aria-label="Back"
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: SS.ink,
            textDecoration: 'none',
          }}
        >
          ←
        </Link>
      ) : (
        <div style={{ width: 22 }} />
      )}
      <SSDots step={step} total={total} />
      <div style={{ width: 22, textAlign: 'right' }}>{right ?? null}</div>
    </div>
  );
}

export function SSDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? 24 : 8,
            height: 8,
            borderRadius: 4,
            background: i <= step ? SS.ink : SS.line,
            transition: 'all .2s',
          }}
        />
      ))}
    </div>
  );
}

export function SSEyebrow({
  children,
  color = SS.inkSoft,
  icon,
  style,
}: {
  children: ReactNode;
  color?: string;
  icon?: ReactNode;
  style?: CSSProperties;
}) {
  const text: CSSProperties = {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  };
  if (icon) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color,
          ...style,
        }}
      >
        {icon}
        <span style={text}>{children}</span>
      </div>
    );
  }
  return (
    <div style={{ ...text, color, ...style }}>{children}</div>
  );
}

export function SSSection({
  children,
  background = '#fff',
  divider = false,
  style,
}: {
  children: ReactNode;
  background?: string;
  divider?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background,
        padding: '22px 20px',
        borderTop: divider ? `1px solid ${SS.line}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type PillVariant = 'primary' | 'dark' | 'outline' | 'red';

const PILL_BASE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  border: 'none',
  borderRadius: 999,
  padding: '20px 24px',
  fontFamily: SS.sans,
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: -0.3,
  cursor: 'pointer',
  textDecoration: 'none',
  boxSizing: 'border-box',
};

function pillStyle(variant: PillVariant): CSSProperties {
  if (variant === 'primary') {
    return {
      ...PILL_BASE,
      background: SS.green,
      color: '#fff',
      boxShadow: `0 4px 0 ${SS.greenDark}`,
    };
  }
  if (variant === 'red') {
    return {
      ...PILL_BASE,
      background: SS.brand,
      color: '#fff',
      boxShadow: `0 4px 0 ${SS.brandDark}`,
    };
  }
  if (variant === 'dark') {
    return {
      ...PILL_BASE,
      background: SS.ink,
      color: '#fff',
      boxShadow: '0 4px 0 #000',
    };
  }
  return {
    ...PILL_BASE,
    background: '#fff',
    color: SS.ink,
    border: `2px solid ${SS.ink}`,
    boxShadow: `0 4px 0 ${SS.ink}`,
  };
}

interface SSPillCommon {
  children: ReactNode;
  variant?: PillVariant;
  arrow?: boolean;
  /** Optional icon rendered before the label, in a flex row with 12px gap. */
  leadingIcon?: ReactNode;
  /** Replaces the text `→` with a custom node (e.g. a stroke arrow icon). */
  iconArrow?: ReactNode;
  style?: CSSProperties;
}

function PillLabel({
  leadingIcon,
  children,
}: {
  leadingIcon?: ReactNode;
  children: ReactNode;
}) {
  if (!leadingIcon) return <span>{children}</span>;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {leadingIcon}
      {children}
    </span>
  );
}

function PillArrow({
  arrow,
  iconArrow,
}: {
  arrow: boolean;
  iconArrow?: ReactNode;
}) {
  if (!arrow) return null;
  if (iconArrow) return <>{iconArrow}</>;
  return <span style={{ fontSize: 22 }}>→</span>;
}

export function SSPillLink({
  href,
  children,
  variant = 'primary',
  arrow = true,
  leadingIcon,
  iconArrow,
  style,
}: SSPillCommon & { href: string }) {
  return (
    <Link href={href} style={{ ...pillStyle(variant), ...style }}>
      <PillLabel leadingIcon={leadingIcon}>{children}</PillLabel>
      <PillArrow arrow={arrow} iconArrow={iconArrow} />
    </Link>
  );
}

export function SSPillButton({
  type = 'button',
  onClick,
  disabled,
  children,
  variant = 'primary',
  arrow = true,
  leadingIcon,
  iconArrow,
  style,
}: SSPillCommon & {
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...pillStyle(variant),
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      <PillLabel leadingIcon={leadingIcon}>{children}</PillLabel>
      <PillArrow arrow={arrow} iconArrow={iconArrow} />
    </button>
  );
}

export function SSField({
  label,
  value,
  placeholder,
  background = '#fff',
}: {
  label: string;
  value?: string;
  placeholder?: string;
  background?: string;
}) {
  return (
    <div
      style={{
        background,
        border: `2px solid ${SS.ink}`,
        borderRadius: 14,
        padding: '12px 16px',
        marginBottom: 12,
      }}
    >
      <SSEyebrow style={{ marginBottom: 4 }}>{label}</SSEyebrow>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: value ? SS.ink : SS.inkSoft,
        }}
      >
        {value || placeholder}
      </div>
    </div>
  );
}

export function SSInput({
  name,
  label,
  value,
  defaultValue,
  onChange,
  placeholder,
  type = 'text',
  background = '#fff',
  autoComplete,
  required,
}: {
  name?: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'password';
  background?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label
      style={{
        display: 'block',
        background,
        border: `2px solid ${SS.ink}`,
        borderRadius: 14,
        padding: '12px 16px',
        marginBottom: 12,
        cursor: 'text',
      }}
    >
      <SSEyebrow style={{ marginBottom: 4 }}>{label}</SSEyebrow>
      <input
        name={name}
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: 0,
          fontFamily: SS.sans,
          fontSize: 18,
          fontWeight: 800,
          color: SS.ink,
        }}
      />
    </label>
  );
}

export function SSStickerCard({
  background = '#fff',
  children,
  style,
}: {
  background?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background,
        border: `2px solid ${SS.ink}`,
        borderRadius: 18,
        padding: 16,
        boxShadow: `0 4px 0 ${SS.ink}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SSToggle({ on }: { on: boolean }) {
  return (
    <div
      style={{
        width: 50,
        height: 28,
        borderRadius: 999,
        background: on ? SS.brand : '#fff',
        border: `2px solid ${SS.ink}`,
        display: 'flex',
        alignItems: 'center',
        padding: 2,
        justifyContent: on ? 'flex-end' : 'flex-start',
        boxShadow: `0 3px 0 ${SS.ink}`,
      }}
    >
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: SS.ink }} />
    </div>
  );
}

export function SSStatusBarSpacer() {
  return <div style={{ height: 50 }} />;
}
