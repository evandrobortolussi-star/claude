export function ComingSoon({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-card">
      <span className="text-4xl">{icon}</span>
      <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      <p className="max-w-xs text-sm text-slate-500">{description}</p>
    </div>
  );
}
