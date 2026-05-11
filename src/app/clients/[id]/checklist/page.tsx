// 고객사별 세무 체크리스트 — 다가오는 90일 이내 신고·납부 항목.
// 사업자 유형에 따라 자동 필터.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import {
  eventsFor,
  upcoming,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  BIZ_TYPE_LABEL,
  type BizType,
} from "@/lib/tax/calendar";

const BIZ_TYPES: BizType[] = ["CORPORATION", "SOLE_GENERAL", "SOLE_SIMPLIFIED", "SOLE_TAX_FREE"];

function isValidBizType(v: unknown): v is BizType {
  return typeof v === "string" && (BIZ_TYPES as string[]).includes(v);
}

function urgencyOf(daysUntil: number): {
  label: string;
  className: string;
} {
  if (daysUntil < 0) return { label: "지연", className: "bg-red-100 text-red-700" };
  if (daysUntil <= 7) return { label: "임박", className: "bg-orange-100 text-orange-700" };
  if (daysUntil <= 30) return { label: "이번달", className: "bg-amber-100 text-amber-700" };
  return { label: "예정", className: "bg-slate-100 text-slate-600" };
}

export default async function ChecklistPage({
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
      if (e.status === 401) redirect(`/login?next=/clients/${encodeURIComponent(params.id)}/checklist`);
      notFound();
    }
    throw e;
  }

  if (!isValidBizType(client.bizType)) {
    // 데이터 손상 — 안내
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        고객사 사업자 유형이 비정상입니다: {String(client.bizType)}
      </div>
    );
  }

  const horizonDays = Number(searchParams?.horizon) || 90;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events = eventsFor(client.bizType);
  const items = upcoming(events, today, horizonDays);

  return (
    <div className="space-y-5">
      <header>
        <Link href={`/clients/${client.id}`} className="text-xs text-brand-600 hover:underline">
          ← {client.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">세무 체크리스트</h1>
        <p className="mt-1 text-sm text-slate-500">
          {BIZ_TYPE_LABEL[client.bizType]} · 다가오는 {horizonDays}일 이내 신고·납부 항목
        </p>
      </header>

      <nav className="flex gap-1 text-xs">
        {[30, 90, 180, 365].map((d) => {
          const active = d === horizonDays;
          return (
            <Link
              key={d}
              href={`?horizon=${d}`}
              className={
                active
                  ? "rounded bg-brand-600 px-2 py-1 font-semibold text-white"
                  : "rounded border border-slate-300 px-2 py-1 text-slate-600 hover:border-brand-500"
              }
            >
              {d}일
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          해당 기간 내 마감 항목이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => {
            const daysUntil = Math.ceil((e.due.getTime() - today.getTime()) / 86400000);
            const urg = urgencyOf(daysUntil);
            return (
              <li
                key={`${e.id}-${e.due.toISOString()}`}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${CATEGORY_COLOR[e.category]}`}
                      >
                        {CATEGORY_LABEL[e.category]}
                      </span>
                      <h2 className="text-sm font-semibold text-slate-800">{e.title}</h2>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{e.detail}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm text-slate-700">
                      {e.due.toISOString().slice(0, 10)}
                    </div>
                    <div className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] ${urg.className}`}>
                      {urg.label}
                      {daysUntil >= 0 ? ` D-${daysUntil}` : ` ${daysUntil}일 경과`}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
