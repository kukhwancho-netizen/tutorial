"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { createStandardJournalEntriesBulk } from "@/lib/accounting/journal";
import {
  parseHometaxCsv,
  parseHometaxXlsx,
  type ImportedRow,
  type ParseResult,
} from "@/lib/import/hometax";

export type ParseState =
  | { phase: "idle" }
  | { phase: "parsed"; result: ParseResult; direction: "SALE" | "PURCHASE"; fileName: string }
  | { phase: "imported"; ok: number; failed: number; errors: Array<{ row: number; error: string }> }
  | { phase: "error"; error: string };

const initial: ParseState = { phase: "idle" };

const ParseInput = z.object({
  clientId: z.string().min(1),
  direction: z.enum(["AUTO", "SALE", "PURCHASE"]).default("AUTO"),
});

export async function parseImportAction(
  _prev: ParseState,
  formData: FormData,
): Promise<ParseState> {
  const parsed = ParseInput.safeParse({
    clientId: formData.get("clientId"),
    direction: formData.get("direction") ?? "AUTO",
  });
  if (!parsed.success) return { phase: "error", error: "입력값이 올바르지 않습니다." };

  try {
    await requireClientAccess(parsed.data.clientId);
  } catch (e) {
    if (e instanceof AuthError) return { phase: "error", error: e.message };
    throw e;
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { phase: "error", error: "파일을 선택하세요." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { phase: "error", error: "파일 크기는 5MB 이하만 지원합니다." };
  }

  const opts = parsed.data.direction === "AUTO" ? {} : { direction: parsed.data.direction };

  let result: ParseResult;
  try {
    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = await file.text();
      result = parseHometaxCsv(text, opts);
    } else if (
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.name.toLowerCase().endsWith(".xls")
    ) {
      const buf = await file.arrayBuffer();
      result = parseHometaxXlsx(buf, opts);
    } else {
      return { phase: "error", error: ".xlsx, .xls, .csv 파일만 지원합니다." };
    }
  } catch (e) {
    return { phase: "error", error: `파싱 실패: ${e instanceof Error ? e.message : String(e)}` };
  }

  // 미리보기는 최대 200건만 (그 이상은 commit 시 별도 처리)
  if (result.rows.length > 200) {
    result.errors.push({
      rowIndex: 0,
      reason: `행이 ${result.rows.length}개입니다. 미리보기는 200건까지만 표시되며, 모두 저장됩니다.`,
    });
  }

  const finalDirection: "SALE" | "PURCHASE" =
    parsed.data.direction === "AUTO"
      ? result.detectedDirection === "PURCHASE"
        ? "PURCHASE"
        : "SALE"
      : (parsed.data.direction as "SALE" | "PURCHASE");

  return {
    phase: "parsed",
    result,
    direction: finalDirection,
    fileName: file.name,
  };
}

const CommitInput = z.object({
  clientId: z.string().min(1),
  payload: z.string().min(1),
});

export async function commitImportAction(
  _prev: ParseState,
  formData: FormData,
): Promise<ParseState> {
  const parsed = CommitInput.safeParse({
    clientId: formData.get("clientId"),
    payload: formData.get("payload"),
  });
  if (!parsed.success) return { phase: "error", error: "입력값이 올바르지 않습니다." };

  try {
    await requireClientAccess(parsed.data.clientId);
  } catch (e) {
    if (e instanceof AuthError) return { phase: "error", error: e.message };
    throw e;
  }

  let rows: ImportedRow[];
  try {
    rows = JSON.parse(parsed.data.payload);
    if (!Array.isArray(rows)) throw new Error("invalid payload");
  } catch {
    return { phase: "error", error: "전송된 데이터 형식이 올바르지 않습니다." };
  }

  if (rows.length === 0) return { phase: "error", error: "저장할 행이 없습니다." };
  if (rows.length > 1000) {
    return { phase: "error", error: "한 번에 최대 1000건까지 임포트 가능합니다. 파일을 나눠주세요." };
  }

  const inputs = rows.map((r) => ({
    clientId: parsed.data.clientId,
    occurredOn: new Date(r.occurredOn),
    counterparty: r.counterparty,
    description: r.counterpartyBizNo
      ? `[임포트] ${r.counterpartyBizNo}`
      : `[임포트]`,
    direction: r.direction,
    settlement: "CASH" as const,
    supplyAmount: r.supplyAmount,
    isTaxFree: r.vatAmount === 0,
    sourceRow: r.rowIndex,
  }));

  const results = await createStandardJournalEntriesBulk(inputs);
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  revalidatePath(`/clients/${parsed.data.clientId}`);

  return {
    phase: "imported",
    ok,
    failed: failed.length,
    errors: failed.slice(0, 20).map((f) => ({
      row: f.sourceRow ?? 0,
      error: f.error ?? "unknown",
    })),
  };
}

export { initial as initialState };
