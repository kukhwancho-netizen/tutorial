import { describe, expect, it } from "vitest";
import { generateIcs } from "../ics";

describe("generateIcs", () => {
  it("VCALENDAR 래퍼 + VERSION 2.0 + 시간대 출력", () => {
    const ics = generateIcs("SOLE_GENERAL", { year: 2026 });
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics).toMatch(/VERSION:2\.0/);
    expect(ics).toMatch(/X-WR-TIMEZONE:Asia\/Seoul/);
    expect(ics).toMatch(/END:VCALENDAR/);
  });

  it("개인 일반과세는 부가세 1·7월·종소세 5월 모두 포함", () => {
    const ics = generateIcs("SOLE_GENERAL", { year: 2026 });
    expect(ics).toContain("부가세 1기 확정신고");
    expect(ics).toContain("부가세 2기 확정신고");
    expect(ics).toContain("종합소득세 정기신고");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260531"); // 5/31
    expect(ics).toContain("DTSTART;VALUE=DATE:20260725"); // 7/25
  });

  it("법인은 법인세 3월·8월 + 분기 부가세 4회", () => {
    const ics = generateIcs("CORPORATION", { year: 2026 });
    expect(ics).toContain("법인세 신고");
    expect(ics).toContain("법인세 중간예납");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260425"); // 부가세 1기 예정
    expect(ics).toContain("DTSTART;VALUE=DATE:20261025"); // 부가세 2기 예정
    expect(ics).not.toContain("종합소득세 정기신고");
  });

  it("간이과세는 부가세 연 1회 + 예정신고 없음", () => {
    const ics = generateIcs("SOLE_SIMPLIFIED", { year: 2026 });
    expect(ics).toContain("간이과세자 부가세");
    expect(ics).not.toContain("부가세 1기 예정");
    expect(ics).not.toContain("부가세 1기 확정");
  });

  it("VALARM 트리거가 D-7과 D-1 두 개", () => {
    const ics = generateIcs("SOLE_GENERAL", { year: 2026, reminderDays: [7, 1] });
    expect(ics).toMatch(/TRIGGER:-P7D/);
    expect(ics).toMatch(/TRIGGER:-P1D/);
  });

  it("매월 반복(원천세) 이벤트는 12회 펼쳐짐", () => {
    const ics = generateIcs("SOLE_GENERAL", { year: 2026 });
    const matches = ics.match(/SUMMARY:.*원천징수이행상황신고/g) || [];
    expect(matches.length).toBe(12);
  });

  it("UID는 연도·이벤트id 조합으로 안정 (재생성 시 변하지 않음)", () => {
    const ics1 = generateIcs("SOLE_GENERAL", { year: 2026 });
    const ics2 = generateIcs("SOLE_GENERAL", { year: 2026 });
    const uids1 = (ics1.match(/UID:[^\r\n]+/g) || []).sort();
    const uids2 = (ics2.match(/UID:[^\r\n]+/g) || []).sort();
    expect(uids1).toEqual(uids2);
  });

  it("타이틀의 콤마·세미콜론은 이스케이프", () => {
    // 직접 콤마/세미콜론이 들어가는 이벤트는 없으니, escape 로직만 검증
    const ics = generateIcs("CORPORATION", { year: 2026, calendarName: "테스트, 캘린더; 1" });
    expect(ics).toContain("X-WR-CALNAME:테스트\\, 캘린더\\; 1");
  });
});
