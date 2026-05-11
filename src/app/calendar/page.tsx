// 연간 세무 일정 (12개월) — 사업자 유형 필터.
// - 로그인 후 활성 고객사가 있으면 그 유형 자동 선택
// - ?bizType= 쿼리로 수동 전환
// - 비로그인 시에도 접근 가능 (정보성 페이지)

import Link from "next/link";
import {
  allEvents,
  eventsFor,
  groupByMonth,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
} from "@/lib/tax/calendar";
import { BIZ_TYPES, BIZ_TYPE_LABEL, isBizType, type BizType } from "@/lib/tax/bizType";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

const MONTH_LABEL = [
  "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월",
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: { bizType?: string };
}) {
  // 활성 고객사의 유형을 기본값으로 사용
  let defaultBizType: BizType | "ALL" = "ALL";
  const session = readSession();
  if (session?.activeClientId) {
    const client = await db.client.findUnique({
      where: { id: session.activeClientId },
      select: { bizType: true },
    });
    if (client && isBizType(client.bizType)) defaultBizType = client.bizType;
  }

  const selected: BizType | "ALL" = isBizType(searchParams?.bizType)
    ? searchParams!.bizType as BizType
    : searchParams?.bizType === "ALL"
      ? "ALL"
      : defaultBizType;

  const events = selected === "ALL" ? allEvents() : eventsFor(selected);
  const grouped = groupByMonth(events);
  const today = new Date();
  const thisMonth = today.getMonth() + 1;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">연간 세무 일정</h1>
          <p className="mt-1 text-sm text-slate-500">
            사업자 유형별 신고·납부 마감일. 매월 반복(원천세·4대보험)은 모든 달에 표시됩니다.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 text-xs">
          <FilterLink href="/calendar?bizType=ALL" label="전체" active={selected === "ALL"} />
          {BIZ_TYPES.map((t) => (
            <FilterLink
              key={t}
              href={`/calendar?bizType=${t}`}
              label={BIZ_TYPE_LABEL[t]}
              active={selected === t}
            />
          ))}
        </nav>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MONTH_LABEL.map((label, idx) => {
          const m = idx + 1;
          const items = grouped[m];
          const isCurrent = m === thisMonth;
          return (
            <section
              key={m}
              className={`rounded-lg border bg-white p-4 ${
                isCurrent ? "border-brand-500 ring-1 ring-brand-500" : "border-slate-200"
              }`}
            >
              <header className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">{label}</h2>
                {isCurrent && (
                  <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-medium text-white">
                    이번 달
                  </span>
                )}
              </header>
              {items.length === 0 ? (
                <p className="text-xs text-slate-400">해당 사항 없음</p>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((e) => (
                    <li
                      key={e.id}
                      className={`rounded border px-2 py-1.5 text-xs ${CATEGORY_COLOR[e.category]}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{e.title}</span>
                        <span className="font-mono text-[10px]">~{e.day}일</span>
                      </div>
                      <div className="mt-0.5 text-[10px] opacity-70">
                        {CATEGORY_LABEL[e.category]} · {e.detail}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <footer className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        본 일정은 일반적인 마감일이며, 휴일·천재지변 시 국세청 고시로 연장될 수 있습니다. 정확한
        기한은{" "}
        <Link href="https://www.hometax.go.kr" className="underline">
          홈택스
        </Link>{" "}
        공지를 확인하세요.
      </footer>
    </div>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded bg-brand-600 px-2 py-1 font-semibold text-white"
          : "rounded border border-slate-300 px-2 py-1 text-slate-600 hover:border-brand-500 hover:text-brand-600"
      }
    >
      {label}
    </Link>
  );
}
