import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";

const PERIODS = [
  { id: "Q1", label: "1분기 (1~3월)", from: 0, to: 3 },
  { id: "1H", label: "상반기 (1~6월)", from: 0, to: 6 },
  { id: "Q3", label: "3분기 (7~9월)", from: 6, to: 9 },
  { id: "2H", label: "하반기 (7~12월)", from: 6, to: 12 },
  { id: "FY", label: "연간 (1~12월)", from: 0, to: 12 },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { period?: string; year?: string };
}) {
  let client;
  try {
    ({ client } = await requireClientAccess(params.id));
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.status === 401) redirect(`/login?next=/clients/${params.id}/reports`);
      notFound();
    }
    throw e;
  }

  const year = Number(searchParams?.year ?? new Date().getFullYear());
  const periodId: PeriodId = (PERIODS.find((p) => p.id === searchParams?.period)?.id ?? "1H") as PeriodId;
  const period = PERIODS.find((p) => p.id === periodId)!;
  const from = new Date(year, period.from, 1);
  const to = new Date(year, period.to, 1);

  const entries = await db.journalEntry.findMany({
    where: { clientId: client.id, occurredOn: { gte: from, lt: to } },
    orderBy: { occurredOn: "asc" },
  });

  // 거래처별 매출 합계
  const salesByPartner = new Map<string, { supply: number; vat: number; count: number }>();
  const purchByPartner = new Map<string, { supply: number; vat: number; count: number }>();
  const expenseByCategory = new Map<string, { supply: number; count: number }>();
  let salesSupply = 0, salesVat = 0, purchSupply = 0, purchVat = 0;
  let taxFreeSales = 0;

  for (const e of entries) {
    const key = e.counterparty || "(미상)";
    if (e.vatDirection === "SALE") {
      const cur = salesByPartner.get(key) ?? { supply: 0, vat: 0, count: 0 };
      cur.supply += e.supplyAmount;
      cur.vat += e.vatAmount;
      cur.count++;
      salesByPartner.set(key, cur);
      salesSupply += e.supplyAmount;
      salesVat += e.vatAmount;
    } else if (e.vatDirection === "PURCHASE") {
      const cur = purchByPartner.get(key) ?? { supply: 0, vat: 0, count: 0 };
      cur.supply += e.supplyAmount;
      cur.vat += e.vatAmount;
      cur.count++;
      purchByPartner.set(key, cur);
      purchSupply += e.supplyAmount;
      purchVat += e.vatAmount;
    } else {
      // 면세
      taxFreeSales += e.supplyAmount;
    }

    if (e.category && e.vatDirection === "PURCHASE") {
      const cur = expenseByCategory.get(e.category) ?? { supply: 0, count: 0 };
      cur.supply += e.supplyAmount;
      cur.count++;
      expenseByCategory.set(e.category, cur);
    }
  }

  const vatPayable = salesVat - purchVat;
  const totalIncome = salesSupply + taxFreeSales;
  const totalExpense = purchSupply;
  const businessIncome = totalIncome - totalExpense; // 사업소득금액 추정 (단순)

  const periodLabel = `${year}년 ${period.label}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/clients/${client.id}`} className="text-xs text-brand-600 hover:underline">
            ← {client.name}
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-800">신고 자료</h1>
          <p className="mt-1 text-sm text-slate-500">
            분개 데이터로 부가세 합계표 + 종소세/법인세 손익을 자동 집계. 그대로 홈택스 신고에 입력.
          </p>
        </div>
        <form className="flex flex-wrap gap-2 text-sm">
          <select
            name="year"
            defaultValue={year}
            className="rounded-md border border-slate-300 px-2 py-1.5"
          >
            {[year + 1, year, year - 1, year - 2].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            name="period"
            defaultValue={periodId}
            className="rounded-md border border-slate-300 px-2 py-1.5"
          >
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700">
            조회
          </button>
        </form>
      </header>

      {/* 부가세 ===================================================== */}
      <article className="rounded-lg border-2 border-slate-300 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="mb-1 text-lg font-bold text-slate-900">① 부가세 신고 자료 — {periodLabel}</h2>
        <p className="mb-3 text-xs text-slate-500">
          이 표를 홈택스 부가세 신고서 화면에 그대로 입력하세요. 거래처별 합계표는
          &quot;매출처별/매입처별 세금계산서 합계표&quot;로 별도 제출.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <PartnerTable title="매출처별 세금계산서 합계" rows={salesByPartner} total={{ supply: salesSupply, vat: salesVat }} />
          <PartnerTable title="매입처별 세금계산서 합계" rows={purchByPartner} total={{ supply: purchSupply, vat: purchVat }} />
        </div>

        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm">
          <Row label="과세 매출 (공급가액)" value={salesSupply} />
          <Row label="매출세액 (10%)" value={salesVat} />
          <Row label="과세 매입 (공급가액)" value={purchSupply} />
          <Row label="매입세액 (10%)" value={purchVat} />
          {taxFreeSales > 0 && <Row label="면세 매출 (참고)" value={taxFreeSales} muted />}
          <Row
            label={vatPayable >= 0 ? "납부세액" : "환급세액"}
            value={Math.abs(vatPayable)}
            big
          />
        </div>
      </article>

      {/* 종소세/법인세 ============================================== */}
      <article className="rounded-lg border-2 border-slate-300 bg-white p-6">
        <h2 className="mb-1 text-lg font-bold text-slate-900">
          ② {client.bizType === "CORPORATION" ? "법인세" : "종합소득세"} 신고 자료 — {periodLabel}
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          {client.bizType === "CORPORATION"
            ? "법인세는 표준재무제표·세무조정이 필요해 본 화면은 참고용입니다. 실제 신고는 결산서 기준."
            : "수입금액 − 필요경비 = 사업소득금액 (추정). 실제 신고는 단순/기준경비율 또는 장부 작성 기준."}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* 수입 */}
          <section className="rounded-md border border-slate-200 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">수입금액</h3>
            <Row label="과세 매출" value={salesSupply} />
            {taxFreeSales > 0 && <Row label="면세 매출" value={taxFreeSales} />}
            <Row label="수입금액 합계" value={totalIncome} strong />
          </section>

          {/* 비용 분류 (필요경비 후보) */}
          <section className="rounded-md border border-slate-200 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">비용 분류 (필요경비 후보)</h3>
            {expenseByCategory.size === 0 ? (
              <p className="text-xs text-slate-500">
                분개에 비용 분류가 입력되지 않음. 분개 입력 시 &quot;비용 분류&quot; 드롭다운을 선택하면 자동 집계.
              </p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {Array.from(expenseByCategory.entries())
                    .sort((a, b) => b[1].supply - a[1].supply)
                    .map(([cat, v]) => (
                      <tr key={cat} className="border-b border-slate-100">
                        <td className="py-1">{cat}</td>
                        <td className="py-1 text-right text-slate-400">{v.count}건</td>
                        <td className="py-1 text-right font-mono">{fmt(v.supply)}</td>
                      </tr>
                    ))}
                  <tr className="border-t-2 border-slate-800 font-semibold">
                    <td colSpan={2} className="py-1">분류된 비용 합계</td>
                    <td className="py-1 text-right font-mono">
                      {fmt(Array.from(expenseByCategory.values()).reduce((s, v) => s + v.supply, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
            <p className="mt-2 text-xs text-slate-500">
              미분류 매입: <span className="font-mono">{fmt(purchSupply - Array.from(expenseByCategory.values()).reduce((s, v) => s + v.supply, 0))}</span>
            </p>
          </section>
        </div>

        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm">
          <Row label="수입금액" value={totalIncome} />
          <Row label="− 매입 합계 (단순)" value={-totalExpense} muted />
          <Row label="사업소득금액 (추정)" value={businessIncome} big />
        </div>

        <footer className="mt-3 text-xs text-slate-500">
          ※ 위 사업소득금액은 매출−매입 단순 계산. 실제 신고 시 인건비·임차료·감가상각·이자비용 등
          추가 필요경비와 가산·감산 항목 적용 필요.
        </footer>
      </article>

      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        ⚠ 본 자료는 분개 데이터 기반 자동 집계입니다. 신고 전 최종 검토 필수.
        세금계산서·신용카드 합계표 등 별도 첨부서류는 홈택스에서 별도 작성.
      </p>
    </div>
  );
}

function PartnerTable({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Map<string, { supply: number; vat: number; count: number }>;
  total: { supply: number; vat: number };
}) {
  return (
    <section className="rounded-md border border-slate-200 p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title} ({rows.size}곳)</h3>
      {rows.size === 0 ? (
        <p className="text-xs text-slate-500">해당 기간 거래 없음</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 text-left font-normal">거래처</th>
              <th className="py-1 text-right font-normal">건</th>
              <th className="py-1 text-right font-normal">공급가액</th>
              <th className="py-1 text-right font-normal">세액</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(rows.entries())
              .sort((a, b) => b[1].supply - a[1].supply)
              .slice(0, 20)
              .map(([name, v]) => (
                <tr key={name} className="border-b border-slate-100">
                  <td className="py-1">{name}</td>
                  <td className="py-1 text-right text-slate-400">{v.count}</td>
                  <td className="py-1 text-right font-mono">{fmt(v.supply)}</td>
                  <td className="py-1 text-right font-mono">{fmt(v.vat)}</td>
                </tr>
              ))}
            {rows.size > 20 && (
              <tr><td colSpan={4} className="py-1 text-center text-slate-400">… 외 {rows.size - 20}곳</td></tr>
            )}
            <tr className="border-t-2 border-slate-800 font-semibold">
              <td className="py-1" colSpan={2}>합계</td>
              <td className="py-1 text-right font-mono">{fmt(total.supply)}</td>
              <td className="py-1 text-right font-mono">{fmt(total.vat)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  big,
  strong,
  muted,
}: {
  label: string;
  value: number;
  big?: boolean;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-200 py-1.5 last:border-b-0 ${
        big ? "border-t-2 border-slate-800 text-base font-bold text-brand-700" : strong ? "font-semibold text-slate-900" : muted ? "text-slate-500" : "text-slate-700"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono">{value < 0 ? `−${fmt(-value)}` : fmt(value)}</span>
    </div>
  );
}
