'use client';

import { useEffect, useId, useRef, type ChangeEvent } from 'react';
import { SS, SSEyebrow } from '@/components/resident/ss/SS';
import { useAddressSuggestions, type ParsedAddressFields } from './useAddressSuggestions';

export type { ParsedAddressFields };

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  label = 'Street',
  placeholder = '312 Almanac Way',
  background = SS.mint,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (parsed: ParsedAddressFields) => void;
  label?: string;
  placeholder?: string;
  background?: string;
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
    <div ref={containerRef} style={{ position: 'relative', marginBottom: 12 }}>
      <label
        style={{
          display: 'block',
          background,
          border: `2px solid ${SS.ink}`,
          borderRadius: 14,
          padding: '12px 16px',
          cursor: 'text',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <SSEyebrow>{label}</SSEyebrow>
          {loading && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: SS.inkSoft,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Searching…
            </span>
          )}
        </div>
        <input
          type="text"
          value={value}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            fontFamily: SS.sans,
            fontSize: 18,
            fontWeight: 800,
            color: SS.ink,
          }}
        />
      </label>

      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#fff',
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            margin: 0,
            padding: 6,
            listStyle: 'none',
            zIndex: 20,
            boxShadow: `0 4px 0 ${SS.ink}`,
            maxHeight: 280,
            overflowY: 'auto',
          }}
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
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: active ? SS.mint : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 900,
                    color: SS.ink,
                    letterSpacing: -0.2,
                  }}
                >
                  {s.primaryText}
                </div>
                {s.secondaryText && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: SS.inkSoft,
                      marginTop: 2,
                    }}
                  >
                    {s.secondaryText}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
