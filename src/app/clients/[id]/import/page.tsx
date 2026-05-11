import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { ImportForm } from "./ImportForm";

export default async function ImportPage({
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
        redirect(`/login?next=/clients/${encodeURIComponent(params.id)}/import`);
      }
      notFound();
    }
    throw e;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <Link href={`/clients/${client.id}`} className="text-xs text-brand-600 hover:underline">
          ← {client.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">홈택스 엑셀 임포트</h1>
        <p className="mt-1 text-sm text-slate-500">
          홈택스에서 다운로드한 매출/매입처별 세금계산서 합계표 (CSV/XLSX)를 업로드하면 표준 분개로 일괄 저장됩니다.
        </p>
      </header>

      <ImportForm clientId={client.id} />

      <section className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <h2 className="mb-2 font-semibold text-slate-700">지원 컬럼 (자동 감지)</h2>
        <ul className="space-y-0.5">
          <li>• <b>거래일자</b>: 거래일자 / 작성일자 / 발급일자 / 일자 / 날짜</li>
          <li>• <b>거래처</b>: 거래처 / 상호 / 매출처 / 매입처 / 공급자 / 공급받는자 / 업체명</li>
          <li>• <b>사업자번호</b>: 사업자등록번호 / 사업자번호 / 등록번호 (선택)</li>
          <li>• <b>공급가액</b>: 공급가액 / 과세표준 / 매출액 / 매입액</li>
          <li>• <b>세액</b>: 세액 / 부가세 / 부가가치세액 (선택)</li>
          <li>• <b>합계</b>: 합계 / 합계금액 / 총액 / 금액 (선택)</li>
        </ul>
        <p className="mt-2">
          시트명·헤더에 &quot;매출&quot;/&quot;매입&quot;이 포함되면 자동으로 구분합니다. 헷갈리면 위에서 명시 선택.
        </p>
      </section>
    </div>
  );
}
