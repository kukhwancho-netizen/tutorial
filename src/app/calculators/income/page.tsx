"use client";

import { useMemo, useState } from "react";
import { GuidePanel } from "@/components/GuidePanel";
import { MoneyInput, fmt } from "@/components/MoneyInput";
import { calcComprehensiveIncomeTax } from "@/lib/tax/income";
import { GUIDES } from "@/lib/tax/guides";

export default function IncomeCalculatorPage() {
  const [income, setIncome] = useState(0);
  const [dependents, setDependents] = useState(1);
  const [otherDeduction, setOtherDeduction] = useState(0);

  const result = useMemo(
    () => calcComprehensiveIncomeTax({ incomeAmount: income, dependents, otherDeduction }),
    [income, dependents, otherDeduction],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-800">종합소득세 계산기</h1>
        <p className="text-sm text-slate-600">
          종합소득금액(사업소득 + 근로소득 + 기타 등)을 입력하면 누진세율로 산출세액을 계산합니다.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <MoneyInput label="종합소득금액" value={income} onChange={setIncome} />
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
          <MoneyInput
            label="기타 소득공제 (국민연금 등)"
            value={otherDeduction}
            onChange={setOtherDeduction}
          />
        </div>

        <div className="rounded-md bg-slate-50 p-4 text-sm">
          <Row label="과세표준" value={result.taxBase} />
          <Row
            label={`적용 세율 ${(result.appliedBracket.rate * 100).toFixed(0)}% (누진공제 ${fmt(result.appliedBracket.deduction)})`}
            value={result.calculatedTax}
          />
          <Row label="결정세액 (표준세액공제 13만원 차감)" value={result.determinedTax} />
          <Row label="지방소득세 (10%)" value={result.localIncomeTax} />
          <Row label="합계" value={result.totalPayable} emphasis />
        </div>
      </section>

      <GuidePanel guide={GUIDES.income} />
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-200 py-2 last:border-b-0 ${
        emphasis ? "text-base font-semibold text-brand-700" : "text-slate-700"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono">{fmt(value)}</span>
    </div>
  );
}
