#!/usr/bin/env node
// 세무기장대리 MCP 서버
// stdio 기반. Claude Desktop의 mcpServers 설정에서 호출.
//
// 인증: 환경변수 MCP_USER_EMAIL 로 사용자 식별 (단일 사용자 가정).
//       사용자가 ACCOUNTANT면 firmId의 모든 고객사 접근,
//       CLIENT면 본인이 Membership을 가진 고객사만 접근.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { calcGeneralVat } from "@/lib/tax/vat";
import { calcComprehensiveIncomeTax } from "@/lib/tax/income";
import { calcFreelanceWithholding, calcEtcIncomeWithholding } from "@/lib/tax/withholding";
import { calcFourMajorInsurance } from "@/lib/tax/insurance";
import {
  eventsFor,
  upcoming,
  CATEGORY_LABEL,
  BIZ_TYPE_LABEL,
  type BizType,
} from "@/lib/tax/calendar";
import {
  createStandardJournalEntry,
  aggregateVat,
} from "@/lib/accounting/journal";

const BIZ_TYPES = ["CORPORATION", "SOLE_GENERAL", "SOLE_SIMPLIFIED", "SOLE_TAX_FREE"] as const;

const userEmail = process.env.MCP_USER_EMAIL;
if (!userEmail) {
  console.error("[mcp] MCP_USER_EMAIL 환경변수가 필요합니다.");
  process.exit(1);
}

type ResolvedUser = {
  userId: string;
  email: string;
  role: "ACCOUNTANT" | "CLIENT";
  firmId: string | null;
};

async function resolveUser(): Promise<ResolvedUser> {
  const u = await db.user.findFirst({ where: { email: userEmail!.toLowerCase() } });
  if (!u) throw new Error(`사용자(${userEmail})를 찾을 수 없습니다. 시드를 확인하세요.`);
  if (u.role !== "ACCOUNTANT" && u.role !== "CLIENT") {
    throw new Error(`사용자 역할이 비정상: ${u.role}`);
  }
  return { userId: u.id, email: u.email, role: u.role, firmId: u.firmId ?? null };
}

async function listAccessibleClients(user: ResolvedUser) {
  if (user.role === "ACCOUNTANT" && user.firmId) {
    return db.client.findMany({ where: { firmId: user.firmId }, orderBy: { name: "asc" } });
  }
  const ms = await db.membership.findMany({
    where: { userId: user.userId },
    include: { client: true },
  });
  return ms.map((m) => m.client);
}

async function requireClientAccess(user: ResolvedUser, clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error(`고객사(${clientId})를 찾을 수 없습니다.`);
  if (user.role === "ACCOUNTANT" && user.firmId === client.firmId) return client;
  const m = await db.membership.findUnique({
    where: { userId_clientId: { userId: user.userId, clientId } },
  });
  if (!m) throw new Error(`고객사(${clientId}) 접근 권한이 없습니다.`);
  return client;
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function okJson(value: unknown) {
  return ok(JSON.stringify(value, null, 2));
}

const server = new McpServer(
  { name: "tax-accounting-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.tool(
  "list_clients",
  "내가 접근 가능한 고객사 목록과 사업자 유형을 반환합니다.",
  {},
  async () => {
    const user = await resolveUser();
    const clients = await listAccessibleClients(user);
    return okJson(
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        bizNo: c.bizNo,
        ownerName: c.ownerName,
        bizType: c.bizType,
        industry: c.industry,
      })),
    );
  },
);

server.tool(
  "calc_vat",
  "일반과세 부가가치세 계산. 공급가액(부가세 제외) 기준.",
  {
    sales: z.number().describe("매출 공급가액 합계 (원)"),
    purchases: z.number().describe("매입 공급가액 합계 (원)"),
  },
  async ({ sales, purchases }) => {
    const r = calcGeneralVat({
      sales: [{ supplyAmount: sales }],
      purchases: [{ supplyAmount: purchases }],
    });
    return okJson(r);
  },
);

server.tool(
  "calc_income_tax",
  "종합소득세 계산 (8단계 누진세율, 2025년 귀속).",
  {
    incomeAmount: z.number().describe("종합소득금액 (원)"),
    dependents: z.number().int().min(1).default(1).describe("부양가족 수(본인 포함)"),
    otherDeduction: z.number().default(0).describe("기타 소득공제 (국민연금 등, 원)"),
  },
  async ({ incomeAmount, dependents, otherDeduction }) => {
    const r = calcComprehensiveIncomeTax({ incomeAmount, dependents, otherDeduction });
    return okJson(r);
  },
);

server.tool(
  "calc_withholding",
  "원천세 계산. type=BUSINESS(3.3%) | OTHER(8.8%, 필요경비 60% 의제).",
  {
    type: z.enum(["BUSINESS", "OTHER"]),
    payment: z.number().describe("지급액 (원)"),
  },
  async ({ type, payment }) => {
    const r =
      type === "BUSINESS"
        ? calcFreelanceWithholding(payment)
        : calcEtcIncomeWithholding(payment);
    return okJson(r);
  },
);

server.tool(
  "calc_insurance",
  "4대보험 계산 (국민연금·건강·장기요양·고용·산재). 월보수 기준.",
  {
    monthlySalary: z.number().describe("월 보수액 (원, 비과세 제외)"),
    firmSize: z.enum(["SMALL", "MID_LARGE"]).default("SMALL"),
    workersCompRate: z
      .number()
      .optional()
      .describe("산재보험 업종 요율 (생략 시 평균요율 사용)"),
  },
  async ({ monthlySalary, firmSize, workersCompRate }) => {
    const r = calcFourMajorInsurance({ monthlySalary, firmSize, workersCompRate });
    return okJson(r);
  },
);

server.tool(
  "get_tax_calendar",
  "사업자 유형별 연간 신고·납부 일정. category로 부가세/소득세/원천세/4대보험/사업장현황 필터.",
  {
    bizType: z.enum(BIZ_TYPES),
    category: z
      .enum(["vat", "income", "withholding", "insurance", "business-status"])
      .optional(),
  },
  async ({ bizType, category }) => {
    let events = eventsFor(bizType as BizType);
    if (category) events = events.filter((e) => e.category === category);
    return okJson({
      bizType,
      bizTypeLabel: BIZ_TYPE_LABEL[bizType as BizType],
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        categoryLabel: CATEGORY_LABEL[e.category],
        month: e.month,
        day: e.day,
        cadence: e.cadence,
        detail: e.detail,
      })),
    });
  },
);

server.tool(
  "get_upcoming_checklist",
  "특정 고객사의 다가오는 마감 항목(N일 이내).",
  {
    clientId: z.string(),
    days: z.number().int().min(1).max(730).default(90),
  },
  async ({ clientId, days }) => {
    const user = await resolveUser();
    const client = await requireClientAccess(user, clientId);
    if (!(BIZ_TYPES as readonly string[]).includes(client.bizType)) {
      throw new Error(`고객사 사업자 유형이 비정상: ${client.bizType}`);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items = upcoming(eventsFor(client.bizType as BizType), today, days);
    return okJson({
      client: { id: client.id, name: client.name, bizType: client.bizType },
      horizonDays: days,
      items: items.map((e) => ({
        id: e.id,
        title: e.title,
        due: e.due.toISOString().slice(0, 10),
        daysUntil: Math.ceil((e.due.getTime() - today.getTime()) / 86400000),
        category: e.category,
        detail: e.detail,
      })),
    });
  },
);

server.tool(
  "get_client_vat_aggregate",
  "고객사·기간별 매출/매입/납부세액 집계. from/to는 YYYY-MM-DD.",
  {
    clientId: z.string(),
    from: z.string().describe("시작일 YYYY-MM-DD"),
    to: z.string().describe("종료일 YYYY-MM-DD"),
  },
  async ({ clientId, from, to }) => {
    const user = await resolveUser();
    await requireClientAccess(user, clientId);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new Error("from/to 날짜 형식이 올바르지 않습니다.");
    }
    const agg = await aggregateVat({ clientId, from: fromDate, to: toDate });
    return okJson({ clientId, from, to, ...agg });
  },
);

server.tool(
  "create_journal_entry",
  "표준 매출/매입 분개를 생성하고 부가세를 자동 분리해 저장합니다. 영수증/세금계산서 정보를 그대로 넘기세요.",
  {
    clientId: z.string(),
    occurredOn: z.string().describe("거래일자 YYYY-MM-DD"),
    counterparty: z.string().describe("상대 거래처(상호)"),
    description: z.string().optional().describe("적요/메모"),
    direction: z.enum(["SALE", "PURCHASE"]),
    settlement: z.enum(["CASH", "CREDIT"]).default("CASH").describe("결제: 현금(또는 보통예금) vs 외상"),
    supplyAmount: z.number().describe("공급가액 (부가세 제외, 원)"),
    isTaxFree: z.boolean().default(false).describe("면세 거래 여부 (true면 부가세 분리 없음)"),
  },
  async (args) => {
    const user = await resolveUser();
    await requireClientAccess(user, args.clientId);
    const occurredOn = new Date(args.occurredOn);
    if (Number.isNaN(occurredOn.getTime())) {
      throw new Error("occurredOn 형식이 올바르지 않습니다.");
    }
    const entry = await createStandardJournalEntry({
      clientId: args.clientId,
      occurredOn,
      counterparty: args.counterparty,
      description: args.description,
      direction: args.direction,
      settlement: args.settlement,
      supplyAmount: args.supplyAmount,
      isTaxFree: args.isTaxFree,
    });
    return okJson({
      id: entry.id,
      occurredOn: entry.occurredOn.toISOString().slice(0, 10),
      counterparty: entry.counterparty,
      vatDirection: entry.vatDirection,
      supplyAmount: entry.supplyAmount,
      vatAmount: entry.vatAmount,
      totalAmount: entry.totalAmount,
      lineCount: entry.lines.length,
    });
  },
);

server.tool(
  "list_recent_journal_entries",
  "고객사의 최근 분개 N건 조회.",
  {
    clientId: z.string(),
    limit: z.number().int().min(1).max(100).default(10),
  },
  async ({ clientId, limit }) => {
    const user = await resolveUser();
    await requireClientAccess(user, clientId);
    const entries = await db.journalEntry.findMany({
      where: { clientId },
      orderBy: { occurredOn: "desc" },
      take: limit,
      include: { lines: { include: { account: true } } },
    });
    return okJson(
      entries.map((e) => ({
        id: e.id,
        occurredOn: e.occurredOn.toISOString().slice(0, 10),
        counterparty: e.counterparty,
        description: e.description,
        vatDirection: e.vatDirection,
        supplyAmount: e.supplyAmount,
        vatAmount: e.vatAmount,
        totalAmount: e.totalAmount,
        lines: e.lines.map((l) => ({
          account: `${l.account.code} ${l.account.name}`,
          debit: l.debit,
          credit: l.credit,
        })),
      })),
    );
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp] tax-accounting-mcp ready (user=${userEmail})`);
}

main().catch((e) => {
  console.error("[mcp] fatal:", e);
  process.exit(1);
});
