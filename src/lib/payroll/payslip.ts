// 급여명세서 생성·저장 — 한 명·한 달치.
// 비과세 한도 적용 + 4대보험·원천세 자동 계산 + DB 저장.

import { db } from "@/lib/db";
import { calcFourMajorInsurance } from "@/lib/tax/insurance";
import { estimateMonthlyWageWithholding } from "@/lib/tax/withholding";

export const NON_TAX_LIMITS = {
  meal: 200_000,
  carAllowance: 200_000,
  childcare: 200_000,
} as const;

export type PayrollInput = {
  clientId: string;
  payDate: Date;
  employeeName: string;
  dependents: number;
  childrenUnder20: number;
  grossPay: number;
  /** 비과세 식대 */
  nonTaxMeal: number;
  /** 비과세 자가운전보조금 */
  nonTaxCarAllowance: number;
  /** 비과세 보육수당 */
  nonTaxChildcare: number;
  /** 기타 비과세 */
  nonTaxOther: number;
  firmSize: "SMALL" | "MID_LARGE";
};

export type PayslipBreakdown = {
  grossPay: number;
  nonTaxablePay: number;
  taxableSalary: number;
  employee: {
    nationalPension: number;
    healthInsurance: number;
    longTermCare: number;
    employmentInsurance: number;
    incomeTax: number;
    localTax: number;
    totalDeduction: number;
  };
  employer: {
    nationalPension: number;
    healthInsurance: number;
    longTermCare: number;
    employmentInsurance: number;
    workersComp: number;
    totalBurden: number;
  };
  netPay: number;
  employerCost: number;
};

/** 입력 → 모든 항목 자동 산출 (DB 저장 전 미리보기에도 사용) */
export function calcPayslip(input: PayrollInput): PayslipBreakdown {
  const nonTaxablePay =
    Math.min(input.nonTaxMeal, NON_TAX_LIMITS.meal) +
    Math.min(input.nonTaxCarAllowance, NON_TAX_LIMITS.carAllowance) +
    Math.min(input.nonTaxChildcare, NON_TAX_LIMITS.childcare) +
    input.nonTaxOther;
  const taxableSalary = Math.max(0, input.grossPay - nonTaxablePay);

  const ins = calcFourMajorInsurance({
    monthlySalary: taxableSalary,
    firmSize: input.firmSize,
  });
  const wht = estimateMonthlyWageWithholding({
    monthlyGross: taxableSalary,
    dependents: input.dependents,
    childrenUnder20: input.childrenUnder20,
  });

  const totalDeduction = ins.employee.total + wht.incomeTax + wht.localTax;
  const netPay = input.grossPay - totalDeduction;
  const employerCost = input.grossPay + ins.employer.total;

  return {
    grossPay: input.grossPay,
    nonTaxablePay,
    taxableSalary,
    employee: {
      nationalPension: ins.employee.nationalPension,
      healthInsurance: ins.employee.healthInsurance,
      longTermCare: ins.employee.longTermCare,
      employmentInsurance: ins.employee.employmentInsurance,
      incomeTax: wht.incomeTax,
      localTax: wht.localTax,
      totalDeduction,
    },
    employer: {
      nationalPension: ins.employer.nationalPension,
      healthInsurance: ins.employer.healthInsurance,
      longTermCare: ins.employer.longTermCare,
      employmentInsurance: ins.employer.employmentInsurance,
      workersComp: ins.employer.workersComp,
      totalBurden: ins.employer.total,
    },
    netPay,
    employerCost,
  };
}

/** 계산 결과를 PayrollEntry로 저장 */
export async function createPayrollEntry(input: PayrollInput) {
  const b = calcPayslip(input);
  return db.payrollEntry.create({
    data: {
      clientId: input.clientId,
      payDate: input.payDate,
      employeeName: input.employeeName,
      dependents: input.dependents,
      childrenUnder20: input.childrenUnder20,
      grossPay: input.grossPay,
      nonTaxablePay: b.nonTaxablePay,
      incomeTax: b.employee.incomeTax,
      localIncomeTax: b.employee.localTax,
      nationalPension: b.employee.nationalPension,
      healthIns: b.employee.healthInsurance,
      longTermCare: b.employee.longTermCare,
      employmentIns: b.employee.employmentInsurance,
    },
  });
}

/** PayrollEntry → 화면 표시용 breakdown 재계산 (저장 후 다시 보여줄 때) */
export function payrollEntryToBreakdown(
  entry: {
    grossPay: number;
    nonTaxablePay: number;
    dependents: number;
    childrenUnder20: number;
    incomeTax: number;
    localIncomeTax: number;
    nationalPension: number;
    healthIns: number;
    longTermCare: number;
    employmentIns: number;
  },
  firmSize: "SMALL" | "MID_LARGE" = "SMALL",
): PayslipBreakdown {
  const taxableSalary = Math.max(0, entry.grossPay - entry.nonTaxablePay);
  // 사업주 부담분은 저장하지 않으므로 재계산
  const ins = calcFourMajorInsurance({ monthlySalary: taxableSalary, firmSize });

  const empTotal =
    entry.nationalPension +
    entry.healthIns +
    entry.longTermCare +
    entry.employmentIns +
    entry.incomeTax +
    entry.localIncomeTax;

  return {
    grossPay: entry.grossPay,
    nonTaxablePay: entry.nonTaxablePay,
    taxableSalary,
    employee: {
      nationalPension: entry.nationalPension,
      healthInsurance: entry.healthIns,
      longTermCare: entry.longTermCare,
      employmentInsurance: entry.employmentIns,
      incomeTax: entry.incomeTax,
      localTax: entry.localIncomeTax,
      totalDeduction: empTotal,
    },
    employer: {
      nationalPension: ins.employer.nationalPension,
      healthInsurance: ins.employer.healthInsurance,
      longTermCare: ins.employer.longTermCare,
      employmentInsurance: ins.employer.employmentInsurance,
      workersComp: ins.employer.workersComp,
      totalBurden: ins.employer.total,
    },
    netPay: entry.grossPay - empTotal,
    employerCost: entry.grossPay + ins.employer.total,
  };
}
