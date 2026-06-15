import Link from 'next/link';
import { EDUCATION_CONTENT } from '@/lib/content/education';
import {
  SS,
  SSEyebrow,
  SSScreen,
  SSStatusBarSpacer,
  SSStickerCard,
} from '@/components/resident/ss/SS';
import { IconArrow, IconCheck, IconClose, IconRecycle } from '@/components/icons/EcoIcons';

export const metadata = {
  title: 'Recycle Right — We Buy Clean Trash',
};

export default function EducationPage() {
  const { eyebrow, heading, intro, dos, donts, links } = EDUCATION_CONTENT;

  return (
    <SSScreen>
      <SSStatusBarSpacer />

      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link
          href="/resident"
          aria-label="Back"
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: SS.ink,
            textDecoration: 'none',
            fontFamily: SS.sans,
          }}
        >
          ←
        </Link>
        <div style={{ width: 22 }} />
      </div>

      <div style={{ padding: '28px 24px 8px' }}>
        <SSEyebrow icon={<IconRecycle size={14} stroke={2.5} />} style={{ color: SS.green, marginBottom: 8 }}>
          {eyebrow}
        </SSEyebrow>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: -1.4,
            lineHeight: 0.95,
            color: SS.ink,
            margin: 0,
          }}
        >
          {heading}
        </h1>
        <p
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: SS.inkSoft,
            lineHeight: 1.45,
            marginTop: 14,
          }}
        >
          {intro}
        </p>
      </div>

      {/* Do's */}
      <div style={{ background: SS.mint, padding: '24px 20px', marginTop: 12 }}>
        <SSEyebrow icon={<IconCheck size={14} stroke={2.5} />} style={{ marginBottom: 12 }}>
          Do this
        </SSEyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dos.map((item) => (
            <Tip key={item} text={item} positive />
          ))}
        </div>
      </div>

      {/* Don'ts */}
      <div style={{ background: SS.peach, padding: '24px 20px' }}>
        <SSEyebrow icon={<IconClose size={14} stroke={2.5} />} style={{ marginBottom: 12 }}>
          Skip this
        </SSEyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {donts.map((item) => (
            <Tip key={item} text={item} positive={false} />
          ))}
        </div>
      </div>

      {/* Outbound links */}
      {links.length > 0 && (
        <div style={{ padding: '24px 20px 8px' }}>
          <SSEyebrow style={{ marginBottom: 12 }}>Learn more</SSEyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <SSStickerCard style={{ padding: '16px 18px', boxShadow: `0 3px 0 ${SS.ink}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: SS.ink, letterSpacing: -0.3 }}>
                        {l.label}
                      </div>
                      {l.note && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: SS.inkSoft, marginTop: 2 }}>
                          {l.note}
                        </div>
                      )}
                    </div>
                    <span style={{ color: SS.ink, flexShrink: 0 }}>
                      <IconArrow size={20} stroke={2.5} />
                    </span>
                  </div>
                </SSStickerCard>
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 24 }} />
    </SSScreen>
  );
}

function Tip({ text, positive }: { text: string; positive: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        background: '#fff',
        border: `2px solid ${SS.ink}`,
        borderRadius: 14,
        padding: '12px 14px',
        boxShadow: `0 3px 0 ${SS.ink}`,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: positive ? SS.green : SS.brand,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {positive ? <IconCheck size={15} stroke={3} /> : <IconClose size={15} stroke={3} />}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: SS.ink, lineHeight: 1.4, paddingTop: 3 }}>
        {text}
      </div>
    </div>
  );
}
