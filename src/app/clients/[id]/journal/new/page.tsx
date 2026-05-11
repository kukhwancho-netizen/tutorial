import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { JournalForm } from "./JournalForm";

export default async function NewJournalPage({
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
        redirect(`/login?next=/clients/${encodeURIComponent(params.id)}/journal/new`);
      }
      notFound();
    }
    throw e;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <Link href={`/clients/${client.id}`} className="text-xs text-brand-600 hover:underline">
          ← {client.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">신규 분개 입력 (간이 기장)</h1>
        <p className="mt-1 text-sm text-slate-500">
          매출/매입 + 공급가액을 입력하면 표준 분개와 부가세 분리가 자동 생성됩니다. 입력 즉시
          고객사 부가세 집계에 반영됩니다.
        </p>
      </header>

      <JournalForm clientId={client.id} />
    </div>
  );
}
