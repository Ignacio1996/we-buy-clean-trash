import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { BagDoc, StickerSheetDoc } from '@/lib/types/bag';
import { PrintBar } from './PrintBar';

export const dynamic = 'force-dynamic';

type LabelSize = '2.25x1.25' | '4x6';

interface PageProps {
  params: Promise<{ sheetId: string }>;
  searchParams: Promise<{ size?: string }>;
}

function parseSize(raw: string | undefined): LabelSize {
  return raw === '4x6' ? '4x6' : '2.25x1.25';
}

interface LabelData {
  code: string;
  qrSvg: string;
}

async function loadSheet(sheetId: string) {
  const sheetSnap = await adminDb.collection('stickerSheets').doc(sheetId).get();
  if (!sheetSnap.exists) return null;
  const sheet = sheetSnap.data() as StickerSheetDoc;

  const bagRefs = sheet.bagIds.map((id) => adminDb.collection('bags').doc(id));
  const bagSnaps = bagRefs.length > 0 ? await adminDb.getAll(...bagRefs) : [];
  const bags = bagSnaps
    .map((s) => (s.exists ? (s.data() as BagDoc) : null))
    .filter((b): b is BagDoc => b !== null)
    .sort((a, b) => a.qrCode.localeCompare(b.qrCode));

  const labels = await Promise.all(
    bags.map(async (bag): Promise<LabelData> => {
      const qrSvg = await QRCode.toString(bag.qrCode, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 0,
        color: { dark: '#000000', light: '#ffffff' },
      });
      return { code: bag.qrCode, qrSvg };
    }),
  );

  return { sheet, labels };
}

export default async function SheetPrintPage({ params, searchParams }: PageProps) {
  await requireRole('admin');
  const { sheetId } = await params;
  const { size: sizeRaw } = await searchParams;
  const size = parseSize(sizeRaw);
  const data = await loadSheet(sheetId);
  if (!data) notFound();
  const { sheet, labels } = data;

  const printedLabel = sheet.printedAt
    ? new Date(sheet.printedAt.toDate()).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="mx-auto max-w-[8.5in] bg-white text-black print:max-w-none">
      <PrintBar
        sheetId={sheetId}
        sheetNumber={sheet.sheetNumber}
        printedLabel={printedLabel}
        size={size}
      />
      {size === '4x6' ? <FourBySixSheet labels={labels} /> : <SmallLabelSheet labels={labels} />}
    </div>
  );
}

function SmallLabelSheet({ labels }: { labels: LabelData[] }) {
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
        Preview below shows all 10 labels. Each prints as its own 2.25″×1.25″ page on Rollo
        thermal stock.
      </div>
      <div className="flex flex-col gap-[0.15in] px-6 pb-10 print:gap-0 print:px-0 print:pb-0">
        {labels.map((label) => (
          <div key={label.code} className="label-page">
            <SmallLabel code={label.code} qrSvg={label.qrSvg} />
          </div>
        ))}
      </div>
    </>
  );
}

// 4×6 sheet: all 10 labels arranged 2 cols × 5 rows on a single page.
// Each cell is exactly 2.0in × 1.2in, filling the 4×6 page edge-to-edge.
function FourBySixSheet({ labels }: { labels: LabelData[] }) {
  return (
    <>
      <style>{`
        @media print {
          @page { size: 4in 6in; margin: 0; }
          html, body { background: white; }
          .screen-only { display: none !important; }
        }
      `}</style>
      <div className="screen-only mb-3 px-6 text-xs text-gray-600">
        Preview below shows the 4″×6″ sheet — all 10 labels on a single page (2 columns × 5 rows).
      </div>
      <div className="mx-auto grid w-[4in] grid-cols-2 grid-rows-5 gap-0 border border-black/20 print:mx-0 print:border-0">
        {labels.map((label) => (
          <FourBySixCell key={label.code} code={label.code} qrSvg={label.qrSvg} />
        ))}
      </div>
    </>
  );
}

// Rollo thermal label: 2.25" × 1.25". The QR fills the square on the left; the
// printed-number fallback runs down the right so a human can read it if the
// camera can't.
function SmallLabel({ code, qrSvg }: { code: string; qrSvg: string }) {
  return (
    <div className="flex h-[1.25in] w-[2.25in] items-stretch border border-black bg-white print:border-0">
      <div
        className="grid h-[1.25in] w-[1.25in] place-items-center p-[0.08in]"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="flex flex-1 flex-col justify-between border-l border-black/40 p-[0.08in] text-black print:border-l-0">
        <div className="text-[7pt] font-semibold uppercase tracking-wide">We Buy Clean Trash</div>
        <div className="flex-1 items-center">
          <div className="font-mono text-[11pt] font-bold leading-tight">{code}</div>
        </div>
        <div className="text-[6.5pt] leading-snug text-gray-700">
          Scan at webuyclean.trash
          <br />
          or enter the number above.
        </div>
      </div>
    </div>
  );
}

// 4×6 grid cell: 2.0" × 1.2". Same internal layout as the small label, scaled
// to the slightly smaller cell footprint. Cells share borders via the grid so
// the sheet looks like a perforated sticker page.
function FourBySixCell({ code, qrSvg }: { code: string; qrSvg: string }) {
  return (
    <div className="flex h-[1.2in] w-[2in] items-stretch border border-black/30 bg-white print:border-black/40">
      <div
        className="grid h-[1.2in] w-[1.2in] place-items-center p-[0.07in]"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="flex flex-1 flex-col justify-between border-l border-black/30 p-[0.07in] text-black">
        <div className="text-[6.5pt] font-semibold uppercase tracking-wide">
          We Buy Clean Trash
        </div>
        <div className="font-mono text-[10pt] font-bold leading-tight">{code}</div>
        <div className="text-[6pt] leading-snug text-gray-700">
          Scan at webuyclean.trash
          <br />
          or enter the number above.
        </div>
      </div>
    </div>
  );
}
