import { describe, expect, it } from "vitest";
import { generateVatFilingGuide } from "../filingGuide";

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
