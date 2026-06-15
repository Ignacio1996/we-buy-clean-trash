import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './landing.module.css';
import { WaitlistButton } from './WaitlistButton';
import { getRegionContent, type LandingRegion } from './regions';

const svgProps = {
  viewBox: '0 0 24 24',
  width: 32,
  height: 32,
  fill: 'none',
  stroke: 'var(--ink)',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ICON_ALUMINUM = (
  <svg {...svgProps} aria-hidden="true">
    <path d="M7 3.5h10v1.6c0 .6-.4 1-1 1H8c-.6 0-1-.4-1-1V3.5z" />
    <path d="M7.5 6.1h9v13.4c0 .6-.5 1-1 1H8.5c-.6 0-1-.5-1-1V6.1z" />
    <path d="M9.5 9.5h5" />
    <path d="M9.5 12.5h5" />
  </svg>
);

const ICON_PET = (
  <svg {...svgProps} aria-hidden="true">
    <path d="M10 3h4v1.5h-4z" />
    <path d="M10 4.5h4v2l1.2 2c.5.8.8 1.8.8 2.7v8.3c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2v-8.3c0-.9.3-1.9.8-2.7L10 6.5v-2z" />
    <path d="M8.8 11.2h6.4" />
  </svg>
);

const ICON_HDPE = (
  <svg {...svgProps} aria-hidden="true">
    <path d="M9 3h4v3H9z" />
    <path d="M6 6h7v14.5c0 .3-.2.5-.5.5h-6c-.3 0-.5-.2-.5-.5V6z" />
    <path d="M13 9h3.5c.3 0 .5.2.5.5v4c0 .3-.2.5-.5.5H13" />
    <path d="M7.5 14h4" />
  </svg>
);

const ICON_CARDBOARD = (
  <svg {...svgProps} aria-hidden="true">
    <path d="M3 7.5l9-3.5 9 3.5v9.5l-9 3.5-9-3.5V7.5z" />
    <path d="M3 7.5l9 3.5 9-3.5" />
    <path d="M12 11v9.5" />
    <path d="M8 5.7l9 3.5" />
  </svg>
);

const ICON_GLASS = (
  <svg {...svgProps} aria-hidden="true">
    <path d="M10.5 3h3v3.5h-3z" />
    <path d="M10.5 6.5h3v2.2l1.5 2c.3.4.5.9.5 1.5v7.3c0 .8-.7 1.5-1.5 1.5h-4c-.8 0-1.5-.7-1.5-1.5v-7.3c0-.6.2-1.1.5-1.5l1.5-2V6.5z" />
    <rect x="9" y="13" width="6" height="3" />
  </svg>
);

const ICON_STEEL = (
  <svg {...svgProps} aria-hidden="true">
    <ellipse cx="12" cy="5" rx="6" ry="1.8" />
    <path d="M6 5v14c0 1 2.7 1.8 6 1.8s6-.8 6-1.8V5" />
    <path d="M6 9.5c0 1 2.7 1.8 6 1.8s6-.8 6-1.8" />
    <path d="M8 13.5h8" />
    <path d="M8 16h5" />
  </svg>
);

const ICON_PAPER = (
  <svg {...svgProps} aria-hidden="true">
    <path d="M5 6h11v14H5z" />
    <path d="M16 9h3v10c0 .6-.4 1-1 1h-2" />
    <path d="M7.5 9h6" />
    <path d="M7.5 12h6" />
    <path d="M7.5 15h6" />
    <path d="M7.5 17.5h4" />
  </svg>
);

const ICON_STAR = (
  <svg {...svgProps} aria-hidden="true" stroke="#fff">
    <path d="M12 3l2.6 5.5 6 .9-4.4 4.2 1.1 6L12 16.7 6.7 19.6l1.1-6L3.4 9.4l6-.9L12 3z" />
  </svg>
);

const MARQUEE_ITEMS = [
  '♻ Aluminum Cans · 120 Points',
  '♻ Plastic Bottles · 40 Points',
  '♻ Milk Jugs · 100 Points',
  '♻ Cardboard · 25 Points',
  '♻ Glass Bottles · 60 Points',
  '♻ Clean Bag Bonus · +50 Points',
];

type Commodity = {
  icon: ReactNode;
  name: string;
  points: string;
  unit: string;
  accept: string;
  bg: string;
  fg?: string;
  borderColor?: string;
  soon?: boolean;
};

const COMMODITIES: Commodity[] = [
  {
    icon: ICON_ALUMINUM,
    name: 'Aluminum Cans',
    points: '120',
    unit: 'points per can',
    accept: 'Soda · seltzer · beer cans',
    bg: '#ECECEC',
  },
  {
    icon: ICON_PET,
    name: 'Plastic Bottles',
    points: '40',
    unit: 'points per bottle',
    accept: 'Water · soda · juice bottles',
    bg: 'var(--sky)',
  },
  {
    icon: ICON_HDPE,
    name: 'Milk Jugs',
    points: '100',
    unit: 'points per jug',
    accept: 'Milk · detergent · shampoo',
    bg: 'var(--mint)',
  },
  {
    icon: ICON_CARDBOARD,
    name: 'Cardboard',
    points: '25',
    unit: 'points per box',
    accept: 'Flattened only · no wax coating',
    bg: 'var(--peach)',
  },
  {
    icon: ICON_GLASS,
    name: 'Glass Bottles',
    points: '60',
    unit: 'points per bottle',
    accept: 'Clear · brown · green bottles',
    bg: 'var(--yellow)',
  },
  {
    icon: ICON_STEEL,
    name: 'Steel Cans',
    points: '30',
    unit: 'points per can',
    accept: 'Soup · food tins · empty aerosol',
    bg: '#ECECEC',
  },
  {
    icon: ICON_PAPER,
    name: 'Paper',
    points: '15',
    unit: 'points per stack',
    accept: 'Newspaper · office · magazines',
    bg: 'var(--sky)',
  },
  {
    icon: ICON_STAR,
    name: 'Clean Bag Bonus',
    points: '+50',
    unit: 'points per bag',
    accept: 'Awarded when your bag is sorted clean',
    bg: 'var(--brand)',
    fg: '#fff',
    soon: true,
  },
];

const FAQS = [
  {
    q: 'How much can I actually make?',
    a: 'A typical 2-person household earns $8–14 per month. Aluminum-heavy households (lots of seltzer or beer cans) can clear $20+. We pay weekly into points; 1,000 points = $10 gift card.',
    open: true,
  },
  {
    q: "What's the catch?",
    a: 'No catch, no commission. We make money by selling clean, sorted commodities at higher prices than dirty single-stream gets. By bag-tagging the stream, we cut contamination from 25% to under 2% — and split the upside with you.',
  },
  {
    q: 'Do bags cost money?',
    a: 'Your first box of 10 bags is free — on us, as a welcome. After that, sheets are $8 with free delivery over $20. A typical sheet pays for itself in about 4 weeks of normal household recycling.',
  },
  {
    q: 'What if my bag has the wrong stuff in it?',
    a: 'Mild contamination — we sort it out at the depot and credit you for the clean portion. Heavy contamination (food, liquid, garbage) means the bag is rejected and returned. We text you a photo so you can fix it for next week.',
  },
  {
    id: 'operate',
    q: 'Where do you operate?',
    // Answer is region-specific — overridden at render from regions.ts.
    a: "Oakland, Berkeley, Emeryville, Alameda, and the eastern San Francisco peninsula. We're launching Sacramento and San Jose in summer 2026. Drop your zip in the footer to join the waitlist for new cities.",
  },
  {
    q: 'How do you pay out?',
    a: "Gift cards (Amazon, Walmart, Target, Visa, REI, and 40+ more) at 1,000 points = $1. Instant delivery to your email. We're piloting direct bank deposit (ACH) for power users in Q3.",
  },
];

export function LandingPage({ region = 'default' }: { region?: LandingRegion }) {
  const content = getRegionContent(region);
  const faqs = FAQS.map((f) =>
    f.id === 'operate' ? { ...f, a: content.whereWeOperate } : f,
  );
  return (
    <div className={styles.root}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <div className={styles.topbarBrand}>
          <div className={styles.topbarWord}>
            We Buy Clean Trash<span className={styles.topbarDot}>.</span>
          </div>
          <div className={styles.topbarTagline}>Turning recyclables into rewards.</div>
        </div>
        <nav className={styles.topbarNav}>
          <a href="#how">How it works</a>
          <a href="#accept">What we take</a>
          <a href="#bags">Bag-tagging</a>
          <a href="#why">Why this works</a>
          <a href="#refer">Refer</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className={styles.topbarActions}>
          <Link href="/login" className={styles.topbarSignIn}>
            Sign in
          </Link>
          <Link href="/signup" className={styles.topbarCta}>
            Get started <span className={styles.arrow}>→</span>
          </Link>
        </div>
      </div>

      {/* Marquee */}
      <div className={styles.marquee} aria-hidden="true">
        <div className={styles.marqueeTrack}>
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div>
            <div className={styles.eyebrow}>Door side · picked up every week</div>
            <h1 className={styles.heroTitle}>
              We pay you
              <br />
              for your <em>clean trash.</em>
            </h1>
            <p className={styles.lede}>
              Separate your clean cans, bottles, and cardboard into pickup bags. Leave them door
              side and earn rewards with every pickup.
            </p>
            <div className={styles.heroTrust}>
              <span className={styles.heroTrustBadge}>40+ yrs</span>
              <span>
                Built by operators with <strong>40+ years</strong> in recycling and waste
                collection.
              </span>
            </div>
            <div className={styles.ctaRow}>
              <Link href="/signup" className={`${styles.btn} ${styles.btnLg} ${styles.btnBrand}`}>
                Get started — first 10 bags free <span className={styles.arrow}>→</span>
              </Link>
              <Link href="/scan" className={`${styles.btn} ${styles.btnLg}`}>
                See how much your trash is worth <span className={styles.arrow}>→</span>
              </Link>
            </div>
          </div>
          <div className={styles.heroRight}>
          <div className={styles.heroCard}>
            <div className={styles.heroCardStamp}>
              $10
              <br />
              gift card
              <br />
              per 4 wks
            </div>
            <div className={styles.heroCardLabel}>Sample household · 4 weeks</div>
            <div className={styles.heroCardBig}>$11.74</div>
            <div className={styles.heroCardSub}>earned · 16 bags returned</div>
            <div className={styles.heroCardRule}></div>
            <div className={styles.heroCardRow}>
              <span>Aluminum · 6 lbs</span>
              <span className={styles.heroCardV}>+$8.52</span>
            </div>
            <div className={styles.heroCardRow}>
              <span>Plastic bottles · 4.2 lbs</span>
              <span className={styles.heroCardV}>+$0.76</span>
            </div>
            <div className={styles.heroCardRow}>
              <span>Cardboard · 18 lbs</span>
              <span className={styles.heroCardV}>+$1.08</span>
            </div>
            <div className={styles.heroCardRow}>
              <span>Glass · 22 lbs</span>
              <span className={styles.heroCardV}>+$0.88</span>
            </div>
            <div className={styles.heroCardRow}>
              <span>×2 weekly bonus</span>
              <span className={styles.heroCardV}>+$0.50</span>
            </div>
          </div>
            <div className={styles.heroBrandsRow}>
              <span className={styles.heroBrandsLabel}>Cash out anytime</span>
              <span className={styles.heroBrandsList}>
                Amazon · Walmart · Target · Visa · REI · 40+ more
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pilot banner */}
      <section className={styles.pilotStrip} id="pilot">
        <div className={styles.pilotInner}>
          <div className={styles.pilotTag}>Pilot</div>
          <div className={styles.pilotBody}>
            <strong>{content.pilotBannerStrong}</strong> {content.pilotBannerBody}
          </div>
          <WaitlistButton label={content.waitlistLabel} />
        </div>
      </section>

      {/* How it works */}
      <section className={`${styles.section} ${styles.sectionMint}`} id="how">
        <div className={styles.sectionInner}>
          <div className={styles.kicker}>In three steps</div>
          <h2 className={styles.h2}>How it works.</h2>
          <p className={styles.intro}>
            Sign up once. We send you 20 bags. You fill them as you go. We come every week.
          </p>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <span className={styles.stepTag}>5 minutes · free</span>
              <h3>Get your first 10 bags free</h3>
              <p>
                We send your first box of 10 tagged bags on us. Bags arrive in 3 days. Reorder
                later for $8 — they pay for themselves in about 4 weeks.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <span className={styles.stepTag}>As you go</span>
              <h3>Fill &amp; set out</h3>
              <p>
                Clean, dry recyclables only. Tap &ldquo;set out for pickup&rdquo; the night before.
                Leave it at your designated pickup area.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <span className={styles.stepTag}>Next day</span>
              <h3>Return &amp; redeem</h3>
              <p>
                Points hit your account the next morning. Cash out to Amazon, Walmart, Visa —
                anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Commodities */}
      <section className={`${styles.section} ${styles.sectionCream}`} id="accept">
        <div className={styles.sectionInner}>
          <div className={styles.kicker}>Earn points with every pickup</div>
          <h2 className={styles.h2}>What we take.</h2>
          <p className={styles.intro}>
            Rinse it. Let it dry. Drop it in the bag. Every clean item earns points — and a fully
            clean bag earns a bonus on top.
          </p>
          <div className={styles.commodities}>
            {COMMODITIES.map((c) => (
              <div
                key={c.name}
                className={`${styles.commodity}${c.soon ? ` ${styles.commodityBonus}` : ''}`}
              >
                <div
                  className={styles.commodityIcon}
                  style={{
                    background: c.bg,
                    ...(c.fg ? { color: c.fg } : {}),
                  }}
                >
                  {c.icon}
                </div>
                <h4>{c.name}</h4>
                <div className={styles.commodityPrice}>
                  {c.points}
                  <span className={styles.commodityPts}> pts</span>
                </div>
                <div className={styles.commodityUnit}>{c.unit}</div>
                <div className={styles.commodityAccept}>{c.accept}</div>
              </div>
            ))}
          </div>
          <p className={styles.commodityFootnote}>
            1,000 points = $10 gift card. Point values shown are typical per item — actual points
            depend on bag weight and sort quality.
          </p>
        </div>
      </section>

      {/* Bag-tagging explainer */}
      <section className={`${styles.section} ${styles.sectionPeach}`} id="bags">
        <div className={styles.sectionInner}>
          <div className={styles.kicker}>How bag-tagging works</div>
          <h2 className={styles.h2}>
            Every bag has
            <br />
            a <em>unique ID.</em>
          </h2>
          <p className={styles.intro}>
            Normal recycling bags are anonymous — nobody can tell whose bag was clean and whose was
            contaminated. We print a QR code on every bag so weight, sort quality, and points all
            tie back to your account.
          </p>
          <div className={styles.bagExplainer}>
            <div className={styles.bagVisual} aria-hidden="true">
              <div className={styles.bagShape}>
                <div className={styles.bagHandle}></div>
                <div className={styles.bagTagSticker}>
                  <div className={styles.bagTagLabel}>WBCT</div>
                  <div className={styles.bagTagQr}>
                    {Array.from({ length: 49 }).map((_, i) => (
                      <span
                        key={i}
                        className={
                          [0, 1, 2, 4, 6, 7, 9, 11, 12, 13, 15, 17, 19, 20, 23, 24, 26, 28, 30, 32, 33, 35, 37, 39, 41, 42, 44, 46, 48].includes(i)
                            ? styles.bagTagQrOn
                            : styles.bagTagQrOff
                        }
                      />
                    ))}
                  </div>
                  <div className={styles.bagTagId}>#AL-0824-3F2</div>
                </div>
              </div>
            </div>
            <ol className={styles.bagSteps}>
              <li>
                <div className={styles.bagStepNum}>1</div>
                <div>
                  <h4>Printed at the depot.</h4>
                  <p>
                    Every sheet of 10 bags gets a fresh batch of QR IDs. The codes are printed on a
                    thermal label so they survive rain, soda, and a week outside.
                  </p>
                </div>
              </li>
              <li>
                <div className={styles.bagStepNum}>2</div>
                <div>
                  <h4>Scanned at intake.</h4>
                  <p>
                    When your bag arrives at the depot, we scan the code, weigh it, and rate sort
                    quality. Everything — clean weight, contamination notes, photos — ties to your
                    bag.
                  </p>
                </div>
              </li>
              <li>
                <div className={styles.bagStepNum}>3</div>
                <div>
                  <h4>Points tied to your account.</h4>
                  <p>
                    Clean material credits your points balance the next morning. A bad bag gets a
                    photo SMS so you can fix it for next week — no guessing.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Why this works */}
      <section className={`${styles.section} ${styles.sectionSky}`} id="why">
        <div className={styles.sectionInner}>
          <div className={styles.kicker}>Why this works</div>
          <h2 className={styles.h2}>
            How we can pay you
            <br />
            for <em>trash.</em>
          </h2>
          <p className={styles.intro}>
            Recycling is only expensive when it&apos;s mixed. Clean, sorted commodities trade for
            real money. Here&apos;s the gap — and how we split it with you.
          </p>
          <div className={styles.whyGrid}>
            <div className={styles.whyCard}>
              <div className={styles.whyNum}>01</div>
              <h3 className={styles.whyH}>Single-stream is dirty.</h3>
              <p className={styles.whyP}>
                Roughly <strong>1 in 4 lbs</strong> of mixed-bin recycling is contaminated by food,
                liquid, or trash. Mixed loads get sold at a steep discount — or sent to landfill.
              </p>
            </div>
            <div className={styles.whyCard}>
              <div className={styles.whyNum}>02</div>
              <h3 className={styles.whyH}>Clean streams are valuable.</h3>
              <p className={styles.whyP}>
                Separated aluminum cans, plastic bottles, milk jugs, and cardboard sell at full
                market prices. The gap between dirty and clean is{' '}
                <strong>real money sitting at your door.</strong>
              </p>
            </div>
            <div className={styles.whyCard}>
              <div className={styles.whyNum}>03</div>
              <h3 className={styles.whyH}>Bag-tagging closes the gap.</h3>
              <p className={styles.whyP}>
                Every bag has a unique QR code. We trace contamination back to the source and coach
                residents — pulling the stream <strong>from ~25% contamination toward under 2%.</strong>
              </p>
            </div>
            <div className={styles.whyCard}>
              <div className={styles.whyNum}>04</div>
              <h3 className={styles.whyH}>You share the upside.</h3>
              <p className={styles.whyP}>
                That price gap is what pays you. <strong>No commission, no middlemen.</strong>{' '}
                Roughly half of every dollar we earn on commodities goes back to residents as gift
                cards.
              </p>
            </div>
          </div>
          <div className={styles.impactPullquote}>
            &ldquo;Clean material is worth real money. <em>We just give it back to you.&rdquo;</em>
            <div className={styles.impactCite}>— The whole business model, in one sentence</div>
          </div>
        </div>
      </section>

      {/* Service reliability */}
      <section className={`${styles.section} ${styles.sectionMint}`} id="reliability">
        <div className={styles.sectionInner}>
          <div className={styles.kicker}>What you can count on</div>
          <h2 className={styles.h2}>
            Same day,
            <br />
            every week.
          </h2>
          <p className={styles.intro}>
            Door-side pickup is only useful if we show up. Here&apos;s what we commit to — and what
            happens when something goes sideways.
          </p>
          <div className={styles.reliabilityGrid}>
            <div className={styles.reliabilityCard}>
              <div className={styles.reliabilityKicker}>Pickup window</div>
              <div className={styles.reliabilityBig}>
                {/* TODO: confirm pickup day + window */}
                Thursdays · 6&nbsp;AM – 2&nbsp;PM
              </div>
              <p>
                Set your bag at your door the night before. We text you a confirmation when
                it&apos;s been picked up.
              </p>
            </div>
            <div className={styles.reliabilityCard}>
              <div className={styles.reliabilityKicker}>Rain or shine</div>
              <div className={styles.reliabilityBig}>
                {/* TODO: confirm wet-weather policy */}
                We pick up in any weather
              </div>
              <p>
                Bags are sealable and weather-tested. If a storm forces a route delay, you&apos;ll
                get an SMS the morning of with the new window.
              </p>
            </div>
            <div className={styles.reliabilityCard}>
              <div className={styles.reliabilityKicker}>If we miss you</div>
              <div className={styles.reliabilityBig}>
                {/* TODO: confirm miss guarantee */}
                Free bag credit + same-week return
              </div>
              <p>
                If we don&apos;t pick up your bag by the end of the window, we credit you a free
                bag and route a truck back within 48 hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Refer a friend */}
      <section className={`${styles.section} ${styles.sectionYellow}`} id="refer">
        <div className={styles.sectionInner}>
          <div className={styles.kicker}>Bring a friend</div>
          <h2 className={styles.h2}>
            Refer a friend.
            <br />
            <em>Get free bags.</em>
          </h2>
          <p className={styles.intro}>
            The pilot is better with neighbors. When someone you refer completes their first
            pickup, you both walk away with an extra sheet of 10 bags — on us.
          </p>
          <div className={styles.referGrid}>
            <div className={styles.referCard}>
              <div className={styles.referBadge}>You</div>
              <div className={styles.referBig}>+10 free bags</div>
              <p>
                Credited the day your friend&apos;s first bag is picked up. Stackable — refer five
                neighbors, earn five sheets.
              </p>
            </div>
            <div className={`${styles.referCard} ${styles.referCardFriend}`}>
              <div className={styles.referBadge}>Your friend</div>
              <div className={styles.referBig}>First box on us</div>
              <p>
                They join with a free welcome box of 10 bags. Same offer everyone gets — no
                catch, no commitment.
              </p>
            </div>
          </div>
          <div className={styles.referCta}>
            <Link href="/signup" className={`${styles.btn} ${styles.btnLg} ${styles.btnInk}`}>
              Sign up & get your link <span className={styles.arrow}>→</span>
            </Link>
            <div className={styles.referFinePrint}>
              Your personal referral link lives in your profile after you sign up — share via SMS,
              email, QR, or any social network.
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.section} id="faq">
        <div className={styles.sectionInner}>
          <div className={styles.kicker}>Things people ask</div>
          <h2 className={styles.h2}>
            Frequently
            <br />
            asked.
          </h2>
          <div className={styles.faq}>
            {faqs.map((f, i) => (
              <details key={i} open={f.open}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.ctaStrip}>
        <div className={styles.ctaInner}>
          <h2>
            Your trash is worth money.
            <br />
            Let&apos;s go get it.
          </h2>
          <div className={styles.ctaStripStack}>
            <Link href="/signup" className={`${styles.btn} ${styles.btnLg} ${styles.btnInk}`}>
              Get started <span className={styles.arrow}>→</span>
            </Link>
            <Link href="/signup" className={`${styles.btn} ${styles.btnLg} ${styles.btnYellow}`}>
              Order a sheet of bags <span className={styles.arrow}>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <div className={styles.footerWord}>
              We Buy
              <br />
              Clean Trash<span className={styles.footerDot}>.</span>
            </div>
            <div className={styles.footerTag}>{content.footerTagline}</div>
          </div>
          <div>
            <h5>{content.pilotAreaTitle}</h5>
            <ul>
              {content.pilotAreaCities.map((c) => (
                <li key={c.name} className={c.live ? undefined : styles.citySoon}>
                  <span
                    className={`${styles.cityDot}${c.live ? '' : ` ${styles.cityDotSoon}`}`}
                  ></span>
                  {c.name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5>Contact</h5>
            <ul>
              <li>
                {/* TODO: support email */}
                support@webuycleantrash.com
              </li>
              <li>
                {/* TODO: support phone */}
                (510) 555-0000
              </li>
              <li className={styles.footerAddr}>
                {/* TODO: business mailing address */}
                {content.contactAddressLines.map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </li>
            </ul>
          </div>
          <div>
            <h5>Product</h5>
            <ul>
              <li>
                <a href="#how">How it works</a>
              </li>
              <li>
                <a href="#accept">What we accept</a>
              </li>
              <li>
                <a href="#bags">Bag-tagging</a>
              </li>
              <li>
                <a href="#why">Why this works</a>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
            </ul>
          </div>
        </div>
        <div className={styles.legal}>
          <div>
            {/* TODO: confirm registered entity name + state of incorporation */}
            © 2026 We Buy Clean Trash, PBC · Delaware
          </div>
          <div>Privacy · Terms · Accessibility</div>
        </div>
      </footer>
    </div>
  );
}
