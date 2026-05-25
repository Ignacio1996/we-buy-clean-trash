'use client';

import { useEffect, useId, useRef } from 'react';
import { useAddressSuggestions, type ParsedAddressFields } from './useAddressSuggestions';

// Dark-themed variant for the admin/manager screens that use the existing
// Tailwind `Field`/`Input` look (white-on-black panels). Same suggestions
// behavior as <AddressAutocomplete>.
export function AddressAutocompleteField({
  label,
  value,
  onChange,
  onSelect,
  required,
  placeholder,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (parsed: ParsedAddressFields) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const { suggestions, open, setOpen, highlight, setHighlight, loading, selectSuggestion, onKeyDown } =
    useAddressSuggestions(value, onSelect);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [setOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wide text-gray-500">
          {label}
          {loading && <span className="ml-2 normal-case text-gray-400">Searching…</span>}
        </span>
        <input
          type="text"
          required={required}
          value={value}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
        />
      </label>

      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 p-1 shadow-xl"
        >
          {suggestions.map((s, i) => {
            const active = i === highlight;
            return (
              <li
                key={s.placeId}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void selectSuggestion(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`cursor-pointer rounded px-3 py-2 ${
                  active ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="text-sm font-medium text-white">{s.primaryText}</div>
                {s.secondaryText && (
                  <div className="text-xs text-gray-400">{s.secondaryText}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
