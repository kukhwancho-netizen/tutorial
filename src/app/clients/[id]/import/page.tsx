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
        <h2 className="mb-2 font-semibold text-slate-700">지원 데이터 소스</h2>
        <table className="w-full">
          <thead className="text-slate-500">
            <tr>
              <th className="py-0.5 text-left font-normal">종류</th>
              <th className="py-0.5 text-left font-normal">다운로드 경로</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            <tr><td className="py-0.5 pr-3">매출 세금계산서 합계표</td><td>홈택스 → 조회/발급 → 매출·매입처별 세금계산서 합계표</td></tr>
            <tr><td className="py-0.5 pr-3">매입 세금계산서 합계표</td><td>위와 동일 (매입 시트)</td></tr>
            <tr><td className="py-0.5 pr-3">현금영수증 발행내역</td><td>홈택스 → 조회/발급 → 현금영수증 → 발행 내역 조회</td></tr>
            <tr><td className="py-0.5 pr-3">현금영수증 사용내역</td><td>홈택스 → 조회/발급 → 현금영수증 → 사용 내역 조회</td></tr>
            <tr><td className="py-0.5 pr-3">카드 매출내역</td><td>카드사 단말기 정산 화면 또는 PG사 엑셀</td></tr>
            <tr><td className="py-0.5 pr-3">사업용 카드 사용내역</td><td>카드사 홈페이지 → 청구내역 → 엑셀 다운로드</td></tr>
          </tbody>
        </table>
        <p className="mt-3 font-semibold text-slate-700">자동 매핑 컬럼 (헤더명 유연 대응)</p>
        <ul className="mt-1 space-y-0.5">
          <li>• <b>일자</b>: 거래일자 / 작성일자 / 발급일자 / 일자 / 날짜 / 사용일자</li>
          <li>• <b>거래처</b>: 거래처 / 상호 / 매출처 / 매입처 / 공급자 / 가맹점명</li>
          <li>• <b>공급가액</b>: 공급가액 / 과세표준 / 매출액 / 매입액</li>
          <li>• <b>세액</b>: 세액 / 부가세 / 부가가치세액</li>
          <li>• <b>합계</b>: 합계 / 합계금액 / 총액 / 금액</li>
        </ul>
        <p className="mt-2">
          매입 데이터는 가맹점명으로 비용 분류(식자재/차량유지/통신비/광고선전비/사무용품/복리후생 등)를 자동 추천합니다.
        </p>
      </section>
    </div>
  );
}
