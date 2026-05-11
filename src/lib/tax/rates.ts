// 2025 관계연도(2026년 신고분) 한국 세율/요율 모음.
// 법령/요율은 매년 변경되므로 본 파일만 갱신하면 계산 로직은 그대로 유지된다.
// 출처: 국세청·국민연금공단·국민건강보험공단·근로복지공단 공시(2025년).

export const TAX_YEAR = 2025 as const;

// ── 부가가치세 ─────────────────────────────────────────────
export const VAT = {
  standardRate: 0.1, // 일반과세자 부가율
  // 간이과세자 업종별 부가율(2025년 기준 대표값)
  simplifiedRates: {
    retailFood: 0.15, // 소매·음식
    manufacturing: 0.2, // 제조·농임어업
    accommodation: 0.25, // 숙박
    construction: 0.3, // 건설·운수·창고
    service: 0.4, // 금융·보험 외 서비스
  },
} as const;

// ── 종합소득세 (2025년 귀속, 누진세율) ─────────────────────
// 과세표준 구간(원), 세율, 누진공제(원)
export const COMPREHENSIVE_INCOME_BRACKETS: ReadonlyArray<{
  upTo: number; // 이하
  rate: number;
  deduction: number; // 누진공제
}> = [
  { upTo: 14_000_000, rate: 0.06, deduction: 0 },
  { upTo: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { upTo: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { upTo: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { upTo: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { upTo: 500_000_000, rate: 0.4, deduction: 25_940_000 },
  { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.45, deduction: 65_940_000 },
];

// 지방소득세: 산출세액의 10%
export const LOCAL_INCOME_TAX_RATE = 0.1;

// ── 원천징수 ──────────────────────────────────────────────
// 사업소득(프리랜서) 3.3% = 소득세 3% + 지방소득세 0.3%
export const FREELANCE_INCOME_TAX = 0.03;
export const FREELANCE_LOCAL_TAX = 0.003;

// 기타소득 일반(필요경비 60% 의제 후 22%) → 실효 8.8%
// 강연료/원고료 등 일시적 소득에 적용
export const ETC_INCOME_DEEMED_EXPENSE_RATE = 0.6;
export const ETC_INCOME_TAX_RATE = 0.2; // 소득세
export const ETC_INCOME_LOCAL_RATE = 0.02; // 지방소득세

// ── 4대보험 (2025년 요율) ─────────────────────────────────
// 국민연금: 사업장가입자 9% (사용자 4.5% + 근로자 4.5%)
// 2025-07-01 ~ 2026-06-30 적용 기준소득월액 상·하한 (국민연금공단 고시)
export const NATIONAL_PENSION = {
  employee: 0.045,
  employer: 0.045,
  minMonthly: 400_000, // 하한액 (2025-07부터 39만→40만 인상)
  maxMonthly: 6_370_000, // 상한액 (2025-07부터 617만→637만 인상)
} as const;

// 건강보험: 7.09% (사용자 3.545% + 근로자 3.545%) - 2024·2025년 동결
export const HEALTH_INSURANCE = {
  employee: 0.03545,
  employer: 0.03545,
} as const;

// 장기요양보험: 건강보험료 × 12.95% (2025년)
export const LONG_TERM_CARE_RATE_OF_HEALTH = 0.1295;

// 고용보험 (실업급여분): 본인 0.9%, 사업주 0.9% + 고용안정·직업능력개발사업 (규모별 0.25%~0.85%)
// 단순화를 위해 사업주는 150인 미만 0.9% + 0.25% = 1.15% 사용
export const EMPLOYMENT_INSURANCE = {
  employee: 0.009,
  employerSmall: 0.0115, // 150인 미만
  employerMidLarge: 0.0145, // 150인~1000인 우선지원 외
} as const;

// 산재보험: 업종별 상이, 평균 약 1.43% (2025년 평균요율, 사용자 전액 부담)
export const WORKERS_COMP_AVERAGE = 0.0143;

// ── 근로소득세 간이세액 (단순화 모델) ─────────────────────
// 정부 공식 간이세액표는 lookup 테이블이지만, 본 프로젝트에서는
// 월급여를 연환산 후 근로소득공제·인적공제·표준세액공제를 반영한
// 산식 기반 근사치를 사용한다(±수천원 오차 허용, 안내용).
export const WAGE_INCOME_DEDUCTION = [
  { upTo: 5_000_000, rate: 0.7, base: 0 },
  { upTo: 15_000_000, rate: 0.4, base: 3_500_000 },
  { upTo: 45_000_000, rate: 0.15, base: 7_500_000 },
  { upTo: 100_000_000, rate: 0.05, base: 12_000_000 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.02, base: 14_750_000 },
];

export const PERSONAL_DEDUCTION = 1_500_000; // 인당 기본공제(연)
export const STANDARD_TAX_CREDIT = 130_000; // 표준세액공제(연)
