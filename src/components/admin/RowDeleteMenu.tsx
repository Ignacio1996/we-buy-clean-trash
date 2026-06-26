'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A compact "⋮" (three-dots) row action menu whose only item is Delete, which
 * opens a styled confirm modal instead of the browser's native confirm(). The
 * caller supplies the destructive request via `onConfirm` (which should throw
 * on failure); this component owns the menu, modal, busy, and error state.
 *
 * Replaces the inline red "Delete" buttons across the admin compost screens so
 * deletes are tucked behind a menu and gated by an explicit confirmation step.
 */
export function RowDeleteMenu({
  menuLabel = 'Delete',
  confirmTitle,
  confirmBody,
  confirmLabel = 'Delete',
  onConfirm,
  align = 'right',
}: {
  /** Text of the single menu item. */
  menuLabel?: string;
  /** Modal heading. */
  confirmTitle: string;
  /** Modal body copy describing the consequences. */
  confirmBody: string;
  /** Text of the destructive confirm button. */
  confirmLabel?: string;
  /** Runs the delete. Throw with a message to surface an inline error. */
  onConfirm: () => Promise<void>;
  /** Which edge the dropdown aligns to. */
  align?: 'left' | 'right';
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function openModal() {
    setMenuOpen(false);
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setModalOpen(false);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      // onConfirm typically navigates/refreshes; close on success.
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'delete_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span ref={wrapRef} className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </svg>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className={`absolute top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-white/10 bg-neutral-900 py-1 shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={openModal}
            className="flex w-full items-center px-3 py-2 text-left text-[13px] text-red-400 hover:bg-red-500/10"
          >
            {menuLabel}
          </button>
        </div>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-6 text-left shadow-2xl"
          >
            <h2 className="text-base font-semibold text-white">{confirmTitle}</h2>
            <p className="mt-2 text-sm text-gray-400">{confirmBody}</p>
            {error && <p className="mt-3 text-[13px] text-red-400">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={busy}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-[13px] text-gray-300 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="rounded-lg bg-red-500/90 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {busy ? 'Deleting…' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
