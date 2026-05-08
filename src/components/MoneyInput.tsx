"use client";

import { fmt as _fmt } from "@/lib/format";

type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  min?: number;
};

export function MoneyInput({ label, value, onChange, hint, min = 0 }: Props) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value === 0 ? "" : value.toLocaleString("ko-KR")}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^0-9-]/g, ""));
          onChange(Number.isFinite(n) && n >= min ? n : 0);
        }}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

// 호환을 위해 re-export (계산기 페이지들이 여기서 import 중)
export const fmt = _fmt;
