import { getSession } from '@/lib/auth/session';
import { requireConsumerResident } from '@/lib/auth/residentAccount';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import { loadActiveCampaigns } from '@/lib/admin/loadActiveCampaigns';
import { buildMaterialMultipliers } from '@/lib/types/pricingCampaign';
import { CalculatorForm } from './CalculatorForm';

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
    <main className="px-4 pt-8">
      <h1 className="text-xl font-semibold text-white">💰 What&rsquo;s it worth?</h1>
      <p className="mt-1 text-xs text-gray-400">
        Live yellow-sheet prices · you earn {(earningPct * 100).toFixed(0)}% of market.
      </p>

      {liveCampaigns.length > 0 && (
        <section className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">
            🔥 Bonus running now
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-100">
            {liveCampaigns.map((c) => (
              <li key={c.id}>
                <span className="font-semibold">×{c.multiplier}</span> on{' '}
                {c.materialIds.map((id) => materialNameById.get(id) ?? id).join(', ')} ·{' '}
                <span className="opacity-80">{c.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-400">Accepted materials</div>
        <ul className="mt-2 space-y-2 text-sm">
          {materials.map((m) => {
            const mult = multipliers[m.id] ?? 1;
            const youGet = m.marketPrice * m.customerPct * mult;
            return (
              <li key={m.id} className="flex items-center justify-between">
                <span className="text-white">
                  {m.name}
                  {mult !== 1 && (
                    <span className="ml-2 rounded bg-amber-400/20 px-1 text-[10px] font-semibold text-amber-200">
                      ×{mult}
                    </span>
                  )}
                </span>
                <span className="text-gray-400">
                  {formatDollars(m.marketPrice)} / lb · you get {formatDollars(youGet)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <CalculatorForm materials={materials} multipliers={multipliers} />

      <p className="mt-4 text-[10px] text-gray-500">
        Separated bags earn 2× points. Contamination can reduce your payout by up to 90%.
      </p>
    </main>
  );
}
