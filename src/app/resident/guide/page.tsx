export default function GuidePage() {
  return (
    <main className="px-4 pt-8">
      <h1 className="text-xl font-semibold text-white">♻️ Recycling guide</h1>
      <p className="mt-1 text-xs text-gray-400">Do it right, earn more.</p>

      <section className="mt-4 rounded-xl border border-green-500/25 bg-green-500/5 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-green-400">✓ Good</div>
        <ul className="mt-2 space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">🧴</span>
            <div>
              <div className="text-white">Empty, rinsed water bottle</div>
              <div className="text-xs text-gray-400">Cap removed, no liquid inside.</div>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">📦</span>
            <div>
              <div className="text-white">Flattened cardboard box</div>
              <div className="text-xs text-gray-400">No tape, dry, no food stains.</div>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">🥫</span>
            <div>
              <div className="text-white">Rinsed aluminum can</div>
              <div className="text-xs text-gray-400">Drained, no food residue.</div>
            </div>
          </li>
        </ul>
      </section>

      <section className="mt-3 rounded-xl border border-red-500/25 bg-red-500/5 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-red-400">
          ✗ Not accepted
        </div>
        <ul className="mt-2 space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">🧴</span>
            <div>
              <div className="text-white">Half-full soda bottle</div>
              <div className="text-xs text-gray-400">Must be empty &amp; rinsed first.</div>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">🍕</span>
            <div>
              <div className="text-white">Greasy pizza box</div>
              <div className="text-xs text-gray-400">Food-soiled cardboard is contamination.</div>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">🥡</span>
            <div>
              <div className="text-white">Plastic with food residue</div>
              <div className="text-xs text-gray-400">Rinse before putting it in the bag.</div>
            </div>
          </li>
        </ul>
      </section>

      <section className="mt-3 rounded-xl border border-blue-500/25 bg-blue-500/5 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-400">
          💡 Tip: Preparing an oil can
        </div>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-300">
          <li>Empty all oil completely.</li>
          <li>Rinse with warm soapy water.</li>
          <li>Let dry before putting in a bag.</li>
        </ol>
      </section>

      <p className="mt-4 text-center text-[10px] text-gray-500">More guides coming soon.</p>
    </main>
  );
}
