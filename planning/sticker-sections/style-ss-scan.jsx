// Sticker Sections — Scan flow
// States: idle (viewfinder), detected, success, error, manual entry

const SS_SC = {
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
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
};

function SSScanChrome({ children, dark = false }) {
  return (
    <div style={{ background: dark ? SS_SC.ink : SS_SC.bg, height: '100%', fontFamily: SS_SC.sans, color: dark ? '#fff' : SS_SC.ink, display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  );
}

function SSScanHeader({ title, sub, onClose = '×', light = true }) {
  const color = light ? SS_SC.ink : '#fff';
  return (
    <>
      <div style={{ height: 50 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color, opacity: 0.7 }}>{sub}</div>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: light ? SS_SC.ink : '#fff', color: light ? '#fff' : SS_SC.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900 }}>{onClose}</div>
      </div>
      <div style={{ padding: '0 20px', fontSize: 28, fontWeight: 900, letterSpacing: -0.8, color, lineHeight: 1.05 }}>{title}</div>
    </>
  );
}

// ---- Idle ----
function SSScIdle() {
  return (
    <SSScanChrome>
      <SSScanHeader sub="Scan bag tag" title={<span>Center the QR <br/>on the bag.</span>} />
      <div style={{ flex: 1, position: 'relative', margin: '24px 20px', borderRadius: 24, overflow: 'hidden', background: '#222' }}>
        {/* faux viewfinder */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, #2c2c2c 0 12px, #292929 12px 24px)' }} />
        {/* corner markers */}
        {[
          { t: 18, l: 18, br: '0 0 0 4px solid', tr: '4px solid 0 0 0' },
        ].map(() => null)}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 220, height: 220 }}>
          {[[0,0,'tl'],[0,'auto','tr'],['auto',0,'bl'],['auto','auto','br']].map(([t,l,k], i) => (
            <div key={k} style={{
              position: 'absolute',
              top: t === 0 ? 0 : 'auto',
              bottom: t === 'auto' ? 0 : 'auto',
              left: l === 0 ? 0 : 'auto',
              right: l === 'auto' ? 0 : 'auto',
              width: 40, height: 40,
              borderTop: t === 0 ? `4px solid ${SS_SC.yellow}` : 'none',
              borderBottom: t === 'auto' ? `4px solid ${SS_SC.yellow}` : 'none',
              borderLeft: l === 0 ? `4px solid ${SS_SC.yellow}` : 'none',
              borderRight: l === 'auto' ? `4px solid ${SS_SC.yellow}` : 'none',
            }}/>
          ))}
          {/* scan line */}
          <div style={{ position: 'absolute', left: 8, right: 8, top: '50%', height: 3, background: SS_SC.brand, boxShadow: `0 0 16px ${SS_SC.brand}` }} />
        </div>
        <div style={{ position: 'absolute', bottom: 18, left: 18, right: 18, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Looking for QR…</div>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: SS_SC.yellow }} />
        </div>
      </div>
      <div style={{ padding: '0 24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button style={{
          width: '100%', background: SS_SC.green, color: '#fff', border: 'none',
          borderRadius: 999, padding: '18px 24px', fontFamily: SS_SC.sans,
          fontSize: 17, fontWeight: 900, letterSpacing: -0.2,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: `0 4px 0 ${SS_SC.greenDark}`,
        }}><span>Enter bag # manually</span><span>→</span></button>
        <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, color: SS_SC.inkSoft }}>Bag tags are on the back of every bag.</div>
      </div>
    </SSScanChrome>
  );
}

// ---- Detected ----
function SSScDetected() {
  return (
    <SSScanChrome>
      <SSScanHeader sub="Bag detected" title="Confirm this is yours." />
      <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: SS_SC.sky, border: `2px solid ${SS_SC.ink}`, borderRadius: 22, padding: 20, boxShadow: `0 6px 0 ${SS_SC.ink}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color: SS_SC.inkSoft }}>Bag #</div>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.8, color: SS_SC.ink, marginTop: 2 }}>A24-104</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: SS_SC.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900 }}>✓</div>
          </div>
          <div style={{ borderTop: `1px dashed ${SS_SC.ink}`, marginTop: 14, paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', color: SS_SC.inkSoft }}>Type</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: SS_SC.ink, marginTop: 2 }}>Aluminum & PET</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', color: SS_SC.inkSoft }}>Est. weight</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: SS_SC.ink, marginTop: 2 }}>2.1 lbs</div>
            </div>
          </div>
        </div>
        <div style={{ background: SS_SC.yellow, border: `2px solid ${SS_SC.ink}`, borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 26 }}>🔥</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: SS_SC.ink, lineHeight: 1.3 }}>×2 multiplier on aluminum this week.</div>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ width: '100%', background: SS_SC.green, color: '#fff', border: 'none', borderRadius: 999, padding: '22px 24px', fontFamily: SS_SC.sans, fontSize: 22, fontWeight: 900, letterSpacing: -0.3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: `0 4px 0 ${SS_SC.greenDark}` }}>
          <span>Set out for pickup</span><span style={{ fontSize: 26 }}>→</span>
        </button>
        <button style={{ width: '100%', background: 'transparent', color: SS_SC.ink, border: `2px solid ${SS_SC.ink}`, borderRadius: 999, padding: '16px 24px', fontFamily: SS_SC.sans, fontSize: 15, fontWeight: 900 }}>
          Not my bag
        </button>
      </div>
    </SSScanChrome>
  );
}

// ---- Success ----
function SSScSuccess() {
  return (
    <div style={{ background: SS_SC.bg, height: '100%', fontFamily: SS_SC.sans, color: SS_SC.ink, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50 }} />
      <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: SS_SC.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900 }}>×</div>
      </div>
      <div style={{ padding: '24px 24px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          width: 110, height: 110, borderRadius: '50%', background: SS_SC.green,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 56, fontWeight: 900, margin: '0 auto 24px',
          border: `4px solid ${SS_SC.ink}`, boxShadow: `0 6px 0 ${SS_SC.ink}`,
        }}>✓</div>
        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color: SS_SC.inkSoft, marginBottom: 6 }}>Bag #A24-104 logged</div>
        <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: -2.8, lineHeight: 0.9, color: SS_SC.ink, textAlign: 'center', marginBottom: 6 }}>+5,120 pts</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: SS_SC.ink, opacity: 0.7, textAlign: 'center', marginBottom: 22 }}>≈ $0.51 earned</div>
        <div style={{ background: '#fff', border: `2px solid ${SS_SC.ink}`, borderRadius: 18, padding: 16, boxShadow: `0 4px 0 ${SS_SC.ink}` }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color: SS_SC.inkSoft, marginBottom: 10 }}>Breakdown</div>
          {[
            ['Aluminum cans', '+3,200'],
            ['PET bottles', '+960'],
            ['×2 weekly bonus', '+960'],
          ].map(([l, v], i) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i ? `1px solid ${SS_SC.line}` : 'none', fontSize: 14, fontWeight: 800, color: SS_SC.ink }}>
              <span>{l}</span><span>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button style={{ width: '100%', background: SS_SC.green, color: '#fff', border: 'none', borderRadius: 999, padding: '22px 24px', fontSize: 22, fontWeight: 900, letterSpacing: -0.3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: `0 4px 0 ${SS_SC.greenDark}` }}>
          <span>Scan next bag</span><span style={{ fontSize: 26 }}>→</span>
        </button>
        <button style={{ width: '100%', background: '#fff', color: SS_SC.ink, border: `2px solid ${SS_SC.ink}`, borderRadius: 999, padding: '18px 24px', fontSize: 16, fontWeight: 900, boxShadow: `0 4px 0 ${SS_SC.ink}` }}>
          Done — back home
        </button>
      </div>
    </div>
  );
}

// ---- Error ----
function SSScError() {
  return (
    <SSScanChrome>
      <SSScanHeader sub="Couldn't read tag" title="Try again, or enter it." />
      <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: SS_SC.brand, border: `2px solid ${SS_SC.ink}`, borderRadius: 22, padding: 22, color: '#fff', boxShadow: `0 6px 0 ${SS_SC.ink}` }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.85, marginBottom: 6 }}>Error</div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1.05 }}>QR was too blurry to read.</div>
          <div style={{ fontSize: 14, fontWeight: 800, opacity: 0.9, marginTop: 8, lineHeight: 1.4 }}>Move 6–8 inches away, keep the bag flat, and hold steady.</div>
        </div>
        <div style={{ background: '#fff', border: `2px solid ${SS_SC.ink}`, borderRadius: 18, padding: 16, color: SS_SC.ink, boxShadow: `0 4px 0 ${SS_SC.ink}` }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color: SS_SC.inkSoft, marginBottom: 10 }}>Tips</div>
          {[
            ['Bright light', 'Indoor light or daylight, not direct sun.'],
            ['Flatten the bag', 'Smooth out wrinkles around the tag.'],
            ['Steady your hand', 'Wait for the yellow brackets to lock.'],
          ].map(([t, s]) => (
            <div key={t} style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: SS_SC.brand, marginTop: 7, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: SS_SC.ink }}>{t}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: SS_SC.inkSoft }}>{s}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ width: '100%', background: SS_SC.green, color: '#fff', border: 'none', borderRadius: 999, padding: '22px 24px', fontFamily: SS_SC.sans, fontSize: 22, fontWeight: 900, letterSpacing: -0.3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: `0 4px 0 ${SS_SC.greenDark}` }}>
          <span>Try again</span><span style={{ fontSize: 26 }}>→</span>
        </button>
        <button style={{ width: '100%', background: 'transparent', color: SS_SC.ink, border: `2px solid ${SS_SC.ink}`, borderRadius: 999, padding: '16px 24px', fontSize: 15, fontWeight: 900 }}>
          Enter bag # manually
        </button>
      </div>
    </SSScanChrome>
  );
}

// ---- Manual entry ----
function SSScManual() {
  const digits = ['A', '2', '4', '-', '1', '0', '4'];
  return (
    <div style={{ background: SS_SC.bg, height: '100%', fontFamily: SS_SC.sans, color: SS_SC.ink, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50 }} />
      <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: SS_SC.ink }}>← Scan</div>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color: SS_SC.inkSoft }}>Manual entry</div>
      </div>
      <div style={{ padding: '12px 24px 4px' }}>
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1.2, lineHeight: 0.95 }}>Type the bag #</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: SS_SC.inkSoft, marginTop: 8 }}>Printed under the QR code, format like A24-104.</div>
      </div>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: SS_SC.yellow, border: `2px solid ${SS_SC.ink}`, borderRadius: 18, padding: '20px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: `0 4px 0 ${SS_SC.ink}` }}>
          {digits.map((d, i) => (
            <div key={i} style={{ fontSize: 32, fontWeight: 900, color: SS_SC.ink, letterSpacing: -0.5, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>{d}</div>
          ))}
          <div style={{ width: 2, height: 30, background: SS_SC.brand, marginLeft: 2, animation: 'sscaret 1s steps(2) infinite' }} />
        </div>
        <style>{`@keyframes sscaret { to { opacity: 0; } }`}</style>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ padding: '12px 16px 16px', background: SS_SC.line }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['1','2','3','4','5','6','7','8','9','-','0','⌫'].map((k) => (
            <button key={k} style={{
              padding: '14px 0', background: '#fff', border: 'none', borderRadius: 12,
              fontFamily: SS_SC.sans, fontSize: 22, fontWeight: 900, color: SS_SC.ink,
              boxShadow: '0 2px 0 rgba(0,0,0,0.15)',
            }}>{k}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '12px 24px 28px' }}>
        <button style={{ width: '100%', background: SS_SC.green, color: '#fff', border: 'none', borderRadius: 999, padding: '20px 24px', fontFamily: SS_SC.sans, fontSize: 20, fontWeight: 900, letterSpacing: -0.3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: `0 4px 0 ${SS_SC.greenDark}` }}>
          <span>Confirm bag</span><span style={{ fontSize: 24 }}>→</span>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { SSScIdle, SSScDetected, SSScSuccess, SSScError, SSScManual });
