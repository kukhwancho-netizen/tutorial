"use client";

import { useFormState } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { fmt } from "@/lib/format";
import { createJournalAction, EXPENSE_CATEGORIES, type CreateJournalState } from "./actions";

const initial: CreateJournalState = {};

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Line = {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  note?: string;
};

const emptyLine: Line = { name: "", quantity: 1, unitPrice: 0, amount: 0 };

export function JournalForm({ clientId }: { clientId: string }) {
  const [state, action] = useFormState(createJournalAction, initial);
  const [direction, setDirection] = useState<"SALE" | "PURCHASE">("PURCHASE");
  const [category, setCategory] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [supplyManual, setSupplyManual] = useState(0);
  const [isTaxFree, setIsTaxFree] = useState(false);
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const hasItems = lines.some((l) => l.amount > 0 || l.name.trim());
  // 라인이 있으면 합계는 라인 합계, 없으면 수동 입력값
  const lineTotal = useMemo(() => lines.reduce((s, l) => s + (l.amount || 0), 0), [lines]);
  const supply = hasItems ? lineTotal : supplyManual;
  const vat = isTaxFree ? 0 : Math.round(supply * 0.1);
  const total = supply + vat;

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => {
      const next = [...prev];
      const merged = { ...next[i], ...patch };
      // 수량·단가 자동 계산 (둘 다 양수일 때)
      if ((patch.quantity !== undefined || patch.unitPrice !== undefined) && merged.quantity > 0 && merged.unitPrice > 0) {
        merged.amount = Math.round(merged.quantity * merged.unitPrice);
      }
      next[i] = merged;
      return next;
    });
  }

  function addLine() {
    setLines((p) => [...p, { ...emptyLine }]);
  }
  function removeLine(i: number) {
    setLines((p) => (p.length === 1 ? [{ ...emptyLine }] : p.filter((_, idx) => idx !== i)));
  }

  async function handleReceiptFile(file: File | undefined) {
    setReceiptError(null);
    if (!file) {
      setReceiptDataUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setReceiptError("이미지 파일만 첨부 가능");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setReceiptError(`파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB). 3MB 이하 권장.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setReceiptDataUrl(typeof e.target?.result === "string" ? e.target.result : null);
    reader.onerror = () => setReceiptError("파일 읽기 실패");
    reader.readAsDataURL(file);
  }

  // 폼 제출 시 hidden input에 채워질 값들
  const itemsJson = useMemo(() => {
    const valid = lines
      .filter((l) => l.name.trim() && l.amount > 0)
      .map((l) => ({
        name: l.name.trim(),
        quantity: l.quantity || 1,
        unitPrice: l.unitPrice || 0,
        amount: l.amount,
        note: l.note ?? undefined,
      }));
    return valid.length > 0 ? JSON.stringify(valid) : "";
  }, [lines]);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="supplyAmount" value={supply} />
      <input type="hidden" name="itemsJson" value={itemsJson} />
      <input type="hidden" name="receiptImage" value={receiptDataUrl ?? ""} />

      {/* 기본 정보 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="거래일자">
          <input
            type="date"
            name="occurredOn"
            defaultValue={todayISO()}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="거래처(상호)">
          <input
            type="text"
            name="counterparty"
            required
            placeholder="(주)상대거래처"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <Field label="적요(거래 메모)">
        <input
          type="text"
          name="description"
          placeholder="예) 5월 식자재 매입"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="거래 구분">
          <select
            name="direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as "SALE" | "PURCHASE")}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="SALE">매출</option>
            <option value="PURCHASE">매입</option>
          </select>
        </Field>
        <Field label="결제 방법">
          <select
            name="settlement"
            defaultValue="CASH"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="CASH">현금 / 보통예금</option>
            <option value="CREDIT">외상 (매출/매입금)</option>
          </select>
        </Field>
        <Field label={direction === "PURCHASE" ? "비용 분류 (종소세 필요경비 분류용)" : "분류 (선택)"}>
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">(선택 안 함)</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* 라인 아이템 */}
      <fieldset className="rounded-md border border-slate-300 bg-slate-50 p-3">
        <legend className="px-1 text-sm font-semibold text-slate-700">
          📋 영수증 라인 명세 (품목별)
        </legend>
        <p className="mb-2 text-xs text-slate-500">
          품목별로 입력하면 합계가 자동 계산됩니다. 라인 미입력 시 아래 &quot;공급가액 직접 입력&quot;으로
          간단 분개 가능.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 text-left font-normal">품목</th>
                <th className="w-16 py-1 text-right font-normal">수량</th>
                <th className="w-24 py-1 text-right font-normal">단가</th>
                <th className="w-28 py-1 text-right font-normal">공급가액</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-slate-200">
                  <td className="py-1">
                    <input
                      type="text"
                      value={l.name}
                      onChange={(e) => setLine(i, { name: e.target.value })}
                      placeholder="예) 양파 10kg"
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: Number(e.target.value) })}
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs"
                    />
                  </td>
                  <td className="py-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={l.unitPrice === 0 ? "" : l.unitPrice.toLocaleString("ko-KR")}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[^0-9-]/g, ""));
                        setLine(i, { unitPrice: Number.isFinite(n) ? n : 0 });
                      }}
                      placeholder="0"
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs"
                    />
                  </td>
                  <td className="py-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={l.amount === 0 ? "" : l.amount.toLocaleString("ko-KR")}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[^0-9-]/g, ""));
                        setLine(i, { amount: Number.isFinite(n) ? n : 0 });
                      }}
                      placeholder="0"
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs"
                    />
                  </td>
                  <td className="py-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      title="삭제"
                      className="text-slate-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-2 rounded border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-brand-500"
        >
          + 품목 추가
        </button>
      </fieldset>

      {/* 라인 합계가 0이면 직접 입력 가능 */}
      {!hasItems && (
        <Field label="공급가액 직접 입력 (라인 없을 때)">
          <input
            type="text"
            inputMode="numeric"
            value={supplyManual === 0 ? "" : supplyManual.toLocaleString("ko-KR")}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9-]/g, ""));
              setSupplyManual(Number.isFinite(n) && n >= 0 ? n : 0);
            }}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono text-base"
          />
        </Field>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="isTaxFree"
          checked={isTaxFree}
          onChange={(e) => setIsTaxFree(e.target.checked)}
        />
        면세 거래 (부가세 분리 없음)
      </label>

      {/* 영수증 사진 */}
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="text-sm font-medium text-slate-700">📎 영수증/세금계산서 사진 (선택)</legend>
        <p className="mb-2 text-xs text-slate-500">증빙 5년 보관용. JPG/PNG/HEIC, 3MB 이하.</p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleReceiptFile(e.target.files?.[0])}
          className="text-sm"
        />
        {receiptError && <p className="mt-2 text-xs text-red-600">{receiptError}</p>}
        {receiptDataUrl && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receiptDataUrl} alt="영수증 미리보기" className="max-h-48 rounded border border-slate-200" />
            <button
              type="button"
              onClick={() => { setReceiptDataUrl(null); setReceiptError(null); }}
              className="mt-1 text-xs text-slate-500 hover:text-red-600"
            >
              제거
            </button>
          </div>
        )}
      </fieldset>

      {/* 합계 미리보기 */}
      <div className="rounded-md bg-slate-50 p-3 text-sm">
        <Row label="공급가액 (라인 합계)" value={supply} />
        <Row label={isTaxFree ? "부가세 (면세)" : "부가세 (10%)"} value={vat} />
        <Row label="합계금액" value={total} emphasis />
      </div>

      {state?.error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={supply === 0}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:bg-slate-300"
        >
          분개 저장
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-200 py-1.5 last:border-b-0 ${
        emphasis ? "text-base font-semibold text-brand-700" : "text-slate-700"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono">{fmt(value)}</span>
    </div>
  );
}
