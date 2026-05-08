export default function ClientDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">거래처 상세</h1>
      <p className="text-sm text-slate-600">
        선택된 거래처: <span className="font-mono">{params.id}</span>
      </p>
      <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        전표 입력·신고 자료 조회 화면은 다음 단계(Prisma 연동)에서 구현됩니다.
      </div>
    </div>
  );
}
