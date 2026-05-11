import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { aggregateVat } from "@/lib/accounting/journal";
import { isBizType, BIZ_TYPE_LABEL } from "@/lib/tax/bizType";
import {
  generateVatFilingGuide,
  generateIncomeTaxFilingGuide,
  generateCorporateTaxFilingGuide,
  generateWithholdingFilingGuide,
  generateBusinessStatusFilingGuide,
  type VatFilingPeriod,
} from "@/lib/tax/filingGuide";
import { MarkdownView } from "./MarkdownView";
import { PrintButton } from "./PrintButton";

type GuideType = "vat" | "income" | "corporate" | "withholding" | "business-status";

const TYPE_LABEL: Record<GuideType, string> = {
  vat: "부가가치세",
  income: "종합소득세",
  corporate: "법인세",
  withholding: "원천세",
  "business-status": "사업장현황신고 (면세)",
};

export default async function FilingGuidePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: {
    type?: string;
    year?: string;
    period?: string;
    targetMonth?: string;
    incomeAmount?: string;
    dependents?: string;
    fiscalYearEnd?: string;
    businessIncome?: string;
    otherIncome?: string;
    wageIncome?: string;
  };
}) {
  let client;
  try {
    ({ client } = await requireClientAccess(params.id));
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.status === 401) redirect(`/login?next=/clients/${params.id}/filing-guide`);
      notFound();
    }
    throw e;
  }

  const type = ((searchParams?.type ?? defaultGuideTypeFor(client.bizType)) as GuideType);
  const year = Number(searchParams?.year ?? new Date().getFullYear() - 1);

  let guide = "";
  let error: string | null = null;

  try {
    if (type === "vat") {
      const period = (searchParams?.period ?? "1H_FINAL") as VatFilingPeriod;
      const { from, to } = vatPeriodRange(period, year);
      const agg = await aggregateVat({ clientId: client.id, from, to });
      if (!isBizType(client.bizType)) throw new Error("사업자 유형 비정상");
      guide = generateVatFilingGuide({
        bizType: client.bizType,
        period,
        clientName: client.name,
        agg,
      });
    } else if (type === "income") {
      const from = new Date(year, 0, 1);
      const to = new Date(year, 11, 31, 23, 59, 59);
      const agg = await aggregateVat({ clientId: client.id, from, to });
      guide = generateIncomeTaxFilingGuide({
        clientName: client.name,
        taxYear: year,
        salesFromJournal: agg.salesSupply,
        incomeAmount: searchParams?.incomeAmount ? Number(searchParams.incomeAmount) : undefined,
        dependents: searchParams?.dependents ? Number(searchParams.dependents) : undefined,
      });
    } else if (type === "corporate") {
      const fiscalYearEnd = searchParams?.fiscalYearEnd ?? `${year}-12-31`;
      const end = new Date(fiscalYearEnd);
      const startYear = end.getFullYear();
      const from = new Date(startYear, 0, 1);
      const agg = await aggregateVat({ clientId: client.id, from, to: end });
      guide = generateCorporateTaxFilingGuide({
        clientName: client.name,
        fiscalYearEnd,
        salesFromJournal: agg.salesSupply,
      });
    } else if (type === "withholding") {
      const targetMonth = searchParams?.targetMonth ?? new Date().toISOString().slice(0, 7);
      guide = generateWithholdingFilingGuide({
        clientName: client.name,
        targetMonth,
        businessIncomePaid: searchParams?.businessIncome ? Number(searchParams.businessIncome) : undefined,
        otherIncomePaid: searchParams?.otherIncome ? Number(searchParams.otherIncome) : undefined,
        wageIncomePaid: searchParams?.wageIncome ? Number(searchParams.wageIncome) : undefined,
      });
    } else if (type === "business-status") {
      const from = new Date(year, 0, 1);
      const to = new Date(year, 11, 31, 23, 59, 59);
      const agg = await aggregateVat({ clientId: client.id, from, to });
      guide = generateBusinessStatusFilingGuide({
        clientName: client.name,
        taxYear: year,
        annualSales: agg.salesSupply,
      });
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // ─────────── 입력 폼 (세목별 다름) ───────────
  const TabLink = ({ t, label }: { t: GuideType; label: string }) => (
    <Link
      href={`?type=${t}&year=${year}`}
      className={`rounded-md border px-3 py-1.5 text-sm ${
        type === t
          ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
          : "border-slate-300 bg-white text-slate-600 hover:border-brand-300"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      <header className="print:hidden">
        <Link href={`/clients/${client.id}`} className="text-xs text-brand-600 hover:underline">
          ← {client.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">
          홈택스 신고 가이드
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {client.name} ({isBizType(client.bizType) ? BIZ_TYPE_LABEL[client.bizType] : client.bizType})
          {" — "}분개 데이터로 자동 집계 + 홈택스 화면 단계별 안내
        </p>
      </header>

      {/* 세목 탭 */}
      <nav className="flex flex-wrap gap-2 print:hidden">
        {(Object.keys(TYPE_LABEL) as GuideType[]).map((t) => (
          <TabLink key={t} t={t} label={TYPE_LABEL[t]} />
        ))}
      </nav>

      {/* 옵션 입력 */}
      <form className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs print:hidden">
        <input type="hidden" name="type" value={type} />
        {type === "withholding" ? (
          <>
            <label>
              <span className="text-slate-600">신고 대상 월</span>
              <input
                type="month"
                name="targetMonth"
                defaultValue={searchParams?.targetMonth ?? new Date().toISOString().slice(0, 7)}
                className="mt-1 block rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <NumField label="사업소득 지급 (원)" name="businessIncome" />
            <NumField label="기타소득 지급 (원)" name="otherIncome" />
            <NumField label="근로소득 지급 (원, 참고)" name="wageIncome" />
          </>
        ) : type === "corporate" ? (
          <label>
            <span className="text-slate-600">결산일</span>
            <input
              type="date"
              name="fiscalYearEnd"
              defaultValue={searchParams?.fiscalYearEnd ?? `${year}-12-31`}
              className="mt-1 block rounded border border-slate-300 px-2 py-1"
            />
          </label>
        ) : (
          <>
            <label>
              <span className="text-slate-600">귀속연도</span>
              <select
                name="year"
                defaultValue={year}
                className="mt-1 block rounded border border-slate-300 px-2 py-1"
              >
                {[year + 1, year, year - 1, year - 2].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            {type === "vat" && (
              <label>
                <span className="text-slate-600">신고 기간</span>
                <select
                  name="period"
                  defaultValue={searchParams?.period ?? "1H_FINAL"}
                  className="mt-1 block rounded border border-slate-300 px-2 py-1"
                >
                  <option value="1H_PRELIM">1기 예정 (4/25)</option>
                  <option value="1H_FINAL">1기 확정 (7/25)</option>
                  <option value="2H_PRELIM">2기 예정 (10/25)</option>
                  <option value="2H_FINAL">2기 확정 (1/25)</option>
                  <option value="SIMPLIFIED_ANNUAL">간이 연 1회 (1/25)</option>
                </select>
              </label>
            )}
            {type === "income" && (
              <>
                <NumField label="종합소득금액 (수입-경비, 원)" name="incomeAmount" />
                <NumField label="부양가족 (본인 포함)" name="dependents" defaultValue="1" />
              </>
            )}
          </>
        )}
        <button className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">
          갱신
        </button>
        <PrintButton />
      </form>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {/* 가이드 출력 (인쇄 대상) */}
      <article className="rounded-lg border-2 border-slate-300 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <MarkdownView text={guide} />
      </article>

      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function defaultGuideTypeFor(bizType: string): GuideType {
  if (bizType === "CORPORATION") return "corporate";
  if (bizType === "SOLE_TAX_FREE") return "business-status";
  return "income";
}

function vatPeriodRange(period: VatFilingPeriod, year: number): { from: Date; to: Date } {
  // 신고 기간 → 대상 거래 기간
  switch (period) {
    case "1H_PRELIM": return { from: new Date(year, 0, 1), to: new Date(year, 3, 1) };
    case "1H_FINAL": return { from: new Date(year, 0, 1), to: new Date(year, 6, 1) };
    case "2H_PRELIM": return { from: new Date(year, 6, 1), to: new Date(year, 9, 1) };
    case "2H_FINAL": return { from: new Date(year, 6, 1), to: new Date(year + 1, 0, 1) };
    case "SIMPLIFIED_ANNUAL": return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
  }
}

function NumField({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <label>
      <span className="text-slate-600">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        className="mt-1 block w-40 rounded border border-slate-300 px-2 py-1 text-right font-mono"
      />
    </label>
  );
}
