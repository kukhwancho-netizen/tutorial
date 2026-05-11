import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";

export default async function PayrollListPage({
  params,
}: {
  params: { id: string };
}) {
  let client;
  try {
    ({ client } = await requireClientAccess(params.id));
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.status === 401) {
        redirect(`/login?next=/clients/${encodeURIComponent(params.id)}/payroll`);
      }
      notFound();
    }
    throw e;
  }

  const entries = await db.payrollEntry.findMany({
    where: { clientId: client.id },
    orderBy: { payDate: "desc" },
    take: 50,
  });

  // 월별 그룹핑
  const byMonth = new Map<string, typeof entries>();
  for (const e of entries) {
    const ym = e.payDate.toISOString().slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym)!.push(e);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/clients/${client.id}`} className="text-xs text-brand-600 hover:underline">
            ← {client.name}
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-800">급여명세서</h1>
          <p className="mt-1 text-sm text-slate-500">
            직원·월별 급여명세서를 생성·관리합니다. 4대보험·원천세 자동 계산.
          </p>
        </div>
        <Link
          href={`/clients/${client.id}/payroll/new`}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          + 명세서 생성
        </Link>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          아직 생성된 명세서가 없습니다. 우상단 “+ 명세서 생성”으로 시작하세요.
        </p>
      ) : (
        <div className="space-y-4">
          {Array.from(byMonth.entries()).map(([ym, list]) => (
            <section key={ym} className="rounded-lg border border-slate-200 bg-white">
              <header className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                {ym} ({list.length}명)
              </header>
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2 text-left">지급일</th>
                    <th className="px-4 py-2 text-left">직원</th>
                    <th className="px-4 py-2 text-right">총급여</th>
                    <th className="px-4 py-2 text-right">공제 합계</th>
                    <th className="px-4 py-2 text-right">실수령액</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => {
                    const totalDeduction =
                      e.nationalPension + e.healthIns + e.longTermCare +
                      e.employmentIns + e.incomeTax + e.localIncomeTax;
                    const net = e.grossPay - totalDeduction;
                    return (
                      <tr key={e.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-2 font-mono text-xs text-slate-600">
                          {e.payDate.toISOString().slice(0, 10)}
                        </td>
                        <td className="px-4 py-2">{e.employeeName}</td>
                        <td className="px-4 py-2 text-right font-mono">{fmt(e.grossPay)}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-500">
                          −{fmt(totalDeduction)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-brand-700">
                          {fmt(net)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            href={`/clients/${client.id}/payroll/${e.id}`}
                            className="text-xs text-brand-600 hover:underline"
                          >
                            보기·인쇄
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
