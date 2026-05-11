import { describe, expect, it } from "vitest";
import {
  generateVatFilingGuide,
  generateIncomeTaxFilingGuide,
  generateCorporateTaxFilingGuide,
  generateWithholdingFilingGuide,
  generateBusinessStatusFilingGuide,
} from "../filingGuide";

describe("generateVatFilingGuide", () => {
  it("일반과세자 1기 확정 가이드에 매출/매입/납부세액이 포함된다", () => {
    const g = generateVatFilingGuide({
      bizType: "SOLE_GENERAL",
      period: "1H_FINAL",
      clientName: "샘플상사",
      agg: {
        salesSupply: 50_000_000,
        salesVat: 5_000_000,
        purchaseSupply: 20_000_000,
        purchaseVat: 2_000_000,
        payable: 3_000_000,
      },
    });
    expect(g).toContain("샘플상사");
    expect(g).toContain("50,000,000원");
    expect(g).toContain("납부세액");
    expect(g).toContain("홈택스");
  });

  it("환급 상황은 '환급세액'으로 표기", () => {
    const g = generateVatFilingGuide({
      bizType: "CORPORATION",
      period: "1H_FINAL",
      clientName: "법인A",
      agg: {
        salesSupply: 10_000_000,
        salesVat: 1_000_000,
        purchaseSupply: 20_000_000,
        purchaseVat: 2_000_000,
        payable: -1_000_000,
      },
    });
    expect(g).toContain("환급세액");
    expect(g).toContain("1,000,000원");
  });

  it("간이과세자는 공급대가 입력 안내", () => {
    const g = generateVatFilingGuide({
      bizType: "SOLE_SIMPLIFIED",
      period: "SIMPLIFIED_ANNUAL",
      clientName: "간이업소",
      agg: {
        salesSupply: 30_000_000,
        salesVat: 0,
        purchaseSupply: 0,
        purchaseVat: 0,
        payable: 0,
      },
    });
    expect(g).toContain("간이과세자");
    expect(g).toContain("공급대가");
  });
});

describe("generateIncomeTaxFilingGuide", () => {
  it("종합소득금액 입력 시 가이드에 포함", () => {
    const g = generateIncomeTaxFilingGuide({
      clientName: "홍길동상회",
      taxYear: 2025,
      salesFromJournal: 80_000_000,
      incomeAmount: 60_000_000,
      dependents: 3,
    });
    expect(g).toContain("종합소득세");
    expect(g).toContain("80,000,000원");
    expect(g).toContain("60,000,000원");
    expect(g).toContain("5/1 ~ 5/31");
    expect(g).toContain("위택스");
  });

  it("종합소득금액 미입력이면 경고", () => {
    const g = generateIncomeTaxFilingGuide({
      clientName: "홍길동상회",
      taxYear: 2025,
    });
    expect(g).toContain("⚠️");
    expect(g).toContain("단순/기준경비율");
  });
});

describe("generateCorporateTaxFilingGuide", () => {
  it("법인세 가이드는 결산일 + 매출 합계 포함", () => {
    const g = generateCorporateTaxFilingGuide({
      clientName: "ABC법인",
      fiscalYearEnd: "2025-12-31",
      salesFromJournal: 500_000_000,
    });
    expect(g).toContain("ABC법인");
    expect(g).toContain("500,000,000원");
    expect(g).toContain("표준재무제표");
    expect(g).toContain("세무조정");
  });
});

describe("generateWithholdingFilingGuide", () => {
  it("사업소득 3.3% / 기타소득 8.8% 자동 계산", () => {
    const g = generateWithholdingFilingGuide({
      clientName: "샘플상사",
      targetMonth: "2026-04",
      businessIncomePaid: 1_000_000,
      otherIncomePaid: 500_000,
    });
    expect(g).toContain("2026-04");
    expect(g).toContain("33,000원");   // 100만 × 3.3%
    expect(g).toContain("44,000원");   // 50만 × 8.8%
    expect(g).toContain("5월 10일");
  });

  it("12월분은 다음 해 1월 10일 마감", () => {
    const g = generateWithholdingFilingGuide({
      clientName: "샘플상사",
      targetMonth: "2026-12",
    });
    expect(g).toContain("2027년 1월 10일");
  });
});

describe("generateBusinessStatusFilingGuide", () => {
  it("면세사업자 2/10 신고 안내 + 1년치 매출", () => {
    const g = generateBusinessStatusFilingGuide({
      clientName: "면세업소",
      taxYear: 2025,
      annualSales: 40_000_000,
    });
    expect(g).toContain("면세업소");
    expect(g).toContain("2026년 2월 1일");
    expect(g).toContain("40,000,000원");
    expect(g).toContain("종합소득세(5월)");
  });
});
