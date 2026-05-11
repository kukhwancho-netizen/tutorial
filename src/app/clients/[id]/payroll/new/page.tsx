import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PayrollForm } from "./PayrollForm";

export default async function NewPayrollPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { duplicate?: string };
}) {
  let client;
  try {
    ({ client } = await requireClientAccess(params.id));
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.status === 401) {
        redirect(`/login?next=/clients/${encodeURIComponent(params.id)}/payroll/new`);
      }
      notFound();
    }
    throw e;
  }

  // 최근 직원 이름 자동완성용
  const recent = await db.payrollEntry.findMany({
    where: { clientId: client.id },
    select: { employeeName: true },
    distinct: ["employeeName"],
    take: 30,
    orderBy: { payDate: "desc" },
  });

  // ?duplicate=<entryId>로 기존 명세서 복제 (다음 달 발급용)
  let prefill = null;
  if (searchParams?.duplicate) {
    const src = await db.payrollEntry.findFirst({
      where: { id: searchParams.duplicate, clientId: client.id },
    });
    if (src) {
      const next = new Date(src.payDate);
      next.setMonth(next.getMonth() + 1);
      prefill = {
        employeeName: src.employeeName,
        payDate: next.toISOString().slice(0, 10),
        grossPay: src.grossPay,
        nonTaxablePay: src.nonTaxablePay,
        dependents: src.dependents,
        childrenUnder20: src.childrenUnder20,
      };
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <Link
          href={`/clients/${client.id}/payroll`}
          className="text-xs text-brand-600 hover:underline"
        >
          ← 명세서 목록
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">신규 급여명세서</h1>
      </header>

      <PayrollForm
        clientId={client.id}
        recentNames={recent.map((r) => r.employeeName)}
        prefill={prefill}
      />
    </div>
  );
}
