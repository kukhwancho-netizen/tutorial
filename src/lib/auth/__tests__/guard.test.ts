// 테넌트 격리 시뮬레이션:
//   - 세션 없으면 401
//   - 다른 사무소의 client 조회 시 403 (세무사)
//   - Membership 없으면 403 (고객사 사용자)
//   - 정상 접근은 통과

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// next/headers cookies()를 모킹
let currentCookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      name === "demo_session" && currentCookie ? { value: currentCookie } : undefined,
    set: () => {},
    delete: () => {},
  }),
}));

const { writeSession } = await import("../session");
const { AuthError, requireClientAccess } = await import("../guard");

let firmA = "";
let firmB = "";
let clientA = "";
let clientB = "";
let accountantA = "";
let accountantB = "";
let outsiderClientUser = "";

beforeAll(async () => {
  const fa = await db.firm.create({ data: { name: "사무소A" } });
  const fb = await db.firm.create({ data: { name: "사무소B" } });
  firmA = fa.id;
  firmB = fb.id;

  const ca = await db.client.create({
    data: { firmId: firmA, name: "고객A", bizNo: "001-00-00001" },
  });
  const cb = await db.client.create({
    data: { firmId: firmB, name: "고객B", bizNo: "002-00-00002" },
  });
  clientA = ca.id;
  clientB = cb.id;

  const aa = await db.user.create({
    data: { email: "a@firm.test", name: "세무사A", role: "ACCOUNTANT", firmId: firmA },
  });
  const ab = await db.user.create({
    data: { email: "b@firm.test", name: "세무사B", role: "ACCOUNTANT", firmId: firmB },
  });
  const outsider = await db.user.create({
    data: { email: "outsider@x.test", name: "외부인", role: "CLIENT" },
  });
  accountantA = aa.id;
  accountantB = ab.id;
  outsiderClientUser = outsider.id;
});

afterAll(async () => {
  await db.user.deleteMany({
    where: { id: { in: [accountantA, accountantB, outsiderClientUser] } },
  });
  await db.client.deleteMany({ where: { id: { in: [clientA, clientB] } } });
  await db.firm.deleteMany({ where: { id: { in: [firmA, firmB] } } });
  await db.$disconnect();
});

function setSession(s: {
  userId: string;
  email: string;
  role: "ACCOUNTANT" | "CLIENT";
  firmId?: string | null;
}) {
  // writeSession은 cookies().set()을 부르지만 모킹된 set은 no-op이므로
  // 직접 쿠키 값을 합성한다.
  const { createHmac } = require("node:crypto");
  const secret = process.env.SESSION_SECRET ?? "dev-only-secret";
  const b64 = Buffer.from(JSON.stringify(s)).toString("base64url");
  const sig = createHmac("sha256", secret).update(b64).digest("hex");
  currentCookie = `${b64}.${sig}`;
}

describe("테넌트 격리 가드", () => {
  it("세션 없으면 401", async () => {
    currentCookie = undefined;
    await expect(requireClientAccess(clientA)).rejects.toMatchObject({
      status: 401,
    });
  });

  it("세무사A는 자기 사무소 고객A 접근 가능", async () => {
    setSession({
      userId: accountantA,
      email: "a@firm.test",
      role: "ACCOUNTANT",
      firmId: firmA,
    });
    const r = await requireClientAccess(clientA);
    expect(r.client.name).toBe("고객A");
  });

  it("세무사A가 사무소B의 고객B를 URL 조작으로 시도 → 403", async () => {
    setSession({
      userId: accountantA,
      email: "a@firm.test",
      role: "ACCOUNTANT",
      firmId: firmA,
    });
    await expect(requireClientAccess(clientB)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("Membership 없는 외부 고객사 사용자는 403", async () => {
    setSession({
      userId: outsiderClientUser,
      email: "outsider@x.test",
      role: "CLIENT",
      firmId: null,
    });
    await expect(requireClientAccess(clientA)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("존재하지 않는 clientId는 404", async () => {
    setSession({
      userId: accountantA,
      email: "a@firm.test",
      role: "ACCOUNTANT",
      firmId: firmA,
    });
    await expect(requireClientAccess("nonexistent-id")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("AuthError instance 확인", () => {
    expect(new AuthError("테스트", 401)).toBeInstanceOf(Error);
  });
});
