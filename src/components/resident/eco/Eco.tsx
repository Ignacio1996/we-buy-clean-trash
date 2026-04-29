import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconChevR } from '@/components/icons/EcoIcons';

/**
 * Editorial Eco shared primitives — paper bg, ink text, forest green accents.
 * Mirrors the WBCT design system in src/app/globals.css.
 */

export function EcoPage({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={`relative px-5 pt-12 sm:px-8 sm:pt-14 ${className}`}>{children}</main>
  );
}

export function EcoMasthead({
  title,
  date,
  backHref,
  rightSlot,
}: {
  title?: string;
  date?: string;
  backHref?: string;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-baseline justify-between border-b border-[#D9D2C2] pb-3.5">
      <div>
        {backHref ? (
          <Link
            href={backHref}
            className="mb-1 inline-flex items-center gap-1 text-[11px] tracking-[1.4px] text-[#5A6358] uppercase"
          >
            <span aria-hidden>←</span> Back
          </Link>
        ) : null}
        <div
          className="italic"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 14,
            color: '#2D5A3D',
            letterSpacing: 0.5,
          }}
        >
          {title ?? 'We Buy Clean Trash'}
        </div>
        {date && (
          <div
            className="mt-0.5 uppercase"
            style={{ fontSize: 11, color: '#5A6358', letterSpacing: 1.6 }}
          >
            {date}
          </div>
        )}
      </div>
      {rightSlot ?? null}
    </div>
  );
}

export function EcoEyebrow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`uppercase ${className}`}
      style={{
        fontFamily: 'var(--eco-sans)',
        fontSize: 11,
        color: '#5A6358',
        letterSpacing: 1.4,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

export function EcoH1({
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
        fontFamily: 'var(--eco-serif)',
        fontSize: 28,
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: -0.4,
        color: '#1F2A22',
      }}
    >
      {children}
    </h1>
  );
}

export function EcoH2({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={className}
      style={{
        fontFamily: 'var(--eco-serif)',
        fontSize: 22,
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: -0.3,
        color: '#1F2A22',
      }}
    >
      {children}
    </h2>
  );
}

export function EcoPaper({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Tag
      className={`rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4 ${className}`}
    >
      {children}
    </Tag>
  );
}

export function EcoQuote({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`italic ${className}`}
      style={{ fontFamily: 'var(--eco-serif)', color: '#1F2A22' }}
    >
      {children}
    </p>
  );
}

export function EcoButton({
  children,
  href,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  className = '',
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  className?: string;
}) {
  const styles =
    variant === 'primary'
      ? 'bg-[#2D5A3D] text-[#FBF7EE] hover:bg-[#1F4029]'
      : variant === 'secondary'
        ? 'bg-[#FBF7EE] text-[#1F2A22] border border-[#D9D2C2] hover:bg-[#F8F3E5]'
        : 'text-[#2D5A3D] hover:underline';
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold tracking-[0.3px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  if (href && !disabled) {
    return (
      <Link href={href} className={`${base} ${styles} ${className}`}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function EcoRule({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[#E8E2D0] py-2.5">
      <span
        className="uppercase"
        style={{ fontSize: 11, color: '#5A6358', letterSpacing: 1.4 }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 15,
          color: '#1F2A22',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function EcoListLink({
  href,
  title,
  subtitle,
  icon,
}: {
  href: string;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="-mx-2 flex items-center gap-3 rounded-[12px] px-2 py-3 transition-colors hover:bg-[#F8F3E5]"
    >
      {icon && (
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: '#E8EFE6', color: '#2D5A3D' }}
        >
          {icon}
        </div>
      )}
      <div className="flex-1">
        <div
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 16,
            color: '#1F2A22',
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5" style={{ fontSize: 12, color: '#5A6358' }}>
            {subtitle}
          </div>
        )}
      </div>
      <IconChevR size={16} color="#5A6358" />
    </Link>
  );
}

export function EcoEmpty({
  title,
  body,
}: {
  title: ReactNode;
  body?: ReactNode;
}) {
  return (
    <div
      className="rounded-[14px] border px-4 py-6 text-center"
      style={{ background: '#FBF7EE', borderColor: '#D9D2C2' }}
    >
      <div
        className="italic"
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 15,
          color: '#1F2A22',
        }}
      >
        {title}
      </div>
      {body && (
        <div className="mt-1" style={{ fontSize: 11, color: '#5A6358' }}>
          {body}
        </div>
      )}
    </div>
  );
}
