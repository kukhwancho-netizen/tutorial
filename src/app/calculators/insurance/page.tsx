"use client";

import { useMemo, useState } from "react";
import { GuidePanel } from "@/components/GuidePanel";
import { MoneyInput, fmt } from "@/components/MoneyInput";
import { calcFourMajorInsurance } from "@/lib/tax/insurance";
import { GUIDES } from "@/lib/tax/guides";

export default function InsuranceCalculatorPage() {
  const [salary, setSalary] = useState(3_000_000);
  const [size, setSize] = useState<"SMALL" | "MID_LARGE">("SMALL");

  const result = useMemo(
    () => calcFourMajorInsurance({ monthlySalary: salary, firmSize: size }),
    [salary, size],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-800">4대보험 계산기</h1>

        <div className="grid gap-4 md:grid-cols-2">
          <MoneyInput
            label="월 보수 (비과세 제외)"
            value={salary}
            onChange={setSalary}
            hint="국민연금은 기준소득월액 39만원~617만원 한도 적용"
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
