// 오픈 리다이렉트 방지: 같은 출처의 절대 경로(/로 시작, // 거부)만 허용.
// 클라이언트(login page)와 서버 액션(loginAction) 양쪽에서 사용.

export function safeNext(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}
