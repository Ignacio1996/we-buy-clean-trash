'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface ParsedAddressFields {
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface AddressSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

function newSessionToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'st-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useAddressSuggestions(
  value: string,
  onSelect: (parsed: ParsedAddressFields) => void,
) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  // One session token per address-entry session — same value sent with every
  // autocomplete keystroke AND the final details fetch so Google bills them
  // as a single Autocomplete Session. Reset after a place is picked.
  const sessionTokenRef = useRef(newSessionToken());
  // Suppress the next debounced fetch after a programmatic value change
  // (selecting a suggestion fills the street field, which would otherwise
  // re-trigger autocomplete).
  const suppressNextFetch = useRef(false);

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
          body: JSON.stringify({ input: trimmed, sessionToken: sessionTokenRef.current }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const body = (await res.json()) as { suggestions?: AddressSuggestion[] };
        const list = body.suggestions ?? [];
        setSuggestions(list);
        setOpen(list.length > 0);
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

  async function selectSuggestion(s: AddressSuggestion) {
    suppressNextFetch.current = true;
    setOpen(false);
    try {
      const res = await fetch('/api/places/details', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ placeId: s.placeId, sessionToken: sessionTokenRef.current }),
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        address?: ParsedAddressFields & { formattedAddress?: string };
      };
      if (!body.address) return;
      onSelect({
        street: body.address.street,
        city: body.address.city,
        state: body.address.state,
        postalCode: body.address.postalCode,
      });
    } finally {
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

  return {
    suggestions,
    open,
    setOpen,
    highlight,
    setHighlight,
    loading,
    selectSuggestion,
    onKeyDown,
  };
}
