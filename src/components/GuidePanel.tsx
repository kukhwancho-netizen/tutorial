import type { Guide } from "@/lib/tax/guides";

export function GuidePanel({ guide }: { guide: Guide }) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-5 text-sm leading-relaxed">
      <h2 className="mb-2 text-base font-semibold text-brand-700">{guide.title}</h2>
      <p className="mb-3 text-slate-700">{guide.summary}</p>
      <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        신고 기간
      </h3>
      <ul className="ml-4 list-disc space-y-1 text-slate-700">
        {guide.filingPeriods.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        체크포인트
      </h3>
      <ul className="ml-4 list-disc space-y-1 text-slate-700">
        {guide.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </aside>
  );
}
