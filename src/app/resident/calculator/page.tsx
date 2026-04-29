import { getSession } from '@/lib/auth/session';
import { requireConsumerResident } from '@/lib/auth/residentAccount';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import { loadActiveCampaigns } from '@/lib/admin/loadActiveCampaigns';
import { buildMaterialMultipliers } from '@/lib/types/pricingCampaign';
import { CalculatorForm } from './CalculatorForm';
import { EcoMasthead, EcoH1 } from '@/components/resident/eco/Eco';
import { IconFire } from '@/components/icons/EcoIcons';

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default async function CalculatorPage() {
  const session = await getSession();
  await requireConsumerResident(session!.uid);
  const [materials, activeCampaigns] = await Promise.all([
    loadActiveMaterials(),
    loadActiveCampaigns(),
  ]);
  const liveCampaigns = activeCampaigns.filter((c) => c.startsAt <= new Date());
  const multipliers = buildMaterialMultipliers(liveCampaigns);
  const earningPct = materials.find((m) => m.customerPct > 0)?.customerPct ?? 0;
  const materialNameById = new Map(materials.map((m) => [m.id, m.name]));

  return (
    <main className="relative px-5 pt-12 sm:px-8 sm:pt-14">
      <EcoMasthead title="What's it worth" backHref="/resident" />

      <section className="mb-5">
        <EcoH1>What is your trash worth?</EcoH1>
        <p
          className="mt-2 italic"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 13,
            color: '#5A6358',
          }}
        >
          Live yellow-sheet prices · you earn {(earningPct * 100).toFixed(0)}% of market.
        </p>
      </section>

      {liveCampaigns.length > 0 && (
        <section
          className="mb-5 flex items-start gap-3 rounded-[14px] border p-4"
          style={{
            background: '#F2E8D6',
            borderColor: 'rgba(160,104,42,0.3)',
          }}
        >
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: '#FBF7EE', color: '#A0682A' }}
          >
            <IconFire size={18} stroke={1.5} />
          </div>
          <div className="flex-1">
            <div className="eco-eyebrow" style={{ color: '#A0682A' }}>
              Bonus running now
            </div>
            <ul className="mt-1.5 space-y-1">
              {liveCampaigns.map((c) => (
                <li
                  key={c.id}
                  style={{
                    fontFamily: 'var(--eco-serif)',
                    fontSize: 14,
                    color: '#1F2A22',
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>×{c.multiplier}</span> on{' '}
                  {c.materialIds.map((id) => materialNameById.get(id) ?? id).join(', ')} ·{' '}
                  <span className="italic" style={{ color: '#A0682A' }}>
                    {c.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mb-5 rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
        <div className="eco-eyebrow mb-1">Accepted materials</div>
        <ul className="mt-1 divide-y divide-[#E8E2D0]">
          {materials.map((m) => {
            const mult = multipliers[m.id] ?? 1;
            const youGet = m.marketPrice * m.customerPct * mult;
            return (
              <li
                key={m.id}
                className="flex items-baseline justify-between gap-3 py-2.5"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    style={{
                      fontFamily: 'var(--eco-serif)',
                      fontSize: 15,
                      color: '#1F2A22',
                    }}
                  >
                    {m.name}
                  </span>
                  {mult !== 1 && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                      style={{
                        background: '#F2E8D6',
                        color: '#A0682A',
                        letterSpacing: 0.6,
                      }}
                    >
                      ×{mult}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 text-right">
                  <span
                    className="italic"
                    style={{
                      fontFamily: 'var(--eco-serif)',
                      fontSize: 12,
                      color: '#8A8A7A',
                    }}
                  >
                    {formatDollars(m.marketPrice)} / lb
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--eco-serif)',
                      fontSize: 14,
                      color: '#2D5A3D',
                      fontFeatureSettings: '"lnum","tnum"',
                    }}
                  >
                    {formatDollars(youGet)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <CalculatorForm materials={materials} multipliers={multipliers} />

      <p
        className="mt-5 italic"
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 12,
          color: '#5A6358',
          lineHeight: 1.5,
        }}
      >
        Separated bags earn 2× points. Contamination can reduce your payout by up to 90%.
      </p>
    </main>
  );
}
