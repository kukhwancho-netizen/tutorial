import { describe, expect, it } from "vitest";
import {
  calcComprehensiveIncomeTax,
  calcEtcIncomeWithholding,
  calcFourMajorInsurance,
  calcFreelanceWithholding,
  calcGeneralVat,
  calcProgressiveTax,
  splitVatFromTotal,
} from "..";

describe("VAT", () => {
  it("일반과세자 매출/매입 부가세 차감", () => {
    const r = calcGeneralVat({
      sales: [{ supplyAmount: 10_000_000 }, { supplyAmount: 5_000_000 }],
      purchases: [{ supplyAmount: 4_000_000 }],
    });
    expect(r.outputVat).toBe(1_500_000);
    expect(r.inputVat).toBe(400_000);
    expect(r.payable).toBe(1_100_000);
  });

  it("합계금액에서 공급가액·부가세 분리", () => {
    const r = splitVatFromTotal(11_000);
    expect(r.supply).toBe(10_000);
    expect(r.vat).toBe(1_000);
  });
});

describe("종합소득세", () => {
  it.each([
    [10_000_000, 600_000], // 6%
    [50_000_000, 50_000_000 * 0.15 - 1_260_000], // = 6,240,000
    [100_000_000, 100_000_000 * 0.35 - 15_440_000], // = 19,560,000
  ])("과표 %i → 산출세액 %i", (base, expected) => {
    expect(calcProgressiveTax(base)).toBe(expected);
  });

  it("인적공제·표준세액공제·지방세 반영", () => {
    const r = calcComprehensiveIncomeTax({
      incomeAmount: 60_000_000,
      dependents: 3, // 본인+배우자+자녀1
    });
    // 과표 = 60,000,000 - 4,500,000 = 55,500,000 → 24% 구간
    expect(r.taxBase).toBe(55_500_000);
    expect(r.calculatedTax).toBe(Math.floor(55_500_000 * 0.24 - 5_760_000));
    expect(r.localIncomeTax).toBe(Math.floor(r.determinedTax * 0.1));
  });
});

describe("원천징수", () => {
  it("프리랜서 3.3%", () => {
    const r = calcFreelanceWithholding(1_000_000);
    expect(r.incomeTax).toBe(30_000);
    expect(r.localTax).toBe(3_000);
    expect(r.net).toBe(967_000);
  });

  it("기타소득(필요경비 60%) 8.8%", () => {
    const r = calcEtcIncomeWithholding(1_000_000);
    // 과세 = 400,000 → 소득세 80,000 + 지방세 8,000
    expect(r.incomeTax).toBe(80_000);
    expect(r.localTax).toBe(8_000);
  });
});

describe("4대보험", () => {
  it("월 300만원 기준 근로자 부담", () => {
    const r = calcFourMajorInsurance({ monthlySalary: 3_000_000 });
    // 국민연금: 3,000,000 × 4.5% = 135,000
    expect(r.employee.nationalPension).toBe(135_000);
    // 건강: 3,000,000 × 3.545% = 106,350
    expect(r.employee.healthInsurance).toBe(106_350);
    // 장기요양: 106,350 × 12.95% = 13,772 → 10원 절사 13,770
    expect(r.employee.longTermCare).toBe(13_770);
    // 고용보험: 3,000,000 × 0.9% = 27,000
    expect(r.employee.employmentInsurance).toBe(27_000);
  });

  it("기준소득월액 상한 적용 (국민연금)", () => {
    const r = calcFourMajorInsurance({ monthlySalary: 10_000_000 });
    // 상한 6,170,000 × 4.5% = 277,650
    expect(r.employee.nationalPension).toBe(277_650);
  });
});
