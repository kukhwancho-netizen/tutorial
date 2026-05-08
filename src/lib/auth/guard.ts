// 서버사이드 테넌트 가드. 모든 거래처 데이터 접근은 이 함수를 거쳐야 한다.
// Membership 테이블을 통해 (userId × clientId) 접근권을 검증한다.

import { db } from "@/lib/db";
import { readSession, type Session } from "./session";

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function requireSession(): Session {
  const s = readSession();
  if (!s) throw new AuthError("로그인이 필요합니다.", 401);
  return s;
}

/** 현재 세션이 해당 고객사에 접근 가능한지 검증하고 client을 반환 */
export async function requireClientAccess(clientId: string) {
  const session = requireSession();

  // 세무사는 자기 사무소의 고객사 + 본인이 멤버인 고객사 모두 접근 가능
  // 고객사 사용자는 본인이 멤버인 고객사만 접근 가능
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AuthError("고객사를 찾을 수 없습니다.", 404);

  if (session.role === "ACCOUNTANT" && session.firmId === client.firmId) {
    return { session, client };
  }

  const membership = await db.membership.findUnique({
    where: { userId_clientId: { userId: session.userId, clientId } },
  });
  if (!membership) throw new AuthError("권한이 없습니다.", 403);

  return { session, client };
}

/** 현재 세션이 접근 가능한 고객사 목록 */
export async function listAccessibleClients() {
  const session = requireSession();

  if (session.role === "ACCOUNTANT" && session.firmId) {
    return db.client.findMany({
      where: { firmId: session.firmId },
      orderBy: { name: "asc" },
    });
  }

  const memberships = await db.membership.findMany({
    where: { userId: session.userId },
    include: { client: true },
  });
  return memberships.map((m) => m.client);
}
