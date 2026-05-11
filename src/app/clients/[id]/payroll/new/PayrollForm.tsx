"use client";

import { useFormState } from "react-dom";
import { useMemo, useState } from "react";
import { fmt } from "@/lib/format";
import { calcPayslip, NON_TAX_LIMITS } from "@/lib/payroll/payslip";
import { createPayrollAction, type State } from "./actions";

const initial: State = {};

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Prefill = {
  employeeName: string;
  payDate: string;
  grossPay: number;
  nonTaxablePay: number;
  dependents: number;
  childrenUnder20: number;
} | null;

export function PayrollForm({
  clientId,
  recentNames,
  prefill,
}: {
  clientId: string;
  recentNames: string[];
  prefill: Prefill;
}) {
  const [state, action] = useFormState(createPayrollAction, initial);
  const [employeeName, setEmployeeName] = useState(prefill?.employeeName ?? "");
  const [payDate, setPayDate] = useState(prefill?.payDate ?? todayISO());
  const [grossPay, setGrossPay] = useState(prefill?.grossPay ?? 0);
  // 비과세는 복제 시 합계만 알지 항목별은 모르니 일단 식대만 채움
  const [nonTaxMeal, setNonTaxMeal] = useState(prefill ? Math.min(prefill.nonTaxablePay, 200_000) : 0);
  const [nonTaxCarAllowance, setNonTaxCarAllowance] = useState(0);
  const [nonTaxChildcare, setNonTaxChildcare] = useState(0);
  const [nonTaxOther, setNonTaxOther] = useState(0);
  const [dependents, setDependents] = useState(prefill?.dependents ?? 1);
  const [children, setChildren] = useState(prefill?.childrenUnder20 ?? 0);
  const [firmSize, setFirmSize] = useState<"SMALL" | "MID_LARGE">("SMALL");

  const preview = useMemo(
    () =>
      calcPayslip({
        clientId,
        payDate: new Date(payDate || todayISO()),
        employeeName,
        grossPay,
        nonTaxMeal,
        nonTaxCarAllowance,
        nonTaxChildcare,
        nonTaxOther,
        dependents,
        childrenUnder20: children,
        firmSize,
      }),
    [
      clientId,
      payDate,
      employeeName,
      grossPay,
      nonTaxMeal,
      nonTaxCarAllowance,
      nonTaxChildcare,
      nonTaxOther,
      dependents,
      children,
      firmSize,
    ],
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="직원 이름">
            <input
              name="employeeName"
              type="text"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              list="recent-employees"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <datalist id="recent-employees">
              {recentNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
          <Field label="지급일">
            <input
              name="payDate"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Money
          name="grossPay"
          label="월 급여 총액 (세전, 비과세 포함)"
          value={grossPay}
          onChange={setGrossPay}
        />

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">비과세 항목 (월)</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Money name="nonTaxMeal" label="식대" value={nonTaxMeal} onChange={setNonTaxMeal} hint={`한도 ${fmt(NON_TAX_LIMITS.meal)}`} />
            <Money name="nonTaxCarAllowance" label="자가운전보조금" value={nonTaxCarAllowance} onChange={setNonTaxCarAllowance} hint={`한도 ${fmt(NON_TAX_LIMITS.carAllowance)}`} />
            <Money name="nonTaxChildcare" label="출산·보육수당 (6세 이하)" value={nonTaxChildcare} onChange={setNonTaxChildcare} hint={`한도 ${fmt(NON_TAX_LIMITS.childcare)}`} />
            <Money name="nonTaxOther" label="기타 비과세" value={nonTaxOther} onChange={setNonTaxOther} hint="연구활동비·일직숙직 등" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="부양가족 수">
            <input
              name="dependents"
              type="number"
              min={1}
              value={dependents}
              onChange={(e) => setDependents(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono"
            />
          </Field>
          <Field label="8세~20세 자녀">
            <input
              name="childrenUnder20"
              type="number"
              min={0}
              value={children}
              onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono"
            />
          </Field>
          <Field label="사업장 규모">
            <select
              name="firmSize"
              value={firmSize}
              onChange={(e) => setFirmSize(e.target.value as "SMALL" | "MID_LARGE")}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="SMALL">150인 미만</option>
              <option value="MID_LARGE">150인 이상</option>
            </select>
          </Field>
        </div>
      </section>

      {/* 자동 미리보기 */}
      <section className="rounded-lg border-2 border-brand-200 bg-brand-50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-brand-700">자동 계산 미리보기</h3>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <Row label="총급여" value={preview.grossPay} />
            <Row label="− 비과세 합계" value={-preview.nonTaxablePay} muted />
            <Row label="과세 보수월액" value={preview.taxableSalary} muted />
            <hr className="my-1 border-slate-200" />
            <Row label="− 4대보험 (근로자)" value={-preview.employee.totalDeduction + preview.employee.incomeTax + preview.employee.localTax} />
            <Row label="− 원천세" value={-(preview.employee.incomeTax + preview.employee.localTax)} />
            <Row label="실수령액" value={preview.netPay} bold large />
          </div>
          <div>
            <Row label="총급여 (사장님 지급)" value={preview.grossPay} />
            <Row label="+ 4대보험 사업주분" value={preview.employer.totalBurden} />
            <Row label="총 인건비" value={preview.employerCost} bold large />
          </div>
        </div>
      </section>

      {state.error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          명세서 저장
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Money({
  name,
  label,
  value,
  onChange,
  hint,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        name={name}
        inputMode="numeric"
        value={value === 0 ? "" : value.toLocaleString("ko-KR")}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^0-9-]/g, ""));
          onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Row({
  label,
  value,
  bold,
  large,
  muted,
}: {
  label: string;
  value: number;
  bold?: boolean;
  large?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1 ${
        large ? "text-base" : "text-sm"
      } ${bold ? "font-bold text-brand-700" : muted ? "text-slate-500" : "text-slate-700"}`}
    >
      <span>{label}</span>
      <span className="font-mono">{value < 0 ? `−${fmt(-value)}` : fmt(value)}</span>
    </div>
  );
}
