import 'server-only';

export interface GeocodeInput {
  street: string;
  unit?: string | null;
  city: string;
  state: string;
  postalCode: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  mocked: boolean;
}

function formatAddress(addr: GeocodeInput): string {
  const line1 = [addr.street, addr.unit].filter((s) => s && s.trim()).join(' ');
  return `${line1}, ${addr.city}, ${addr.state} ${addr.postalCode}`;
}

// Deterministic mock based on the zip — gives stable-ish coords for testing
// without hitting Google. We scatter points slightly around a hash of the
// full address so multiple residents in the same zip don't collide.
function mockGeocode(addr: GeocodeInput): GeocodeResult {
  const zip = addr.postalCode.replace(/\D/g, '').slice(0, 5).padEnd(5, '0');
  const zipN = Number(zip);
  const baseLat = 40.7 + (zipN % 1000) / 10000;
  const baseLng = -74 + Math.floor(zipN / 1000) / 1000;
  let h = 0;
  const full = formatAddress(addr);
  for (let i = 0; i < full.length; i++) h = (h * 31 + full.charCodeAt(i)) | 0;
  const jitterLat = ((h & 0xffff) / 0xffff - 0.5) * 0.01;
  const jitterLng = (((h >> 16) & 0xffff) / 0xffff - 0.5) * 0.01;
  return { lat: baseLat + jitterLat, lng: baseLng + jitterLng, mocked: true };
}

interface GoogleGeocodeResponse {
  status: string;
  results?: Array<{
    geometry?: { location?: { lat: number; lng: number } };
  }>;
}

export async function geocodeAddress(addr: GeocodeInput): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return mockGeocode(addr);

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', formatAddress(addr));
  url.searchParams.set('key', apiKey);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as GoogleGeocodeResponse;
    if (body.status !== 'OK') return null;
    const loc = body.results?.[0]?.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat, lng: loc.lng, mocked: false };
  } catch {
    return null;
  }
}
