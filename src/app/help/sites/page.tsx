import Link from "next/link";
import { SITES } from "@/lib/help/sites";

export default function HelpSitesPage({
  searchParams,
}: {
  searchParams?: { site?: string };
}) {
  const activeId = searchParams?.site ?? SITES[0].id;
  const active = SITES.find((s) => s.id === activeId) ?? SITES[0];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-800">정부 사이트 사용 가이드</h1>
        <p className="mt-1 text-sm text-slate-500">
          홈택스·위택스·4대보험·근로복지공단 — 처음 쓰시는 분도 따라할 수 있는 단계별 안내.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        {SITES.map((s) => (
          <Link
            key={s.id}
            href={`?site=${s.id}`}
            className={`rounded-md border px-3 py-1.5 ${
              active.id === s.id
                ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
                : "border-slate-300 bg-white text-slate-600 hover:border-brand-300"
            }`}
          >
            {s.name}
          </Link>
        ))}
      </nav>

      <article className="space-y-5 rounded-lg border-2 border-slate-300 bg-white p-6 shadow-sm">
        {/* 헤더 — 사이트 이름·URL·목적 */}
        <header className="border-b-2 border-slate-800 pb-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-2xl font-bold text-slate-900">{active.name}</h2>
            <a
              href={active.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-600 hover:underline"
            >
              🔗 {active.url}
            </a>
          </div>
          <p className="mt-1 text-sm text-slate-600">{active.purpose}</p>
        </header>

        {/* 처음 사용 — 가입·인증 */}
        <Section icon="🚪" title="처음 사용 (가입·인증)">
          <Sub title="가입 절차">
            <List items={active.signup} />
          </Sub>
          <Sub title="로그인 방법">
            <List items={active.loginMethods} />
          </Sub>
          <Sub title="사전 준비물">
            <List items={active.prepare} />
          </Sub>
        </Section>

        {/* 자주 쓰는 메뉴 */}
        <Section icon="📍" title="자주 쓰는 메뉴 위치">
          <div className="space-y-3">
            {active.mainMenus.map((m) => (
              <div key={m.name} className="rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-800">{m.name}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {m.path.map((p, i) => (
                    <span key={i}>
                      {i > 0 && <span className="mx-1 text-slate-400">›</span>}
                      <span className="font-medium">{p}</span>
                    </span>
                  ))}
                </p>
                <p className="mt-1 text-xs text-slate-500">→ {m.usedFor}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* FAQ */}
        <Section icon="❓" title="자주 묻는 질문">
          <div className="space-y-3">
            {active.faqs.map((f, i) => (
              <details key={i} className="rounded border border-slate-200 p-3" open>
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  Q. {f.q}
                </summary>
                <p className="mt-2 text-sm text-slate-700">A. {f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* 팁 */}
        <Section icon="💡" title="알아두면 좋은 팁">
          <List items={active.tips} />
        </Section>

        <footer className="space-y-3">
          {active.id === "hometax" && (
            <div className="rounded border border-brand-200 bg-brand-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-brand-800">📺 화면별 상세 따라하기</h3>
              <Link
                href="/help/walkthrough/vat-1h-final-sole"
                className="inline-block rounded-md bg-white border border-brand-300 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-100"
              >
                → 부가세 1기 확정신고 (개인 일반과세) 9단계 워크스루
              </Link>
              <p className="mt-1 text-xs text-slate-600">
                실제 홈택스 화면을 따라 단계별로. 캡쳐 자리도 마련됨 (직접 추가).
              </p>
            </div>
          )}
          <div className="rounded bg-brand-50 p-4 text-center">
            <a
              href={active.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              🔗 {active.name} 바로가기
            </a>
          </div>
        </footer>
      </article>

      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        ⚠️ 사이트 UI는 수시로 개편됩니다. 메뉴 위치가 다르면 우측 상단 검색창에 메뉴명 입력으로 찾으세요.
        본 안내는 2025년 기준입니다.
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

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 first:mt-0">
      <p className="text-xs font-semibold text-slate-600">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="ml-5 space-y-0.5 text-sm text-slate-700 list-disc">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
