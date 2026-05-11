import { describe, expect, it } from "vitest";
import {
  allEvents,
  eventsFor,
  groupByMonth,
  upcoming,
} from "../calendar";

describe("calendar", () => {
  it("monthly 이벤트는 12개월로 펼쳐진다", () => {
    const all = allEvents();
    const withholding = all.filter((e) => e.id.startsWith("withholding-monthly"));
    expect(withholding.length).toBe(12);
    expect(new Set(withholding.map((e) => e.month))).toEqual(new Set([1,2,3,4,5,6,7,8,9,10,11,12]));
  });

  it("간이과세자는 1월 부가세, 5월 종소세만 있고 분기 예정신고는 없다", () => {
    const events = eventsFor("SOLE_SIMPLIFIED");
    const vatEvents = events.filter((e) => e.category === "vat");
    expect(vatEvents.length).toBe(1);
    expect(vatEvents[0].month).toBe(1);
    expect(events.some((e) => e.id === "income-may")).toBe(true);
    expect(events.some((e) => e.id === "vat-corp-1-prelim")).toBe(false);
  });

  it("법인은 부가세 4회(예정2+확정2)·법인세 2회가 있고, 종소세 5월은 없다", () => {
    const events = eventsFor("CORPORATION");
    const vat = events.filter((e) => e.category === "vat");
    expect(vat.length).toBe(4);
    expect(events.some((e) => e.id === "corp-tax-mar")).toBe(true);
    expect(events.some((e) => e.id === "income-may")).toBe(false);
  });

  it("면세사업자는 사업장현황신고(2/10)와 종소세 5월을 갖는다", () => {
    const events = eventsFor("SOLE_TAX_FREE");
    expect(events.some((e) => e.id === "biz-status-tax-free" && e.month === 2 && e.day === 10)).toBe(true);
    expect(events.some((e) => e.id === "income-may")).toBe(true);
  });

  it("groupByMonth는 12개 키 모두 채운다", () => {
    const grouped = groupByMonth(eventsFor("CORPORATION"));
    expect(Object.keys(grouped)).toEqual(["1","2","3","4","5","6","7","8","9","10","11","12"]);
  });

  it("upcoming은 horizon 안의 이벤트만 마감일 순으로 반환한다", () => {
    const today = new Date(2026, 4, 1); // 2026-05-01
    const events = eventsFor("SOLE_GENERAL");
    const within30 = upcoming(events, today, 30);
    // 5/31 종소세는 30일 이내, 7/25 부가세는 아님
    expect(within30.some((e) => e.id === "income-may")).toBe(true);
    expect(within30.some((e) => e.id === "vat-1h-final")).toBe(false);
    // 정렬 검증
    for (let i = 1; i < within30.length; i++) {
      expect(within30[i].due.getTime()).toBeGreaterThanOrEqual(within30[i-1].due.getTime());
    }
  });

  it("1월 이벤트는 연말에 보면 다음 해로 롤오버된다", () => {
    const today = new Date(2026, 11, 15); // 12/15
    const events = eventsFor("SOLE_GENERAL");
    const list = upcoming(events, today, 60);
    const vatJan = list.find((e) => e.id === "vat-2h-final");
    expect(vatJan).toBeDefined();
    expect(vatJan!.due.getFullYear()).toBe(2027);
  });
});
