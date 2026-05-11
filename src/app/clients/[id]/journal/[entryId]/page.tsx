import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";

export default async function JournalEntryDetailPage({
  params,
}: {
  params: { id: string; entryId: string };
}) {
  let client;
  try {
    ({ client } = await requireClientAccess(params.id));
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.status === 401) {
        redirect(`/login?next=/clients/${encodeURIComponent(params.id)}/journal/${params.entryId}`);
      }
      notFound();
    }
    throw e;
  }

  const entry = await db.journalEntry.findFirst({
    where: { id: params.entryId, clientId: client.id },
    include: {
      lines: { include: { account: true } },
      receiptItems: true,
    },
  });
  if (!entry) notFound();

  const dirLabel =
    entry.vatDirection === "SALE" ? "매출" : entry.vatDirection === "PURCHASE" ? "매입" : "면세";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <Link href={`/clients/${client.id}`} className="text-xs text-brand-600 hover:underline">
          ← {client.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">분개 상세</h1>
      </header>

      <article className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <Info label="거래일자" value={entry.occurredOn.toISOString().slice(0, 10)} />
          <Info label="거래처" value={entry.counterparty ?? "-"} />
          <Info label="구분" value={dirLabel} />
          <Info label="비용 분류" value={entry.category ?? "-"} />
          <Info label="적요" value={entry.description ?? "-"} />
        </div>

        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm">
          <Row label="공급가액" value={entry.supplyAmount} />
          <Row label="부가세" value={entry.vatAmount} />
          <Row label="합계금액" value={entry.totalAmount} emphasis />
        </div>

        {entry.receiptItems.length > 0 && (
          <>
            <h2 className="mt-5 mb-2 text-sm font-semibold text-slate-700">📋 영수증 라인 명세</h2>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-1 text-left">품목</th>
                  <th className="py-1 text-right">수량</th>
                  <th className="py-1 text-right">단가</th>
                  <th className="py-1 text-right">금액</th>
                </tr>
              </thead>
              <tbody>
                {entry.receiptItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-1">{item.name}</td>
                    <td className="py-1 text-right font-mono">
                      {item.quantity === 1 ? "-" : item.quantity}
                    </td>
                    <td className="py-1 text-right font-mono">
                      {item.unitPrice > 0 ? fmt(item.unitPrice) : "-"}
                    </td>
                    <td className="py-1 text-right font-mono">{fmt(item.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-800 font-semibold">
                  <td colSpan={3} className="py-1">합계</td>
                  <td className="py-1 text-right font-mono">
                    {fmt(entry.receiptItems.reduce((s, i) => s + i.amount, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <h2 className="mt-5 mb-2 text-sm font-semibold text-slate-700">분개 라인 (차변·대변)</h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-1 text-left">계정과목</th>
              <th className="py-1 text-right">차변</th>
              <th className="py-1 text-right">대변</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="py-1">{l.account.code} {l.account.name}</td>
                <td className="py-1 text-right font-mono">{l.debit > 0 ? fmt(l.debit) : ""}</td>
                <td className="py-1 text-right font-mono">{l.credit > 0 ? fmt(l.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      {entry.receiptImage ? (
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">📎 영수증/세금계산서</h2>
          <a href={entry.receiptImage} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.receiptImage}
              alt="영수증"
              className="max-h-[600px] rounded border border-slate-300"
            />
          </a>
          <p className="mt-2 text-xs text-slate-500">
            클릭하면 새 탭에서 원본 크기로 보입니다. 우클릭 → 이미지 저장으로 보관 가능.
          </p>
        </article>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
          첨부된 영수증이 없습니다. (분개 입력 시 사진 첨부 가능)
        </p>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>
      <div className="text-slate-800">{value}</div>
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-200 py-1 last:border-b-0 ${
        emphasis ? "text-base font-semibold text-brand-700" : "text-slate-700"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono">{fmt(value)}</span>
    </div>
  );
}
