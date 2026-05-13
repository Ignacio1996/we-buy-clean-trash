'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import QRCode from 'qrcode';
import { SS, SSEyebrow } from './ss/SS';

const SHARE_COPY =
  'I get paid for my recycling with We Buy Clean Trash. Sign up with my link and we both score.';

function subscribeNoop() {
  return () => {};
}

export function ReferFriend({ referralCode }: { referralCode: string }) {
  const origin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => '',
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const referralUrl = useMemo(() => {
    if (!origin) return '';
    return `${origin}/signup?ref=${encodeURIComponent(referralCode)}`;
  }, [origin, referralCode]);

  useEffect(() => {
    if (!referralUrl) return;
    let cancelled = false;
    QRCode.toDataURL(referralUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#111111', light: '#FFFFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [referralUrl]);

  async function handleCopy() {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API blocked — ignore
    }
  }

  async function handleNativeShare() {
    if (!referralUrl) return;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'We Buy Clean Trash',
          text: SHARE_COPY,
          url: referralUrl,
        });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    await handleCopy();
  }

  const smsHref = `sms:?&body=${encodeURIComponent(`${SHARE_COPY} ${referralUrl}`)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent('Get paid for your recycling')}&body=${encodeURIComponent(`${SHARE_COPY}\n\n${referralUrl}`)}`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_COPY)}&url=${encodeURIComponent(referralUrl)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`;

  return (
    <div style={{ background: SS.mint, padding: '24px 20px' }}>
      <SSEyebrow style={{ marginBottom: 10 }}>Refer a friend</SSEyebrow>
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: -0.8,
          color: SS.ink,
          lineHeight: 1.05,
        }}
      >
        Share trash. <span style={{ color: SS.brand }}>Earn together.</span>
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: SS.ink,
          opacity: 0.75,
          marginTop: 6,
          marginBottom: 16,
          lineHeight: 1.4,
        }}
      >
        Send your link. When a friend joins and orders bags, you both pocket a bonus.
      </div>

      <div
        style={{
          background: '#fff',
          border: `2px solid ${SS.ink}`,
          borderRadius: 14,
          padding: '12px 14px',
          boxShadow: `0 4px 0 ${SS.ink}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <SSEyebrow style={{ marginBottom: 4 }}>Your link</SSEyebrow>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: SS.ink,
              letterSpacing: -0.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {referralUrl || 'Loading…'}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!referralUrl}
          style={{
            background: copied ? SS.green : SS.ink,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '10px 16px',
            fontFamily: SS.sans,
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 1,
            textTransform: 'uppercase',
            cursor: referralUrl ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <ShareTile label="Text" sub="SMS" href={smsHref} background={SS.yellow} icon="✉︎" />
        <ShareTile label="Email" sub="Mailto" href={emailHref} background={SS.sky} icon="@" />
        <ShareTile
          label="X / Twitter"
          sub="Post"
          href={twitterHref}
          background="#fff"
          icon="𝕏"
          external
        />
        <ShareTile
          label="Facebook"
          sub="Share"
          href={facebookHref}
          background={SS.peach}
          icon="f"
          external
        />
      </div>

      <button
        type="button"
        onClick={() => setShowQr((s) => !s)}
        style={{
          width: '100%',
          background: '#fff',
          color: SS.ink,
          border: `2px solid ${SS.ink}`,
          borderRadius: 999,
          padding: '14px 18px',
          fontFamily: SS.sans,
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: -0.2,
          boxShadow: `0 4px 0 ${SS.ink}`,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span>{showQr ? 'Hide QR code' : 'Show QR code'}</span>
        <span style={{ fontSize: 18 }}>{showQr ? '×' : '▢'}</span>
      </button>

      {showQr && (
        <div
          style={{
            background: '#fff',
            border: `2px solid ${SS.ink}`,
            borderRadius: 18,
            padding: 18,
            boxShadow: `0 4px 0 ${SS.ink}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Referral QR code"
              width={220}
              height={220}
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <div
              style={{
                width: 220,
                height: 220,
                background: SS.line,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
                color: SS.inkSoft,
              }}
            >
              Generating…
            </div>
          )}
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: SS.inkSoft,
              marginTop: 4,
            }}
          >
            Scan to sign up
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleNativeShare}
        disabled={!referralUrl}
        style={{
          width: '100%',
          background: SS.brand,
          color: '#fff',
          border: 'none',
          borderRadius: 999,
          padding: '18px 22px',
          fontFamily: SS.sans,
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: -0.3,
          boxShadow: `0 4px 0 ${SS.brandDark}`,
          cursor: referralUrl ? 'pointer' : 'not-allowed',
          marginTop: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Share link</span>
        <span style={{ fontSize: 18 }}>→</span>
      </button>
    </div>
  );
}

function ShareTile({
  label,
  sub,
  href,
  background,
  icon,
  external,
}: {
  label: string;
  sub: string;
  href: string;
  background: string;
  icon: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      style={{
        background,
        border: `2px solid ${SS.ink}`,
        borderRadius: 14,
        padding: '14px 14px',
        boxShadow: `0 4px 0 ${SS.ink}`,
        textDecoration: 'none',
        color: SS.ink,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: SS.ink,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.2, color: SS.ink }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: SS.inkSoft,
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      </div>
    </a>
  );
}
