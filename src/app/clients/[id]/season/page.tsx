// 다가오는 신고 시즌 카드 — 일정·방식·리스크 중심.
// 계산이나 자료 자동집계가 아니라, "언제 / 어떻게 / 안 하면 어떻게 되는지" 한눈에.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { eventsFor, upcoming, CATEGORY_LABEL } from "@/lib/tax/calendar";
import { isBizType, BIZ_TYPE_LABEL } from "@/lib/tax/bizType";
import { getFilingMeta } from "@/lib/tax/filingMeta";

export default async function SeasonPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { horizon?: string };
}) {
  let client;
  try {
    ({ client } = await requireClientAccess(params.id));
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.status === 401) redirect(`/login?next=/clients/${params.id}/season`);
      notFound();
    }
    throw e;
  }

  if (!isBizType(client.bizType)) {
    return <p className="text-sm text-red-600">사업자 유형이 비정상입니다.</p>;
  }

  const horizon = Number(searchParams?.horizon ?? 180);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = upcoming(eventsFor(client.bizType), today, horizon);

  return (
    <div className="space-y-5">
      <header>
        <Link href={`/clients/${client.id}`} className="text-xs text-brand-600 hover:underline">
          ← {client.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">다가오는 신고 시즌</h1>
        <p className="mt-1 text-sm text-slate-500">
          {BIZ_TYPE_LABEL[client.bizType]} · {horizon}일 이내 마감 항목.
          각 카드에 일정·신고 방식·미신고 리스크가 한 화면에 정리됨.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-xs">
        {[30, 90, 180, 365].map((d) => (
          <Link
            key={d}
            href={`?horizon=${d}`}
            className={`rounded border px-2 py-1 ${
              d === horizon
                ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
                : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            {d}일 이내
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          ✅ {horizon}일 이내 마감 항목 없음. 여유 있게 다음 시즌 준비 시작하세요.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((e) => {
            const daysUntil = Math.ceil((e.due.getTime() - today.getTime()) / 86400000);
            const meta = getFilingMeta(e.id);
            return (
              <FilingCard
                key={`${e.id}-${e.due.toISOString()}`}
                title={e.title}
                category={CATEGORY_LABEL[e.category]}
                detail={e.detail}
                due={e.due.toISOString().slice(0, 10)}
                daysUntil={daysUntil}
                meta={meta}
                clientId={client.id}
              />
            );
          })}
        </div>
      )}

      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        ⚠️ 본 페이지는 안내용입니다. 마감일이 공휴일/주말이면 다음 영업일까지 자동 연장.
        가산세율·면제 기준 등 세부는 국세청 고시 확인 필요.
      </p>
    </div>
  );
}

function FilingCard({
  title,
  category,
  detail,
  due,
  daysUntil,
  meta,
  clientId,
}: {
  title: string;
  category: string;
  detail: string;
  due: string;
  daysUntil: number;
  meta: ReturnType<typeof getFilingMeta>;
  clientId: string;
}) {
  // 임박도 색상
  const urgency =
    daysUntil < 0
      ? { label: "지연", bg: "bg-red-600", text: "text-white", border: "border-red-300", banner: "bg-red-50 text-red-800" }
      : daysUntil <= 7
        ? { label: "임박", bg: "bg-orange-600", text: "text-white", border: "border-orange-300", banner: "bg-orange-50 text-orange-800" }
        : daysUntil <= 30
          ? { label: "이번달", bg: "bg-amber-500", text: "text-white", border: "border-amber-300", banner: "bg-amber-50 text-amber-800" }
          : { label: "예정", bg: "bg-slate-500", text: "text-white", border: "border-slate-300", banner: "bg-slate-50 text-slate-700" };

  return (
    <article className={`rounded-lg border-2 bg-white shadow-sm ${urgency.border}`}>
      {/* 상단 헤더 — D-카운트 + 제목 */}
      <header className={`flex flex-wrap items-center gap-3 px-5 py-3 ${urgency.banner}`}>
        <div className="flex flex-col items-center justify-center">
          <span className={`rounded-md ${urgency.bg} px-3 py-1 font-mono text-lg font-bold ${urgency.text}`}>
            {daysUntil >= 0 ? `D-${daysUntil}` : `${-daysUntil}일 경과`}
          </span>
          <span className="mt-1 text-[10px] font-semibold">{urgency.label}</span>
        </div>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wide opacity-70">{category} · 마감 {due}</p>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-0.5 text-xs opacity-80">{detail}</p>
        </div>
      </header>

      {/* 본문: 방식 + 리스크 */}
      <div className="grid gap-0 md:grid-cols-2">
        {/* 어떻게 신고하나 */}
        <section className="border-t border-slate-200 p-5 md:border-r md:border-t-0">
          <h3 className="mb-2 flex items-center gap-1 text-sm font-bold text-slate-800">
            📝 어떻게 신고하나
          </h3>
          {meta ? (
            <>
              {/* 홈택스 경로 */}
              <p className="mb-2 text-xs text-slate-600">
                {meta.path.map((p, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mx-1 text-slate-300">›</span>}
                    <span className="font-medium">{p}</span>
                  </span>
                ))}
              </p>
              {/* 핵심 단계 */}
              <ol className="ml-4 space-y-1 text-sm text-slate-700">
                {meta.steps.map((s, i) => (
                  <li key={i} className="list-decimal">{s}</li>
                ))}
              </ol>
              {/* 사전 준비물 */}
              {meta.prepare && meta.prepare.length > 0 && (
                <div className="mt-3 rounded bg-slate-50 p-2 text-xs">
                  <p className="font-semibold text-slate-600">📋 사전 준비물</p>
                  <ul className="mt-1 ml-4 space-y-0.5 list-disc text-slate-600">
                    {meta.prepare.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500">신고 방식 정보가 등록되어 있지 않음</p>
          )}
        </section>

        {/* 안 하면 어떻게 되나 */}
        <section className="border-t border-slate-200 p-5">
          <h3 className="mb-2 flex items-center gap-1 text-sm font-bold text-red-700">
            ⚠️ 신고 안 하거나 늦으면
          </h3>
          {meta?.risks && meta.risks.length > 0 ? (
            <ul className="ml-4 space-y-1 list-disc text-sm text-slate-700">
              {meta.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">리스크 정보가 등록되어 있지 않음</p>
          )}
        </section>
      </div>

      {/* 액션 버튼 */}
      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm">
        {meta?.hometaxUrl && (
          <a
            href={meta.hometaxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
          >
            🔗 사이트 바로가기
          </a>
        )}
        <Link
          href={`/help/sites?site=${siteIdForCategory(category)}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:border-brand-500"
        >
          📘 처음이세요? 사이트 사용법
        </Link>
        {meta?.wetaxUrl && (
          <a
            href={meta.wetaxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:border-brand-500"
          >
            🔗 위택스 (지방세)
          </a>
        )}
        <Link
          href={`/clients/${clientId}/filing-guide?type=${guideTypeForEvent(category)}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:border-brand-500"
        >
          📘 상세 가이드 (자료 자동 집계 포함)
        </Link>
      </footer>
    </article>
  );
}

function guideTypeForEvent(category: string): string {
  if (category.includes("부가")) return "vat";
  if (category.includes("법인")) return "corporate";
  if (category.includes("소득")) return "income";
  if (category.includes("원천")) return "withholding";
  if (category.includes("사업장")) return "business-status";
  return "vat";
}

function siteIdForCategory(category: string): string {
  if (category.includes("4대보험")) return "si4n";
  if (category.includes("보수총액") || category.includes("산재")) return "comwel";
  return "hometax"; // 부가세·소득세·법인세·원천세·사업장현황 모두 홈택스
}
