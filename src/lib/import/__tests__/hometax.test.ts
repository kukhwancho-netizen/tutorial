import { describe, expect, it } from "vitest";
import { parseHometaxCsv, parseSheet } from "../hometax";

describe("hometax CSV 파싱", () => {
  it("표준 매출처별 세금계산서 합계표 형식 (한국어 헤더)", () => {
    const csv = [
      "거래일자,거래처,사업자번호,공급가액,세액,합계",
      "2026-05-01,ABC상사,123-45-67890,1000000,100000,1100000",
      "2026-05-03,DEF무역,098-76-54321,2500000,250000,2750000",
    ].join("\n");
    const r = parseHometaxCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]).toMatchObject({
      occurredOn: "2026-05-01",
      counterparty: "ABC상사",
      counterpartyBizNo: "1234567890",
      supplyAmount: 1000000,
      vatAmount: 100000,
      totalAmount: 1100000,
      direction: "SALE", // 기본
    });
  });

  it("천단위 콤마 + 점 구분 날짜도 처리", () => {
    const csv = [
      "일자,상호,공급가액,부가세",
      "2026.05.01,홍길동상회,\"1,234,567\",\"123,456\"",
    ].join("\n");
    const r = parseHometaxCsv(csv);
    expect(r.rows[0].supplyAmount).toBe(1234567);
    expect(r.rows[0].vatAmount).toBe(123456);
  });

  it("시트명에 '매입'이 있으면 PURCHASE로 자동 감지", () => {
    const rows = [
      ["거래일자", "매입처", "공급가액", "세액"],
      ["2026-05-01", "공급사A", "1000000", "100000"],
    ];
    const r = parseSheet(rows, "매입처별 세금계산서 합계표");
    expect(r.detectedDirection).toBe("PURCHASE");
    expect(r.rows[0].direction).toBe("PURCHASE");
  });

  it("명시적 direction 옵션이 자동 감지보다 우선", () => {
    const rows = [
      ["거래일자", "매출처", "공급가액"],
      ["2026-05-01", "거래처A", "1000000"],
    ];
    const r = parseSheet(rows, "매출처별 합계표", { direction: "PURCHASE" });
    expect(r.rows[0].direction).toBe("PURCHASE");
  });

  it("타이틀 행이 위에 있어도 헤더 자동 탐지", () => {
    const csv = [
      "[매출처별 세금계산서 합계표]",
      "조회기간: 2026.04.01 ~ 2026.06.30",
      "거래일자,거래처,공급가액,세액",
      "2026-05-01,ABC,1000000,100000",
    ].join("\n");
    const r = parseHometaxCsv(csv);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].counterparty).toBe("ABC");
  });

  it("거래일자 누락 행은 errors에 추가, 나머지는 진행", () => {
    const csv = [
      "거래일자,거래처,공급가액,세액",
      ",ABC,1000000,100000",
      "2026-05-02,DEF,2000000,200000",
    ].join("\n");
    const r = parseHometaxCsv(csv);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0].reason).toMatch(/거래일자/);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].counterparty).toBe("DEF");
  });

  it("부가세가 공급가액의 10%와 차이가 크면 warning", () => {
    const csv = [
      "거래일자,거래처,공급가액,세액",
      "2026-05-01,ABC,1000000,50000",
    ].join("\n");
    const r = parseHometaxCsv(csv);
    expect(r.rows[0].warning).toBeDefined();
    expect(r.rows[0].warning).toMatch(/부가세/);
  });

  it("필수 컬럼이 없으면 전체 에러", () => {
    const csv = [
      "이름,주소",
      "홍길동,서울",
    ].join("\n");
    const r = parseHometaxCsv(csv);
    expect(r.rows.length).toBe(0);
    expect(r.errors[0].reason).toMatch(/거래일자|공급가액/);
  });
});
