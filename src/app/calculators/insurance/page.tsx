"use client";

import { useMemo, useState } from "react";
import { GuidePanel } from "@/components/GuidePanel";
import { MoneyInput, fmt } from "@/components/MoneyInput";
import { calcFourMajorInsurance } from "@/lib/tax/insurance";
import { GUIDES } from "@/lib/tax/guides";

// 2025년 기준 주요 비과세 한도 (월)
const LIMITS = {
  meal: 200_000,           // 식대
  carAllowance: 200_000,   // 자가운전보조금 (본인 명의 차량, 업무 사용)
  childcare: 200_000,      // 6세 이하 자녀 보육수당
};

export default function InsuranceCalculatorPage() {
  const [grossSalary, setGrossSalary] = useState(3_000_000);
  const [meal, setMeal] = useState(0);
  const [carAllowance, setCarAllowance] = useState(0);
  const [childcare, setChildcare] = useState(0);
  const [otherNonTax, setOtherNonTax] = useState(0);
  const [size, setSize] = useState<"SMALL" | "MID_LARGE">("SMALL");

  // 한도 초과분은 과세 (보수월액에 포함)
  const mealEx = Math.min(meal, LIMITS.meal);
  const carEx = Math.min(carAllowance, LIMITS.carAllowance);
  const childEx = Math.min(childcare, LIMITS.childcare);
  const totalNonTax = mealEx + carEx + childEx + otherNonTax;
  const taxableSalary = Math.max(0, grossSalary - totalNonTax);

  const result = useMemo(
    () => calcFourMajorInsurance({ monthlySalary: taxableSalary, firmSize: size }),
    [taxableSalary, size],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-800">4대보험 계산기</h1>

        <div className="grid gap-4 md:grid-cols-2">
          <MoneyInput
            label="월 급여 총액 (세전, 비과세 포함)"
            value={grossSalary}
            onChange={setGrossSalary}
            hint="근로계약서상 월급여 총액"
          />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">사업장 규모</span>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as "SMALL" | "MID_LARGE")}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="SMALL">150인 미만 (고용보험 사업주 1.15%)</option>
              <option value="MID_LARGE">150인 이상 (고용보험 사업주 1.45%)</option>
            </select>
          </label>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">비과세 항목 (월)</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <MoneyInput
              label="식대"
              value={meal}
              onChange={setMeal}
              hint={`한도 ${fmt(LIMITS.meal)} (초과분 과세)`}
            />
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
              hint="연구활동비·일직숙직료·생산직 야간 등"
            />
          </div>
          <div className="mt-3 grid gap-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>비과세 합계 (한도 적용)</span>
              <span className="font-mono">{fmt(totalNonTax)}</span>
            </div>
            <div className="flex justify-between font-semibold text-brand-700">
              <span>과세 보수월액 (= 총액 − 비과세)</span>
              <span className="font-mono">{fmt(taxableSalary)}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="근로자 부담">
            <Row label="국민연금 (4.5%)" value={result.employee.nationalPension} />
            <Row label="건강보험 (3.545%)" value={result.employee.healthInsurance} />
            <Row label="장기요양 (건강×12.95%)" value={result.employee.longTermCare} />
            <Row label="고용보험 (0.9%)" value={result.employee.employmentInsurance} />
            <Row label="합계" value={result.employee.total} emphasis />
          </Section>
          <Section title="사업주 부담">
            <Row label="국민연금 (4.5%)" value={result.employer.nationalPension} />
            <Row label="건강보험 (3.545%)" value={result.employer.healthInsurance} />
            <Row label="장기요양" value={result.employer.longTermCare} />
            <Row label="고용보험" value={result.employer.employmentInsurance} />
            <Row label="산재보험 (평균 1.43%)" value={result.employer.workersComp} />
            <Row label="합계" value={result.employer.total} emphasis />
          </Section>
        </div>

        <p className="text-xs text-slate-500">
          국민연금 기준소득월액 상·하한(40만원 ~ 637만원, 2025-07 적용) 자동 적용.
          한도 초과 비과세분은 과세 보수월액에 포함되어 4대보험 산정 시 자동 반영됩니다.
        </p>
      </section>

      <GuidePanel guide={GUIDES.insurance} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-slate-50 p-4 text-sm">
      <h3 className="mb-2 font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-200 py-2 last:border-b-0 ${
        emphasis ? "font-semibold text-brand-700" : "text-slate-700"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono">{fmt(value)}</span>
    </div>
  );
}
