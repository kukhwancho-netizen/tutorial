"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import {
  createStandardJournalEntry,
  JournalImbalanceError,
} from "@/lib/accounting/journal";

export type CreateJournalState = { error?: string };

// 비용 카테고리 (매입 분개 시 분류용)
export const EXPENSE_CATEGORIES = [
  "식자재", "사무용품", "광고선전비", "차량유지", "통신비",
  "임차료", "수도광열", "복리후생", "접대비", "운반비",
  "지급수수료", "여비교통", "교육훈련", "도서인쇄", "소모품",
  "기타",
] as const;

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
  receiptImage: optStr, // base64 data URL (선택)
  category: optStr, // 비용 분류 (매입 시)
  itemsJson: optStr, // 영수증 라인 아이템 JSON 배열 (선택)
});

const ItemSchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().int().nonnegative().default(0),
  amount: z.number().int().nonnegative(),
  note: z.string().optional(),
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
    receiptImage: formData.get("receiptImage"),
    category: formData.get("category"),
    itemsJson: formData.get("itemsJson"),
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
    // 영수증 data URL이 너무 크면 거부 (대략 4MB base64 ~= 3MB 원본)
    const receipt = input.receiptImage?.startsWith("data:image/") ? input.receiptImage : undefined;
    if (receipt && receipt.length > 4_500_000) {
      return { error: "영수증 이미지가 너무 큽니다. 3MB 이하로 줄여주세요." };
    }
    const entry = await createStandardJournalEntry({
      clientId: input.clientId,
      occurredOn: new Date(input.occurredOn),
      counterparty: input.counterparty,
      description: input.description || undefined,
      direction: input.direction,
      settlement: input.settlement,
      supplyAmount: input.supplyAmount,
      isTaxFree: input.isTaxFree,
      receiptImage: receipt,
    });

    // 카테고리·라인 아이템 별도 update (createStandardJournalEntry는 표준 분개만 처리)
    const category = input.category?.trim() || undefined;
    let items: z.infer<typeof ItemSchema>[] = [];
    if (input.itemsJson?.trim()) {
      try {
        const parsedItems = JSON.parse(input.itemsJson);
        if (Array.isArray(parsedItems)) {
          items = z.array(ItemSchema).parse(parsedItems);
        }
      } catch {
        // 라인 파싱 실패는 무시 (분개 자체는 저장됨)
      }
    }
    if (category || items.length > 0) {
      await db.journalEntry.update({
        where: { id: entry.id },
        data: {
          category,
          receiptItems: items.length > 0
            ? { create: items.map((i) => ({ ...i, note: i.note ?? null })) }
            : undefined,
        },
      });
    }
  } catch (e) {
    if (e instanceof JournalImbalanceError) {
      return { error: `분개 불균형: ${e.message}` };
    }
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  redirect(`/clients/${input.clientId}`);
}
