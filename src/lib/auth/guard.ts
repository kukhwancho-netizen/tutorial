// Next.js 라우트용 권한 가드. cookies()로 세션을 읽고 guardCore에 위임.
// 비-Next 컨텍스트(MCP·CLI·테스트)는 guardCore의 함수를 직접 사용.

import { readSession, type Session } from "./session";
import {
  AuthError,
  checkClientAccess,
  findAccessibleClients,
  type ResolvedUser,
} from "./guardCore";

export { AuthError } from "./guardCore";
export type { ResolvedUser } from "./guardCore";

function sessionToUser(s: Session): ResolvedUser {
  return { userId: s.userId, email: s.email, role: s.role, firmId: s.firmId ?? null };
}

export function requireSession(): Session {
  const s = readSession();
  if (!s) throw new AuthError("로그인이 필요합니다.", 401);
  return s;
}

/** 현재 세션이 해당 고객사에 접근 가능한지 검증하고 client을 반환 */
export async function requireClientAccess(clientId: string) {
  const session = requireSession();
  const client = await checkClientAccess(sessionToUser(session), clientId);
  return { session, client };
}

/** 현재 세션이 접근 가능한 고객사 목록 */
export async function listAccessibleClients() {
  const session = requireSession();
  return findAccessibleClients(sessionToUser(session));
}
