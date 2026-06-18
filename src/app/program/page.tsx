import Link from 'next/link';

const CARDS = [
  {
    href: '/program/reports',
    title: 'Diversion reports',
    body: 'Monthly + all-time food-scrap diversion by site. Download CSV or print a PDF for the City.',
    icon: '📈',
  },
  {
    href: '/program/commercial-accounts',
    title: 'Commercial sites',
    body: 'The site directory — add, edit, pause for the season, or archive sites and their bins.',
    icon: '🏢',
  },
  {
    href: '/program/destinations',
    title: 'Drop-off destinations',
    body: 'Composting facilities the route delivers to, and who gets the "on the way" text.',
    icon: '📍',
  },
] as const;

export default function ProgramDashboardPage() {
  return (
    <div>
      <header className="mb-6">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          Compost Clubhouse
        </span>
        <h1 className="mt-2 text-2xl font-semibold text-white">Program manager</h1>
        <p className="mt-1 text-xs text-gray-500">
          Everything for the Compost Clubhouse + City of Columbus food-scrap program in one place.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10"
          >
            <div className="text-2xl">{c.icon}</div>
            <div className="mt-3 text-sm font-semibold text-white">{c.title}</div>
            <div className="mt-1 text-xs text-gray-500">{c.body}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
