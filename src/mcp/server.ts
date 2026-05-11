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
import { eventsFor, upcoming, CATEGORY_LABEL } from "@/lib/tax/calendar";
import { BIZ_TYPES, BIZ_TYPE_LABEL, isBizType, type BizType } from "@/lib/tax/bizType";
import {
  createStandardJournalEntry,
  createStandardJournalEntriesBulk,
  aggregateVat,
} from "@/lib/accounting/journal";
import { findAnomalies } from "@/lib/accounting/anomaly";
import { generateIcs } from "@/lib/calendar/ics";
import {
  checkClientAccess,
  findAccessibleClients,
  resolveUserByEmail,
  type ResolvedUser,
} from "@/lib/auth/guardCore";
import { fetchNtsStatus, checksumValid, normalizeBizNo } from "@/lib/tax/bizNo";
import {
  generateVatFilingGuide,
  generateIncomeTaxFilingGuide,
  generateCorporateTaxFilingGuide,
  generateWithholdingFilingGuide,
  generateBusinessStatusFilingGuide,
  type VatFilingPeriod,
} from "@/lib/tax/filingGuide";

const userEmail = process.env.MCP_USER_EMAIL;
if (!userEmail) {
  console.error("[mcp] MCP_USER_EMAIL 환경변수가 필요합니다.");
  process.exit(1);
}

let _userCache: ResolvedUser | null = null;
async function user(): Promise<ResolvedUser> {
  if (_userCache) return _userCache;
  _userCache = await resolveUserByEmail(userEmail!);
  return _userCache;
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function okJson(value: unknown) {
  return ok(JSON.stringify(value, null, 2));
}

const server = new McpServer(
  { name: "tax-accounting-mcp", version: "0.2.0" },
  { capabilities: { tools: {} } },
);

server.tool(
  "list_clients",
  "내가 접근 가능한 고객사 목록과 사업자 유형을 반환합니다.",
  {},
  async () => {
    const clients = await findAccessibleClients(await user());
    return okJson(
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        bizNo: c.bizNo,
        ownerName: c.ownerName,
        bizType: c.bizType,
        bizTypeLabel: isBizType(c.bizType) ? BIZ_TYPE_LABEL[c.bizType] : c.bizType,
        industry: c.industry,
      })),
    );
  },
);

server.tool(
  "calc_vat",
  "일반과세 부가가치세 계산. 공급가액(부가세 제외) 기준.",
  {
    sales: z.number(),
    purchases: z.number(),
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
    incomeAmount: z.number(),
    dependents: z.number().int().min(1).default(1),
    otherDeduction: z.number().default(0),
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
    payment: z.number(),
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
    monthlySalary: z.number(),
    firmSize: z.enum(["SMALL", "MID_LARGE"]).default("SMALL"),
    workersCompRate: z.number().optional(),
  },
  async ({ monthlySalary, firmSize, workersCompRate }) => {
    const r = calcFourMajorInsurance({ monthlySalary, firmSize, workersCompRate });
    return okJson(r);
  },
);

server.tool(
  "get_tax_calendar",
  "사업자 유형별 연간 신고·납부 일정. category로 필터.",
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
    const client = await checkClientAccess(await user(), clientId);
    if (!isBizType(client.bizType)) {
      throw new Error(`고객사 사업자 유형이 비정상: ${client.bizType}`);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items = upcoming(eventsFor(client.bizType), today, days);
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
  "고객사·기간별 매출/매입/납부세액 집계.",
  {
    clientId: z.string(),
    from: z.string(),
    to: z.string(),
  },
  async ({ clientId, from, to }) => {
    await checkClientAccess(await user(), clientId);
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
    occurredOn: z.string(),
    counterparty: z.string(),
    description: z.string().optional(),
    direction: z.enum(["SALE", "PURCHASE"]),
    settlement: z.enum(["CASH", "CREDIT"]).default("CASH"),
    supplyAmount: z.number(),
    isTaxFree: z.boolean().default(false),
  },
  async (args) => {
    await checkClientAccess(await user(), args.clientId);
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
    await checkClientAccess(await user(), clientId);
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

server.tool(
  "verify_biz_no",
  "사업자등록번호 형식·체크섬 검증 + (NTS_BUSINESSMAN_API_KEY 설정 시) 국세청 상태 조회. 거래처 등록 전 검증 용도.",
  {
    bizNo: z.string().describe("사업자번호 (하이픈 있어도 무방, 10자리 숫자)"),
  },
  async ({ bizNo }) => {
    const normalized = normalizeBizNo(bizNo);
    if (!normalized) return okJson({ ok: false, reason: "10자리 숫자가 아닙니다." });
    if (!checksumValid(normalized)) {
      return okJson({ ok: false, normalized, reason: "체크섬 실패 (형식 오류)" });
    }
    const status = await fetchNtsStatus(normalized);
    return okJson(status);
  },
);

server.tool(
  "generate_vat_filing_guide",
  "특정 고객사·기간에 대해 홈택스 부가세 신고 단계별 가이드를 마크다운으로 생성. 직접 신고할 때 따라할 수 있도록.",
  {
    clientId: z.string(),
    period: z.enum(["1H_PRELIM", "1H_FINAL", "2H_PRELIM", "2H_FINAL", "SIMPLIFIED_ANNUAL"]),
    from: z.string().describe("집계 시작일 YYYY-MM-DD"),
    to: z.string().describe("집계 종료일 YYYY-MM-DD"),
  },
  async ({ clientId, period, from, to }) => {
    const client = await checkClientAccess(await user(), clientId);
    if (!isBizType(client.bizType)) {
      throw new Error(`고객사 사업자 유형이 비정상: ${client.bizType}`);
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new Error("from/to 날짜 형식이 올바르지 않습니다.");
    }
    const agg = await aggregateVat({ clientId, from: fromDate, to: toDate });
    const guide = generateVatFilingGuide({
      bizType: client.bizType,
      period: period as VatFilingPeriod,
      clientName: client.name,
      agg,
    });
    return ok(guide);
  },
);

server.tool(
  "generate_income_tax_filing_guide",
  "개인사업자 종합소득세(5월 신고) 단계별 가이드. 분개 매출 자동 집계 + 사용자 소득금액·부양가족 직접 입력.",
  {
    clientId: z.string(),
    taxYear: z.number().int().describe("귀속연도 (예: 2025)"),
    incomeAmount: z.number().optional().describe("종합소득금액(수입-필요경비). 없으면 가이드만 출력"),
    dependents: z.number().int().min(1).optional(),
  },
  async ({ clientId, taxYear, incomeAmount, dependents }) => {
    const client = await checkClientAccess(await user(), clientId);
    // 해당 연도 매출 집계 (참고)
    const from = new Date(taxYear, 0, 1);
    const to = new Date(taxYear, 11, 31, 23, 59, 59);
    const agg = await aggregateVat({ clientId, from, to });
    const guide = generateIncomeTaxFilingGuide({
      clientName: client.name,
      taxYear,
      salesFromJournal: agg.salesSupply,
      incomeAmount,
      dependents,
    });
    return ok(guide);
  },
);

server.tool(
  "generate_corporate_tax_filing_guide",
  "법인세 신고(결산일 후 3개월) 단계별 가이드. 법인 고객사 전용.",
  {
    clientId: z.string(),
    fiscalYearEnd: z.string().describe("결산일 YYYY-MM-DD (보통 12-31)"),
  },
  async ({ clientId, fiscalYearEnd }) => {
    const client = await checkClientAccess(await user(), clientId);
    if (client.bizType !== "CORPORATION") {
      throw new Error("법인사업자만 사용 가능 (현 고객사는 " + client.bizType + ")");
    }
    const end = new Date(fiscalYearEnd);
    const startYear = end.getFullYear();
    const from = new Date(startYear, 0, 1);
    const agg = await aggregateVat({ clientId, from, to: end });
    const guide = generateCorporateTaxFilingGuide({
      clientName: client.name,
      fiscalYearEnd,
      salesFromJournal: agg.salesSupply,
    });
    return ok(guide);
  },
);

server.tool(
  "generate_withholding_filing_guide",
  "월별 원천세 신고(다음달 10일) 단계별 가이드. 사업소득/기타소득 지급액 입력 시 원천세 자동 계산.",
  {
    clientId: z.string(),
    targetMonth: z.string().describe("신고대상 월 YYYY-MM"),
    businessIncomePaid: z.number().optional().describe("프리랜서 등 사업소득 지급 합계"),
    otherIncomePaid: z.number().optional().describe("강사료 등 기타소득 지급 합계"),
    wageIncomePaid: z.number().optional().describe("근로소득 지급 합계 (참고용 — 실제 원천세는 간이세액표)"),
  },
  async ({ clientId, targetMonth, businessIncomePaid, otherIncomePaid, wageIncomePaid }) => {
    const client = await checkClientAccess(await user(), clientId);
    const guide = generateWithholdingFilingGuide({
      clientName: client.name,
      targetMonth,
      businessIncomePaid,
      otherIncomePaid,
      wageIncomePaid,
    });
    return ok(guide);
  },
);

server.tool(
  "generate_business_status_filing_guide",
  "면세사업자 사업장현황신고(2/10) 단계별 가이드. 1년치 매출 자동 집계.",
  {
    clientId: z.string(),
    taxYear: z.number().int().describe("귀속연도 (예: 2025)"),
  },
  async ({ clientId, taxYear }) => {
    const client = await checkClientAccess(await user(), clientId);
    if (client.bizType !== "SOLE_TAX_FREE") {
      throw new Error("면세사업자만 사용 (현 고객사는 " + client.bizType + ")");
    }
    const from = new Date(taxYear, 0, 1);
    const to = new Date(taxYear, 11, 31, 23, 59, 59);
    const agg = await aggregateVat({ clientId, from, to });
    const guide = generateBusinessStatusFilingGuide({
      clientName: client.name,
      taxYear,
      annualSales: agg.salesSupply,
    });
    return ok(guide);
  },
);

server.tool(
  "bulk_create_journal_entries",
  "여러 분개를 일괄 저장. 엑셀 행을 읽어 한꺼번에 넘길 때 사용. 한 건 실패해도 다른 건은 진행됨.",
  {
    clientId: z.string(),
    entries: z.array(
      z.object({
        occurredOn: z.string().describe("YYYY-MM-DD"),
        counterparty: z.string(),
        description: z.string().optional(),
        direction: z.enum(["SALE", "PURCHASE"]),
        settlement: z.enum(["CASH", "CREDIT"]).default("CASH"),
        supplyAmount: z.number(),
        isTaxFree: z.boolean().default(false),
        sourceRow: z.number().int().optional(),
      }),
    ).max(1000, "한 번에 최대 1000건"),
  },
  async ({ clientId, entries }) => {
    await checkClientAccess(await user(), clientId);
    const inputs = entries.map((e) => ({
      clientId,
      occurredOn: new Date(e.occurredOn),
      counterparty: e.counterparty,
      description: e.description,
      direction: e.direction,
      settlement: e.settlement,
      supplyAmount: e.supplyAmount,
      isTaxFree: e.isTaxFree,
      sourceRow: e.sourceRow,
    }));
    const results = await createStandardJournalEntriesBulk(inputs);
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    return okJson({
      total: results.length,
      ok,
      failed: failed.length,
      errors: failed.slice(0, 50).map((f) => ({ sourceRow: f.sourceRow, error: f.error })),
    });
  },
);

server.tool(
  "find_journal_anomalies",
  "고객사 분개에서 누락·이상을 휴리스틱으로 감지. 신고 전·월말 점검용. (매출 급변, 신고시즌 임박 누락, 거래처 단절, VAT 미분류)",
  {
    clientId: z.string(),
  },
  async ({ clientId }) => {
    await checkClientAccess(await user(), clientId);
    const anomalies = await findAnomalies(clientId);
    return okJson({
      count: anomalies.length,
      bySeverity: {
        alert: anomalies.filter((a) => a.severity === "alert").length,
        warn: anomalies.filter((a) => a.severity === "warn").length,
        info: anomalies.filter((a) => a.severity === "info").length,
      },
      items: anomalies,
    });
  },
);

server.tool(
  "generate_calendar_ics",
  "사업자 유형별 1년치 세무 일정을 iCalendar(.ics) 텍스트로 반환. 구글/애플/아웃룩 캘린더 모두 지원. D-7·D-1 알림 자동 포함.",
  {
    bizType: z.enum(BIZ_TYPES),
    year: z.number().int().min(2000).max(2100).optional(),
    reminderDays: z.array(z.number().int().min(0).max(60)).optional(),
  },
  async ({ bizType, year, reminderDays }) => {
    const ics = generateIcs(bizType as BizType, { year, reminderDays });
    return ok(ics);
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp] tax-accounting-mcp v0.5.0 ready (user=${userEmail})`);
}

main().catch((e) => {
  console.error("[mcp] fatal:", e);
  process.exit(1);
});
