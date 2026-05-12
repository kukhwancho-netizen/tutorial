"use client";

import { useMemo, useState } from "react";
import { MoneyInput, fmt } from "@/components/MoneyInput";
import { calcProgressiveTax, appliedBracket } from "@/lib/tax/income";
import { LOCAL_INCOME_TAX_RATE, PERSONAL_DEDUCTION } from "@/lib/tax/rates";

// 자녀세액공제 (2025년 인상값)
function childTaxCredit(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 250_000;
  if (n === 2) return 550_000;
  return 550_000 + (n - 2) * 400_000;
}

type Mode = "ledger" | "estimate";

export default function IncomeTaxCalculatorPage() {
  // 사업장 (캡쳐용)
  const [companyName, setCompanyName] = useState("");
  const [bizNo, setBizNo] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1);

  // 모드
  const [mode, setMode] = useState<Mode>("ledger");

  // ① 수입금액
  const [revenue, setRevenue] = useState(0);

  // ② 필요경비
  const [expenseRate, setExpenseRate] = useState(70); // 추계 모드용 %
  const [expense, setExpense] = useState({
    인건비: 0, 임차료: 0, 수도광열: 0, 통신비: 0, 차량유지: 0,
    광고선전비: 0, 복리후생: 0, 접대비: 0, 여비교통: 0,
    소모품: 0, 지급수수료: 0, 감가상각: 0, 이자비용: 0, 기타: 0,
  });

  // ③ 인적공제
  const [dependents, setDependents] = useState(1);
  const [childrenUnder20, setChildrenUnder20] = useState(0);
  const [seniorDependents, setSeniorDependents] = useState(0);
  const [disabledDependents, setDisabledDependents] = useState(0);

  // ④ 소득공제
  const [pensionPaid, setPensionPaid] = useState(0);
  const [healthInsurancePaid, setHealthInsurancePaid] = useState(0);
  const [otherDeduction, setOtherDeduction] = useState(0);

  // ⑤ 세액공제
  const [pensionAccountPaid, setPensionAccountPaid] = useState(0);
  const [donation, setDonation] = useState(0);
  const [medicalExpense, setMedicalExpense] = useState(0);
  const [educationExpense, setEducationExpense] = useState(0);

  // ⑥ 가산세
  const [latePenalty, setLatePenalty] = useState(false);

  // ==================== 계산 ====================
  const calc = useMemo(() => {
    const expenseAmount =
      mode === "estimate"
        ? Math.floor(revenue * (expenseRate / 100))
        : Object.values(expense).reduce((s, v) => s + v, 0);
    const businessIncome = Math.max(0, revenue - expenseAmount);

    const basicDed = dependents * PERSONAL_DEDUCTION;
    const seniorDed = seniorDependents * 1_000_000;
    const disabledDed = disabledDependents * 2_000_000;
    const personalDed = basicDed + seniorDed + disabledDed;
    const otherDed = pensionPaid + healthInsurancePaid + otherDeduction;

    const taxBase = Math.max(0, businessIncome - personalDed - otherDed);
    const calculatedTax = calcProgressiveTax(taxBase);
    const bracket = appliedBracket(taxBase);

    const childCredit = childTaxCredit(childrenUnder20);
    const standardCredit = 130_000;
    const pensionCredit = Math.floor(Math.min(pensionAccountPaid, 6_000_000) * 0.132);
    const donationCredit =
      donation <= 10_000_000
        ? Math.floor(donation * 0.15)
        : Math.floor(10_000_000 * 0.15 + (donation - 10_000_000) * 0.3);
    const medicalCredit = Math.floor(Math.max(0, medicalExpense - revenue * 0.03) * 0.15);
    const educationCredit = Math.floor(Math.min(educationExpense, 9_000_000) * 0.15);
    const taxCredit =
      childCredit + standardCredit + pensionCredit + donationCredit + medicalCredit + educationCredit;

    const determinedTax = Math.max(0, calculatedTax - taxCredit);
    const penalty = latePenalty ? Math.floor(determinedTax * 0.2) : 0;
    const localTax = Math.floor((determinedTax + penalty) * LOCAL_INCOME_TAX_RATE);

    return {
      expenseAmount, businessIncome,
      basicDed, seniorDed, disabledDed, personalDed, otherDed,
      taxBase, calculatedTax, bracket,
      childCredit, standardCredit, pensionCredit, donationCredit,
      medicalCredit, educationCredit, taxCredit,
      determinedTax, penalty, localTax,
      totalPayable: determinedTax + penalty + localTax,
    };
  }, [
    mode, revenue, expenseRate, expense, dependents, seniorDependents, disabledDependents,
    childrenUnder20, pensionPaid, healthInsurancePaid, otherDeduction,
    pensionAccountPaid, donation, medicalExpense, educationExpense, latePenalty,
  ]);

  function setExp(key: keyof typeof expense, v: number) {
    setExpense((prev) => ({ ...prev, [key]: v }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* 왼쪽: 입력 */}
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">종합소득세 예상세액 계산</h1>
          <div className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-800">
            ⚠️ <b>참고용 추정치</b>입니다. 단순/기준경비율 적용 대상 여부, 세액공제 한도, 가족 인적공제
            요건(소득·나이) 등에 따라 실제 결과는 달라질 수 있어요.
          </div>
          <p className="mt-2 text-xs text-slate-500">개인사업자 5월 정기신고 (성실신고 6/30).</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-500">사업장 정보</legend>
          <Text label="상호" value={companyName} onChange={setCompanyName} placeholder="○○상회" />
          <Text label="사업자등록번호" value={bizNo} onChange={setBizNo} placeholder="123-45-67890" />
          <Text label="대표자명" value={ownerName} onChange={setOwnerName} placeholder="홍길동" />
          <label className="block">
            <span className="text-xs text-slate-600">귀속연도</span>
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {[taxYear + 1, taxYear, taxYear - 1, taxYear - 2].map((y) => (
                <option key={y} value={y}>{y}년 귀속</option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-500">① 수입금액 (연간)</legend>
          <MoneyInput
            label="총수입금액"
            value={revenue}
            onChange={setRevenue}
            hint="매출 합계 (부가세 제외 공급가액). 거래처별 분개의 매출 합계 활용 가능."
          />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-500">② 필요경비</legend>
          <div className="flex gap-2 text-xs">
            {(["ledger", "estimate"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded border px-2 py-1.5 ${
                  mode === m
                    ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
                    : "border-slate-300 text-slate-600"
                }`}
              >
                {m === "ledger" ? "장부 작성 (카테고리별)" : "추계 (경비율)"}
              </button>
            ))}
          </div>

          {mode === "estimate" ? (
            <label className="block">
              <span className="text-xs text-slate-600">경비율 (%)</span>
              <input
                type="number"
                value={expenseRate}
                onChange={(e) => setExpenseRate(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono"
              />
              <span className="mt-1 block text-xs text-slate-500">
                업종별 국세청 단순/기준경비율. 소매·음식 80~90% / 제조 70~80% / 서비스 50~70% 정도.
              </span>
            </label>
          ) : (
            <div className="grid gap-1.5 max-h-72 overflow-y-auto rounded border border-slate-200 p-2">
              {(Object.keys(expense) as Array<keyof typeof expense>).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <label className="w-20 text-xs text-slate-600">{k}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={expense[k] === 0 ? "" : expense[k].toLocaleString("ko-KR")}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/[^0-9-]/g, ""));
                      setExp(k, Number.isFinite(n) && n >= 0 ? n : 0);
                    }}
                    placeholder="0"
                    className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs"
                  />
                </div>
              ))}
              <p className="text-xs text-slate-500">
                💡 분개에 비용 분류를 입력하면 거래처 페이지의 신고 자료에서 카테고리별 자동 집계됨.
              </p>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-500">③ 인적·소득공제</legend>
          <div className="grid grid-cols-2 gap-2">
            <Num label="부양가족 (본인 포함)" value={dependents} onChange={setDependents} min={1} />
            <Num label="8~20세 자녀" value={childrenUnder20} onChange={setChildrenUnder20} />
            <Num label="70세↑ 부양 (+100만 each)" value={seniorDependents} onChange={setSeniorDependents} />
            <Num label="장애인 부양 (+200만 each)" value={disabledDependents} onChange={setDisabledDependents} />
          </div>
          <MoneyInput label="국민연금 본인 부담 (연)" value={pensionPaid} onChange={setPensionPaid} />
          <MoneyInput label="건강·고용보험 본인 (연)" value={healthInsurancePaid} onChange={setHealthInsurancePaid} hint="근로소득 있을 때만 공제 가능" />
          <MoneyInput label="기타 소득공제" value={otherDeduction} onChange={setOtherDeduction} hint="신용카드 사용공제 등 (사업소득만이면 한정)" />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-500">④ 세액공제</legend>
          <MoneyInput label="연금저축·IRP 납입 (연)" value={pensionAccountPaid} onChange={setPensionAccountPaid} hint="한도 600만 / 13.2%" />
          <MoneyInput label="기부금" value={donation} onChange={setDonation} hint="1천만 이하 15% / 초과 30%" />
          <MoneyInput label="의료비 (총수입 3% 초과분만 공제)" value={medicalExpense} onChange={setMedicalExpense} />
          <MoneyInput label="교육비 (한도 900만)" value={educationExpense} onChange={setEducationExpense} hint="15% 공제" />
        </fieldset>

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={latePenalty} onChange={(e) => setLatePenalty(e.target.checked)} />
          무신고 가산세 적용 (결정세액 × 20%)
        </label>

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
          <h2 className="text-2xl font-bold tracking-wide text-slate-900">종합소득세 신고 계산서</h2>
          <p className="mt-1 text-sm text-slate-600">{taxYear}년 귀속 (다음해 5/1~5/31 신고)</p>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
          <Info label="상호" value={companyName || "_____________"} />
          <Info label="사업자등록번호" value={bizNo || "_____________"} />
          <Info label="대표자" value={ownerName || "_____________"} />
          <Info label="신고방식" value={mode === "ledger" ? "장부 작성" : `추계 (${expenseRate}%)`} />
        </section>

        <Section title="① 수입금액 → 사업소득금액">
          <Row label="총수입금액" value={revenue} />
          <Row label="− 필요경비" value={-calc.expenseAmount} muted />
          <Row label="사업소득금액" value={calc.businessIncome} strong />
        </Section>

        <Section title="② 소득공제">
          <Row label={`인적 기본공제 (${dependents}명 × 150만)`} value={calc.basicDed} muted />
          {calc.seniorDed > 0 && <Row label={`경로우대 (${seniorDependents}명 × 100만)`} value={calc.seniorDed} muted />}
          {calc.disabledDed > 0 && <Row label={`장애인 (${disabledDependents}명 × 200만)`} value={calc.disabledDed} muted />}
          {calc.otherDed > 0 && <Row label="기타 (연금·보험 등)" value={calc.otherDed} muted />}
          <Row label="공제 합계" value={-(calc.personalDed + calc.otherDed)} strong />
        </Section>

        <Section title="③ 과세표준 / 산출세액">
          <Row label="과세표준" value={calc.taxBase} />
          <Row
            label={`적용세율 ${(calc.bracket.rate * 100).toFixed(0)}% (누진공제 ${fmt(calc.bracket.deduction)})`}
            value={calc.calculatedTax}
            strong
          />
        </Section>

        <Section title="④ 세액공제">
          <Row label="자녀세액공제" value={calc.childCredit} muted />
          <Row label="표준세액공제" value={calc.standardCredit} muted />
          {calc.pensionCredit > 0 && <Row label="연금계좌 (13.2%)" value={calc.pensionCredit} muted />}
          {calc.donationCredit > 0 && <Row label="기부금" value={calc.donationCredit} muted />}
          {calc.medicalCredit > 0 && <Row label="의료비 (3% 초과분 15%)" value={calc.medicalCredit} muted />}
          {calc.educationCredit > 0 && <Row label="교육비 (15%)" value={calc.educationCredit} muted />}
          <Row label="세액공제 합계" value={-calc.taxCredit} strong />
        </Section>

        <Section title="⑤ 결정세액 / 납부세액">
          <Row label="결정세액 (산출 − 세액공제)" value={calc.determinedTax} />
          {calc.penalty > 0 && <Row label="+ 무신고 가산세 (20%)" value={calc.penalty} muted />}
          <Row label="+ 지방소득세 (10%)" value={calc.localTax} muted />
          <Row label="최종 납부세액" value={calc.totalPayable} big />
        </Section>

        <footer className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500">
          ※ 본 계산은 안내용입니다. 단순/기준경비율 적용 대상 여부·세액공제 한도·성실신고확인
          여부 등은 실제 신고 전 검토 필요. 지방소득세는 위택스(wetax.go.kr)에서 별도 신고.
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

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
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

function Num({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-600">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono text-sm"
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
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Row({ label, value, big, strong, muted }: { label: string; value: number; big?: boolean; strong?: boolean; muted?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-100 py-1.5 last:border-b-0 ${
        big ? "border-t-2 border-slate-800 text-base font-bold text-brand-700"
          : strong ? "font-semibold text-slate-900"
            : muted ? "text-slate-500"
              : "text-slate-800"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono">{value < 0 ? `−${fmt(-value)}` : fmt(value)} 원</span>
    </div>
  );
}
