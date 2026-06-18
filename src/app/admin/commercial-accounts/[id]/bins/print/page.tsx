import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { requireAnyRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { COMPOST_MANAGER_ROLES } from '@/lib/types/role';
import type { BagDoc } from '@/lib/types/bag';
import { resolveContainerType, containerBinSize } from '@/lib/types/bag';
import { BIN_DISPLAY_NAMES, type BinSize } from '@/lib/logic/binWeightTable';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { BinPrintBar } from './BinPrintBar';

type LabelSize = '2.25x1.25' | '4x6';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ size?: string }>;
}

function parseSize(raw: string | undefined): LabelSize {
  return raw === '4x6' ? '4x6' : '2.25x1.25';
}

interface LabelData {
  code: string;
  binSize: BinSize | null;
  qrSvg: string;
}

async function loadAccountBins(accountId: string) {
  const accountSnap = await adminDb.collection('commercialAccounts').doc(accountId).get();
  if (!accountSnap.exists) return null;
  const account = accountSnap.data() as CommercialAccountDoc;

  const binsSnap = await adminDb
    .collection('bags')
    .where('commercialAccountId', '==', accountId)
    .where('reusable', '==', true)
    .get();

  const bins = binsSnap.docs
    .map((d) => d.data() as BagDoc)
    .sort((a, b) => a.qrCode.localeCompare(b.qrCode));

  const labels = await Promise.all(
    bins.map(async (bag): Promise<LabelData> => {
      const qrSvg = await QRCode.toString(bag.qrCode, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 0,
        color: { dark: '#000000', light: '#ffffff' },
      });
      return {
        code: bag.qrCode,
        binSize: containerBinSize(resolveContainerType(bag)),
        qrSvg,
      };
    }),
  );

  return { account, labels };
}

export default async function BinLabelsPrintPage({ params, searchParams }: PageProps) {
  await requireAnyRole(COMPOST_MANAGER_ROLES);
  const { id } = await params;
  const { size: sizeRaw } = await searchParams;
  const size = parseSize(sizeRaw);

  const data = await loadAccountBins(id);
  if (!data) notFound();
  const { account, labels } = data;

  return (
    <div className="mx-auto max-w-[8.5in] bg-white text-black print:max-w-none">
      <BinPrintBar
        accountId={id}
        businessName={account.businessName}
        binCount={labels.length}
        size={size}
      />
      {labels.length === 0 ? (
        <div className="screen-only px-6 pb-10 text-sm text-gray-600">
          No bins provisioned for this site yet. Provision bins from the commercial accounts page
          first, then come back to print their labels.
        </div>
      ) : size === '4x6' ? (
        <FourBySixSheet businessName={account.businessName} labels={labels} />
      ) : (
        <SmallLabelSheet businessName={account.businessName} labels={labels} />
      )}
    </div>
  );
}

function SmallLabelSheet({
  businessName,
  labels,
}: {
  businessName: string;
  labels: LabelData[];
}) {
  return (
    <>
      {/* One 2.25×1.25 label per page. Rollo small-label stock. */}
      <style>{`
        @media print {
          @page { size: 2.25in 1.25in; margin: 0; }
          html, body { background: white; }
          .screen-only { display: none !important; }
          .label-page { page-break-after: always; break-after: page; }
          .label-page:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
      <div className="screen-only mb-3 px-6 text-xs text-gray-600">
        Preview below shows all {labels.length} bin label{labels.length === 1 ? '' : 's'}. Each
        prints as its own 2.25″×1.25″ page on Rollo thermal stock.
      </div>
      <div className="flex flex-col gap-[0.15in] px-6 pb-10 print:gap-0 print:px-0 print:pb-0">
        {labels.map((label) => (
          <div key={label.code} className="label-page">
            <SmallLabel businessName={businessName} label={label} />
          </div>
        ))}
      </div>
    </>
  );
}

// 4×6 sheet: bins arranged 2 cols × 5 rows per page (10 per page).
function FourBySixSheet({
  businessName,
  labels,
}: {
  businessName: string;
  labels: LabelData[];
}) {
  return (
    <>
      <style>{`
        @media print {
          @page { size: 4in 6in; margin: 0; }
          html, body { background: white; }
          .screen-only { display: none !important; }
          .sheet-page { page-break-after: always; break-after: page; }
          .sheet-page:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
      <div className="screen-only mb-3 px-6 text-xs text-gray-600">
        Preview below shows the 4″×6″ sheet{labels.length > 10 ? 's' : ''} — up to 10 labels per page
        (2 columns × 5 rows).
      </div>
      <div className="px-6 pb-10 print:px-0 print:pb-0">
        {chunk(labels, 10).map((page, i) => (
          <div
            key={i}
            className="sheet-page mx-auto mb-6 grid w-[4in] grid-cols-2 grid-rows-5 gap-0 border border-black/20 print:mx-0 print:mb-0 print:border-0"
          >
            {page.map((label) => (
              <FourBySixCell key={label.code} businessName={businessName} label={label} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Rollo thermal label: 2.25" × 1.25". QR fills the square on the left; the
// site name + printed-number fallback run down the right.
function SmallLabel({ businessName, label }: { businessName: string; label: LabelData }) {
  return (
    <div className="flex h-[1.25in] w-[2.25in] items-stretch border border-black bg-white print:border-0">
      <div
        className="grid h-[1.25in] w-[1.25in] place-items-center p-[0.08in]"
        dangerouslySetInnerHTML={{ __html: label.qrSvg }}
      />
      <div className="flex flex-1 flex-col justify-between border-l border-black/40 p-[0.08in] text-black print:border-l-0">
        <div className="line-clamp-2 text-[7.5pt] font-semibold uppercase leading-tight tracking-wide">
          {businessName}
        </div>
        <div>
          <div className="font-mono text-[11pt] font-bold leading-tight">{label.code}</div>
          {label.binSize && (
            <div className="text-[8pt] font-semibold text-gray-800">
              {BIN_DISPLAY_NAMES[label.binSize]} compost bin
            </div>
          )}
        </div>
        <div className="text-[6.5pt] leading-snug text-gray-600">Scan at pickup</div>
      </div>
    </div>
  );
}

// 4×6 grid cell: 2.0" × 1.2".
function FourBySixCell({ businessName, label }: { businessName: string; label: LabelData }) {
  return (
    <div className="flex h-[1.2in] w-[2in] items-stretch border border-black/30 bg-white print:border-black/40">
      <div
        className="grid h-[1.2in] w-[1.2in] place-items-center p-[0.07in]"
        dangerouslySetInnerHTML={{ __html: label.qrSvg }}
      />
      <div className="flex flex-1 flex-col justify-between border-l border-black/30 p-[0.07in] text-black">
        <div className="line-clamp-2 text-[6.5pt] font-semibold uppercase leading-tight tracking-wide">
          {businessName}
        </div>
        <div>
          <div className="font-mono text-[10pt] font-bold leading-tight">{label.code}</div>
          {label.binSize && (
            <div className="text-[7pt] font-semibold text-gray-800">
              {BIN_DISPLAY_NAMES[label.binSize]} compost bin
            </div>
          )}
        </div>
        <div className="text-[6pt] leading-snug text-gray-600">Scan at pickup</div>
      </div>
    </div>
  );
}
