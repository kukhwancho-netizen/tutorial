"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import {
  createStandardJournalEntry,
  JournalImbalanceError,
} from "@/lib/accounting/journal";

export type CreateJournalState = { error?: string };

// FormData.get은 누락 시 null을 반환한다. zod는 null을 string으로 강제 변환하지
// 않으므로, 각 string 필드를 nullish 허용으로 받고 빈 문자열을 기본값으로 사용한다.
const optStr = z.preprocess((v) => (v == null ? "" : v), z.string());
const optTrimmed = z.preprocess(
  (v) => (v == null ? "" : v),
  z.string().trim(),
);

const FormSchema = z.object({
  clientId: optStr.pipe(z.string().min(1, "고객사 정보가 없습니다.")),
  occurredOn: optStr
    .pipe(z.string().min(1, "거래일자를 입력하세요."))
    .refine((s) => !Number.isNaN(new Date(s).getTime()), {
      message: "거래일자 형식이 올바르지 않습니다.",
    }),
  counterparty: optTrimmed.pipe(z.string().min(1, "거래처(상호)를 입력하세요.")),
  description: optTrimmed,
  direction: z.enum(["SALE", "PURCHASE"], {
    errorMap: () => ({ message: "거래 구분(매출/매입)을 선택하세요." }),
  }),
  settlement: z.preprocess((v) => v ?? "CASH", z.enum(["CASH", "CREDIT"])),
  supplyAmount: optStr
    .transform((s) => Number(s.replace(/[^0-9-]/g, "")))
    .pipe(z.number().int().positive("공급가액은 0보다 커야 합니다.")),
  isTaxFree: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export async function createJournalAction(
  _prev: CreateJournalState,
  formData: FormData,
): Promise<CreateJournalState> {
  const parsed = FormSchema.safeParse({
    clientId: formData.get("clientId"),
    occurredOn: formData.get("occurredOn"),
    counterparty: formData.get("counterparty"),
    description: formData.get("description"),
    direction: formData.get("direction"),
    settlement: formData.get("settlement"),
    supplyAmount: formData.get("supplyAmount"),
    isTaxFree: formData.get("isTaxFree"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }
  const input = parsed.data;

  try {
    await requireClientAccess(input.clientId);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }

  try {
    await createStandardJournalEntry({
      clientId: input.clientId,
      occurredOn: new Date(input.occurredOn),
      counterparty: input.counterparty,
      description: input.description || undefined,
      direction: input.direction,
      settlement: input.settlement,
      supplyAmount: input.supplyAmount,
      isTaxFree: input.isTaxFree,
    });
  } catch (e) {
    if (e instanceof JournalImbalanceError) {
      return { error: `분개 불균형: ${e.message}` };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  redirect(`/clients/${input.clientId}`);
}
