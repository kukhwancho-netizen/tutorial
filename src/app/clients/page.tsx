import Link from "next/link";

// 거래처 페이지는 다음 PR에서 Prisma 연동으로 확장한다.
// 현재는 시드 데이터 기반의 정적 미리보기.
const SAMPLE_CLIENTS = [
  {
    id: "demo-client-sample",
    name: "샘플상사",
    bizNo: "111-22-33333",
    ownerName: "홍길동",
    bizType: "개인 일반과세자",
    industry: "도소매",
  },
];

export default function ClientsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">거래처 (고객사)</h1>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          DB 연동은 다음 단계 (Prisma + SQLite)
        </span>
      </div>

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
            {SAMPLE_CLIENTS.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 font-mono">{c.bizNo}</td>
                <td className="px-4 py-3">{c.ownerName}</td>
                <td className="px-4 py-3">{c.bizType}</td>
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
    </div>
  );
}
