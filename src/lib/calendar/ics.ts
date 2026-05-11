// 세무 일정을 iCalendar(RFC 5545) 형식으로 출력.
// 사용자가 다운로드 → Google Calendar / Apple Calendar / Outlook 등 어디든 임포트.
// VALARM(D-7, D-1)으로 자동 알림 설정.

import { type TaxEvent, type BizType, eventsFor } from "@/lib/tax/calendar";

export type IcsOptions = {
  /** 시작 연도 (기본: 현재 연도) */
  year?: number;
  /** 알림 일수 (기본: [7, 1]) */
  reminderDays?: number[];
  /** 캘린더 이름 */
  calendarName?: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIcsDate(year: number, month: number, day: number): string {
  return `${year}${pad(month)}${pad(day)}`;
}

/** 텍스트 안의 줄바꿈·쉼표·세미콜론·역슬래시를 ICS 규약대로 이스케이프 */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** ICS는 한 줄 75 옥텟 제한. 한국어는 octet 기준으로 안전하게 70자에서 fold. */
function foldLine(line: string): string {
  if (line.length <= 70) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 70) {
    parts.push((i === 0 ? "" : " ") + line.slice(i, i + 70));
  }
  return parts.join("\r\n");
}

function buildVEvent(
  event: TaxEvent & { occurYear: number },
  reminderDays: number[],
  now: string,
): string {
  const dt = toIcsDate(event.occurYear, event.month, event.day);
  const uid = `${event.id}-${event.occurYear}@tax-accounting`;

  const alarms = reminderDays
    .map(
      (d) =>
        ["BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:-P${d}D`, `DESCRIPTION:${escapeIcs(`${event.title} D-${d}`)}`, "END:VALARM"].join("\r\n"),
    )
    .join("\r\n");

  const lines = [
    "BEGIN:VEVENT",
    foldLine(`UID:${uid}`),
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${dt}`,
    foldLine(`SUMMARY:${escapeIcs(event.title)} 마감`),
    foldLine(`DESCRIPTION:${escapeIcs(event.detail)}`),
    "CATEGORIES:" + escapeIcs(event.category),
    "TRANSP:TRANSPARENT",
    alarms,
    "END:VEVENT",
  ];
  return lines.join("\r\n");
}

/**
 * 주어진 BizType에 대해 1년치 세무 일정을 ICS 텍스트로 생성.
 * 매월 반복 이벤트(원천세·4대보험)는 12개 이벤트로 펼침.
 */
export function generateIcs(bizType: BizType, opts: IcsOptions = {}): string {
  const year = opts.year ?? new Date().getFullYear();
  const reminders = opts.reminderDays ?? [7, 1];
  const events = eventsFor(bizType);
  const now =
    new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const eventBlocks = events
    .map((e) => buildVEvent({ ...e, occurYear: year }, reminders, now))
    .join("\r\n");

  const cal = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//tax-accounting-mcp//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeIcs(opts.calendarName ?? `세무 일정 ${year} (${bizType})`)}`),
    "X-WR-TIMEZONE:Asia/Seoul",
    eventBlocks,
    "END:VCALENDAR",
  ].join("\r\n");

  return cal + "\r\n";
}
