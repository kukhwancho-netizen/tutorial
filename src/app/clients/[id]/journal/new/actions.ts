"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { createJournalEntry, JournalImbalanceError } from "@/lib/accounting/journal";

export type CreateJournalState = { error?: string };

type Direction = "SALE" | "PURCHASE";
type Settlement = "CASH" | "CREDIT"; // 현금/보통예금 vs 외상

function pickAccount(
  accounts: Array<{ id: string; code: string }>,
  code: string,
): { id: string; code: string } {
  const a = accounts.find((x) => x.code === code);
  if (!a) throw new Error(`계정과목(${code})이 등록되어 있지 않습니다. 시드를 다시 실행하세요.`);
  return a;
}

export async function createJournalAction(
  _prev: CreateJournalState,
  formData: FormData,
): Promise<CreateJournalState> {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return { error: "고객사 정보가 없습니다." };

  try {
    await requireClientAccess(clientId);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }

  const occurredOnStr = String(formData.get("occurredOn") ?? "").trim();
  const counterparty = String(formData.get("counterparty") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const direction = String(formData.get("direction") ?? "") as Direction;
  const settlement = String(formData.get("settlement") ?? "CASH") as Settlement;
  const supplyAmount = Number(String(formData.get("supplyAmount") ?? "0").replace(/[^0-9-]/g, ""));
  const isTaxFree = formData.get("isTaxFree") === "on";

  if (!occurredOnStr) return { error: "거래일자를 입력하세요." };
  if (!counterparty) return { error: "거래처(상호)를 입력하세요." };
  if (direction !== "SALE" && direction !== "PURCHASE") return { error: "거래 구분(매출/매입)을 선택하세요." };
  if (!Number.isFinite(supplyAmount) || supplyAmount <= 0) return { error: "공급가액은 0보다 커야 합니다." };

  const occurredOn = new Date(occurredOnStr);
  if (Number.isNaN(occurredOn.getTime())) return { error: "거래일자 형식이 올바르지 않습니다." };

  const vatAmount = isTaxFree ? 0 : Math.round(supplyAmount * 0.1);
  const total = supplyAmount + vatAmount;

  const accounts = await db.account.findMany({
    where: { clientId },
    select: { id: true, code: true },
  });

  // 표준 분개 자동 생성 — 데모 시드 계정과목(101 현금, 108 외상매출금, 251 외상매입금,
  // 135 부가세대급금, 255 부가세예수금, 401 상품매출, 146 상품) 기준.
  const cash = pickAccount(accounts, "101"); // 현금
  const ar = pickAccount(accounts, "108"); // 외상매출금
  const ap = pickAccount(accounts, "251"); // 외상매입금
  const vatPayable = pickAccount(accounts, "255"); // 부가세예수금
  const vatCreditable = pickAccount(accounts, "135"); // 부가세대급금
  const salesRev = pickAccount(accounts, "401"); // 상품매출
  const inventory = pickAccount(accounts, "146"); // 상품

  type LineDraft = { accountId: string; debit?: number; credit?: number; memo?: string };
  const lines: LineDraft[] = [];

  if (direction === "SALE") {
    const settle = settlement === "CASH" ? cash : ar;
    lines.push({ accountId: settle.id, debit: total });
    lines.push({ accountId: salesRev.id, credit: supplyAmount });
    if (vatAmount > 0) lines.push({ accountId: vatPayable.id, credit: vatAmount });
  } else {
    lines.push({ accountId: inventory.id, debit: supplyAmount });
    if (vatAmount > 0) lines.push({ accountId: vatCreditable.id, debit: vatAmount });
    const settle = settlement === "CASH" ? cash : ap;
    lines.push({ accountId: settle.id, credit: total });
  }

  try {
    await createJournalEntry({
      clientId,
      occurredOn,
      description: description || undefined,
      counterparty,
      vatDirection: isTaxFree ? null : direction,
      supplyAmount,
      vatAmount,
      isTaxInvoice: !isTaxFree,
      lines,
    });
  } catch (e) {
    if (e instanceof JournalImbalanceError) {
      return { error: `분개 불균형: ${e.message}` };
    }
    throw e;
  }

  redirect(`/clients/${clientId}`);
}
