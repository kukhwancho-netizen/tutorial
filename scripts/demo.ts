/**
 * 시뮬레이션 데모 스크립트.
 * `npm run demo` 로 실행. DB는 시드된 상태를 가정한다.
 *
 * 시나리오:
 *  ① 권한 가드: 다른 사무소 고객사 접근 차단 / Membership 없는 고객사 사용자 차단
 *  ② 복식부기: 매출 2건 + 매입 1건 입력 후 VAT 자동 집계
 *  ③ 차변≠대변 분개 거부
 */
import { PrismaClient } from "@prisma/client";
import {
  JournalImbalanceError,
  aggregateVat,
  createJournalEntry,
} from "../src/lib/accounting/journal";

const db = new PrismaClient();
const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";
const line = "─".repeat(60);

async function setupExtraTenantsForGuardDemo() {
  // 사무소B + 고객B 추가 (가드 시나리오 검증용)
  const fb = await db.firm.upsert({
    where: { id: "demo-firm-b" },
    update: {},
    create: { id: "demo-firm-b", name: "데모 사무소B" },
  });
  const cb = await db.client.upsert({
    where: { firmId_bizNo: { firmId: fb.id, bizNo: "999-99-99999" } },
    update: {},
    create: {
      id: "demo-client-b",
      firmId: fb.id,
      name: "타사무소상사",
      bizNo: "999-99-99999",
    },
  });
  return { fb, cb };
}

async function clearExistingJournal(clientId: string) {
  await db.journalLine.deleteMany({ where: { entry: { clientId } } });
  await db.journalEntry.deleteMany({ where: { clientId } });
}

// 가드 로직을 cookies() 없이 재현 (UI에서는 requireClientAccess가 동일 검증을 수행한다)
async function checkAccess(
  user: { id: string; role: "ACCOUNTANT" | "CLIENT"; firmId?: string | null },
  clientId: string,
): Promise<{ ok: true; clientName: string } | { ok: false; status: number; reason: string }> {
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false, status: 404, reason: "고객사 없음" };

  if (user.role === "ACCOUNTANT" && user.firmId === client.firmId) {
    return { ok: true, clientName: client.name };
  }
  const m = await db.membership.findUnique({
    where: { userId_clientId: { userId: user.id, clientId } },
  });
  if (!m) return { ok: false, status: 403, reason: "권한 없음" };
  return { ok: true, clientName: client.name };
}

async function main() {
  console.log(line);
  console.log("① 서버사이드 테넌트 격리 시뮬레이션");
  console.log(line);

  const { cb: clientB } = await setupExtraTenantsForGuardDemo();

  const accountantA = await db.user.findFirstOrThrow({
    where: { email: "accountant@example.com" },
  });
  const ownerSample = await db.user.findFirstOrThrow({ where: { email: "owner@sample.co.kr" } });
  const clientA = await db.client.findFirstOrThrow({ where: { bizNo: "111-22-33333" } });

  const cases = [
    {
      desc: "세무사A → 자기 사무소 고객A",
      user: { id: accountantA.id, role: "ACCOUNTANT" as const, firmId: accountantA.firmId },
      target: clientA.id,
      expect: "허용",
    },
    {
      desc: "세무사A → 다른 사무소 고객B (URL 조작 시도)",
      user: { id: accountantA.id, role: "ACCOUNTANT" as const, firmId: accountantA.firmId },
      target: clientB.id,
      expect: "차단",
    },
    {
      desc: "고객사 사용자(샘플상사 대표) → 자기 회사",
      user: { id: ownerSample.id, role: "CLIENT" as const, firmId: null },
      target: clientA.id,
      expect: "허용",
    },
    {
      desc: "고객사 사용자(샘플상사 대표) → 타사무소 고객B",
      user: { id: ownerSample.id, role: "CLIENT" as const, firmId: null },
      target: clientB.id,
      expect: "차단",
    },
  ];

  for (const c of cases) {
    const r = await checkAccess(c.user, c.target);
    const got = r.ok ? "허용" : `차단(${r.status} ${r.reason})`;
    const mark = (c.expect === "허용") === r.ok ? "✓" : "✗";
    console.log(`  ${mark} ${c.desc}: ${got}`);
  }

  console.log("\n" + line);
  console.log("② 복식부기 분개 + VAT 자동 집계 시뮬레이션");
  console.log(line);

  await clearExistingJournal(clientA.id);
  const accounts = await db.account.findMany({ where: { clientId: clientA.id } });
  const acc = (code: string) => accounts.find((a) => a.code === code)!.id;

  // 매출 1
  await createJournalEntry({
    clientId: clientA.id,
    occurredOn: new Date("2025-01-15"),
    description: "거래처A 외상 매출",
    counterparty: "거래처A",
    vatDirection: "SALE",
    supplyAmount: 5_000_000,
    vatAmount: 500_000,
    isTaxInvoice: true,
    lines: [
      { accountId: acc("108"), debit: 5_500_000 }, // 외상매출금
      { accountId: acc("401"), credit: 5_000_000 }, // 상품매출
      { accountId: acc("255"), credit: 500_000 }, // 부가세예수금
    ],
  });
  console.log("  ✓ 매출 #1 (공급 5,000,000 + VAT 500,000) 분개 생성");

  // 매출 2
  await createJournalEntry({
    clientId: clientA.id,
    occurredOn: new Date("2025-02-20"),
    description: "거래처B 현금 매출",
    counterparty: "거래처B",
    vatDirection: "SALE",
    supplyAmount: 10_000_000,
    vatAmount: 1_000_000,
    lines: [
      { accountId: acc("101"), debit: 11_000_000 },
      { accountId: acc("401"), credit: 10_000_000 },
      { accountId: acc("255"), credit: 1_000_000 },
    ],
  });
  console.log("  ✓ 매출 #2 (공급 10,000,000 + VAT 1,000,000) 분개 생성");

  // 매입
  await createJournalEntry({
    clientId: clientA.id,
    occurredOn: new Date("2025-03-05"),
    description: "공급처C 상품 매입",
    counterparty: "공급처C",
    vatDirection: "PURCHASE",
    supplyAmount: 3_000_000,
    vatAmount: 300_000,
    lines: [
      { accountId: acc("146"), debit: 3_000_000 }, // 상품
      { accountId: acc("135"), debit: 300_000 }, // 부가세대급금
      { accountId: acc("251"), credit: 3_300_000 }, // 외상매입금
    ],
  });
  console.log("  ✓ 매입 #1 (공급 3,000,000 + VAT 300,000) 분개 생성");

  // 차변≠대변 거부
  try {
    await createJournalEntry({
      clientId: clientA.id,
      occurredOn: new Date(),
      lines: [
        { accountId: acc("101"), debit: 100_000 },
        { accountId: acc("401"), credit: 90_000 },
      ],
    });
    console.log("  ✗ 차변≠대변 거부 실패 — 시스템 결함");
  } catch (e) {
    if (e instanceof JournalImbalanceError) {
      console.log(
        `  ✓ 차변≠대변 분개 거부 (차변 ${fmt(e.debitTotal)} ≠ 대변 ${fmt(e.creditTotal)})`,
      );
    } else throw e;
  }

  // VAT 집계
  const vat = await aggregateVat({
    clientId: clientA.id,
    from: new Date("2025-01-01"),
    to: new Date("2025-12-31T23:59:59"),
  });
  console.log("\n  부가세 자동 집계 결과:");
  console.log(`    매출 공급가액   ${fmt(vat.salesSupply).padStart(15)}`);
  console.log(`    매출세액        ${fmt(vat.salesVat).padStart(15)}`);
  console.log(`    매입 공급가액   ${fmt(vat.purchaseSupply).padStart(15)}`);
  console.log(`    매입세액        ${fmt(vat.purchaseVat).padStart(15)}`);
  console.log(
    `    ─────────────────────────────────────`,
  );
  console.log(
    `    ${vat.payable >= 0 ? "납부세액" : "환급세액"}        ${fmt(Math.abs(vat.payable)).padStart(15)}`,
  );

  const expected = { salesVat: 1_500_000, purchaseVat: 300_000, payable: 1_200_000 };
  const matches =
    vat.salesVat === expected.salesVat &&
    vat.purchaseVat === expected.purchaseVat &&
    vat.payable === expected.payable;
  console.log(`\n  ${matches ? "✓" : "✗"} 기대값과 일치 (납부세액 1,200,000원)`);

  console.log("\n" + line);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
