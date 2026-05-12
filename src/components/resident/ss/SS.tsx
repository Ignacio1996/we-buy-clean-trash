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

export function SSHeader({
  initial,
  href = '/resident/profile',
}: {
  initial: string;
  href?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px 16px',
        gap: 12,
      }}
    >
      <SSWordmark inline />
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
    </div>
  );
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
  style,
}: {
  children: ReactNode;
  color?: string;
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
        ...style,
      }}
    >
      {children}
    </div>
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
  style?: CSSProperties;
}

export function SSPillLink({
  href,
  children,
  variant = 'primary',
  arrow = true,
  style,
}: SSPillCommon & { href: string }) {
  return (
    <Link href={href} style={{ ...pillStyle(variant), ...style }}>
      <span>{children}</span>
      {arrow && <span style={{ fontSize: 22 }}>→</span>}
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
      <span>{children}</span>
      {arrow && <span style={{ fontSize: 22 }}>→</span>}
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
