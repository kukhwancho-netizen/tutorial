// 쿠키·Next 의존 없는 권한 검증 코어.
// - Next 라우트는 guard.ts(cookies()로 세션 읽음 → 이 함수 호출)
// - MCP/배치/CLI는 ResolvedUser를 직접 만들어 이 함수 호출
//
// 단일 권한 모델:
//   ACCOUNTANT: 자기 사무소(firmId)의 모든 고객사 + 본인 Membership
//   CLIENT:     본인 Membership 고객사만

import { db } from "@/lib/db";

export type Role = "ACCOUNTANT" | "CLIENT";

export type ResolvedUser = {
  userId: string;
  email: string;
  role: Role;
  firmId: string | null;
};

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** 고객사 단건 접근 검증 + 반환 */
export async function checkClientAccess(user: ResolvedUser, clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AuthError("고객사를 찾을 수 없습니다.", 404);

  if (user.role === "ACCOUNTANT" && user.firmId === client.firmId) return client;

  const m = await db.membership.findUnique({
    where: { userId_clientId: { userId: user.userId, clientId } },
  });
  if (!m) throw new AuthError("권한이 없습니다.", 403);

  return client;
}

/** 사용자가 접근 가능한 고객사 목록 */
export async function findAccessibleClients(user: ResolvedUser) {
  if (user.role === "ACCOUNTANT" && user.firmId) {
    return db.client.findMany({ where: { firmId: user.firmId }, orderBy: { name: "asc" } });
  }
  const memberships = await db.membership.findMany({
    where: { userId: user.userId },
    include: { client: true },
  });
  return memberships.map((m) => m.client);
}

/** email로 사용자 찾고 ResolvedUser로 정규화. MCP/CLI용. */
export async function resolveUserByEmail(email: string): Promise<ResolvedUser> {
  const u = await db.user.findFirst({ where: { email: email.toLowerCase() } });
  if (!u) throw new AuthError(`사용자(${email})를 찾을 수 없습니다.`, 404);
  if (u.role !== "ACCOUNTANT" && u.role !== "CLIENT") {
    throw new AuthError(`사용자 역할이 비정상: ${u.role}`, 500);
  }
  return { userId: u.id, email: u.email, role: u.role, firmId: u.firmId ?? null };
}
