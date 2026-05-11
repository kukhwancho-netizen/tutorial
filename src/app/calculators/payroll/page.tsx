"use client";

import { useMemo, useState } from "react";
import { MoneyInput, fmt } from "@/components/MoneyInput";
import { calcFourMajorInsurance } from "@/lib/tax/insurance";
import { estimateMonthlyWageWithholding } from "@/lib/tax/withholding";

const LIMITS = {
  meal: 200_000,
  carAllowance: 200_000,
  childcare: 200_000,
};

export default function PayrollCalculatorPage() {
  const [gross, setGross] = useState(3_000_000);
  const [meal, setMeal] = useState(200_000);
  const [carAllowance, setCarAllowance] = useState(0);
  const [childcare, setChildcare] = useState(0);
  const [otherNonTax, setOtherNonTax] = useState(0);
  const [dependents, setDependents] = useState(1);
  const [children, setChildren] = useState(0);
  const [firmSize, setFirmSize] = useState<"SMALL" | "MID_LARGE">("SMALL");

  const totalNonTax =
    Math.min(meal, LIMITS.meal) +
    Math.min(carAllowance, LIMITS.carAllowance) +
    Math.min(childcare, LIMITS.childcare) +
    otherNonTax;
  const taxableSalary = Math.max(0, gross - totalNonTax);

  const insurance = useMemo(
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

  const totalDeduction = insurance.employee.total + wage.incomeTax + wage.localTax;
  const netPay = gross - totalDeduction;
  const employerCost = gross + insurance.employer.total;

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      {/* 왼쪽: 입력 */}
      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">월급 통합 계산기</h1>
          <p className="mt-1 text-sm text-slate-500">
            총급여 + 비과세 + 부양가족 입력하면 4대보험·원천세·실수령액·사업주 부담을 한 번에 산출.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <MoneyInput
            label="월 급여 총액 (세전, 비과세 포함)"
            value={gross}
            onChange={setGross}
            hint="근로계약서상 월급여 총액"
          />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">사업장 규모</span>
            <select
              value={firmSize}
              onChange={(e) => setFirmSize(e.target.value as "SMALL" | "MID_LARGE")}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="SMALL">150인 미만</option>
              <option value="MID_LARGE">150인 이상</option>
            </select>
          </label>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">비과세 항목 (월)</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <MoneyInput label="식대" value={meal} onChange={setMeal} hint={`한도 ${fmt(LIMITS.meal)}`} />
            <MoneyInput
              label="자가운전보조금"
              value={carAllowance}
              onChange={setCarAllowance}
              hint={`한도 ${fmt(LIMITS.carAllowance)} · 본인 차량·업무용`}
            />
            <MoneyInput
              label="출산·보육수당 (6세 이하)"
              value={childcare}
              onChange={setChildcare}
              hint={`한도 ${fmt(LIMITS.childcare)}`}
            />
            <MoneyInput
              label="기타 비과세"
              value={otherNonTax}
              onChange={setOtherNonTax}
              hint="연구활동비·일직숙직료 등"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">부양가족 수 (본인 포함)</span>
            <input
              type="number"
              min={1}
              value={dependents}
              onChange={(e) => setDependents(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">8세~20세 자녀 수</span>
            <input
              type="number"
              min={0}
              value={children}
              onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono"
            />
          </label>
        </div>
      </section>

      {/* 오른쪽: 명세서 */}
      <aside className="space-y-4">
        {/* 사장님 카드 */}
        <div className="rounded-lg border-2 border-brand-500 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-brand-700">📋 사장님 결제</h2>
          <Row label="월 급여 (총액)" value={gross} />
          <Row label="+ 4대보험 사업주 부담" value={insurance.employer.total} />
          <Row label="총 인건비" value={employerCost} bold large />
        </div>

        {/* 직원 카드 */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">👤 직원 명세서</h2>
          <Row label="월 급여 (총액)" value={gross} />
          <div className="my-2 border-t border-slate-200" />
          <Row label="− 비과세 합계" value={-totalNonTax} muted />
          <Row label="과세 보수월액" value={taxableSalary} muted />
          <div className="my-2 border-t border-slate-200" />

          <details className="text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">4대보험 (근로자분) 상세</summary>
            <Row label="국민연금 4.5%" value={insurance.employee.nationalPension} small />
            <Row label="건강 3.545%" value={insurance.employee.healthInsurance} small />
            <Row label="장기요양" value={insurance.employee.longTermCare} small />
            <Row label="고용 0.9%" value={insurance.employee.employmentInsurance} small />
          </details>
          <Row label="− 4대보험 (근로자)" value={-insurance.employee.total} />

          <details className="text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">원천세 상세 (간이세액 추정)</summary>
            <Row label="월 소득세" value={wage.incomeTax} small />
            <Row label="월 지방소득세" value={wage.localTax} small />
          </details>
          <Row label="− 원천세" value={-(wage.incomeTax + wage.localTax)} />

          <div className="my-2 border-t border-slate-200" />
          <Row label="실수령액" value={netPay} bold large />
        </div>

        <p className="px-1 text-xs text-slate-500">
          * 정확한 근로소득세는 국세청 간이세액표를 따르며 본 결과는 ±수천원 오차 가능. 4대보험은
          2025-07 기준 요율·국민연금 상하한(40만~637만) 적용.
        </p>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  large,
  small,
  muted,
}: {
  label: string;
  value: number;
  bold?: boolean;
  large?: boolean;
  small?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-100 py-1.5 last:border-b-0 ${
        large ? "text-base" : small ? "text-xs" : "text-sm"
      } ${bold ? "font-bold text-brand-700" : muted ? "text-slate-500" : "text-slate-700"}`}
    >
      <span>{label}</span>
      <span className="font-mono">{value < 0 ? `−${fmt(-value)}` : fmt(value)}</span>
    </div>
  );
}
