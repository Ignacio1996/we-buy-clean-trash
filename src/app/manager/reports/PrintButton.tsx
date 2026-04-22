'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
    >
      📄 Download PDF
    </button>
  );
}
