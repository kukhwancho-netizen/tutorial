// 통합 시뮬레이션: 분개 입력 → VAT 집계 정확도 검증
// Vitest로 실DB(SQLite)를 띄워 시나리오를 돌린다.
//
// 시나리오:
//   1. 매출 5,500,000 (공급 5,000,000 + VAT 500,000) 분개 입력
//   2. 매출 11,000,000 (공급 10,000,000 + VAT 1,000,000) 분개 입력
//   3. 매입 3,300,000 (공급 3,000,000 + VAT 300,000) 분개 입력
//   4. 차변≠대변 분개는 거부되어야 함
//   5. VAT 집계: 매출세액 1,500,000 - 매입세액 300,000 = 납부 1,200,000

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  JournalImbalanceError,
  aggregateVat,
  createJournalEntry,
} from "@/lib/accounting/journal";

const db = new PrismaClient();

let clientId: string;
let cashId: string;
let receivableId: string;
let salesId: string;
let inventoryId: string;
let payableId: string;
let vatPayableId: string; // 부가세예수금
let vatReceivableId: string; // 부가세대급금

beforeAll(async () => {
  const c = await db.client.findFirstOrThrow({ where: { bizNo: "111-22-33333" } });
  clientId = c.id;

  const accounts = await db.account.findMany({ where: { clientId } });
  const map = new Map(accounts.map((a) => [a.code, a.id]));
  cashId = map.get("101")!;
  receivableId = map.get("108")!;
  salesId = map.get("401")!;
  inventoryId = map.get("146")!;
  payableId = map.get("251")!;
  vatPayableId = map.get("255")!;
  vatReceivableId = map.get("135")!;

  // 테스트 격리: 기존 분개 정리
  await db.journalLine.deleteMany({ where: { entry: { clientId } } });
  await db.journalEntry.deleteMany({ where: { clientId } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("복식부기 + VAT 자동 집계 통합 시나리오", () => {
  it("매출 분개 #1 (5,000,000 + VAT 500,000)", async () => {
    const entry = await createJournalEntry({
      clientId,
      occurredOn: new Date(2025, 0, 15),
      description: "샘플상사 → 거래처A 상품 매출",
      counterparty: "거래처A",
      vatDirection: "SALE",
      supplyAmount: 5_000_000,
      vatAmount: 500_000,
      isTaxInvoice: true,
      lines: [
        { accountId: receivableId, debit: 5_500_000 },
        { accountId: salesId, credit: 5_000_000 },
        { accountId: vatPayableId, credit: 500_000 },
      ],
    });
    expect(entry.lines).toHaveLength(3);
    expect(entry.totalAmount).toBe(5_500_000);
  });

  it("매출 분개 #2 (10,000,000 + VAT 1,000,000)", async () => {
    await createJournalEntry({
      clientId,
      occurredOn: new Date(2025, 1, 20),
      counterparty: "거래처B",
      vatDirection: "SALE",
      supplyAmount: 10_000_000,
      vatAmount: 1_000_000,
      lines: [
        { accountId: cashId, debit: 11_000_000 },
        { accountId: salesId, credit: 10_000_000 },
        { accountId: vatPayableId, credit: 1_000_000 },
      ],
    });
  });

  it("매입 분개 (3,000,000 + VAT 300,000)", async () => {
    await createJournalEntry({
      clientId,
      occurredOn: new Date(2025, 2, 5),
      counterparty: "공급처C",
      vatDirection: "PURCHASE",
      supplyAmount: 3_000_000,
      vatAmount: 300_000,
      lines: [
        { accountId: inventoryId, debit: 3_000_000 },
        { accountId: vatReceivableId, debit: 300_000 },
        { accountId: payableId, credit: 3_300_000 },
      ],
    });
  });

  it("차변≠대변 분개는 거부", async () => {
    await expect(
      createJournalEntry({
        clientId,
        occurredOn: new Date(),
        lines: [
          { accountId: cashId, debit: 100_000 },
          { accountId: salesId, credit: 90_000 },
        ],
      }),
    ).rejects.toThrow(JournalImbalanceError);
  });

  it("0원 분개도 거부", async () => {
    await expect(
      createJournalEntry({
        clientId,
        occurredOn: new Date(),
        lines: [
          { accountId: cashId, debit: 0 },
          { accountId: salesId, credit: 0 },
        ],
      }),
    ).rejects.toThrow(JournalImbalanceError);
  });

  it("VAT 자동 집계 정확도", async () => {
    const r = await aggregateVat({
      clientId,
      from: new Date(2025, 0, 1),
      to: new Date(2025, 11, 31, 23, 59, 59),
    });
    expect(r.salesSupply).toBe(15_000_000);
    expect(r.salesVat).toBe(1_500_000);
    expect(r.purchaseSupply).toBe(3_000_000);
    expect(r.purchaseVat).toBe(300_000);
    expect(r.payable).toBe(1_200_000);
  });
});
