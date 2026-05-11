// 분개 누락·이상 감지 휴리스틱.
// 신고 전 또는 월말에 호출해 "이거 빠진 거 없어?" 점검 용도.
//
// 검출 규칙:
//   A. 매출 급변   직전 같은 기간 대비 ±50% 이상 변동
//   B. 분개 부재   신고 시즌 30일 전인데 해당 기간 분개 0건
//   C. 거래처 단절 3개월 이상 거래 없는 거래처 (이전 3개월간 1회 이상 거래)
//   D. VAT 누락    매출/매입 분개인데 vatDirection이 null (면세 아닌데 누락 의심)

import { db } from "@/lib/db";
import { eventsFor, upcoming, type BizType } from "@/lib/tax/calendar";
import { isBizType } from "@/lib/tax/bizType";

export type AnomalyKind = "SALES_SHIFT" | "MISSING_ENTRIES" | "DORMANT_COUNTERPARTY" | "MISSING_VAT";

export type Anomaly = {
  kind: AnomalyKind;
  severity: "info" | "warn" | "alert";
  title: string;
  detail: string;
  /** 추가 데이터 (UI/Claude가 활용 가능) */
  meta?: Record<string, unknown>;
};

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfNextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

async function sumSales(clientId: string, from: Date, to: Date): Promise<number> {
  const r = await db.journalEntry.aggregate({
    _sum: { supplyAmount: true },
    where: {
      clientId,
      vatDirection: "SALE",
      occurredOn: { gte: from, lt: to },
    },
  });
  return r._sum.supplyAmount ?? 0;
}

async function entryCount(clientId: string, from: Date, to: Date): Promise<number> {
  return db.journalEntry.count({
    where: { clientId, occurredOn: { gte: from, lt: to } },
  });
}

// ----------------------------------------------------------------------------
// A. 매출 급변
// ----------------------------------------------------------------------------

async function detectSalesShift(clientId: string, today: Date): Promise<Anomaly[]> {
  const thisStart = startOfMonth(today);
  const thisEnd = startOfNextMonth(today);
  const lastStart = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const lastEnd = thisStart;

  const [thisSales, lastSales] = await Promise.all([
    sumSales(clientId, thisStart, thisEnd),
    sumSales(clientId, lastStart, lastEnd),
  ]);
  if (lastSales === 0 && thisSales === 0) return [];
  if (lastSales === 0) {
    return [
      {
        kind: "SALES_SHIFT",
        severity: "info",
        title: "직전월 매출 없음 → 이번달 신규 매출",
        detail: `직전월 매출 0원 → 이번달 ${thisSales.toLocaleString()}원. 신규 거래 시작일 가능.`,
        meta: { thisSales, lastSales },
      },
    ];
  }
  const ratio = thisSales / lastSales;
  if (ratio >= 1.5) {
    return [
      {
        kind: "SALES_SHIFT",
        severity: "warn",
        title: "매출 급증",
        detail: `직전월 대비 ${Math.round((ratio - 1) * 100)}% 증가 (${lastSales.toLocaleString()} → ${thisSales.toLocaleString()})`,
        meta: { thisSales, lastSales, ratio },
      },
    ];
  }
  if (ratio <= 0.5) {
    return [
      {
        kind: "SALES_SHIFT",
        severity: "warn",
        title: "매출 급감",
        detail: `직전월 대비 ${Math.round((1 - ratio) * 100)}% 감소 (${lastSales.toLocaleString()} → ${thisSales.toLocaleString()}). 누락된 매출 분개 가능성 점검 권장.`,
        meta: { thisSales, lastSales, ratio },
      },
    ];
  }
  return [];
}

// ----------------------------------------------------------------------------
// B. 신고 시즌 임박인데 분개 부재
// ----------------------------------------------------------------------------

async function detectMissingEntriesBeforeFiling(
  clientId: string,
  bizType: BizType,
  today: Date,
): Promise<Anomaly[]> {
  const items = upcoming(eventsFor(bizType), today, 30).filter(
    (e) => e.category === "vat" || e.category === "income",
  );
  if (items.length === 0) return [];

  const out: Anomaly[] = [];
  for (const e of items) {
    // 해당 신고 대상 기간을 추정 (간단한 휴리스틱)
    // - 부가세 7월 마감 → 1~6월
    // - 부가세 1월 마감 → 7~12월(전년)
    // - 종소세 5월 마감 → 1~12월(전년)
    let from: Date | null = null;
    let to: Date | null = null;
    if (e.category === "vat") {
      if (e.month === 7) {
        from = new Date(today.getFullYear(), 0, 1);
        to = new Date(today.getFullYear(), 6, 1);
      } else if (e.month === 1) {
        from = new Date(today.getFullYear() - 1, 6, 1);
        to = new Date(today.getFullYear(), 0, 1);
      } else if (e.month === 4) {
        from = new Date(today.getFullYear(), 0, 1);
        to = new Date(today.getFullYear(), 3, 1);
      } else if (e.month === 10) {
        from = new Date(today.getFullYear(), 6, 1);
        to = new Date(today.getFullYear(), 9, 1);
      }
    } else if (e.category === "income" && e.month === 5) {
      from = new Date(today.getFullYear() - 1, 0, 1);
      to = new Date(today.getFullYear(), 0, 1);
    }
    if (!from || !to) continue;

    const cnt = await entryCount(clientId, from, to);
    if (cnt === 0) {
      out.push({
        kind: "MISSING_ENTRIES",
        severity: "alert",
        title: `${e.title} 임박 — 해당 기간 분개 0건`,
        detail: `${e.due.toISOString().slice(0, 10)} 마감 (D-${Math.ceil((e.due.getTime() - today.getTime()) / 86400000)}). 신고 대상 기간(${from.toISOString().slice(0, 10)}~)에 분개가 없습니다.`,
        meta: { eventId: e.id, from: from.toISOString(), to: to.toISOString() },
      });
    } else if (cnt < 3) {
      out.push({
        kind: "MISSING_ENTRIES",
        severity: "warn",
        title: `${e.title} 임박 — 분개 ${cnt}건뿐`,
        detail: `신고 대상 기간에 분개가 ${cnt}건만 있습니다. 누락 점검 권장.`,
        meta: { eventId: e.id, count: cnt },
      });
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// C. 휴면 거래처
// ----------------------------------------------------------------------------

async function detectDormantCounterparties(clientId: string, today: Date): Promise<Anomaly[]> {
  const cutoff = new Date(today.getTime() - 3 * MONTH_MS); // 3개월 전

  // 최근 3개월 거래처
  const recent = await db.journalEntry.groupBy({
    by: ["counterparty"],
    where: { clientId, occurredOn: { gte: cutoff }, counterparty: { not: null } },
    _count: true,
  });
  const recentSet = new Set(recent.map((r) => r.counterparty));

  // 이전(3개월 전 시점까지)에 거래했던 모든 거래처
  const previous = await db.journalEntry.groupBy({
    by: ["counterparty"],
    where: {
      clientId,
      occurredOn: { lt: cutoff },
      counterparty: { not: null },
    },
    _count: true,
  });

  const dormant = previous.filter((p) => p.counterparty && !recentSet.has(p.counterparty));
  if (dormant.length === 0) return [];

  return [
    {
      kind: "DORMANT_COUNTERPARTY",
      severity: "info",
      title: `최근 3개월간 거래 없는 거래처 ${dormant.length}곳`,
      detail: dormant
        .slice(0, 5)
        .map((d) => `${d.counterparty} (과거 ${d._count}건)`)
        .join(", ") + (dormant.length > 5 ? ` 외 ${dormant.length - 5}곳` : ""),
      meta: { counterparties: dormant.slice(0, 20) },
    },
  ];
}

// ----------------------------------------------------------------------------
// D. VAT 누락 의심 분개
// ----------------------------------------------------------------------------

async function detectMissingVat(clientId: string, today: Date): Promise<Anomaly[]> {
  const monthAgo = new Date(today.getTime() - 3 * MONTH_MS);
  // vatDirection 이 null 이면서 금액이 큰 분개 (보통 면세는 금액이 작음)
  const suspicious = await db.journalEntry.findMany({
    where: {
      clientId,
      occurredOn: { gte: monthAgo },
      vatDirection: null,
      supplyAmount: { gte: 500_000 }, // 50만 이상
    },
    select: { id: true, occurredOn: true, counterparty: true, supplyAmount: true, description: true },
    take: 10,
    orderBy: { supplyAmount: "desc" },
  });
  if (suspicious.length === 0) return [];

  return [
    {
      kind: "MISSING_VAT",
      severity: "warn",
      title: `부가세 미분류 분개 ${suspicious.length}건 (50만원 이상)`,
      detail: `면세 거래가 맞는지 확인 권장. 과세 거래라면 부가세 라인 누락.`,
      meta: {
        entries: suspicious.map((e) => ({
          id: e.id,
          date: e.occurredOn.toISOString().slice(0, 10),
          counterparty: e.counterparty,
          amount: e.supplyAmount,
        })),
      },
    },
  ];
}

// ----------------------------------------------------------------------------
// 종합 — 모든 검출 규칙 실행
// ----------------------------------------------------------------------------

export async function findAnomalies(
  clientId: string,
  today: Date = new Date(),
): Promise<Anomaly[]> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { bizType: true },
  });
  if (!client) return [];

  const t = new Date(today);
  t.setHours(0, 0, 0, 0);

  const tasks: Promise<Anomaly[]>[] = [
    detectSalesShift(clientId, t),
    detectDormantCounterparties(clientId, t),
    detectMissingVat(clientId, t),
  ];
  if (isBizType(client.bizType)) {
    tasks.push(detectMissingEntriesBeforeFiling(clientId, client.bizType, t));
  }

  const results = await Promise.all(tasks);
  return results.flat();
}
