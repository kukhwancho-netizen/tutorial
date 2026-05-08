import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

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
      firmId: firm.id,
      name: "샘플상사",
      bizNo: "111-22-33333",
      ownerName: "홍길동",
      bizType: "SOLE_GENERAL",
      industry: "도소매",
    },
  });

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

  console.log("Seed completed:", { firm: firm.name, client: client.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
