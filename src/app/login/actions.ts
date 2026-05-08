"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clearSession, readSession, writeSession } from "@/lib/auth/session";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "이메일을 입력하세요." };

  const user = await db.user.findFirst({
    where: { email },
    include: { memberships: true },
  });
  if (!user) return { error: "등록되지 않은 사용자입니다. (시드 데이터 사용)" };

  writeSession({
    userId: user.id,
    email: user.email,
    role: user.role,
    firmId: user.firmId ?? null,
    activeClientId: user.memberships[0]?.clientId,
  });
  redirect("/");
}

export async function logoutAction() {
  clearSession();
  redirect("/login");
}

export async function switchClientAction(formData: FormData) {
  const session = readSession();
  if (!session) redirect("/login");

  const clientId = String(formData.get("clientId") ?? "");
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return { error: "고객사를 찾을 수 없습니다." };

  if (session!.role === "ACCOUNTANT") {
    if (session!.firmId !== client.firmId) {
      return { error: "다른 사무소의 고객사로는 전환할 수 없습니다." };
    }
  } else {
    const m = await db.membership.findUnique({
      where: { userId_clientId: { userId: session!.userId, clientId } },
    });
    if (!m) return { error: "접근 권한이 없습니다." };
  }

  writeSession({ ...session!, activeClientId: clientId });
  redirect("/");
}
