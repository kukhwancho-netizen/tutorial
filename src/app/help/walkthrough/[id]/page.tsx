import Link from "next/link";
import { notFound } from "next/navigation";
import { WALKTHROUGHS } from "@/lib/help/walkthroughs";

export default function WalkthroughPage({ params }: { params: { id: string } }) {
  const w = WALKTHROUGHS[params.id];
  if (!w) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <Link href="/help/sites" className="text-xs text-brand-600 hover:underline">
          ← 사이트 사용법
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{w.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          소요시간 약 {w.totalMinutes}분 · 단계 {w.steps.length}개
        </p>
      </header>

      {/* 준비물 */}
      <section className="rounded-lg border-2 border-amber-300 bg-amber-50 p-5">
        <h2 className="mb-2 text-sm font-bold text-amber-900">📋 시작 전 준비물</h2>
        <ul className="ml-5 space-y-0.5 text-sm text-amber-800 list-disc">
          {w.prepare.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </section>

      {/* 단계별 */}
      <ol className="space-y-4">
        {w.steps.map((s) => (
          <li key={s.step} className="rounded-lg border-2 border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">
                {s.step}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-0.5 text-xs text-slate-500">📍 {s.where}</p>
              </div>
            </div>

            <div className="mt-3 ml-13">
              <h4 className="mb-1 text-xs font-semibold text-slate-700">할 일</h4>
              <ul className="ml-5 space-y-1 text-sm text-slate-800 list-decimal">
                {s.what.map((act, i) => <li key={i}>{act}</li>)}
              </ul>

              {s.warning && (
                <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                  ⚠️ <b>주의</b> · {s.warning}
                </div>
              )}

              {/* 캡쳐 자리 */}
              <div className="mt-3">
                <p className="text-xs text-slate-500">📷 화면 캡쳐</p>
                {s.screenshot ? (
                  <div className="mt-1 rounded border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-400">
                    <p className="font-mono">public/walkthrough/{w.id}/{s.screenshot}</p>
                    <p className="mt-1">
                      → 본인이 실제 화면을 캡쳐해서 위 경로에 넣으면 여기에 표시됩니다.
                      (현재는 placeholder)
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs italic text-slate-400">(이 단계는 캡쳐 불필요)</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* 신고 후 */}
      <section className="rounded-lg border-2 border-green-300 bg-green-50 p-5">
        <h2 className="mb-2 text-sm font-bold text-green-900">✅ 신고 완료 후 할 일</h2>
        <ul className="ml-5 space-y-0.5 text-sm text-green-800 list-disc">
          {w.afterFiling.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </section>

      <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        💡 캡쳐 추가: <code>public/walkthrough/{w.id}/</code> 폴더에 단계별 PNG 파일을 넣으세요.
        파일명은 각 단계의 <code>screenshot</code> 값과 동일하게.
      </p>
    </div>
  );
}
