"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clearSession, readSession, writeSession } from "@/lib/auth/session";

// 오픈 리다이렉트 방지: 같은 출처의 절대 경로(/로 시작, //은 거부)만 허용
function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(formData.get("next"));
  if (!email) return { error: "이메일을 입력하세요." };

  const user = await db.user.findFirst({
    where: { email },
    include: { memberships: true },
  });
  if (!user) return { error: "등록되지 않은 사용자입니다. (시드 데이터 사용)" };

  if (user.role !== "ACCOUNTANT" && user.role !== "CLIENT") {
    return { error: "사용자 역할이 잘못되어 있습니다." };
  }
  writeSession({
    userId: user.id,
    email: user.email,
    role: user.role,
    firmId: user.firmId ?? null,
    activeClientId: user.memberships[0]?.clientId,
  });
  redirect(next);
}

export async function logoutAction() {
  clearSession();
  redirect("/login");
}

export async function switchClientAction(formData: FormData): Promise<void> {
  const session = readSession();
  if (!session) {
    redirect("/login");
  }

  const clientId = String(formData.get("clientId") ?? "");
  const client = await db.client.findUnique({ where: { id: clientId } });
  // 권한 위반은 silent — 폼은 select로 본인이 접근 가능한 옵션만 노출되므로
  // 여기 도달하는 위반 시도는 클라이언트 사이드 조작이고, 응답하지 않는 게 맞다.
  if (!client) return;

  if (session.role === "ACCOUNTANT") {
    if (session.firmId !== client.firmId) return;
  } else {
    const m = await db.membership.findUnique({
      where: { userId_clientId: { userId: session.userId, clientId } },
    });
    if (!m) return;
  }

  writeSession({ ...session, activeClientId: clientId });
  redirect("/");
}
