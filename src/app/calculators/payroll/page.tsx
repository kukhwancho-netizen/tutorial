"use client";

import { useMemo, useState } from "react";
import { MoneyInput, fmt } from "@/components/MoneyInput";
import { calcFourMajorInsurance } from "@/lib/tax/insurance";
import { estimateMonthlyWageWithholding } from "@/lib/tax/withholding";

const LIMITS = { meal: 200_000, carAllowance: 200_000, childcare: 200_000 };

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PayrollCalculatorPage() {
  // 사업장 정보
  const [companyName, setCompanyName] = useState("");
  const [bizNo, setBizNo] = useState("");
  const [ownerName, setOwnerName] = useState("");
  // 직원 + 지급일
  const [employeeName, setEmployeeName] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  // 급여
  const [gross, setGross] = useState(3_000_000);
  const [meal, setMeal] = useState(200_000);
  const [carAllowance, setCarAllowance] = useState(0);
  const [childcare, setChildcare] = useState(0);
  const [otherNonTax, setOtherNonTax] = useState(0);
  const [dependents, setDependents] = useState(1);
  const [children, setChildren] = useState(0);
  const [firmSize, setFirmSize] = useState<"SMALL" | "MID_LARGE">("SMALL");
  const [showEmployerCost, setShowEmployerCost] = useState(false);

  const totalNonTax =
    Math.min(meal, LIMITS.meal) +
    Math.min(carAllowance, LIMITS.carAllowance) +
    Math.min(childcare, LIMITS.childcare) +
    otherNonTax;
  const taxableSalary = Math.max(0, gross - totalNonTax);

  const ins = useMemo(
    () => calcFourMajorInsurance({ monthlySalary: taxableSalary, firmSize }),
    [taxableSalary, firmSize],
  );
  const wage = useMemo(
    () =>
      estimateMonthlyWageWithholding({
        monthlyGross: taxableSalary,
        dependents,
        childrenUnder20: children,
      }),
    [taxableSalary, dependents, children],
  );

  const totalDeduction = ins.employee.total + wage.incomeTax + wage.localTax;
  const netPay = gross - totalDeduction;
  const employerCost = gross + ins.employer.total;

  const ym = payDate.slice(0, 7).replace("-", "년 ") + "월";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* 왼쪽: 입력 (인쇄/캡쳐 시 숨김) */}
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 print:hidden">
        <h1 className="text-lg font-semibold text-slate-800">급여명세서 만들기</h1>
        <p className="text-xs text-slate-500">
          입력하면 오른쪽이 실시간 명세서로 바뀝니다. 캡쳐(Windows: <kbd>Win+Shift+S</kbd>)하거나
          맨 아래 인쇄 버튼으로 저장.
        </p>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-500">사업장 정보</legend>
          <Text label="사업장명 (상호)" value={companyName} onChange={setCompanyName} placeholder="(주)○○회사" />
          <Text label="사업자등록번호" value={bizNo} onChange={setBizNo} placeholder="123-45-67890" />
          <Text label="대표자명" value={ownerName} onChange={setOwnerName} placeholder="홍길동" />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-500">직원 / 지급일</legend>
          <Text label="직원 성명" value={employeeName} onChange={setEmployeeName} placeholder="김직원" />
          <label className="block">
            <span className="text-xs text-slate-600">지급일</span>
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-500">급여 / 비과세</legend>
          <MoneyInput label="월 급여 총액 (세전)" value={gross} onChange={setGross} />
          <MoneyInput label="식대" value={meal} onChange={setMeal} hint={`한도 ${fmt(LIMITS.meal)}`} />
          <MoneyInput label="자가운전보조금" value={carAllowance} onChange={setCarAllowance} hint={`한도 ${fmt(LIMITS.carAllowance)}`} />
          <MoneyInput label="출산·보육수당" value={childcare} onChange={setChildcare} hint={`한도 ${fmt(LIMITS.childcare)}`} />
          <MoneyInput label="기타 비과세" value={otherNonTax} onChange={setOtherNonTax} />
        </fieldset>

        <fieldset className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-xs text-slate-600">부양가족</span>
            <input
              type="number"
              min={1}
              value={dependents}
              onChange={(e) => setDependents(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-right font-mono text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">8~20세 자녀</span>
            <input
              type="number"
              min={0}
              value={children}
              onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-right font-mono text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">사업장 규모</span>
            <select
              value={firmSize}
              onChange={(e) => setFirmSize(e.target.value as "SMALL" | "MID_LARGE")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="SMALL">150인 미만</option>
              <option value="MID_LARGE">150인 이상</option>
            </select>
          </label>
        </fieldset>

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={showEmployerCost}
            onChange={(e) => setShowEmployerCost(e.target.checked)}
          />
          명세서에 사업주 부담 표시 (내부용)
        </label>

        <button
          type="button"
          onClick={() => window.print()}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          🖨 인쇄 / PDF 저장
        </button>
      </section>

      {/* 오른쪽: 명세서 (캡쳐·인쇄 대상) */}
      <article id="payslip" className="rounded-lg border-2 border-slate-300 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="border-b-2 border-slate-800 pb-3 text-center">
          <h2 className="text-2xl font-bold tracking-wide text-slate-900">급여명세서</h2>
          <p className="mt-1 text-sm text-slate-600">{ym}</p>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
          <Info label="사업장" value={companyName || "_____________"} />
          <Info label="사업자등록번호" value={bizNo || "_____________"} />
          <Info label="대표자" value={ownerName || "_____________"} />
          <Info label="지급일" value={payDate} />
        </section>

        <section className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
          <span className="text-xs text-slate-500">성명</span>
          <span className="ml-3 text-base font-bold text-slate-900">
            {employeeName || "_____________"}
          </span>
        </section>

        <section className="mt-5">
          <h3 className="border-b border-slate-300 pb-1 text-sm font-bold text-slate-700">지급 내역</h3>
          <table className="mt-2 w-full text-sm">
            <tbody>
              <RowTbl label="기본급 + 수당 (과세)" value={taxableSalary} />
              {meal > 0 && <RowTbl label="식대 (비과세)" value={Math.min(meal, LIMITS.meal)} muted />}
              {carAllowance > 0 && <RowTbl label="자가운전보조금 (비과세)" value={Math.min(carAllowance, LIMITS.carAllowance)} muted />}
              {childcare > 0 && <RowTbl label="출산·보육수당 (비과세)" value={Math.min(childcare, LIMITS.childcare)} muted />}
              {otherNonTax > 0 && <RowTbl label="기타 비과세" value={otherNonTax} muted />}
              <RowTbl label="지급액 합계" value={gross} strong />
            </tbody>
          </table>
        </section>

        <section className="mt-5">
          <h3 className="border-b border-slate-300 pb-1 text-sm font-bold text-slate-700">공제 내역</h3>
          <table className="mt-2 w-full text-sm">
            <tbody>
              <RowTbl label="국민연금 (4.5%)" value={ins.employee.nationalPension} />
              <RowTbl label="건강보험 (3.545%)" value={ins.employee.healthInsurance} />
              <RowTbl label="장기요양보험 (건강×12.95%)" value={ins.employee.longTermCare} />
              <RowTbl label="고용보험 (0.9%)" value={ins.employee.employmentInsurance} />
              <RowTbl label="소득세" value={wage.incomeTax} />
              <RowTbl label="지방소득세" value={wage.localTax} />
              <RowTbl label="공제 합계" value={totalDeduction} strong />
            </tbody>
          </table>
        </section>

        <section className="mt-5 border-t-2 border-slate-800 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-slate-900">실 지급액</span>
            <span className="font-mono text-2xl font-bold text-brand-700">{fmt(netPay)} 원</span>
          </div>
        </section>

        {showEmployerCost && (
          <section className="mt-5 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">사업주 부담 (참고 — 직원에게는 표시되지 않습니다)</p>
            <table className="mt-1 w-full">
              <tbody>
                <RowTbl label="국민연금 사업주" value={ins.employer.nationalPension} small />
                <RowTbl label="건강보험 사업주" value={ins.employer.healthInsurance} small />
                <RowTbl label="장기요양 사업주" value={ins.employer.longTermCare} small />
                <RowTbl label="고용보험 사업주" value={ins.employer.employmentInsurance} small />
                <RowTbl label="산재보험" value={ins.employer.workersComp} small />
                <RowTbl label="사업주 부담 합계" value={ins.employer.total} small strong />
                <RowTbl label="총 인건비 (지급 + 부담)" value={employerCost} small strong />
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-6 text-xs text-slate-400">
          * 소득세는 국세청 간이세액표 기반 추정 (±수천원 오차).
          국민연금 기준소득월액 상·하한 적용 (40만~637만, 2025-07 기준).
        </footer>
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

function RowTbl({
  label,
  value,
  strong,
  muted,
  small,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
  small?: boolean;
}) {
  return (
    <tr
      className={`${
        strong ? "border-t-2 border-slate-800 font-bold text-slate-900" : "border-b border-slate-100"
      } ${muted ? "text-slate-500" : "text-slate-800"} ${small ? "text-xs" : "text-sm"}`}
    >
      <td className="py-1">{label}</td>
      <td className="py-1 text-right font-mono">{fmt(value)}</td>
    </tr>
  );
}
