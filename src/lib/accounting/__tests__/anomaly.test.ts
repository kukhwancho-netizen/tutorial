import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { findAnomalies } from "../anomaly";

const db = new PrismaClient();

let firmId = "";
let clientId = "";
let cashAcct = "";
let salesAcct = "";
let vatAcct = "";

async function seedAccounts(cid: string) {
  const accts = await Promise.all([
    db.account.create({ data: { clientId: cid, code: "101", name: "현금", type: "ASSET" } }),
    db.account.create({ data: { clientId: cid, code: "401", name: "상품매출", type: "REVENUE" } }),
    db.account.create({ data: { clientId: cid, code: "255", name: "부가세예수금", type: "LIABILITY" } }),
  ]);
  cashAcct = accts[0].id;
  salesAcct = accts[1].id;
  vatAcct = accts[2].id;
}

async function makeEntry(
  date: Date,
  supply: number,
  vatDirection: "SALE" | "PURCHASE" | null,
  counterparty?: string,
) {
  const vat = vatDirection ? Math.round(supply * 0.1) : 0;
  return db.journalEntry.create({
    data: {
      clientId,
      occurredOn: date,
      counterparty: counterparty ?? "거래처A",
      vatDirection,
      supplyAmount: supply,
      vatAmount: vat,
      totalAmount: supply + vat,
      isTaxInvoice: vatDirection !== null,
      lines: {
        create: [
          { accountId: cashAcct, debit: supply + vat },
          { accountId: salesAcct, credit: supply },
          ...(vat > 0 ? [{ accountId: vatAcct, credit: vat }] : []),
        ],
      },
    },
  });
}

beforeAll(async () => {
  const firm = await db.firm.create({ data: { name: "이상감지테스트사무소" } });
  firmId = firm.id;
  const client = await db.client.create({
    data: { firmId, name: "이상감지샘플", bizNo: "999-99-99999", bizType: "SOLE_GENERAL" },
  });
  clientId = client.id;
  await seedAccounts(clientId);
});

afterAll(async () => {
  await db.journalEntry.deleteMany({ where: { clientId } });
  await db.account.deleteMany({ where: { clientId } });
  await db.client.deleteMany({ where: { id: clientId } });
  await db.firm.deleteMany({ where: { id: firmId } });
  await db.$disconnect();
});

describe("findAnomalies", () => {
  it("거래가 전혀 없으면 SALES_SHIFT는 없음 (다른 anomaly는 있을 수 있음)", async () => {
    const today = new Date(2026, 4, 15); // 2026-05-15
    const anomalies = await findAnomalies(clientId, today);
    expect(anomalies.find((a) => a.kind === "SALES_SHIFT")).toBeUndefined();
  });

  it("이번달 매출이 직전월의 2배 이상이면 'SALES_SHIFT/매출 급증'", async () => {
    // 직전월(4월) 매출 100만, 이번달(5월) 매출 250만
    await makeEntry(new Date(2026, 3, 15), 1_000_000, "SALE");
    await makeEntry(new Date(2026, 4, 5), 1_500_000, "SALE");
    await makeEntry(new Date(2026, 4, 10), 1_000_000, "SALE");

    const today = new Date(2026, 4, 15);
    const anomalies = await findAnomalies(clientId, today);
    const shift = anomalies.find((a) => a.kind === "SALES_SHIFT");
    expect(shift).toBeDefined();
    expect(shift!.title).toContain("매출 급증");
  });

  it("VAT 미분류 + 50만 이상 분개는 MISSING_VAT", async () => {
    await makeEntry(new Date(2026, 4, 10), 800_000, null, "VAT의심거래처");
    const anomalies = await findAnomalies(clientId, new Date(2026, 4, 15));
    expect(anomalies.find((a) => a.kind === "MISSING_VAT")).toBeDefined();
  });

  it("이전 3개월간 거래했으나 최근 3개월 거래 없는 거래처는 DORMANT", async () => {
    // 6개월 전(2025-11)에 거래했고 그 이후 이 거래처와 거래 없음
    await makeEntry(new Date(2025, 10, 15), 500_000, "SALE", "휴면거래처");
    const anomalies = await findAnomalies(clientId, new Date(2026, 4, 15));
    const dormant = anomalies.find((a) => a.kind === "DORMANT_COUNTERPARTY");
    expect(dormant).toBeDefined();
    expect(dormant!.detail).toContain("휴면거래처");
  });
});
