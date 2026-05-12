// Sticker Sections — Profile page
// Account info · Lifetime stats · Settings

const SS_PR = {
  bg: '#FFFFFF',
  ink: '#111111',
  inkSoft: '#6B6B6B',
  line: '#ECECEC',
  brand: '#E11D2A',
  brandDark: '#A6121C',
  yellow: '#FFEB52',
  mint: '#D9F2D9',
  sky: '#E4EEFB',
  peach: '#FFD9C7',
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
};

function SSPSection({ children, color = '#fff', style }) {
  return <div style={{ background: color, padding: '22px 20px', ...style }}>{children}</div>;
}

function SSPLabel({ children, color = SS_PR.inkSoft }) {
  return <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color, marginBottom: 10 }}>{children}</div>;
}

function SSPRow({ label, value, hint, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${SS_PR.line}`, gap: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: SS_PR.inkSoft }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: SS_PR.ink, letterSpacing: -0.3, marginTop: 2 }}>{value}</div>
        {hint && <div style={{ fontSize: 12, fontWeight: 700, color: SS_PR.inkSoft, marginTop: 2 }}>{hint}</div>}
      </div>
      <span style={{ fontSize: 18, fontWeight: 900, color: SS_PR.ink }}>›</span>
    </div>
  );
}

function SSPToggle({ on }) {
  return (
    <div style={{
      width: 50, height: 28, borderRadius: 999,
      background: on ? SS_PR.brand : '#fff',
      border: `2px solid ${SS_PR.ink}`,
      display: 'flex', alignItems: 'center', padding: 2,
      justifyContent: on ? 'flex-end' : 'flex-start',
      boxShadow: `0 3px 0 ${SS_PR.ink}`,
    }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: SS_PR.ink }} />
    </div>
  );
}

function SSPSettingRow({ label, sub, on, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: last ? 'none' : `1px solid rgba(0,0,0,0.08)`, gap: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: SS_PR.ink, letterSpacing: -0.3 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: SS_PR.inkSoft, marginTop: 2 }}>{sub}</div>
      </div>
      <SSPToggle on={on} />
    </div>
  );
}

function SSPNav() {
  const items = [['home','Home'],['scan','Scan'],['bags','Bags'],['rew','Rewards'],['me','Profile']];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: `1px solid ${SS_PR.line}`, padding: '8px 4px 24px', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }}>
      {items.map(([k, l]) => (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 6, color: k === 'me' ? SS_PR.brand : SS_PR.ink }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: k === 'me' ? SS_PR.brand : 'transparent', border: `2px solid ${k === 'me' ? SS_PR.brand : SS_PR.ink}` }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.2 }}>{l}</span>
        </div>
      ))}
    </div>
  );
}

function SSProfile() {
  return (
    <div style={{ background: SS_PR.bg, minHeight: '100%', fontFamily: SS_PR.sans, color: SS_PR.ink, paddingBottom: 90 }}>
      <div style={{ height: 50 }} />
      {/* Header — yellow sticker block */}
      <div style={{ background: SS_PR.yellow, padding: '24px 20px 26px', position: 'relative' }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.6, textTransform: 'uppercase', color: SS_PR.ink, opacity: 0.7 }}>Profile</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
          <div style={{ width: 76, height: 76, borderRadius: '50%', background: SS_PR.brand, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 32, border: `3px solid ${SS_PR.ink}`, boxShadow: `0 4px 0 ${SS_PR.ink}` }}>A</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1, lineHeight: 1, color: SS_PR.ink }}>Aguirre Reyes</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: SS_PR.ink, opacity: 0.75, marginTop: 4 }}>Member since Mar 2024</div>
          </div>
        </div>
      </div>

      {/* Lifetime stats — sky sticker block */}
      <div style={{ background: SS_PR.sky, padding: '22px 20px' }}>
        <SSPLabel>Lifetime stats</SSPLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['$184.20', 'total earned'],
            ['243', 'bags returned'],
            ['1,240 lbs', 'recycled'],
            ['7.4', 'trees saved'],
          ].map(([v, l]) => (
            <div key={l} style={{ background: '#fff', border: `2px solid ${SS_PR.ink}`, borderRadius: 14, padding: '14px 14px', boxShadow: `0 4px 0 ${SS_PR.ink}` }}>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.9, color: SS_PR.ink, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: SS_PR.inkSoft, marginTop: 6 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ background: SS_PR.mint, border: `2px solid ${SS_PR.ink}`, borderRadius: 14, padding: 14, marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, boxShadow: `0 4px 0 ${SS_PR.ink}` }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: SS_PR.brand, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900 }}>♻</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: SS_PR.ink, letterSpacing: -0.2 }}>Top 8% of recyclers in Oakland.</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: SS_PR.inkSoft, marginTop: 2 }}>Based on bags returned this quarter.</div>
          </div>
        </div>
      </div>

      {/* Account info */}
      <SSPSection>
        <SSPLabel>Account info</SSPLabel>
        <SSPRow label="Name" value="Aguirre Reyes" />
        <SSPRow label="Email" value="aguirre@reyes.co" />
        <SSPRow label="Phone" value="(415) 555-0188" />
        <SSPRow label="Address" value="412 Mariposa Ave · Apt 3B" hint="Oakland, CA 94610" last />
      </SSPSection>

      {/* Settings — peach */}
      <div style={{ background: SS_PR.peach, padding: '22px 20px' }}>
        <SSPLabel>Settings</SSPLabel>
        <SSPSettingRow label="Push notifications" sub="Pickup reminders, bonuses, payouts" on />
        <SSPSettingRow label="SMS reminders" sub="Day-before pickup texts" on />
        <SSPSettingRow label="Auto-reorder bags" sub="When bags left ≤ 5" on={false} last />
        <div style={{ height: 14 }} />
        <SSPLabel>Preferences</SSPLabel>
        <SSPRow label="Pickup day" value="Mondays · 6:00 PM" />
        <SSPRow label="Language" value="English" />
        <SSPRow label="Payout method" value="Amazon gift card" last />
      </div>

      {/* Sign out */}
      <div style={{ padding: '24px 20px 28px' }}>
        <button style={{
          width: '100%', background: '#fff', color: SS_PR.brand,
          border: `2px solid ${SS_PR.brand}`,
          borderRadius: 999, padding: '18px 24px',
          fontFamily: SS_PR.sans, fontSize: 17, fontWeight: 900, letterSpacing: -0.2,
          boxShadow: `0 4px 0 ${SS_PR.brand}`,
        }}>Sign out</button>
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: SS_PR.inkSoft, marginTop: 16, letterSpacing: 0.5 }}>App v2.4.1 · Help & support</div>
      </div>

      <SSPNav />
    </div>
  );
}

Object.assign(window, { SSProfile });
