import Link from 'next/link';
import styles from './landing.module.css';
import { LiveTicker } from './LiveTicker';

const MARQUEE_ITEMS = [
  'Aluminum $1.42 / lb',
  'PET $0.18 / lb',
  'HDPE $0.22 / lb',
  'Cardboard $0.06 / lb',
  'Glass $0.04 / lb',
  'Steel $0.09 / lb',
  'Mixed paper $0.05 / lb',
];

type Commodity = {
  code: string;
  name: string;
  price: string;
  unit: string;
  accept: string;
  bg: string;
  fg?: string;
  borderColor?: string;
  soon?: boolean;
};

const COMMODITIES: Commodity[] = [
  {
    code: 'Al',
    name: 'Aluminum',
    price: '$1.42',
    unit: 'per lb',
    accept: 'Cans · foil · trays',
    bg: '#ECECEC',
  },
  {
    code: 'P1',
    name: 'PET (#1)',
    price: '$0.18',
    unit: 'per lb',
    accept: 'Water · soda · juice bottles',
    bg: 'var(--sky)',
  },
  {
    code: 'P2',
    name: 'HDPE (#2)',
    price: '$0.22',
    unit: 'per lb',
    accept: 'Milk jugs · detergent · shampoo',
    bg: 'var(--mint)',
  },
  {
    code: 'Cb',
    name: 'Cardboard',
    price: '$0.06',
    unit: 'per lb',
    accept: 'Flattened only · no wax coating',
    bg: 'var(--peach)',
  },
  {
    code: 'Gl',
    name: 'Glass',
    price: '$0.04',
    unit: 'per lb',
    accept: 'Clear · brown · green bottles',
    bg: 'var(--yellow)',
  },
  {
    code: 'St',
    name: 'Steel',
    price: '$0.09',
    unit: 'per lb',
    accept: 'Soup cans · food tins · empty aerosol',
    bg: '#ECECEC',
  },
  {
    code: 'Mp',
    name: 'Mixed paper',
    price: '$0.05',
    unit: 'per lb',
    accept: 'Newspaper · office · magazines',
    bg: 'var(--sky)',
  },
  {
    code: '×',
    name: 'Not yet',
    price: "Coming '26",
    unit: 'on the roadmap',
    accept: 'E-waste · textiles · #5 polypropylene',
    bg: 'var(--brand)',
    fg: '#fff',
    soon: true,
  },
];

const FAQS = [
  {
    q: 'How much can I actually make?',
    a: 'A typical 2-person household earns $8–14 per month. Aluminum-heavy households (lots of seltzer or beer cans) can clear $20+. We pay weekly into points; 100,000 points = $10 gift card.',
    open: true,
  },
  {
    q: "What's the catch?",
    a: 'No catch, no commission. We make money by selling clean, sorted commodities at higher prices than dirty single-stream gets. By bag-tagging the stream, we cut contamination from 25% to under 2% — and split the upside with you.',
  },
  {
    q: 'Do bags cost money?',
    a: '$8 per sheet of 10 bags. Free shipping over $20. Your first sheet pays for itself in about 4 weeks of normal household recycling.',
  },
  {
    q: 'What if my bag has the wrong stuff in it?',
    a: 'Mild contamination — we sort it out at the depot and credit you for the clean portion. Heavy contamination (food, liquid, garbage) means the bag is rejected and returned. We text you a photo so you can fix it for next week.',
  },
  {
    q: 'Where do you operate?',
    a: "Oakland, Berkeley, Emeryville, Alameda, and the eastern San Francisco peninsula. We're launching Sacramento and San Jose in summer 2026. Drop your zip in the footer to join the waitlist for new cities.",
  },
  {
    q: 'How do you pay out?',
    a: "Gift cards (Amazon, Walmart, Target, Visa, REI, and 40+ more) at 1,000 points = $1. Instant delivery to your email. We're piloting direct bank deposit (ACH) for power users in Q3.",
  },
];

export function LandingPage() {
  return (
    <div className={styles.root}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <div className={styles.topbarWord}>
          We Buy Clean Trash<span className={styles.topbarDot}>.</span>
        </div>
        <nav className={styles.topbarNav}>
          <a href="#how">How it works</a>
          <a href="#accept">What we take</a>
          <a href="#impact">Impact</a>
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
            <div className={styles.eyebrow}>Curbside · zero commission · weekly</div>
            <h1 className={styles.heroTitle}>
              We pay you
              <br />
              for your <em>trash.</em>
            </h1>
            <p className={styles.lede}>
              Bag your aluminum, PET, glass, and cardboard. We pick it up at the curb every week and
              pay you in gift cards. No sorting centers. No bins to lug.
            </p>
            <div className={styles.ctaRow}>
              <Link href="/signup" className={`${styles.btn} ${styles.btnLg} ${styles.btnBrand}`}>
                Get started <span className={styles.arrow}>→</span>
              </Link>
              <Link href="/scan" className={`${styles.btn} ${styles.btnLg}`}>
                Check your zip <span className={styles.arrow}>→</span>
              </Link>
            </div>
          </div>
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
              <span>PET · 4.2 lbs</span>
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
              <span className={styles.stepTag}>5 minutes</span>
              <h3>Order bags</h3>
              <p>
                Pick a sheet of 10 bags from the app. Free shipping over $20. Bags arrive in 3 days.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <span className={styles.stepTag}>As you go</span>
              <h3>Fill &amp; set out</h3>
              <p>
                Clean, dry recyclables only. Tap &ldquo;set out for pickup&rdquo; the night before.
                Curb by 5:30 PM.
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
          <div className={styles.kicker}>Live rates · updated daily</div>
          <h2 className={styles.h2}>What we take.</h2>
          <p className={styles.intro}>
            Seven commodities, clean only. Rinse it out and let it dry — that&apos;s it. We don&apos;t
            take anything contaminated by food, oil, or paint.
          </p>
          <div className={styles.commodities}>
            {COMMODITIES.map((c) => (
              <div
                key={c.name}
                className={`${styles.commodity}${c.soon ? ` ${styles.commoditySoon}` : ''}`}
              >
                <div
                  className={styles.commodityIcon}
                  style={{
                    background: c.bg,
                    ...(c.fg ? { color: c.fg } : {}),
                  }}
                >
                  {c.code}
                </div>
                <h4>{c.name}</h4>
                <div className={styles.commodityPrice}>{c.price}</div>
                <div className={styles.commodityUnit}>{c.unit}</div>
                <div className={styles.commodityAccept}>{c.accept}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live ticker */}
      <section className={styles.tickerSection} id="ticker">
        <div className={styles.sectionInner}>
          <div className={`${styles.kicker} ${styles.tickerKicker}`}>
            Live · across the network
          </div>
          <h2 className={`${styles.h2} ${styles.tickerH2}`}>
            Right now, somebody is
            <br />
            turning trash into <em>cash.</em>
          </h2>
          <LiveTicker />
          <div className={styles.tickerFooter}>
            <div className={styles.tickerLive}>Live feed · 1,284 pickups today</div>
            <div>Updated every 12 seconds</div>
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className={`${styles.section} ${styles.sectionSky}`} id="impact">
        <div className={styles.sectionInner}>
          <div className={styles.kicker}>Since launch · 2023</div>
          <h2 className={styles.h2}>
            The pile we
            <br />
            didn&apos;t bury.
          </h2>
          <p className={styles.intro}>
            Every bag we pick up is one that didn&apos;t go to landfill or get burned. Here&apos;s
            the running total.
          </p>
          <div className={styles.impactGrid}>
            <div className={styles.impactCell}>
              <div className={styles.impactNum}>3.4M</div>
              <div className={styles.impactLabel}>lbs recycled</div>
            </div>
            <div className={styles.impactCell}>
              <div className={styles.impactNum}>$840k</div>
              <div className={styles.impactLabel}>paid to residents</div>
            </div>
            <div className={styles.impactCell}>
              <div className={styles.impactNum}>18,420</div>
              <div className={styles.impactLabel}>trees saved</div>
            </div>
            <div className={styles.impactCell}>
              <div className={styles.impactNum}>5.6M</div>
              <div className={styles.impactLabel}>gal water saved</div>
            </div>
          </div>
          <div className={styles.impactPullquote}>
            &ldquo;Single-stream recycling has a 25% contamination rate on average.{' '}
            <em>Our bag-tagged stream sits at 1.8%.</em> Clean material is worth real money — we
            just give it back to you.&rdquo;
            <div className={styles.impactCite}>— Internal sort report · Q1 2026</div>
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
            {FAQS.map((f, i) => (
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
            <div className={styles.footerTag}>
              Curbside, zero-commission residential recycling. Founded 2023 · Oakland, CA.
            </div>
          </div>
          <div>
            <h5>Service area</h5>
            <ul>
              <li>
                <span className={styles.cityDot}></span>Oakland
              </li>
              <li>
                <span className={styles.cityDot}></span>Berkeley
              </li>
              <li>
                <span className={styles.cityDot}></span>Emeryville
              </li>
              <li>
                <span className={styles.cityDot}></span>Alameda
              </li>
              <li className={styles.citySoon}>
                <span className={`${styles.cityDot} ${styles.cityDotSoon}`}></span>Sacramento ·
                Jul &apos;26
              </li>
              <li className={styles.citySoon}>
                <span className={`${styles.cityDot} ${styles.cityDotSoon}`}></span>San Jose · Sep
                &apos;26
              </li>
            </ul>
          </div>
          <div>
            <h5>Product</h5>
            <ul>
              <li>How it works</li>
              <li>What we accept</li>
              <li>Live rates</li>
              <li>For property managers</li>
              <li>For municipalities</li>
            </ul>
          </div>
          <div>
            <h5>Company</h5>
            <ul>
              <li>About</li>
              <li>Careers</li>
              <li>Press</li>
              <li>Contact</li>
              <li>Help center</li>
            </ul>
          </div>
        </div>
        <div className={styles.legal}>
          <div>© 2026 We Buy Clean Trash, PBC.</div>
          <div>Privacy · Terms · Accessibility</div>
        </div>
      </footer>
    </div>
  );
}
