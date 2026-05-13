import Link from "next/link";
import { INDUSTRIES, findIndustry } from "@/lib/help/industries";

export default function IndustryHelpPage({
  searchParams,
}: {
  searchParams?: { id?: string };
}) {
  const active = findIndustry(searchParams?.id ?? "") ?? INDUSTRIES[0];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-800">업종별 맞춤 안내</h1>
        <p className="mt-1 text-sm text-slate-500">
          같은 부가세·종소세라도 업종에 따라 챙길 항목·특례·자주 빠뜨리는 부분이 다릅니다.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        {INDUSTRIES.map((ind) => (
          <Link
            key={ind.id}
            href={`?id=${ind.id}`}
            className={`rounded-md border px-3 py-2 ${
              active.id === ind.id
                ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
                : "border-slate-300 bg-white text-slate-600 hover:border-brand-300"
            }`}
          >
            <span className="mr-1">{ind.emoji}</span>
            {ind.name}
          </Link>
        ))}
      </nav>

      <article className="space-y-5 rounded-lg border-2 border-slate-300 bg-white p-6 shadow-sm">
        <header className="border-b-2 border-slate-800 pb-4">
          <h2 className="text-2xl font-bold text-slate-900">
            <span className="mr-2">{active.emoji}</span>
            {active.name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{active.summary}</p>
        </header>

        {/* 필수 신고 */}
        <Section icon="📅" title="꼭 해야 할 신고">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-300">
                <th className="py-1 text-left font-normal">신고</th>
                <th className="py-1 text-left font-normal">언제</th>
                <th className="py-1 text-left font-normal">메모</th>
              </tr>
            </thead>
            <tbody>
              {active.mustFile.map((m, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1.5 font-medium text-slate-800">{m.name}</td>
                  <td className="py-1.5 font-mono text-brand-700">{m.when}</td>
                  <td className="py-1.5 text-xs text-slate-500">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 특례 */}
        <Section icon="✨" title="업종 특례 / 핵심 절세">
          <div className="space-y-3">
            {active.specialties.map((s, i) => (
              <div key={i} className="rounded border border-brand-200 bg-brand-50 p-3">
                <h4 className="text-sm font-bold text-brand-800">{s.title}</h4>
                <p className="mt-1 text-sm text-slate-700">{s.detail}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 자주 빠뜨리는 항목 */}
        <Section icon="⚠️" title="자주 빠뜨리는 항목 (체크 필수)">
          <ul className="ml-5 space-y-1 text-sm text-slate-700 list-disc">
            {active.oftenMissed.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Section>

        {/* 영수증·증빙 */}
        <Section icon="📋" title="이건 꼭 챙기세요 (영수증·증빙)">
          <ul className="ml-5 space-y-1 text-sm text-slate-700 list-disc">
            {active.receipts.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Section>

        {/* 시스템 활용법 */}
        <Section icon="💡" title="이 시스템에서 어떻게 쓰면 좋은가">
          <ul className="ml-5 space-y-1 text-sm text-slate-700 list-disc">
            {active.systemTips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Section>
      </article>

      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        ⚠️ 본 안내는 일반적 기준입니다. 사업 규모·구조에 따라 다를 수 있으니 큰 변경 시 세무사 상담 권장.
      </p>
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1 text-sm font-bold text-slate-800">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </section>
  );
}
