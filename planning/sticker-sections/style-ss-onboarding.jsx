// Sticker Sections — Onboarding flow
// 5 steps: Welcome · Address · Pickup day · First order · Done

const SS_OB = {
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
};

function SSDots({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === step ? 24 : 8, height: 8, borderRadius: 4,
          background: i <= step ? SS_OB.ink : SS_OB.line,
          transition: 'all .2s',
        }} />
      ))}
    </div>
  );
}

function SSPill({ children, variant = 'primary', style }) {
  const base = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', border: 'none', borderRadius: 999, padding: '20px 24px',
    fontFamily: SS_OB.sans, fontSize: 20, fontWeight: 900, letterSpacing: -0.3,
    cursor: 'pointer',
  };
  if (variant === 'primary') Object.assign(base, { background: SS_OB.green, color: '#fff', boxShadow: `0 4px 0 ${SS_OB.greenDark}` });
  if (variant === 'dark') Object.assign(base, { background: SS_OB.ink, color: '#fff', boxShadow: `0 4px 0 #000` });
  if (variant === 'outline') Object.assign(base, { background: '#fff', color: SS_OB.ink, border: `2px solid ${SS_OB.ink}`, boxShadow: `0 4px 0 ${SS_OB.ink}` });
  return <button style={{ ...base, ...style }}>{children}<span style={{ fontSize: 22 }}>→</span></button>;
}

function SSField({ label, value, placeholder, color = '#fff' }) {
  return (
    <div style={{ background: color, border: `2px solid ${SS_OB.ink}`, borderRadius: 14, padding: '12px 16px', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', color: SS_OB.inkSoft, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: value ? SS_OB.ink : SS_OB.inkSoft }}>{value || placeholder}</div>
    </div>
  );
}

// ---- 1 · Welcome ----
function SSObWelcome() {
  return (
    <div style={{ background: SS_OB.bg, height: '100%', fontFamily: SS_OB.sans, color: SS_OB.ink, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50 }} />
      <div style={{ background: SS_OB.bg, padding: '32px 24px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.6, textTransform: 'uppercase', color: SS_OB.ink, opacity: 0.7, marginBottom: 14 }}>We Buy Clean Trash</div>
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: -1.6, lineHeight: 0.95, color: SS_OB.ink, marginBottom: 18 }}>
          Your trash is <span style={{ color: SS_OB.green }}>worth money.</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: SS_OB.ink, opacity: 0.75, lineHeight: 1.4 }}>
          We pick up your clean recyclables at the curb and pay you in gift cards. No sorting machines. No bins to lug.
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ background: '#fff', border: `2px solid ${SS_OB.ink}`, borderRadius: 18, padding: 16, display: 'flex', gap: 12, alignItems: 'center', boxShadow: `0 4px 0 ${SS_OB.ink}` }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: SS_OB.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900 }}>$</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: SS_OB.ink, letterSpacing: -0.5 }}>$10 gift card</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: SS_OB.inkSoft }}>≈ 4 weeks of pickups</div>
          </div>
        </div>
      </div>
      <div style={{ background: '#fff', padding: '20px 24px 28px' }}>
        <SSPill variant="primary">Get started</SSPill>
        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: SS_OB.inkSoft, marginTop: 16 }}>
          Have an account? <span style={{ color: SS_OB.ink, textDecoration: 'underline' }}>Sign in</span>
        </div>
      </div>
    </div>
  );
}

// ---- 2 · Address ----
function SSObAddress() {
  return (
    <div style={{ background: SS_OB.bg, height: '100%', fontFamily: SS_OB.sans, color: SS_OB.ink, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50 }} />
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: SS_OB.ink }}>←</div>
        <SSDots step={1} total={5} />
        <div style={{ fontSize: 13, fontWeight: 800, color: SS_OB.inkSoft }}>Skip</div>
      </div>
      <div style={{ padding: '28px 24px 8px' }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color: SS_OB.brand, marginBottom: 8 }}>Step 1 of 4</div>
        <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1.4, lineHeight: 0.95, color: SS_OB.ink, marginBottom: 10 }}>Where do you live?</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: SS_OB.inkSoft, lineHeight: 1.4 }}>We need your address so our driver can find your bags.</div>
      </div>
      <div style={{ padding: '20px 24px', flex: 1 }}>
        <SSField label="Street" value="412 Mariposa Ave" color={SS_OB.mint} />
        <SSField label="Unit (optional)" value="Apt 3B" />
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
          <SSField label="City" value="Oakland" />
          <SSField label="Zip" value="94610" color={SS_OB.sky} />
        </div>
        <div style={{ background: SS_OB.mint, border: `2px solid ${SS_OB.ink}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: SS_OB.ink, color: SS_OB.mint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900 }}>✓</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: SS_OB.ink }}>We pick up in Oakland on Mondays.</div>
        </div>
      </div>
      <div style={{ background: '#fff', padding: '8px 24px 28px' }}>
        <SSPill variant="primary">Continue</SSPill>
      </div>
    </div>
  );
}

// ---- 3 · Pickup day ----
function SSObPickup() {
  const days = [
    { d: 'Mon', label: 'Monday', time: '6:00 PM', sel: true },
    { d: 'Wed', label: 'Wednesday', time: '6:00 PM', sel: false },
  ];
  return (
    <div style={{ background: SS_OB.bg, height: '100%', fontFamily: SS_OB.sans, color: SS_OB.ink, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50 }} />
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: SS_OB.ink }}>←</div>
        <SSDots step={2} total={5} />
        <div style={{ width: 22 }} />
      </div>
      <div style={{ padding: '28px 24px 8px' }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color: SS_OB.brand, marginBottom: 8 }}>Step 2 of 4</div>
        <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1.4, lineHeight: 0.95, color: SS_OB.ink, marginBottom: 10 }}>Pick a pickup day.</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: SS_OB.inkSoft, lineHeight: 1.4 }}>Set out your bags by 5:30 PM. We come every week.</div>
      </div>
      <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {days.map((d) => (
          <div key={d.d} style={{
            background: d.sel ? SS_OB.yellow : '#fff',
            border: `2px solid ${SS_OB.ink}`,
            borderRadius: 18, padding: '18px 18px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: d.sel ? `0 4px 0 ${SS_OB.ink}` : 'none',
          }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.7, color: SS_OB.ink }}>{d.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: SS_OB.inkSoft, marginTop: 2 }}>Set out by {d.time}</div>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: d.sel ? SS_OB.brand : '#fff',
              border: `2px solid ${SS_OB.ink}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 16, fontWeight: 900,
            }}>{d.sel ? '✓' : ''}</div>
          </div>
        ))}
        <div style={{ fontSize: 13, fontWeight: 700, color: SS_OB.inkSoft, lineHeight: 1.4, padding: '8px 4px' }}>
          You can skip a week anytime from the Bags tab. We text you the day before.
        </div>
      </div>
      <div style={{ background: '#fff', padding: '8px 24px 28px' }}>
        <SSPill variant="primary">Continue</SSPill>
      </div>
    </div>
  );
}

// ---- 4 · First order ----
function SSObOrder() {
  const sheets = 2;
  return (
    <div style={{ background: SS_OB.bg, height: '100%', fontFamily: SS_OB.sans, color: SS_OB.ink, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50 }} />
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: SS_OB.ink }}>←</div>
        <SSDots step={3} total={5} />
        <div style={{ width: 22 }} />
      </div>
      <div style={{ padding: '28px 24px 8px' }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color: SS_OB.brand, marginBottom: 8 }}>Step 3 of 4</div>
        <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1.4, lineHeight: 0.95, color: SS_OB.ink, marginBottom: 10 }}>Order your bags.</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: SS_OB.inkSoft, lineHeight: 1.4 }}>10 bags per sheet. Each one earns up to $1.20 of recyclables.</div>
      </div>
      <div style={{ padding: '20px 24px 8px' }}>
        <div style={{ background: SS_OB.sky, border: `2px solid ${SS_OB.ink}`, borderRadius: 22, padding: '24px 22px', boxShadow: `0 4px 0 ${SS_OB.ink}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: SS_OB.ink }}>Sheets of bags</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: `2px solid ${SS_OB.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20 }}>−</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: SS_OB.ink, minWidth: 24, textAlign: 'center', letterSpacing: -0.8 }}>{sheets}</div>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: SS_OB.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20 }}>+</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px dashed ${SS_OB.ink}`, paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: SS_OB.ink }}>{sheets * 10} bags · free shipping</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: SS_OB.ink, letterSpacing: -0.5 }}>${(sheets * 8).toFixed(2)}</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 24px', flex: 1 }}>
        <div style={{ background: SS_OB.mint, border: `2px solid ${SS_OB.ink}`, borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 22 }}>🎁</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: SS_OB.ink, lineHeight: 1.3 }}>
            <span style={{ color: SS_OB.brand }}>+10,000 pts signup bonus</span> credited after your first pickup.
          </div>
        </div>
      </div>
      <div style={{ background: '#fff', padding: '8px 24px 28px' }}>
        <SSPill variant="primary">Pay & continue</SSPill>
      </div>
    </div>
  );
}

// ---- 5 · Done ----
function SSObDone() {
  return (
    <div style={{ background: SS_OB.bg, height: '100%', fontFamily: SS_OB.sans, color: SS_OB.ink, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 50 }} />
      <div style={{ padding: '60px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%', background: SS_OB.green,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 60, fontWeight: 900, margin: '0 auto 28px',
          border: `4px solid ${SS_OB.ink}`, boxShadow: `0 6px 0 ${SS_OB.ink}`,
        }}>✓</div>
        <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -2, lineHeight: 0.92, color: SS_OB.ink, textAlign: 'center', marginBottom: 14 }}>
          You're in!
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: SS_OB.ink, opacity: 0.75, textAlign: 'center', lineHeight: 1.4, marginBottom: 22 }}>
          Your bags arrive <strong>Mon, Apr 28</strong>. Set them out by 5:30 PM.
        </div>
        <div style={{ background: '#fff', border: `2px solid ${SS_OB.ink}`, borderRadius: 18, padding: 18, boxShadow: `0 4px 0 ${SS_OB.ink}` }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color: SS_OB.inkSoft, marginBottom: 12 }}>What happens next</div>
          {[
            ['Mon Apr 28', 'Bags arrive at your door'],
            ['Mon May 5', 'First pickup · set out by 5:30 PM'],
            ['Tue May 6', 'Points credited to your account'],
          ].map(([when, what], i) => (
            <div key={when} style={{
              display: 'flex', gap: 12, padding: '12px 0',
              borderTop: i > 0 ? `1px solid ${SS_OB.line}` : 'none',
              alignItems: 'flex-start',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? SS_OB.brand : SS_OB.ink, marginTop: 8, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: SS_OB.inkSoft }}>{when}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: SS_OB.ink, letterSpacing: -0.3, marginTop: 2 }}>{what}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: '#fff', padding: '20px 24px 28px', borderTop: `2px solid ${SS_OB.ink}` }}>
        <SSPill variant="dark">Open the app</SSPill>
      </div>
    </div>
  );
}

Object.assign(window, { SSObWelcome, SSObAddress, SSObPickup, SSObOrder, SSObDone });
