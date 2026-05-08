"use client";

import { useFormState } from "react-dom";
import { loginAction } from "./actions";

const initialState = { error: undefined as string | undefined };

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-8">
      <h1 className="text-xl font-semibold text-slate-800">로그인</h1>
      <p className="mt-1 text-sm text-slate-500">
        데모 계정: <span className="font-mono">accountant@example.com</span> (세무사) /{" "}
        <span className="font-mono">owner@sample.co.kr</span> (고객사)
      </p>

      <form action={formAction} className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">이메일</span>
          <input
            name="email"
            type="email"
            required
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
