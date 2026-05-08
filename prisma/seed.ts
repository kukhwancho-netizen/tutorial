import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

// 한국 기업회계기준 기본 계정과목 시드 (요약본)
const DEFAULT_ACCOUNTS: Array<{ code: string; name: string; type: AccountType }> = [
  { code: "101", name: "현금", type: "ASSET" },
  { code: "102", name: "보통예금", type: "ASSET" },
  { code: "108", name: "외상매출금", type: "ASSET" },
  { code: "135", name: "부가세대급금", type: "ASSET" },
  { code: "146", name: "상품", type: "ASSET" },
  { code: "251", name: "외상매입금", type: "LIABILITY" },
  { code: "255", name: "부가세예수금", type: "LIABILITY" },
  { code: "401", name: "상품매출", type: "REVENUE" },
  { code: "451", name: "상품매출원가", type: "EXPENSE" },
  { code: "811", name: "복리후생비", type: "EXPENSE" },
  { code: "813", name: "접대비", type: "EXPENSE" },
  { code: "814", name: "통신비", type: "EXPENSE" },
];

async function main() {
  const firm = await db.firm.upsert({
    where: { id: "demo-firm" },
    update: {},
    create: {
      id: "demo-firm",
      name: "데모 세무회계 사무소",
      bizNo: "123-45-67890",
    },
  });

  const accountant = await db.user.upsert({
    where: { email: "accountant@example.com" },
    update: {},
    create: {
      email: "accountant@example.com",
      name: "김세무",
      role: "ACCOUNTANT",
      firmId: firm.id,
    },
  });

  const client = await db.client.upsert({
    where: { firmId_bizNo: { firmId: firm.id, bizNo: "111-22-33333" } },
    update: {},
    create: {
      id: "demo-client-sample",
      firmId: firm.id,
      name: "샘플상사",
      bizNo: "111-22-33333",
      ownerName: "홍길동",
      bizType: "SOLE_GENERAL",
      industry: "도소매",
    },
  });

  for (const acc of DEFAULT_ACCOUNTS) {
    await db.account.upsert({
      where: { clientId_code: { clientId: client.id, code: acc.code } },
      update: {},
      create: { clientId: client.id, ...acc },
    });
  }

  const clientUser = await db.user.upsert({
    where: { email: "owner@sample.co.kr" },
    update: {},
    create: {
      email: "owner@sample.co.kr",
      name: "홍길동",
      role: "CLIENT",
    },
  });

  await db.membership.upsert({
    where: { userId_clientId: { userId: clientUser.id, clientId: client.id } },
    update: {},
    create: { userId: clientUser.id, clientId: client.id },
  });

  await db.membership.upsert({
    where: { userId_clientId: { userId: accountant.id, clientId: client.id } },
    update: {},
    create: { userId: accountant.id, clientId: client.id },
  });

  console.log("Seed completed:", {
    firm: firm.name,
    client: client.name,
    accounts: DEFAULT_ACCOUNTS.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
