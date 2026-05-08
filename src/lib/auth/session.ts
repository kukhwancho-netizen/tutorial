// 데모 세션: 서명된 쿠키 1개로 (userId, activeClientId)를 보관한다.
// 비밀번호는 시드 데이터에 미존재 — 이메일만으로 로그인되는 데모 모드.
// 실서비스에서는 NextAuth(Email/Credentials/SAML)로 교체할 것.

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "demo_session";
const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret";

export type Session = {
  userId: string;
  email: string;
  role: "ACCOUNTANT" | "CLIENT";
  firmId?: string | null;
  /** 현재 작업 중인 고객사. 세무사가 여러 고객사를 다룰 때 전환된다. */
  activeClientId?: string;
};

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function verify(payload: string, sig: string): boolean {
  const expected = sign(payload);
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function readSession(): Session | null {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [b64, sig] = raw.split(".");
  if (!b64 || !sig) return null;
  if (!verify(b64, sig)) return null;
  try {
    return JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as Session;
  } catch {
    return null;
  }
}

export function writeSession(session: Session) {
  const b64 = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = sign(b64);
  cookies().set(COOKIE_NAME, `${b64}.${sig}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // 데모용. 운영에서는 secure: true + 짧은 만료 + 회전.
    maxAge: 60 * 60 * 24,
  });
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}
