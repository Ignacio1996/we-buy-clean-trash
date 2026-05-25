import 'server-only';

// Thin server-side wrapper around the Google Places API (New). The client never
// sees GOOGLE_MAPS_API_KEY — it POSTs to /api/places/autocomplete and
// /api/places/details, which call these helpers.
//
// Session tokens group billable autocomplete keystrokes with the final details
// fetch into a single "Autocomplete Session" charge. The client generates a
// UUID per address-entry session and sends the same value with every keystroke
// + the final details call.

const PLACES_BASE = 'https://places.googleapis.com/v1';

export interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
}

interface AutocompleteApiResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      text?: { text?: string };
    };
  }>;
}

interface PlaceDetailsApiResponse {
  formattedAddress?: string;
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  location?: { latitude?: number; longitude?: number };
}

export async function autocompletePlaces(params: {
  input: string;
  sessionToken: string;
}): Promise<PlaceSuggestion[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return [];
  const input = params.input.trim();
  if (input.length < 3) return [];

  const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      input,
      sessionToken: params.sessionToken,
      includedRegionCodes: ['us'],
      includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
      languageCode: 'en',
    }),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as AutocompleteApiResponse;
  const suggestions = body.suggestions ?? [];
  return suggestions
    .map((s) => {
      const p = s.placePrediction;
      if (!p?.placeId) return null;
      const main = p.structuredFormat?.mainText?.text ?? p.text?.text ?? '';
      const secondary = p.structuredFormat?.secondaryText?.text ?? '';
      return { placeId: p.placeId, primaryText: main, secondaryText: secondary };
    })
    .filter((s): s is PlaceSuggestion => s !== null && s.primaryText !== '');
}

function pick(
  components: NonNullable<PlaceDetailsApiResponse['addressComponents']>,
  types: string[],
  field: 'longText' | 'shortText' = 'longText',
): string {
  for (const c of components) {
    if (!c.types) continue;
    if (types.some((t) => c.types!.includes(t))) {
      return (c[field] ?? '').trim();
    }
  }
  return '';
}

export async function getPlaceDetails(params: {
  placeId: string;
  sessionToken: string;
}): Promise<ParsedAddress | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const url = new URL(`${PLACES_BASE}/places/${encodeURIComponent(params.placeId)}`);
  url.searchParams.set('sessionToken', params.sessionToken);

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'formattedAddress,addressComponents,location',
    },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as PlaceDetailsApiResponse;
  const components = body.addressComponents ?? [];
  const streetNumber = pick(components, ['street_number']);
  const route = pick(components, ['route']);
  const street = [streetNumber, route].filter(Boolean).join(' ');
  const city =
    pick(components, ['locality']) ||
    pick(components, ['postal_town']) ||
    pick(components, ['sublocality', 'sublocality_level_1']);
  const state = pick(components, ['administrative_area_level_1'], 'shortText');
  const postalCode = pick(components, ['postal_code']);
  const lat = body.location?.latitude ?? null;
  const lng = body.location?.longitude ?? null;
  return {
    street,
    city,
    state,
    postalCode,
    formattedAddress: body.formattedAddress ?? '',
    lat,
    lng,
  };
}
