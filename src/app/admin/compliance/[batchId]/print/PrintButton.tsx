'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-black px-3 py-1 text-xs font-semibold text-white hover:bg-gray-800"
    >
      🖨️ Print all letters
    </button>
  );
}
