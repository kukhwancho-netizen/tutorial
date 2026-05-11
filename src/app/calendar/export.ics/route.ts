// /calendar/export.ics?bizType=SOLE_GENERAL&year=2026
// → text/calendar 응답. 사용자가 클릭하면 다운로드되어 캘린더 앱에서 임포트 가능.

import { NextRequest } from "next/server";
import { generateIcs } from "@/lib/calendar/ics";
import { isBizType } from "@/lib/tax/bizType";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const bizType = sp.get("bizType");
  const yearRaw = sp.get("year");
  const year = yearRaw ? Number(yearRaw) : new Date().getFullYear();

  if (!isBizType(bizType)) {
    return new Response("bizType 파라미터가 올바르지 않습니다.", { status: 400 });
  }
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return new Response("year 파라미터가 올바르지 않습니다.", { status: 400 });
  }

  const ics = generateIcs(bizType, { year });
  const fileName = `tax-calendar-${bizType}-${year}.ics`;

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
