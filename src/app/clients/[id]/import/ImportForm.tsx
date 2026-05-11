"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import { fmt } from "@/lib/format";
import {
  parseImportAction,
  commitImportAction,
  type ParseState,
} from "./actions";

const initialState: ParseState = { phase: "idle" };

const DIR_LABEL: Record<"SALE" | "PURCHASE", string> = {
  SALE: "매출",
  PURCHASE: "매입",
};

export function ImportForm({ clientId }: { clientId: string }) {
  const [parseState, parseDispatch] = useFormState(parseImportAction, initialState);
  const [commitState, commitDispatch] = useFormState(commitImportAction, initialState);

  // commit 후 결과 우선 노출
  const state: ParseState =
    commitState.phase === "imported" || commitState.phase === "error"
      ? commitState
      : parseState;

  return (
    <div className="space-y-4">
      {/* Step 1. 업로드 + 파싱 */}
      <form action={parseDispatch} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <input type="hidden" name="clientId" value={clientId} />
        <label className="block">
          <span className="text-sm font-medium text-slate-700">파일 (.xlsx, .xls, .csv)</span>
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls,.csv"
            required
            className="mt-1 block w-full text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">거래 구분</span>
          <select
            name="direction"
            defaultValue="AUTO"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="AUTO">자동 감지 (시트명·헤더 기준)</option>
            <option value="SALE">매출로 강제</option>
            <option value="PURCHASE">매입으로 강제</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          업로드 + 미리보기
        </button>
      </form>

      {/* Step 2. 미리보기 + commit */}
      {state.phase === "parsed" && <Preview state={state} clientId={clientId} dispatch={commitDispatch} />}

      {/* Step 3. 임포트 결과 */}
      {state.phase === "imported" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">임포트 완료</p>
          <p className="mt-1">
            성공 <span className="font-mono">{state.ok}</span>건 · 실패{" "}
            <span className="font-mono">{state.failed}</span>건
          </p>
          {state.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {state.errors.map((e, i) => (
                <li key={i}>행 {e.row}: {e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.phase === "error" && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </div>
  );
}

function Preview({
  state,
  clientId,
  dispatch,
}: {
  state: Extract<ParseState, { phase: "parsed" }>;
  clientId: string;
  dispatch: (formData: FormData) => void;
}) {
  const { result, direction, fileName } = state;
  const totalSupply = result.rows.reduce((s, r) => s + r.supplyAmount, 0);
  const totalVat = result.rows.reduce((s, r) => s + r.vatAmount, 0);
  const warningCount = result.rows.filter((r) => r.warning).length;
  const [confirmed, setConfirmed] = useState(false);

  return (
    <form
      action={(fd) => {
        // payload에 행 JSON을 통째로 실어 보낸다 (서버에서 재파싱 안 함)
        fd.set("payload", JSON.stringify(result.rows));
        dispatch(fd);
      }}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-5"
    >
      <input type="hidden" name="clientId" value={clientId} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">
          미리보기 — {fileName} ({DIR_LABEL[direction]})
        </h2>
        <p className="text-xs text-slate-500">
          {result.rows.length}행 · 공급가액 합계 {fmt(totalSupply)} · 부가세 합계 {fmt(totalVat)}
          {warningCount > 0 && ` · 경고 ${warningCount}`}
        </p>
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">파싱 경고 {result.errors.length}건</p>
          <ul className="mt-1 space-y-0.5">
            {result.errors.slice(0, 5).map((e, i) => (
              <li key={i}>행 {e.rowIndex}: {e.reason}</li>
            ))}
            {result.errors.length > 5 && <li>… 외 {result.errors.length - 5}건</li>}
          </ul>
        </div>
      )}

      <div className="max-h-80 overflow-auto rounded border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-1">행</th>
              <th className="px-2 py-1">일자</th>
              <th className="px-2 py-1">거래처</th>
              <th className="px-2 py-1 text-right">공급가액</th>
              <th className="px-2 py-1 text-right">부가세</th>
              <th className="px-2 py-1 text-right">합계</th>
              <th className="px-2 py-1">경고</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 100).map((r) => (
              <tr key={r.rowIndex} className="border-t border-slate-100">
                <td className="px-2 py-1 font-mono text-slate-400">{r.rowIndex}</td>
                <td className="px-2 py-1 font-mono">{r.occurredOn}</td>
                <td className="px-2 py-1">{r.counterparty}</td>
                <td className="px-2 py-1 text-right font-mono">{fmt(r.supplyAmount)}</td>
                <td className="px-2 py-1 text-right font-mono">{fmt(r.vatAmount)}</td>
                <td className="px-2 py-1 text-right font-mono">{fmt(r.totalAmount)}</td>
                <td className="px-2 py-1 text-amber-600">{r.warning ? "⚠" : ""}</td>
              </tr>
            ))}
            {result.rows.length > 100 && (
              <tr>
                <td colSpan={7} className="px-2 py-2 text-center text-slate-400">
                  … 외 {result.rows.length - 100}건 (모두 저장됩니다)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        위 내용을 검토했습니다. 분개로 저장합니다.
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!confirmed || result.rows.length === 0}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:bg-slate-300"
        >
          {result.rows.length}건 분개 저장
        </button>
      </div>
    </form>
  );
}
