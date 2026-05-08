import {
  ETC_INCOME_DEEMED_EXPENSE_RATE,
  ETC_INCOME_LOCAL_RATE,
  ETC_INCOME_TAX_RATE,
  FREELANCE_INCOME_TAX,
  FREELANCE_LOCAL_TAX,
  LOCAL_INCOME_TAX_RATE,
} from "./rates";
import { calcProgressiveTax, calcWageIncomeAmount } from "./income";

export type FreelanceWithholding = {
  payment: number;
  incomeTax: number;
  localTax: number;
  net: number;
};

/** 사업소득 원천징수 (3.3%): 흔히 말하는 프리랜서 원천세 */
export function calcFreelanceWithholding(payment: number): FreelanceWithholding {
  const incomeTax = Math.floor(payment * FREELANCE_INCOME_TAX);
  const localTax = Math.floor(payment * FREELANCE_LOCAL_TAX);
  return { payment, incomeTax, localTax, net: payment - incomeTax - localTax };
}

/** 기타소득 원천징수: 일반(필요경비 60% 의제) → 22% × 40% = 8.8% */
export function calcEtcIncomeWithholding(
  payment: number,
  deemedExpenseRate = ETC_INCOME_DEEMED_EXPENSE_RATE,
): FreelanceWithholding {
  const taxable = Math.floor(payment * (1 - deemedExpenseRate));
  const incomeTax = Math.floor(taxable * ETC_INCOME_TAX_RATE);
  const localTax = Math.floor(taxable * ETC_INCOME_LOCAL_RATE);
  return { payment, incomeTax, localTax, net: payment - incomeTax - localTax };
}

/**
 * 근로소득 간이세액 (안내용 근사치).
 * 정확한 값은 국세청 간이세액표(엑셀)를 따라야 한다.
 *
 * 모델: 월급여 × 12 - 근로소득공제 - 인적공제 - 표준세액공제 → 누진세율 → ÷12
 */
export function estimateMonthlyWageWithholding(params: {
  monthlyGross: number; // 비과세 제외 월급여
  dependents: number; // 본인 포함 부양가족 수
  childrenUnder20?: number; // 8세 이상 자녀 수 (자녀세액공제용)
}): { incomeTax: number; localTax: number } {
  const annualGross = params.monthlyGross * 12;
  const wageIncome = calcWageIncomeAmount(annualGross);
  const personal = params.dependents * 1_500_000;
  const taxBase = Math.max(0, wageIncome - personal);

  const yearlyTax = calcProgressiveTax(taxBase);

  // 자녀세액공제: 8세~20세 자녀 1명 25만원, 2명 55만원, 3명부터 1인당 40만원 추가(2025 기준)
  const childCredit = childTaxCredit(params.childrenUnder20 ?? 0);
  const standardCredit = 130_000;
  const determined = Math.max(0, yearlyTax - childCredit - standardCredit);

  const monthlyIncomeTax = Math.floor(determined / 12);
  const monthlyLocalTax = Math.floor(monthlyIncomeTax * LOCAL_INCOME_TAX_RATE);
  return { incomeTax: monthlyIncomeTax, localTax: monthlyLocalTax };
}

function childTaxCredit(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 250_000;
  if (n === 2) return 550_000;
  return 550_000 + (n - 2) * 400_000;
}
