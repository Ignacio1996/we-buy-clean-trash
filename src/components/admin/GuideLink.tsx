export function GuideLink({ href, label = 'View testing guide' }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
    >
      <span>📖</span>
      <span>{label}</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}
