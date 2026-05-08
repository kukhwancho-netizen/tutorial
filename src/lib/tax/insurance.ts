import {
  EMPLOYMENT_INSURANCE,
  HEALTH_INSURANCE,
  LONG_TERM_CARE_RATE_OF_HEALTH,
  NATIONAL_PENSION,
  WORKERS_COMP_AVERAGE,
} from "./rates";

export type FourMajorInsuranceInput = {
  monthlySalary: number; // 월 보수월액 (비과세 제외)
  /** 사업장 규모 - 고용보험 사업주 부담분 산정용 */
  firmSize?: "SMALL" | "MID_LARGE";
  /** 산재보험 업종별 요율 (지정 없으면 평균요율 사용) */
  workersCompRate?: number;
};

export type FourMajorInsuranceResult = {
  base: number; // 산정 기준
  employee: {
    nationalPension: number;
    healthInsurance: number;
    longTermCare: number;
    employmentInsurance: number;
    total: number;
  };
  employer: {
    nationalPension: number;
    healthInsurance: number;
    longTermCare: number;
    employmentInsurance: number;
    workersComp: number;
    total: number;
  };
};

export function calcFourMajorInsurance(input: FourMajorInsuranceInput): FourMajorInsuranceResult {
  // 국민연금은 기준소득월액 상·하한이 별도로 적용된다.
  const npBase = clamp(input.monthlySalary, NATIONAL_PENSION.minMonthly, NATIONAL_PENSION.maxMonthly);
  const base = input.monthlySalary;

  const empNp = floor10(npBase * NATIONAL_PENSION.employee);
  const erNp = floor10(npBase * NATIONAL_PENSION.employer);

  const empHi = floor10(base * HEALTH_INSURANCE.employee);
  const erHi = floor10(base * HEALTH_INSURANCE.employer);

  // 장기요양보험은 건강보험료 기준
  const empLtc = floor10(empHi * LONG_TERM_CARE_RATE_OF_HEALTH);
  const erLtc = floor10(erHi * LONG_TERM_CARE_RATE_OF_HEALTH);

  const empEi = floor10(base * EMPLOYMENT_INSURANCE.employee);
  const erEiRate =
    input.firmSize === "MID_LARGE"
      ? EMPLOYMENT_INSURANCE.employerMidLarge
      : EMPLOYMENT_INSURANCE.employerSmall;
  const erEi = floor10(base * erEiRate);

  const compRate = input.workersCompRate ?? WORKERS_COMP_AVERAGE;
  const erComp = floor10(base * compRate);

  return {
    base,
    employee: {
      nationalPension: empNp,
      healthInsurance: empHi,
      longTermCare: empLtc,
      employmentInsurance: empEi,
      total: empNp + empHi + empLtc + empEi,
    },
    employer: {
      nationalPension: erNp,
      healthInsurance: erHi,
      longTermCare: erLtc,
      employmentInsurance: erEi,
      workersComp: erComp,
      total: erNp + erHi + erLtc + erEi + erComp,
    },
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

/**
 * 4대보험은 10원 단위 절사. 단, IEEE 754 부동소수 오차로
 * 3,000,000 × 0.009 = 26999.9999... 가 되어 절사 시 26,990 으로 떨어지는
 * 문제가 있어 round로 정수화 후 절사한다 (실무 공단 계산과 일치).
 */
function floor10(v: number) {
  return Math.floor(Math.round(v) / 10) * 10;
}
