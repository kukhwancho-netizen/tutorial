"use client";

import { useMemo, useState } from "react";
import { MoneyInput, fmt } from "@/components/MoneyInput";
import { VAT } from "@/lib/tax/rates";

type Mode = "general" | "simplified";

type IndustryKey = keyof typeof VAT.simplifiedRates;
const INDUSTRY_LABEL: Record<IndustryKey, string> = {
  retailFood: "소매·음식 (15%)",
  manufacturing: "제조·농임어업 (20%)",
  accommodation: "숙박 (25%)",
  construction: "건설·운수·창고 (30%)",
  service: "금융·서비스 그 외 (40%)",
};

const PERIODS: { value: string; label: string }[] = [
  { value: "1H_PRELIM", label: "1기 예정 (1~3월, 4/25 마감)" },
  { value: "1H_FINAL", label: "1기 확정 (개인 1~6월 / 법인 4~6월, 7/25)" },
  { value: "2H_PRELIM", label: "2기 예정 (7~9월, 10/25)" },
  { value: "2H_FINAL", label: "2기 확정 (개인 7~12월 / 법인 10~12월, 다음해 1/25)" },
  { value: "SIMPLIFIED_ANNUAL", label: "간이과세 연 1회 (1~12월, 다음해 1/25)" },
];

export default function VatCalculatorPage() {
  const [mode, setMode] = useState<Mode>("general");
  const [period, setPeriod] = useState("1H_FINAL");

  // 사업장 정보 (캡쳐용)
  const [companyName, setCompanyName] = useState("");
  const [bizNo, setBizNo] = useState("");

  // === 일반과세자 ===
  // 매출
  const [salesInvoice, setSalesInvoice] = useState(0); // 세금계산서 발급분
  const [salesCardCash, setSalesCardCash] = useState(0); // 신용카드·현금영수증 발행분
  const [salesOther, setSalesOther] = useState(0); // 기타 (영수증 등)
  const [salesZero, setSalesZero] = useState(0); // 영세율 (수출 등)
  // 매입
  const [purchInvoice, setPurchInvoice] = useState(0); // 세금계산서 일반 매입
  const [purchCardCash, setPurchCardCash] = useState(0); // 신용카드·현금영수증 매입
  const [purchNotDeductible, setPurchNotDeductible] = useState(0); // 불공제 매입 (접대비 등)
  // 공제
  const [cardSalesIncentive, setCardSalesIncentive] = useState(true); // 신용카드 발행 세액공제 자동 적용

  // === 간이과세자 ===
  const [industry, setIndustry] = useState<IndustryKey>("retailFood");
  const [supplyTotalSimplified, setSupplyTotalSimplified] = useState(0); // 공급대가 (부가세 포함)
  const [taxInvoicePurchasesSimplified, setTaxInvoicePurchasesSimplified] = useState(0);

  // ==================== 계산 ====================
  const general = useMemo(() => {
    const taxableSales = salesInvoice + salesCardCash + salesOther; // 영세율 제외
    const outputVat = Math.floor(taxableSales * 0.1);

    const deductiblePurchases = purchInvoice + purchCardCash;
    const inputVat = Math.floor(deductiblePurchases * 0.1);

    // 신용카드매출전표 발행세액공제: (카드+현금영수증 매출) × 1.3%, 한도 연 1000만원
    const cardCredit = cardSalesIncentive
      ? Math.min(Math.floor((salesCardCash * 1.1) * 0.013), 10_000_000)
      : 0;

    const beforeCredit = outputVat - inputVat;
    const payable = beforeCredit - cardCredit;

    return {
      taxableSales,
      outputVat,
      deductiblePurchases,
      inputVat,
      cardCredit,
      beforeCredit,
      payable,
      totalSales: taxableSales + salesZero,
    };
  }, [salesInvoice, salesCardCash, salesOther, salesZero, purchInvoice, purchCardCash, cardSalesIncentive]);

  const simplified = useMemo(() => {
    const rate = VAT.simplifiedRates[industry];
    const taxBase = Math.floor(supplyTotalSimplified * rate);
    const tax = Math.floor(taxBase * 0.1);
    const deduction = Math.floor(taxInvoicePurchasesSimplified * 0.005);
    const exempt = supplyTotalSimplified < 48_000_000; // 직전연도 4800만 미만 납부면제
    const payable = exempt ? 0 : Math.max(0, tax - deduction);
    return { rate, taxBase, tax, deduction, payable, exempt };
  }, [industry, supplyTotalSimplified, taxInvoicePurchasesSimplified]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* 왼쪽: 입력 (인쇄 시 숨김) */}
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">부가가치세 신고 계산</h1>
          <p className="mt-1 text-xs text-slate-500">
            합계금액(부가세 포함) → 공급가액 분리: <span className="font-mono">합계 ÷ 1.1</span>
          </p>
        </div>

        {/* 모드 선택 */}
        <div className="flex gap-2 text-sm">
          {(["general", "simplified"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                mode === m
                  ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
            >
              {m === "general" ? "일반과세자" : "간이과세자"}
            </button>
          ))}
        </div>

        {/* 신고기간 + 사업자 정보 */}
        <fieldset className="space-y-2">
          <label className="block">
            <span className="text-xs text-slate-600">신고 기간</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {PERIODS.filter((p) =>
                mode === "simplified" ? p.value === "SIMPLIFIED_ANNUAL" : p.value !== "SIMPLIFIED_ANNUAL",
              ).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <Text label="사업장명 (상호)" value={companyName} onChange={setCompanyName} placeholder="(주)○○회사" />
          <Text label="사업자등록번호" value={bizNo} onChange={setBizNo} placeholder="123-45-67890" />
        </fieldset>

        {/* 모드별 입력 */}
        {mode === "general" ? (
          <>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-500">매출 (공급가액, 부가세 제외)</legend>
              <MoneyInput label="세금계산서 발급분" value={salesInvoice} onChange={setSalesInvoice} hint="거래처에 세금계산서 발급한 매출" />
              <MoneyInput label="신용카드·현금영수증 발행분" value={salesCardCash} onChange={setSalesCardCash} hint="소비자 카드결제·현금영수증 (발행세액공제 대상)" />
              <MoneyInput label="기타 매출" value={salesOther} onChange={setSalesOther} hint="간이영수증·미발행 등" />
              <MoneyInput label="영세율 매출 (수출 등)" value={salesZero} onChange={setSalesZero} hint="세율 0% 적용. 매출세액 없음" />
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-500">매입 (공급가액, 부가세 제외)</legend>
              <MoneyInput label="세금계산서 수취 매입" value={purchInvoice} onChange={setPurchInvoice} />
              <MoneyInput label="신용카드·현금영수증 매입" value={purchCardCash} onChange={setPurchCardCash} hint="사업 관련 카드 사용분" />
              <MoneyInput label="매입세액 불공제" value={purchNotDeductible} onChange={setPurchNotDeductible} hint="접대비·비영업용 차량·면세사업분 등 (공제 안 됨)" />
            </fieldset>

            <label className="flex items-start gap-2 rounded-md bg-slate-50 p-3 text-xs">
              <input
                type="checkbox"
                checked={cardSalesIncentive}
                onChange={(e) => setCardSalesIncentive(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-slate-700">
                <b>신용카드매출전표 발행세액공제</b> 자동 적용
                <br />
                <span className="text-slate-500">개인사업자 대상, 카드+현금영수증 매출의 1.3% (연 한도 1천만원)</span>
              </span>
            </label>
          </>
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-500">간이과세 정보</legend>
              <label className="block">
                <span className="text-xs text-slate-600">업종 (부가가치율)</span>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value as IndustryKey)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {(Object.entries(INDUSTRY_LABEL) as [IndustryKey, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <MoneyInput
                label="연간 공급대가 (부가세 포함 매출 합계)"
                value={supplyTotalSimplified}
                onChange={setSupplyTotalSimplified}
                hint="기준: 1억 400만 미만 / 부동산임대·유흥 4800만 미만"
              />
              <MoneyInput
                label="세금계산서 수취 매입 (공급대가)"
                value={taxInvoicePurchasesSimplified}
                onChange={setTaxInvoicePurchasesSimplified}
                hint="0.5% 매입세액공제"
              />
            </fieldset>
          </>
        )}

        <button
          type="button"
          onClick={() => window.print()}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          🖨 인쇄 / PDF 저장
        </button>
      </section>

      {/* 오른쪽: 명세서 */}
      <article className="rounded-lg border-2 border-slate-300 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="border-b-2 border-slate-800 pb-3 text-center">
          <h2 className="text-2xl font-bold tracking-wide text-slate-900">부가가치세 신고 계산서</h2>
          <p className="mt-1 text-sm text-slate-600">
            {PERIODS.find((p) => p.value === period)?.label}
          </p>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
          <Info label="사업장" value={companyName || "_____________"} />
          <Info label="사업자등록번호" value={bizNo || "_____________"} />
          <Info label="과세 유형" value={mode === "general" ? "일반과세자" : "간이과세자"} />
        </section>

        {mode === "general" ? (
          <>
            <Section title="① 매출 내역">
              <Tr label="세금계산서 발급분" v={salesInvoice} vat={Math.floor(salesInvoice * 0.1)} />
              <Tr label="신용카드·현금영수증 발행분" v={salesCardCash} vat={Math.floor(salesCardCash * 0.1)} />
              <Tr label="기타 매출" v={salesOther} vat={Math.floor(salesOther * 0.1)} />
              {salesZero > 0 && <Tr label="영세율 매출 (수출 등)" v={salesZero} vat={0} muted />}
              <Tr label="과세 매출 합계" v={general.taxableSales} vat={general.outputVat} strong />
            </Section>

            <Section title="② 매입 내역">
              <Tr label="세금계산서 수취 매입" v={purchInvoice} vat={Math.floor(purchInvoice * 0.1)} />
              <Tr label="신용카드·현금영수증 매입" v={purchCardCash} vat={Math.floor(purchCardCash * 0.1)} />
              {purchNotDeductible > 0 && (
                <Tr
                  label="매입세액 불공제 (접대비 등)"
                  v={purchNotDeductible}
                  vat={Math.floor(purchNotDeductible * 0.1)}
                  muted
                />
              )}
              <Tr label="공제 가능 매입 합계" v={general.deductiblePurchases} vat={general.inputVat} strong />
            </Section>

            <Section title="③ 납부세액 계산">
              <Tr2 label="매출세액 (①)" value={general.outputVat} />
              <Tr2 label="− 매입세액 (②)" value={-general.inputVat} />
              <Tr2 label="= 차감세액" value={general.beforeCredit} muted />
              {general.cardCredit > 0 && (
                <Tr2 label="− 신용카드매출전표 발행세액공제 (1.3%)" value={-general.cardCredit} />
              )}
              <Tr2
                label={general.payable >= 0 ? "최종 납부세액" : "환급세액"}
                value={Math.abs(general.payable)}
                big
              />
            </Section>
          </>
        ) : (
          <>
            <Section title="① 공급대가 (매출)">
              <Tr2 label="연간 공급대가" value={supplyTotalSimplified} />
              <Tr2 label={`× 업종 부가가치율 ${(simplified.rate * 100).toFixed(0)}%`} value={simplified.taxBase} muted />
              <Tr2 label="× 10% = 산출세액" value={simplified.tax} />
            </Section>

            <Section title="② 매입세액공제">
              <Tr2 label="세금계산서 수취 매입 (공급대가)" value={taxInvoicePurchasesSimplified} muted />
              <Tr2 label="× 0.5% = 공제액" value={simplified.deduction} />
            </Section>

            <Section title="③ 납부세액">
              {simplified.exempt && (
                <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-800">
                  공급대가 4,800만원 미만 → 부가세 납부 의무 면제 (신고는 함)
                </p>
              )}
              <Tr2 label="산출세액" value={simplified.tax} />
              <Tr2 label="− 매입세액공제" value={-simplified.deduction} />
              <Tr2 label="최종 납부세액" value={simplified.payable} big />
            </Section>
          </>
        )}

        <footer className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500">
          * 본 계산은 일반적 케이스 기준입니다. 의제매입세액공제(음식점)·재활용폐자원·수출
          영세율 첨부서류 등은 별도 검토 필요. 정확한 신고는 홈택스에서 진행하세요.
        </footer>
      </article>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

// ==================== 컴포넌트 ====================

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-600">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="ml-2 text-slate-800">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="border-b border-slate-300 pb-1 text-sm font-bold text-slate-700">{title}</h3>
      <table className="mt-2 w-full text-sm">
        <thead className="text-xs text-slate-400">
          <tr>
            <th className="py-1 text-left font-normal">항목</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

/** 매출/매입 명세 행 (공급가액 + 세액) */
function Tr({
  label,
  v,
  vat,
  strong,
  muted,
}: {
  label: string;
  v: number;
  vat: number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <tr
      className={`${
        strong ? "border-t-2 border-slate-800 font-bold text-slate-900" : "border-b border-slate-100"
      } ${muted ? "text-slate-500" : "text-slate-800"}`}
    >
      <td className="py-1">{label}</td>
      <td className="py-1 text-right font-mono text-xs">{fmt(v)}</td>
      <td className="py-1 text-right font-mono">{fmt(vat)}</td>
    </tr>
  );
}

/** 단일 값 행 */
function Tr2({
  label,
  value,
  big,
  muted,
}: {
  label: string;
  value: number;
  big?: boolean;
  muted?: boolean;
}) {
  return (
    <tr
      className={`border-b border-slate-100 last:border-b-0 ${
        big ? "border-t-2 border-slate-800 text-base font-bold text-brand-700" : muted ? "text-slate-500" : "text-slate-800"
      }`}
    >
      <td className="py-1.5">{label}</td>
      <td className="py-1.5 text-right font-mono">
        {value < 0 ? `−${fmt(-value)}` : fmt(value)} 원
      </td>
    </tr>
  );
}
