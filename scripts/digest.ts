#!/usr/bin/env tsx
// 일별 다이제스트 — cron으로 매일 또는 주별 실행.
//
// 사용:
//   tsx scripts/digest.ts --user accountant@example.com
//   tsx scripts/digest.ts --user accountant@example.com --horizon 7
//   tsx scripts/digest.ts --user accountant@example.com --json
//
// Slack/Discord 푸시:
//   SLACK_WEBHOOK_URL=... tsx scripts/digest.ts --user accountant@example.com
//
// cron 예시 (매일 오전 7시):
//   0 7 * * * cd /path/to/tutorial && \
//       SLACK_WEBHOOK_URL=https://hooks.slack.com/... \
//       DATABASE_URL=file:./prisma/dev.db \
//       npx tsx scripts/digest.ts --user accountant@example.com >> /var/log/tax-digest.log 2>&1

import { resolveUserByEmail } from "@/lib/auth/guardCore";
import {
  buildDigest,
  digestToMarkdown,
  digestToShortLine,
  digestToSlack,
  postToWebhook,
} from "@/lib/notify/digest";

type Args = {
  user?: string;
  horizon?: number;
  json?: boolean;
  quiet?: boolean;
  short?: boolean;
};

function parseArgs(): Args {
  const a: Args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--user") a.user = argv[++i];
    else if (k === "--horizon") a.horizon = Number(argv[++i]);
    else if (k === "--json") a.json = true;
    else if (k === "--quiet") a.quiet = true;
    else if (k === "--short") a.short = true;
  }
  return a;
}

async function main() {
  const args = parseArgs();
  if (!args.user) {
    console.error("사용법: tsx scripts/digest.ts --user <email> [--horizon 14] [--json] [--quiet]");
    process.exit(1);
  }
  const user = await resolveUserByEmail(args.user);
  const digest = await buildDigest(user, { horizonDays: args.horizon ?? 14 });

  const shortLine = digestToShortLine(digest);

  // stdout 출력
  if (args.json) {
    console.log(JSON.stringify(digest, null, 2));
  } else if (args.short) {
    console.log(shortLine);
  } else if (!args.quiet) {
    console.log(digestToMarkdown(digest));
  }

  // ntfy.sh 푸시 (한 줄, 무인증 — 가장 간단)
  const ntfyTopic = process.env.NTFY_TOPIC;
  if (ntfyTopic && !shortLine.startsWith("✅")) {
    await fetch(`https://ntfy.sh/${ntfyTopic}`, {
      method: "POST",
      body: shortLine,
      headers: { Title: "세무 알림" },
    });
    if (!args.quiet) console.log(`\nntfy.sh/${ntfyTopic} 푸시 완료`);
  }

  // Slack/Discord 푸시 (전체 다이제스트)
  const webhook = process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (webhook) {
    if (digest.totals.upcomingAll === 0 && digest.totals.anomaliesAll === 0) {
      if (!args.quiet) console.log("\n(다이제스트 비어있음 — 웹훅 푸시 생략)");
    } else {
      await postToWebhook(webhook, digestToSlack(digest));
      if (!args.quiet) console.log(`\n웹훅 푸시 완료: ${webhook.slice(0, 40)}...`);
    }
  }
}

main()
  .catch((e) => {
    console.error("[digest] fatal:", e);
    process.exit(1);
  })
  .finally(() => {
    // Prisma 연결 정리
    import("@/lib/db").then(({ db }) => db.$disconnect());
  });
