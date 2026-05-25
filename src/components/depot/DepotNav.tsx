import { SS } from '@/components/resident/ss/SS';

export function DepotNav() {
  return (
    <header
      style={{
        padding: '14px 20px 12px',
        borderBottom: `1px solid ${SS.line}`,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: -0.6,
          lineHeight: 1,
          color: SS.ink,
          textTransform: 'uppercase',
        }}
      >
        We Buy Clean <span style={{ color: SS.brand }}>Trash.</span>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: SS.inkSoft,
        }}
      >
        Depot
      </span>
    </header>
  );
}
