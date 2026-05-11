import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";
import { payrollEntryToBreakdown } from "@/lib/payroll/payslip";
import { PrintButton } from "./PrintButton";

export default async function PayslipDetailPage({
  params,
}: {
  params: { id: string; payslipId: string };
}) {
  let client;
  try {
    ({ client } = await requireClientAccess(params.id));
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.status === 401) {
        redirect(`/login?next=/clients/${encodeURIComponent(params.id)}/payroll/${params.payslipId}`);
      }
      notFound();
    }
    throw e;
  }

  const entry = await db.payrollEntry.findFirst({
    where: { id: params.payslipId, clientId: client.id },
  });
  if (!entry) notFound();

  const b = payrollEntryToBreakdown(entry);
  const ym = entry.payDate.toISOString().slice(0, 7);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* 화면 전용 헤더 (인쇄 시 숨김) */}
      <header className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/clients/${client.id}/payroll`}
          className="text-xs text-brand-600 hover:underline"
        >
          ← 명세서 목록
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/clients/${client.id}/payroll/new?duplicate=${entry.id}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-brand-500"
          >
            다음 달 복제
          </Link>
          <PrintButton />
        </div>
      </header>

      {/* 인쇄 영역 */}
      <article className="rounded-lg border border-slate-300 bg-white p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-800 pb-3">
          <h1 className="text-2xl font-bold text-slate-900">급여명세서</h1>
          <p className="mt-1 text-sm text-slate-600">{ym} ({entry.payDate.toISOString().slice(0, 10)} 지급)</p>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <Info label="사업장" value={client.name} />
          <Info label="사업자등록번호" value={client.bizNo} />
          <Info label="대표자" value={client.ownerName ?? "-"} />
          <Info label="직원 성명" value={entry.employeeName} bold />
        </section>

        <section className="mt-6">
          <h2 className="border-b border-slate-300 pb-1 text-sm font-semibold text-slate-700">지급내역</h2>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Line label="기본급 + 수당 (총급여)" value={entry.grossPay} />
            <Line label="비과세 (식대 등)" value={entry.nonTaxablePay} muted />
            <Line label="과세 보수월액" value={b.taxableSalary} muted />
            <Line label="지급액 합계" value={entry.grossPay} strong />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="border-b border-slate-300 pb-1 text-sm font-semibold text-slate-700">공제내역</h2>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Line label="국민연금 (4.5%)" value={b.employee.nationalPension} />
            <Line label="건강보험 (3.545%)" value={b.employee.healthInsurance} />
            <Line label="장기요양보험" value={b.employee.longTermCare} />
            <Line label="고용보험 (0.9%)" value={b.employee.employmentInsurance} />
            <Line label="소득세" value={b.employee.incomeTax} />
            <Line label="지방소득세" value={b.employee.localTax} />
            <Line label="공제 합계" value={b.employee.totalDeduction} strong />
          </div>
        </section>

        <section className="mt-6 border-t-2 border-slate-800 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-slate-900">실지급액</span>
            <span className="font-mono text-2xl font-bold text-brand-700">{fmt(b.netPay)}원</span>
          </div>
        </section>

        <section className="mt-6 rounded-md bg-slate-50 p-3 text-xs text-slate-600 print:hidden">
          <p className="font-semibold">참고 — 사업주 부담 (직원에게는 표시되지 않음)</p>
          <div className="mt-1 grid grid-cols-2 gap-x-6">
            <Line label="국민연금 사업주분" value={b.employer.nationalPension} small />
            <Line label="건강보험 사업주분" value={b.employer.healthInsurance} small />
            <Line label="장기요양 사업주분" value={b.employer.longTermCare} small />
            <Line label="고용보험 사업주분" value={b.employer.employmentInsurance} small />
            <Line label="산재보험" value={b.employer.workersComp} small />
            <Line label="사업주 부담 합계" value={b.employer.totalBurden} small strong />
            <Line label="총 인건비 (총급여 + 부담)" value={b.employerCost} small strong />
          </div>
        </section>

        <footer className="mt-8 text-xs text-slate-500 print:mt-12">
          본 명세서는 자동 계산 결과이며, 정확한 소득세는 국세청 근로소득 간이세액표에 따릅니다.
          이의 있을 시 7일 이내 인사담당자에게 문의 바랍니다.
        </footer>
      </article>

      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { background: white !important; }
          header.print\\:hidden, footer { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Info({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 ${bold ? "font-bold text-slate-900" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}

function Line({
  label,
  value,
  muted,
  strong,
  small,
}: {
  label: string;
  value: number;
  muted?: boolean;
  strong?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-200 py-1 last:border-b-0 ${
        small ? "text-xs" : "text-sm"
      } ${strong ? "font-semibold text-slate-900" : muted ? "text-slate-500" : "text-slate-700"}`}
    >
      <span>{label}</span>
      <span className="font-mono">{fmt(value)}</span>
    </div>
  );
}
