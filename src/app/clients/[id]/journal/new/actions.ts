"use server";

import { redirect } from "next/navigation";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import {
  createStandardJournalEntry,
  JournalImbalanceError,
} from "@/lib/accounting/journal";

export type CreateJournalState = { error?: string };

type Direction = "SALE" | "PURCHASE";
type Settlement = "CASH" | "CREDIT";

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
  if (direction !== "SALE" && direction !== "PURCHASE") {
    return { error: "거래 구분(매출/매입)을 선택하세요." };
  }
  if (settlement !== "CASH" && settlement !== "CREDIT") {
    return { error: "결제 방법을 선택하세요." };
  }
  const occurredOn = new Date(occurredOnStr);
  if (Number.isNaN(occurredOn.getTime())) return { error: "거래일자 형식이 올바르지 않습니다." };

  try {
    await createStandardJournalEntry({
      clientId,
      occurredOn,
      counterparty,
      description: description || undefined,
      direction,
      settlement,
      supplyAmount,
      isTaxFree,
    });
  } catch (e) {
    if (e instanceof JournalImbalanceError) {
      return { error: `분개 불균형: ${e.message}` };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  redirect(`/clients/${clientId}`);
}
