import Link from "next/link";
import { listAccessibleClients } from "@/lib/auth/guard";
import { readSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const BIZ_TYPE_LABEL: Record<string, string> = {
  CORPORATION: "법인사업자",
  SOLE_GENERAL: "개인 일반과세자",
  SOLE_SIMPLIFIED: "개인 간이과세자",
  SOLE_TAX_FREE: "면세사업자",
};

export default async function ClientsPage() {
  if (!readSession()) redirect("/login?next=/clients");
  const clients = await listAccessibleClients();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">거래처 (고객사)</h1>

      {clients.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          접근 가능한 고객사가 없습니다.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">상호</th>
                <th className="px-4 py-3">사업자번호</th>
                <th className="px-4 py-3">대표자</th>
                <th className="px-4 py-3">과세유형</th>
                <th className="px-4 py-3">업종</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono">{c.bizNo}</td>
                  <td className="px-4 py-3">{c.ownerName}</td>
                  <td className="px-4 py-3">{BIZ_TYPE_LABEL[c.bizType]}</td>
                  <td className="px-4 py-3">{c.industry}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/clients/${c.id}`} className="text-brand-600 hover:underline">
                      상세
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
