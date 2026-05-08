import {
  COMPREHENSIVE_INCOME_BRACKETS,
  LOCAL_INCOME_TAX_RATE,
  PERSONAL_DEDUCTION,
  STANDARD_TAX_CREDIT,
  WAGE_INCOME_DEDUCTION,
} from "./rates";

export type ComprehensiveIncomeInput = {
  /** 종합소득금액 (사업소득금액 + 근로소득금액 + 기타소득금액 등) */
  incomeAmount: number;
  /** 본인 포함 부양가족 수 (기본공제 대상) */
  dependents: number;
  /** 기타 소득공제 합계(국민연금료 등) */
  otherDeduction?: number;
  /** 세액공제 합계(자녀세액공제·연금계좌 등) */
  taxCredit?: number;
};

export type ComprehensiveIncomeResult = {
  taxBase: number; // 과세표준
  calculatedTax: number; // 산출세액
  determinedTax: number; // 결정세액 (세액공제 반영)
  localIncomeTax: number; // 지방소득세
  totalPayable: number; // 합계
  appliedBracket: { rate: number; deduction: number };
};

/** 누진세율 적용 산출세액 */
export function calcProgressiveTax(taxBase: number): number {
  if (taxBase <= 0) return 0;
  const bracket = COMPREHENSIVE_INCOME_BRACKETS.find((b) => taxBase <= b.upTo);
  if (!bracket) return 0;
  return Math.max(0, Math.floor(taxBase * bracket.rate - bracket.deduction));
}

export function appliedBracket(taxBase: number) {
  return (
    COMPREHENSIVE_INCOME_BRACKETS.find((b) => taxBase <= b.upTo) ?? COMPREHENSIVE_INCOME_BRACKETS[0]
  );
}

export function calcComprehensiveIncomeTax(
  input: ComprehensiveIncomeInput,
): ComprehensiveIncomeResult {
  const personalDed = (input.dependents ?? 1) * PERSONAL_DEDUCTION;
  const taxBase = Math.max(0, input.incomeAmount - personalDed - (input.otherDeduction ?? 0));
  const calculatedTax = calcProgressiveTax(taxBase);
  const determinedTax = Math.max(0, calculatedTax - (input.taxCredit ?? STANDARD_TAX_CREDIT));
  const localIncomeTax = Math.floor(determinedTax * LOCAL_INCOME_TAX_RATE);

  return {
    taxBase,
    calculatedTax,
    determinedTax,
    localIncomeTax,
    totalPayable: determinedTax + localIncomeTax,
    appliedBracket: appliedBracket(taxBase),
  };
}

/** 근로소득공제 (연 총급여 기준) */
export function wageIncomeDeduction(annualGross: number): number {
  const tier = WAGE_INCOME_DEDUCTION.find((t) => annualGross <= t.upTo);
  if (!tier) return 0;
  // base는 직전 구간까지의 누적 공제, rate는 현재 구간 가산율
  const prev = WAGE_INCOME_DEDUCTION[WAGE_INCOME_DEDUCTION.indexOf(tier) - 1];
  const lowerBound = prev ? prev.upTo : 0;
  return Math.floor(tier.base + (annualGross - lowerBound) * tier.rate);
}

/** 근로소득금액 = 총급여 - 근로소득공제 */
export function calcWageIncomeAmount(annualGross: number): number {
  return Math.max(0, annualGross - wageIncomeDeduction(annualGross));
}
