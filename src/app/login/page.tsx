"use client";

import { useFormState } from "react-dom";
import { loginAction } from "./actions";

const initialState = { error: undefined as string | undefined };

// 클라이언트용 next 검증 (서버 액션에서 한 번 더 검증되므로 1차 방어)
function clientSafeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const [state, formAction] = useFormState(loginAction, initialState);
  const next = clientSafeNext(searchParams?.next);

  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-8">
      <h1 className="text-xl font-semibold text-slate-800">로그인</h1>
      <p className="mt-1 text-sm text-slate-500">
        데모 모드: 비밀번호 없이 이메일만으로 로그인됩니다.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        세무사 <span className="font-mono">accountant@example.com</span> · 고객사{" "}
        <span className="font-mono">owner@sample.co.kr</span>
      </p>

      <form action={formAction} className="mt-5 space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="text-sm font-medium text-slate-700">이메일</span>
          <input
            name="email"
            type="email"
            required
            autoFocus
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
        >
          로그인
        </button>
      </form>
    </div>
  );
}
