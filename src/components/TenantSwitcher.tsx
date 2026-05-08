// 서버 컴포넌트 — 세션을 직접 읽고 접근 가능한 고객사만 노출.
import { listAccessibleClients } from "@/lib/auth/guard";
import { readSession } from "@/lib/auth/session";
import { switchClientAction, logoutAction } from "@/app/login/actions";
import { ClientSelect } from "./ClientSelect";

export async function TenantSwitcher() {
  const session = readSession();
  if (!session) {
    return (
      <a href="/login" className="text-sm text-brand-600 hover:underline">
        로그인
      </a>
    );
  }

  const clients = await listAccessibleClients();

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
        {session.role === "ACCOUNTANT" ? "세무사" : "고객사"} · {session.email}
      </span>
      {clients.length > 0 && (
        <form action={switchClientAction} className="flex items-center gap-2">
          <ClientSelect
            options={clients.map((c) => ({ id: c.id, name: c.name }))}
            defaultValue={session.activeClientId}
          />
        </form>
      )}
      <form action={logoutAction}>
        <button className="text-slate-500 hover:text-slate-700">로그아웃</button>
      </form>
    </div>
  );
}
