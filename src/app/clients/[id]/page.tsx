import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { aggregateVat } from "@/lib/accounting/journal";
import { findAnomalies, type Anomaly } from "@/lib/accounting/anomaly";
import { fmt } from "@/lib/format";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { year?: string };
}) {
  let client;
  try {
    ({ client } = await requireClientAccess(params.id));
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.status === 401) redirect(`/login?next=/clients/${encodeURIComponent(params.id)}`);
      // 403/404는 둘 다 notFound로 — 보안상 "존재하지만 권한없음"을 노출하지 않는다.
      notFound();
    }
    throw e;
  }

  const year = Number(searchParams?.year) || new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const vat = await aggregateVat({ clientId: client.id, from: yearStart, to: yearEnd });

  const recentEntries = await db.journalEntry.findMany({
    where: { clientId: client.id },
    orderBy: { occurredOn: "desc" },
    take: 10,
    include: { lines: { include: { account: true } } },
  });

  const anomalies = await findAnomalies(client.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{client.name}</h1>
          <p className="text-sm text-slate-500">
            사업자번호 <span className="font-mono">{client.bizNo}</span> · 대표 {client.ownerName}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <a
            href={`/clients/${client.id}/season`}
            className="rounded-md border-2 border-brand-500 bg-brand-600 px-3 py-1.5 font-semibold text-white hover:bg-brand-700"
          >
            🎯 다가오는 시즌
          </a>
          <a
            href={`/clients/${client.id}/checklist`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:border-brand-500 hover:text-brand-600"
          >
            세무 체크리스트
          </a>
          <a
            href={`/clients/${client.id}/reports`}
            className="rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-brand-700 hover:border-brand-500"
          >
            📊 신고 자료
          </a>
          <a
            href={`/clients/${client.id}/filing-guide`}
            className="rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-brand-700 hover:border-brand-500"
          >
            📘 신고 가이드
          </a>
          <a
            href={`/clients/${client.id}/payroll`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:border-brand-500 hover:text-brand-600"
          >
            급여명세서
          </a>
          <a
            href={`/clients/${client.id}/import`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:border-brand-500 hover:text-brand-600"
          >
            엑셀 임포트
          </a>
          <a
            href={`/clients/${client.id}/journal/new`}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
          >
            + 분개 입력
          </a>
        </nav>
      </header>

      {anomalies.length > 0 && (
        <section className="space-y-2">
          {anomalies.map((a, i) => (
            <AnomalyBanner key={i} a={a} />
          ))}
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{year}년 부가세 집계</h2>
          <div className="flex gap-1 text-xs">
            {[year - 1, year, year + 1].map((y) => (
              <a
                key={y}
                href={`?year=${y}`}
                className={
                  y === year
                    ? "rounded bg-brand-50 px-2 py-1 font-semibold text-brand-700"
                    : "rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
                }
              >
                {y}
              </a>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Stat label="매출 공급가액" value={vat.salesSupply} />
          <Stat label="매출세액" value={vat.salesVat} />
          <Stat label="매입 공급가액" value={vat.purchaseSupply} />
          <Stat label="매입세액" value={vat.purchaseVat} />
        </div>
        <div className="mt-3 border-t border-slate-200 pt-3 text-right text-base font-semibold text-brand-700">
          {vat.payable >= 0 ? "납부세액" : "환급세액"} {fmt(Math.abs(vat.payable))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">최근 분개</h2>
        {recentEntries.length === 0 ? (
          <p className="text-sm text-slate-500">아직 등록된 전표가 없습니다.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentEntries.map((e) => (
              <li key={e.id} className="rounded border border-slate-100 p-3 hover:border-brand-300">
                <a
                  href={`/clients/${client.id}/journal/${e.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between text-slate-600">
                    <span>
                      {e.occurredOn.toISOString().slice(0, 10)}
                      {e.receiptImage && (
                        <span className="ml-2 text-xs text-brand-600" title="영수증 첨부됨">📎</span>
                      )}
                    </span>
                    <span>{e.counterparty}</span>
                  </div>
                  <div className="mt-1 text-slate-800">{e.description}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    {e.lines
                      .filter((l) => l.debit > 0)
                      .map((l) => (
                        <div key={l.id} className="font-mono">
                          {l.account.name} <span className="text-slate-400">차변</span> {fmt(l.debit)}
                        </div>
                      ))}
                  </div>
                  <div>
                    {e.lines
                      .filter((l) => l.credit > 0)
                      .map((l) => (
                        <div key={l.id} className="font-mono">
                          {l.account.name} <span className="text-slate-400">대변</span> {fmt(l.credit)}
                        </div>
                      ))}
                  </div>
                </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AnomalyBanner({ a }: { a: Anomaly }) {
  const style =
    a.severity === "alert"
      ? "border-red-200 bg-red-50 text-red-800"
      : a.severity === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-700";
  const icon = a.severity === "alert" ? "🚨" : a.severity === "warn" ? "⚠" : "ℹ";
  return (
    <div className={`rounded-md border p-3 text-sm ${style}`}>
      <p className="font-semibold">{icon} {a.title}</p>
      <p className="mt-1 text-xs">{a.detail}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-base">{fmt(value)}</div>
    </div>
  );
}
