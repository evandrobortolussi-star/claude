import Link from 'next/link';

export function SectionLink({
  href,
  icon,
  label,
  description,
  badge,
}: {
  href: string;
  icon: string;
  label: string;
  description?: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card active:bg-slate-50"
    >
      <span className="text-xl">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      {!!badge && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{badge}</span>
      )}
      <span className="text-slate-300">›</span>
    </Link>
  );
}
