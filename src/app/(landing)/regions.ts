/**
 * Region-specific copy for the public landing page. The default variant is the
 * original Bay Area pilot content (rendered at `/`); the `ohio` variant powers
 * `/ohio`, the page Kirk sends to his Columbus clients. Everything else on the
 * page is shared — only the service-area / location strings switch here.
 *
 * Signup itself resolves zips dynamically against the `zones` collection, so
 * the actual accepted Ohio zips are managed in the admin Zones UI, not here.
 */
export type LandingRegion = 'default' | 'ohio';

export interface RegionPilotCity {
  name: string;
  /** Live = green dot; otherwise a muted "coming" dot. */
  live: boolean;
}

export interface RegionContent {
  /** Bold lead of the pilot banner strip. */
  pilotBannerStrong: string;
  /** Body text of the pilot banner strip. */
  pilotBannerBody: string;
  waitlistLabel: string;
  /** FAQ "Where do you operate?" answer. */
  whereWeOperate: string;
  /** Footer brand tagline (second line under the wordmark). */
  footerTagline: string;
  /** Footer "Pilot area" column heading. */
  pilotAreaTitle: string;
  pilotAreaCities: RegionPilotCity[];
  /** Footer contact mailing-address lines (placeholder until confirmed). */
  contactAddressLines: string[];
}

const DEFAULT_CONTENT: RegionContent = {
  pilotBannerStrong: 'Launching summer 2026 in Oakland.',
  pilotBannerBody:
    "We're showing the work as we build — early signups shape the routes, the bag design, and the rewards. Be one of the first 200 households.",
  waitlistLabel: 'Join the waitlist',
  whereWeOperate:
    "Oakland, Berkeley, Emeryville, Alameda, and the eastern San Francisco peninsula. We're launching Sacramento and San Jose in summer 2026. Drop your zip in the footer to join the waitlist for new cities.",
  footerTagline:
    'Turning recyclables into rewards. Door-side, zero-commission residential recycling. Pilot launching summer 2026 in Oakland, CA.',
  pilotAreaTitle: 'Pilot area',
  pilotAreaCities: [
    { name: 'Oakland · summer 2026', live: true },
    { name: 'Berkeley · TBD', live: false },
    { name: 'Emeryville · TBD', live: false },
    { name: 'Alameda · TBD', live: false },
  ],
  contactAddressLines: ['123 Pilot St.', 'Oakland, CA 94607'],
};

const OHIO_CONTENT: RegionContent = {
  pilotBannerStrong: 'Serving Columbus, Ohio and surrounding areas.',
  pilotBannerBody:
    "We're live in Columbus — set out your clean recyclables door-side and earn rewards every single week. Drop your zip below to see if we've reached your street yet.",
  waitlistLabel: 'Check your address',
  whereWeOperate:
    "We're serving Columbus, Ohio and the surrounding areas. Drop your zip in the footer to check your address — if we haven't reached your street yet, you'll join the waitlist and we'll let you know the moment we do.",
  footerTagline:
    'Turning recyclables into rewards. Door-side, zero-commission residential recycling. Serving Columbus, Ohio and surrounding areas.',
  pilotAreaTitle: 'Service area',
  pilotAreaCities: [
    { name: 'Columbus · live now', live: true },
    { name: 'Surrounding areas · rolling out', live: false },
  ],
  // TODO: confirm Columbus business mailing address.
  contactAddressLines: ['Columbus, OH'],
};

const REGION_CONTENT: Record<LandingRegion, RegionContent> = {
  default: DEFAULT_CONTENT,
  ohio: OHIO_CONTENT,
};

export function getRegionContent(region: LandingRegion): RegionContent {
  return REGION_CONTENT[region];
}
