"use client";

import { useFormState } from "react-dom";
import { useMemo, useState } from "react";
import { fmt } from "@/lib/format";
import { createJournalAction, type CreateJournalState } from "./actions";

const initial: CreateJournalState = {};

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function JournalForm({ clientId }: { clientId: string }) {
  const [state, action] = useFormState(createJournalAction, initial);
  const [supply, setSupply] = useState(0);
  const [isTaxFree, setIsTaxFree] = useState(false);
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const vat = useMemo(() => (isTaxFree ? 0 : Math.round(supply * 0.1)), [supply, isTaxFree]);
  const total = supply + vat;

  async function handleReceiptFile(file: File | undefined) {
    setReceiptError(null);
    if (!file) {
      setReceiptDataUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setReceiptError("이미지 파일만 첨부 가능 (JPG, PNG, HEIC). PDF는 미지원.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setReceiptError(`파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB). 3MB 이하 권장.`);
      return;
    }
    // 클라이언트 측에서 base64 data URL로 변환 (서버 액션은 hidden input으로 받음)
    const reader = new FileReader();
    reader.onload = (e) => setReceiptDataUrl(typeof e.target?.result === "string" ? e.target.result : null);
    reader.onerror = () => setReceiptError("파일 읽기 실패");
    reader.readAsDataURL(file);
  }

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <input type="hidden" name="clientId" value={clientId} />

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

      <Field label="적요(메모)">
        <input
          type="text"
          name="description"
          placeholder="예) 상품 매출"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="거래 구분">
          <select
            name="direction"
            required
            defaultValue="SALE"
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
      </div>

      <Field label="공급가액 (부가세 제외)">
        <input
          type="text"
          inputMode="numeric"
          name="supplyAmount"
          required
          value={supply === 0 ? "" : supply.toLocaleString("ko-KR")}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^0-9-]/g, ""));
            setSupply(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono text-base"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="isTaxFree"
          checked={isTaxFree}
          onChange={(e) => setIsTaxFree(e.target.checked)}
        />
        면세 거래 (부가세 분리 없음)
      </label>

      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="text-sm font-medium text-slate-700">📎 영수증/세금계산서 첨부 (선택)</legend>
        <p className="mb-2 text-xs text-slate-500">
          증빙 보관용. 5년 의무 보관. 이미지 파일만 (JPG/PNG/HEIC), 3MB 이하 권장.
        </p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleReceiptFile(e.target.files?.[0])}
          className="text-sm"
        />
        {/* 서버 액션이 receiptImage로 받음 */}
        <input type="hidden" name="receiptImage" value={receiptDataUrl ?? ""} />
        {receiptError && (
          <p className="mt-2 text-xs text-red-600">{receiptError}</p>
        )}
        {receiptDataUrl && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptDataUrl}
              alt="영수증 미리보기"
              className="max-h-48 rounded border border-slate-200"
            />
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

      <div className="rounded-md bg-slate-50 p-3 text-sm">
        <Row label="공급가액" value={supply} />
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
          className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
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
