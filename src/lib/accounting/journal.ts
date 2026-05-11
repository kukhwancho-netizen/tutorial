// 복식부기 분개 헬퍼.
// - 차변 합 = 대변 합 검증
// - 부가세 신고용 매출/매입 집계
// - 표준 매출/매입 분개 자동 생성

import { db } from "@/lib/db";

export type TxnDirection = "SALE" | "PURCHASE";

/**
 * 표준 분개에 쓰이는 시드 계정과목 코드.
 * `prisma/seed.ts`와 정합성을 유지해야 한다.
 */
export const STANDARD_ACCOUNT_CODES = {
  CASH: "101",            // 현금
  BANK: "102",            // 보통예금
  AR: "108",              // 외상매출금
  VAT_RECEIVABLE: "135",  // 부가세대급금
  INVENTORY: "146",       // 상품
  AP: "251",              // 외상매입금
  VAT_PAYABLE: "255",     // 부가세예수금
  SALES_REVENUE: "401",   // 상품매출
} as const;

export type JournalLineInput = {
  accountId: string;
  debit?: number;
  credit?: number;
  memo?: string;
};

export class JournalImbalanceError extends Error {
  constructor(public debitTotal: number, public creditTotal: number) {
    super(`차변(${debitTotal}) ≠ 대변(${creditTotal})`);
  }
}

export function assertBalanced(lines: JournalLineInput[]): {
  debitTotal: number;
  creditTotal: number;
} {
  const debitTotal = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const creditTotal = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (debitTotal !== creditTotal) {
    throw new JournalImbalanceError(debitTotal, creditTotal);
  }
  if (debitTotal === 0) {
    throw new JournalImbalanceError(0, 0);
  }
  return { debitTotal, creditTotal };
}

export type CreateEntryInput = {
  clientId: string;
  occurredOn: Date;
  description?: string;
  counterparty?: string;
  vatDirection?: TxnDirection | null;
  supplyAmount?: number;
  vatAmount?: number;
  isTaxInvoice?: boolean;
  /** 영수증 이미지 (data URL). 증빙 보관용 (5년 의무) */
  receiptImage?: string;
  lines: JournalLineInput[];
};

export async function createJournalEntry(input: CreateEntryInput) {
  assertBalanced(input.lines);

  const supplyAmount = input.supplyAmount ?? 0;
  const vatAmount = input.vatAmount ?? 0;

  return db.journalEntry.create({
    data: {
      clientId: input.clientId,
      occurredOn: input.occurredOn,
      receiptImage: input.receiptImage ?? null,
      description: input.description,
      counterparty: input.counterparty,
      vatDirection: input.vatDirection ?? null,
      supplyAmount,
      vatAmount,
      totalAmount: supplyAmount + vatAmount,
      isTaxInvoice: input.isTaxInvoice ?? false,
      lines: {
        create: input.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          memo: l.memo,
        })),
      },
    },
    include: { lines: true },
  });
}

/**
 * 표준 매출/매입 분개를 자동 생성해 저장.
 * - 매출: (현금|외상매출금) 차변, 상품매출+부가세예수금 대변
 * - 매입: (상품)+부가세대급금 차변, (현금|외상매입금) 대변
 * - 면세(isTaxFree)면 부가세 라인 생략
 * 시드 계정과목(101, 108, 251, 135, 255, 401, 146)이 필요하다.
 */
export async function createStandardJournalEntry(input: {
  clientId: string;
  occurredOn: Date;
  counterparty: string;
  description?: string;
  direction: TxnDirection;
  settlement: "CASH" | "CREDIT";
  supplyAmount: number;
  isTaxFree?: boolean;
  receiptImage?: string;
}) {
  if (!Number.isFinite(input.supplyAmount) || input.supplyAmount <= 0) {
    throw new Error("공급가액은 0보다 커야 합니다.");
  }

  const vatAmount = input.isTaxFree ? 0 : Math.round(input.supplyAmount * 0.1);
  const total = input.supplyAmount + vatAmount;

  const accounts = await db.account.findMany({
    where: { clientId: input.clientId },
    select: { id: true, code: true },
  });
  const pick = (code: string) => {
    const a = accounts.find((x) => x.code === code);
    if (!a) throw new Error(`계정과목(${code})이 등록되어 있지 않습니다. 시드를 실행하세요.`);
    return a.id;
  };

  const cash = pick(STANDARD_ACCOUNT_CODES.CASH);
  const ar = pick(STANDARD_ACCOUNT_CODES.AR);
  const ap = pick(STANDARD_ACCOUNT_CODES.AP);
  const vatPayable = pick(STANDARD_ACCOUNT_CODES.VAT_PAYABLE);
  const vatCreditable = pick(STANDARD_ACCOUNT_CODES.VAT_RECEIVABLE);
  const salesRev = pick(STANDARD_ACCOUNT_CODES.SALES_REVENUE);
  const inventory = pick(STANDARD_ACCOUNT_CODES.INVENTORY);

  const lines: JournalLineInput[] = [];
  if (input.direction === "SALE") {
    lines.push({ accountId: input.settlement === "CASH" ? cash : ar, debit: total });
    lines.push({ accountId: salesRev, credit: input.supplyAmount });
    if (vatAmount > 0) lines.push({ accountId: vatPayable, credit: vatAmount });
  } else {
    lines.push({ accountId: inventory, debit: input.supplyAmount });
    if (vatAmount > 0) lines.push({ accountId: vatCreditable, debit: vatAmount });
    lines.push({ accountId: input.settlement === "CASH" ? cash : ap, credit: total });
  }

  return createJournalEntry({
    clientId: input.clientId,
    occurredOn: input.occurredOn,
    description: input.description,
    counterparty: input.counterparty,
    vatDirection: input.isTaxFree ? null : input.direction,
    supplyAmount: input.supplyAmount,
    vatAmount,
    isTaxInvoice: !input.isTaxFree,
    receiptImage: input.receiptImage,
    lines,
  });
}

/**
 * 일괄 표준 분개 — 엑셀 임포트 등에서 사용.
 * 한 건 실패해도 다른 건은 진행하고, per-row 결과를 반환.
 */
export async function createStandardJournalEntriesBulk(
  inputs: Array<Parameters<typeof createStandardJournalEntry>[0] & { sourceRow?: number }>,
) {
  const results: Array<{
    sourceRow?: number;
    ok: boolean;
    entryId?: string;
    error?: string;
  }> = [];
  for (const input of inputs) {
    try {
      const entry = await createStandardJournalEntry(input);
      results.push({ sourceRow: input.sourceRow, ok: true, entryId: entry.id });
    } catch (e) {
      results.push({
        sourceRow: input.sourceRow,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

/** 부가세 신고용 매출/매입 집계 */
export async function aggregateVat(params: {
  clientId: string;
  from: Date;
  to: Date;
}) {
  const entries = await db.journalEntry.findMany({
    where: {
      clientId: params.clientId,
      occurredOn: { gte: params.from, lte: params.to },
      vatDirection: { not: null },
    },
    select: { vatDirection: true, supplyAmount: true, vatAmount: true },
  });

  let salesSupply = 0;
  let salesVat = 0;
  let purchaseSupply = 0;
  let purchaseVat = 0;
  for (const e of entries) {
    if (e.vatDirection === "SALE") {
      salesSupply += e.supplyAmount;
      salesVat += e.vatAmount;
    } else if (e.vatDirection === "PURCHASE") {
      purchaseSupply += e.supplyAmount;
      purchaseVat += e.vatAmount;
    }
  }
  return {
    salesSupply,
    salesVat,
    purchaseSupply,
    purchaseVat,
    payable: salesVat - purchaseVat,
  };
}
