'use client';

type LabelSize = '2.25x1.25' | '4x6';

export function BinPrintBar({
  accountId,
  businessName,
  binCount,
  size,
}: {
  accountId: string;
  businessName: string;
  binCount: number;
  size: LabelSize;
}) {
  const base = `/admin/commercial-accounts/${accountId}/bins/print`;
  return (
    <div className="sticky top-0 z-10 mx-6 mb-4 flex items-center justify-between gap-3 border-b border-gray-300 bg-white/95 py-3 backdrop-blur print:hidden">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500">Bin QR labels</div>
        <div className="text-sm font-semibold">
          {businessName}{' '}
          <span className="ml-1 text-xs font-normal text-gray-500">
            · {binCount} bin{binCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-xs">
          <a
            href={base}
            className={`px-2.5 py-1.5 ${size === '2.25x1.25' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            2.25 × 1.25
          </a>
          <a
            href={`${base}?size=4x6`}
            className={`px-2.5 py-1.5 ${size === '4x6' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            4 × 6
          </a>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={binCount === 0}
          className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          Print
        </button>
        <a
          href="/admin/commercial-accounts"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-100"
        >
          Close
        </a>
      </div>
    </div>
  );
}
