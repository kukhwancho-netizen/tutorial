// 다이제스트 — 한 사용자(또는 전체 고객사)에 대해
//   - 다가오는 마감(N일 이내)
//   - 분개 누락·이상
// 을 모아 마크다운으로 정리. CLI/MCP/Slack 모두 같은 함수 재사용.

import { db } from "@/lib/db";
import { eventsFor, upcoming } from "@/lib/tax/calendar";
import { isBizType, BIZ_TYPE_LABEL } from "@/lib/tax/bizType";
import { findAnomalies, type Anomaly } from "@/lib/accounting/anomaly";
import { findAccessibleClients, type ResolvedUser } from "@/lib/auth/guardCore";

export type ClientDigest = {
  clientId: string;
  clientName: string;
  bizTypeLabel: string;
  upcoming: Array<{ title: string; due: string; daysUntil: number; category: string }>;
  anomalies: Anomaly[];
};

export type Digest = {
  generatedAt: string;
  userEmail: string;
  clients: ClientDigest[];
  totals: {
    upcomingAll: number;
    upcoming7d: number;
    anomaliesAll: number;
    anomaliesAlert: number;
  };
};

export type DigestOptions = {
  /** 다가오는 일정 horizon (기본 14일) */
  horizonDays?: number;
};

export async function buildDigest(
  user: ResolvedUser,
  opts: DigestOptions = {},
): Promise<Digest> {
  const horizon = opts.horizonDays ?? 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const clients = await findAccessibleClients(user);
  const digests: ClientDigest[] = [];

  for (const c of clients) {
    let upcomingItems: ClientDigest["upcoming"] = [];
    if (isBizType(c.bizType)) {
      upcomingItems = upcoming(eventsFor(c.bizType), today, horizon).map((e) => ({
        title: e.title,
        due: e.due.toISOString().slice(0, 10),
        daysUntil: Math.ceil((e.due.getTime() - today.getTime()) / 86400000),
        category: e.category,
      }));
    }
    const anomalies = await findAnomalies(c.id, today);
    digests.push({
      clientId: c.id,
      clientName: c.name,
      bizTypeLabel: isBizType(c.bizType) ? BIZ_TYPE_LABEL[c.bizType] : c.bizType,
      upcoming: upcomingItems,
      anomalies,
    });
  }

  const totals = {
    upcomingAll: digests.reduce((s, d) => s + d.upcoming.length, 0),
    upcoming7d: digests.reduce(
      (s, d) => s + d.upcoming.filter((u) => u.daysUntil <= 7).length,
      0,
    ),
    anomaliesAll: digests.reduce((s, d) => s + d.anomalies.length, 0),
    anomaliesAlert: digests.reduce(
      (s, d) => s + d.anomalies.filter((a) => a.severity === "alert").length,
      0,
    ),
  };

  return {
    generatedAt: new Date().toISOString(),
    userEmail: user.email,
    clients: digests,
    totals,
  };
}

// ----------------------------------------------------------------------------
// 포매터
// ----------------------------------------------------------------------------

export function digestToMarkdown(d: Digest): string {
  const lines: string[] = [
    `# 세무 다이제스트 (${d.generatedAt.slice(0, 10)})`,
    "",
    `사용자: ${d.userEmail} · 고객사 ${d.clients.length}곳`,
    `다가오는 마감: ${d.totals.upcomingAll}건 (7일 이내 ${d.totals.upcoming7d}건)`,
    `이상 감지: ${d.totals.anomaliesAll}건${d.totals.anomaliesAlert > 0 ? ` (🚨 alert ${d.totals.anomaliesAlert})` : ""}`,
    "",
  ];

  if (d.totals.upcomingAll === 0 && d.totals.anomaliesAll === 0) {
    lines.push("✅ 오늘 처리할 항목 없음.");
    return lines.join("\n");
  }

  for (const c of d.clients) {
    if (c.upcoming.length === 0 && c.anomalies.length === 0) continue;
    lines.push(`## ${c.clientName} (${c.bizTypeLabel})`);
    lines.push("");

    if (c.upcoming.length > 0) {
      lines.push("**📅 다가오는 마감**");
      for (const u of c.upcoming) {
        const urgency = u.daysUntil <= 1 ? "🚨" : u.daysUntil <= 7 ? "⚠" : "·";
        lines.push(`- ${urgency} ${u.due} (D-${u.daysUntil}) ${u.title}`);
      }
      lines.push("");
    }

    if (c.anomalies.length > 0) {
      lines.push("**🔍 이상 감지**");
      for (const a of c.anomalies) {
        const icon = a.severity === "alert" ? "🚨" : a.severity === "warn" ? "⚠" : "ℹ";
        lines.push(`- ${icon} ${a.title}`);
        lines.push(`  ${a.detail}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ----------------------------------------------------------------------------
// Slack/Discord 호환 페이로드 (둘 다 {text: "..."} 형태 수용)
// ----------------------------------------------------------------------------

export function digestToSlack(d: Digest): { text: string } {
  return { text: digestToMarkdown(d) };
}

export async function postToWebhook(url: string, payload: object): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Webhook 응답 실패 ${res.status}: ${await res.text()}`);
  }
}
