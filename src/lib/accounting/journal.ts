// 복식부기 분개 헬퍼.
// - 차변 합 = 대변 합 검증
// - 부가세 신고용 매출/매입 집계
// - 표준 매출/매입 분개 자동 생성

import { db } from "@/lib/db";

export type TxnDirection = "SALE" | "PURCHASE";

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
