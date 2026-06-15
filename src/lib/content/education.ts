/**
 * Config-driven content for the resident "Recycle Right" education module.
 *
 * Everything a resident reads in /resident/education is sourced from this one
 * object so copy and links can be swapped without touching component code. The
 * direction from the client (Kirk) is heart-driven, fifth-grade-simple, money
 * first — with outbound links to local resources or WBCT's own YouTube content.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TODO: replace placeholder copy + links with Kirk's answers from the question
 * worksheet. Each field below is a placeholder; the structure is final.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface EducationLink {
  label: string;
  href: string;
  /** Short note shown under the link, e.g. "Columbus, OH" or "WBCT on YouTube". */
  note?: string;
}

export interface EducationContent {
  /** Short eyebrow above the heading. */
  eyebrow: string;
  heading: string;
  /** The "why" — heart-driven intro. Money first, then the planet. */
  intro: string;
  dos: string[];
  donts: string[];
  /** Configurable outbound-link slot — local resources, SWACO, WBCT YouTube. */
  links: EducationLink[];
}

export const EDUCATION_CONTENT: EducationContent = {
  eyebrow: 'Recycle Right',
  heading: 'Clean trash is cash.',
  intro:
    "Every clean can and bottle you set out puts money back in your pocket — and keeps good material out of the landfill. The cleaner your bag, the more it's worth. Here's how to get every last point.",
  dos: [
    'Rinse cans, bottles, and jugs — a quick swish is plenty.',
    'Let everything dry before it goes in the bag.',
    'Flatten cardboard boxes so more fits in each bag.',
    'Keep materials loose — no bagging recyclables inside other bags.',
  ],
  donts: [
    "Don't include food, liquid, or greasy containers — they contaminate the whole bag.",
    "Don't add plastic film, bags, or wrap — those aren't accepted.",
    "Don't toss in glass unless your area accepts it yet.",
    "Don't include foam, diapers, or anything wet.",
  ],
  links: [
    {
      label: 'Recycle Right — what goes where',
      // TODO: confirm with Kirk — likely the local SWACO "Recycle Right" page.
      href: 'https://www.recycleright.org/',
      note: 'Local recycling guide',
    },
    {
      label: 'Watch: how we turn your trash into rewards',
      // TODO: confirm WBCT's YouTube channel / video URL.
      href: 'https://www.youtube.com/',
      note: 'WBCT on YouTube',
    },
  ],
};
