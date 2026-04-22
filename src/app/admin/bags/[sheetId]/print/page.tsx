import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { BagDoc, StickerSheetDoc } from '@/lib/types/bag';
import { PrintBar } from './PrintBar';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ sheetId: string }>;
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

export default async function SheetPrintPage({ params }: PageProps) {
  await requireRole('admin');
  const { sheetId } = await params;
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
      {/* Rollo thermal printers feed one label per page. @page sets the page
          to the physical label size so the browser prints each .label-page
          as a separate 2.25"×1.25" label. Works with standard printers too —
          select "fit to page" or use 2.25×1.25 label stock. */}
      <style>{`
        @media print {
          @page { size: 2.25in 1.25in; margin: 0; }
          html, body { background: white; }
          .screen-only { display: none !important; }
          .label-page { page-break-after: always; break-after: page; }
          .label-page:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
      <PrintBar sheetId={sheetId} sheetNumber={sheet.sheetNumber} printedLabel={printedLabel} />

      <div className="screen-only mb-3 px-6 text-xs text-gray-600">
        Preview below shows all 10 labels. Each prints as its own 2.25″×1.25″ page on Rollo
        thermal stock.
      </div>

      <div className="flex flex-col gap-[0.15in] px-6 pb-10 print:gap-0 print:px-0 print:pb-0">
        {labels.map((label) => (
          <div key={label.code} className="label-page">
            <Label code={label.code} qrSvg={label.qrSvg} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Rollo thermal label: 2.25" × 1.25". The QR fills the square on the left; the
// printed-number fallback runs down the right so a human can read it if the
// camera can't.
function Label({ code, qrSvg }: { code: string; qrSvg: string }) {
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
