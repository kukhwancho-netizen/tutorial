"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-white p-8 text-center">
      <p className="text-sm font-medium text-red-600">오류</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-800">
        요청을 처리하는 중에 문제가 발생했습니다
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        잠시 후 다시 시도해 주세요. 문제가 지속되면 관리자에게 문의해 주세요.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-slate-400">코드 {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
      >
        다시 시도
      </button>
    </div>
  );
}
