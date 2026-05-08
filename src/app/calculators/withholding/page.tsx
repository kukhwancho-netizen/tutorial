"use client";

import { useMemo, useState } from "react";
import { GuidePanel } from "@/components/GuidePanel";
import { MoneyInput, fmt } from "@/components/MoneyInput";
import {
  calcEtcIncomeWithholding,
  calcFreelanceWithholding,
  estimateMonthlyWageWithholding,
} from "@/lib/tax/withholding";
import { GUIDES } from "@/lib/tax/guides";

type Mode = "freelance" | "etc" | "wage";

export default function WithholdingCalculatorPage() {
  const [mode, setMode] = useState<Mode>("freelance");
  const [payment, setPayment] = useState(0);
  const [dependents, setDependents] = useState(1);
  const [children, setChildren] = useState(0);

  const freelance = useMemo(() => calcFreelanceWithholding(payment), [payment]);
  const etc = useMemo(() => calcEtcIncomeWithholding(payment), [payment]);
  const wage = useMemo(
    () =>
      estimateMonthlyWageWithholding({
        monthlyGross: payment,
        dependents,
        childrenUnder20: children,
      }),
    [payment, dependents, children],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-800">원천징수 계산기</h1>

        <div className="flex gap-2 text-sm">
          {(["freelance", "etc", "wage"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md border px-3 py-1.5 ${
                mode === m
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
            >
              {m === "freelance" ? "사업소득 3.3%" : m === "etc" ? "기타소득 8.8%" : "근로소득"}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <MoneyInput
            label={mode === "wage" ? "월 급여 (비과세 제외)" : "지급금액"}
            value={payment}
            onChange={setPayment}
          />
          {mode === "wage" && (
            <>
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
            </>
          )}
        </div>

        <div className="rounded-md bg-slate-50 p-4 text-sm">
          {mode === "freelance" && (
            <>
              <Row label="소득세 (3%)" value={freelance.incomeTax} />
              <Row label="지방소득세 (0.3%)" value={freelance.localTax} />
              <Row label="실수령액" value={freelance.net} emphasis />
            </>
          )}
          {mode === "etc" && (
            <>
              <Row label="소득세 (8%)" value={etc.incomeTax} />
              <Row label="지방소득세 (0.8%)" value={etc.localTax} />
              <Row label="실수령액" value={etc.net} emphasis />
            </>
          )}
          {mode === "wage" && (
            <>
              <Row label="월 소득세 (간이세액 추정)" value={wage.incomeTax} />
              <Row label="월 지방소득세" value={wage.localTax} />
              <Row label="합계" value={wage.incomeTax + wage.localTax} emphasis />
              <p className="mt-2 text-xs text-slate-500">
                * 정확한 금액은 국세청 근로소득 간이세액표를 따르며, 본 계산은 누진세율 기반의
                근사치입니다.
              </p>
            </>
          )}
        </div>
      </section>

      <GuidePanel guide={GUIDES.withholding} />
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
