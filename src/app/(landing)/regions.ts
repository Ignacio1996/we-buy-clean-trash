/**
 * Region-specific copy for the public landing page. The default variant is the
 * Maryland pilot content (rendered at `/`); the `ohio` variant powers `/ohio`,
 * the page Kirk sends to his Columbus clients. Everything else on the page is
 * shared — only the service-area / location strings switch here.
 *
 * Signup itself resolves zips dynamically against the `zones` collection, so
 * the actual accepted zips are managed in the admin Zones UI, not here.
 */
export type LandingRegion = 'default' | 'ohio';

/** Company contact block — same on every region page. */
export const CONTACT_EMAIL = 'support@webuycleantrash.com';
export const CONTACT_PHONE = '240-624-2617';
export const CONTACT_ADDRESS_LINES = [
  'We Buy Clean Trash',
  '1550 Rochelle Avenue',
  'Capitol Heights, MD 20743',
];

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
  /** Waitlist modal sub-heading copy. */
  waitlistLede: string;
  /** Waitlist modal confirmation copy for a brand-new signup. */
  waitlistSuccessNew: string;
  /** Waitlist modal confirmation copy for someone already on the list. */
  waitlistSuccessReturning: string;
  /** Placeholder shown in the waitlist zip field. */
  waitlistZipPlaceholder: string;
  /** FAQ "Where do you operate?" answer. */
  whereWeOperate: string;
  /** Footer brand tagline (second line under the wordmark). */
  footerTagline: string;
  /** Footer "Pilot area" column heading. */
  pilotAreaTitle: string;
  pilotAreaCities: RegionPilotCity[];
}

const DEFAULT_CONTENT: RegionContent = {
  pilotBannerStrong: 'Launching summer 2026 in Capitol Heights, MD.',
  pilotBannerBody:
    "We're showing the work as we build — early signups shape the routes, the bag design, and the rewards. Be one of the first 200 households.",
  waitlistLabel: 'Join the waitlist',
  waitlistLede:
    "Capitol Heights, MD, summer 2026. We'll email you a few weeks before pickups start — zero spam, just one note when it's your turn.",
  waitlistSuccessNew:
    'Thanks — we logged your spot. When the Capitol Heights pilot opens up, you’ll be among the first 200 households we email.',
  waitlistSuccessReturning:
    "You're already on the waitlist — we updated your details. We'll reach out as the Capitol Heights pilot opens up.",
  waitlistZipPlaceholder: '20743',
  whereWeOperate:
    "Capitol Heights, Maryland and the surrounding Prince George's County area. Drop your zip in the footer to join the waitlist — we'll let you know the moment we reach your street.",
  footerTagline:
    'Turning recyclables into rewards. Door-side, zero-commission residential recycling. Pilot launching summer 2026 in Capitol Heights, MD.',
  pilotAreaTitle: 'Pilot area',
  pilotAreaCities: [
    { name: 'Capitol Heights · summer 2026', live: true },
    { name: "Prince George's County · TBD", live: false },
  ],
};

const OHIO_CONTENT: RegionContent = {
  pilotBannerStrong: 'Serving Columbus, Ohio and surrounding areas.',
  pilotBannerBody:
    "We're live in Columbus — set out your clean recyclables door-side and earn rewards every single week. Drop your zip below to see if we've reached your street yet.",
  waitlistLabel: 'Check your address',
  waitlistLede:
    "Columbus, Ohio and surrounding areas. Drop your zip and we'll tell you where we're at — zero spam, just one note when it's your turn.",
  waitlistSuccessNew:
    "Thanks — we logged your spot. If we haven't reached your street yet, you'll be among the first we email when we do.",
  waitlistSuccessReturning:
    "You're already on the list — we updated your details. We'll reach out as we reach your street.",
  waitlistZipPlaceholder: '43215',
  whereWeOperate:
    "We're serving Columbus, Ohio and the surrounding areas. Drop your zip in the footer to check your address — if we haven't reached your street yet, you'll join the waitlist and we'll let you know the moment we do.",
  footerTagline:
    'Turning recyclables into rewards. Door-side, zero-commission residential recycling. Serving Columbus, Ohio and surrounding areas.',
  pilotAreaTitle: 'Service area',
  pilotAreaCities: [
    { name: 'Columbus · live now', live: true },
    { name: 'Surrounding areas · rolling out', live: false },
  ],
};

const REGION_CONTENT: Record<LandingRegion, RegionContent> = {
  default: DEFAULT_CONTENT,
  ohio: OHIO_CONTENT,
};

export function getRegionContent(region: LandingRegion): RegionContent {
  return REGION_CONTENT[region];
}
