// Variation 02 — "Sticker Sections"
// White background base with alternating soft pastel section blocks.
// Sticker Mule influence: chunky rounded buttons, oversized type, flat.

const SS = {
  bg: '#FFFFFF',
  ink: '#111111',
  inkSoft: '#6B6B6B',
  line: '#ECECEC',
  brand: '#E11D2A',
  yellow: '#FFEB52',     // soft sticker-y yellow section
  mint: '#D9F2D9',       // soft mint section
  sky: '#E4EEFB',
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
};

function SSStyle({ data }) {
  const dollar = ptsToDollars(data.points);
  const pct = Math.min(1, data.points / GIFT_TARGET);
  const ptsToGo = Math.max(0, GIFT_TARGET - data.points);

  return (
    <div style={{ background: SS.bg, minHeight: '100%', fontFamily: SS.sans, color: SS.ink, paddingBottom: 90 }}>
      <div style={{ height: 50 }} />

      {/* Header — wordmark + avatar inline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 16px', gap: 12 }}>
        <div style={{
          fontSize: 22, fontWeight: 900, letterSpacing: -0.8,
          lineHeight: 1, color: SS.ink, textTransform: 'uppercase', flex: 1,
        }}>
          We Buy Clean <span style={{ color: SS.brand }}>Trash.</span>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: SS.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{data.name[0]}</div>
      </div>

      {/* Yellow sticker block — points hero */}
      <div style={{ background: SS.yellow, padding: '24px 20px 24px' }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', color: SS.ink, opacity: 0.7, marginBottom: 6 }}>Hello, {data.name}</div>
        <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -2, lineHeight: 0.95, color: SS.ink }}>{fmtDollars(dollar)}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: SS.ink, marginTop: 6 }}>{fmtPts(data.points)} points earned</div>
      </div>

      {/* White CTA block — Scan Bags */}
      <div style={{ background: '#fff', padding: '20px 20px 8px' }}>
        <button style={{
          width: '100%', background: SS.brand, color: '#fff', border: 'none',
          borderRadius: 999, padding: '22px 24px', fontFamily: SS.sans,
          fontSize: 22, fontWeight: 900, letterSpacing: -0.3,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: `0 4px 0 ${'#A6121C'}`,
        }}>
          <span>Scan bags</span>
          <span style={{ fontSize: 26 }}>→</span>
        </button>
        <button style={{
          width: '100%', background: '#fff', color: SS.ink, border: `2px solid ${SS.ink}`,
          borderRadius: 999, padding: '20px 24px', marginTop: 12, fontFamily: SS.sans,
          fontSize: 20, fontWeight: 900, letterSpacing: -0.3,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: `0 4px 0 ${SS.ink}`,
        }}>
          <span>{data.hasOrdered ? 'Order more bags' : 'Order bags'}</span>
          <span style={{ fontSize: 24 }}>→</span>
        </button>
      </div>

      {/* White section — next pickup / delivery (under CTAs) */}
      <div style={{ background: '#fff', padding: '20px 20px 22px', borderTop: `1px solid ${SS.line}`, marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', color: SS.inkSoft, marginBottom: 8 }}>Next delivery</div>
        {data.pendingOrder ? (
          <>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.7, color: SS.ink, lineHeight: 1.1 }}>
              {data.pendingOrder.bags} bags · {data.pendingOrder.status === 'out_for_delivery' ? 'Out for delivery' : data.pendingOrder.eta}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: SS.inkSoft, marginTop: 6 }}>
              {data.nextPickup ? `Pickup ${data.nextPickup.day}, ${data.nextPickup.time}` : 'No pickup scheduled'}
            </div>
          </>
        ) : data.nextPickup ? (
          <>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.7, color: SS.ink, lineHeight: 1.1 }}>Pickup {data.nextPickup.day}, {data.nextPickup.time}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: SS.inkSoft, marginTop: 6 }}>No bag delivery scheduled.</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.7, color: SS.ink }}>Nothing scheduled</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: SS.inkSoft, marginTop: 6 }}>Order bags to join the next route.</div>
          </>
        )}
      </div>

      {/* Sky section — reward progress */}
      <div style={{ background: SS.sky, padding: '24px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', color: SS.inkSoft, marginBottom: 8 }}>Next $10 gift card</div>
        <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -2, color: SS.ink, lineHeight: 0.95, marginBottom: 4 }}>
          {pct >= 1 ? 'Ready!' : fmtPts(ptsToGo)}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: SS.ink, marginBottom: 14, opacity: 0.75 }}>
          {pct >= 1 ? 'Tap rewards to cash out.' : `points to your next $10 gift card`}
        </div>
        <div style={{ height: 14, background: '#fff', borderRadius: 999, overflow: 'hidden', border: `2px solid ${SS.ink}` }}>
          <div style={{ height: '100%', width: `${pct*100}%`, background: SS.brand }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: SS.ink, opacity: 0.7 }}>{fmtPts(data.points)} / {fmtPts(GIFT_TARGET)} pts</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: SS.brand }}>{Math.round(pct*100)}%</div>
        </div>
      </div>

      {/* Mint section — 3 step flow (moved to bottom) */}
      <div style={{ background: SS.mint, padding: '28px 20px 28px' }}>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8, marginBottom: 18, color: SS.ink }}>How it works</div>
        {[
          ['Order bags', 'Pick a sheet of 10 bags. Free delivery over $20.'],
          ['Fill & set out', 'Clean recyclables. Leave bags at your designated pickup area.'],
          ['Return & redeem', 'Points convert to gift cards. Cash out anytime.'],
        ].map(([t, sub], i) => (
          <div key={t} style={{ display: 'flex', gap: 14, padding: '14px 0', alignItems: 'flex-start' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: SS.ink, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 900, flexShrink: 0,
            }}>{i + 1}</div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontSize: 19, fontWeight: 900, color: SS.ink, letterSpacing: -0.3 }}>{t}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: SS.ink, marginTop: 2, lineHeight: 1.35, opacity: 0.7 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      <SSNav active="home" />
    </div>
  );
}

function SSNav({ active }) {
  const items = [
    { k: 'home', l: 'Home' },
    { k: 'scan', l: 'Scan' },
    { k: 'bags', l: 'Bags' },
    { k: 'rew', l: 'Rewards' },
    { k: 'me', l: 'Profile' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: `1px solid ${SS.line}`,
      padding: '8px 4px 24px', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
    }}>
      {items.map(({ k, l }) => (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 6, color: active === k ? SS.brand : SS.ink }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: active === k ? SS.brand : 'transparent', border: `2px solid ${active === k ? SS.brand : SS.ink}` }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.2 }}>{l}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { SSStyle });
