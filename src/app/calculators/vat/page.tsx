"use client";

import { useMemo, useState } from "react";
import { GuidePanel } from "@/components/GuidePanel";
import { MoneyInput, fmt } from "@/components/MoneyInput";
import { calcGeneralVat } from "@/lib/tax/vat";
import { GUIDES } from "@/lib/tax/guides";

export default function VatCalculatorPage() {
  const [sales, setSales] = useState(0);
  const [purchases, setPurchases] = useState(0);

  const result = useMemo(
    () =>
      calcGeneralVat({
        sales: [{ supplyAmount: sales }],
        purchases: [{ supplyAmount: purchases }],
      }),
    [sales, purchases],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-800">부가가치세 계산기 (일반과세)</h1>
        <p className="text-sm text-slate-600">
          공급가액(부가세 제외)을 입력하세요. 합계금액(부가세 포함)에서 분리할 때는 합계 ÷ 1.1
          입니다.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <MoneyInput label="매출 공급가액" value={sales} onChange={setSales} />
          <MoneyInput label="매입 공급가액" value={purchases} onChange={setPurchases} />
        </div>

        <div className="rounded-md bg-slate-50 p-4 text-sm">
          <Row label="매출세액 (매출 × 10%)" value={result.outputVat} />
          <Row label="매입세액 (매입 × 10%)" value={result.inputVat} />
          <Row
            label={result.payable >= 0 ? "납부세액" : "환급세액"}
            value={Math.abs(result.payable)}
            emphasis
          />
        </div>
      </section>

      <GuidePanel guide={GUIDES.vat} />
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
