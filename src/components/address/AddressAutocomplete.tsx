'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { SS, SSEyebrow } from '@/components/resident/ss/SS';

export interface ParsedAddressFields {
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

interface Suggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

// New v4 RFC 4122 token, formatted but not cryptographically critical — Google
// only requires uniqueness per autocomplete session.
function newSessionToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'st-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  // One session token per address-entry session. Reset after a place is picked
  // so the next correction starts a new billable session. Memoize so React
  // doesn't churn it on every render.
  const sessionTokenRef = useRef(newSessionToken());
  // Suppresses fetching right after the user selects a suggestion (since we
  // programmatically set the input value).
  const suppressNextFetch = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = useMemo(() => value.trim(), [value]);

  useEffect(() => {
    if (suppressNextFetch.current) {
      suppressNextFetch.current = false;
      return;
    }
    if (trimmed.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/places/autocomplete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            input: trimmed,
            sessionToken: sessionTokenRef.current,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const body = (await res.json()) as { suggestions?: Suggestion[] };
        setSuggestions(body.suggestions ?? []);
        setOpen((body.suggestions ?? []).length > 0);
        setHighlight(0);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [trimmed]);

  // Close the dropdown when the user clicks outside.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function selectSuggestion(s: Suggestion) {
    suppressNextFetch.current = true;
    setOpen(false);
    try {
      const res = await fetch('/api/places/details', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          placeId: s.placeId,
          sessionToken: sessionTokenRef.current,
        }),
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        address?: ParsedAddressFields & { formattedAddress?: string };
      };
      const addr = body.address;
      if (!addr) return;
      onSelect({
        street: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
      });
    } finally {
      // Start a fresh session token for any subsequent edits.
      sessionTokenRef.current = newSessionToken();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = suggestions[highlight];
      if (pick) void selectSuggestion(pick);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

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
          aria-autocomplete="list"
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
