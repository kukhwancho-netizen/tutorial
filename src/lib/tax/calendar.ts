// 세무 일정 단일 소스. 모든 페이지가 여기서 파생된다.
// 법령 변경 시 본 파일만 갱신.

import { BIZ_TYPE_LABEL, type BizType } from "./bizType";

export { BIZ_TYPE_LABEL, type BizType };

export type TaxEventCategory = "vat" | "income" | "withholding" | "insurance" | "business-status";

export type Cadence = "monthly" | "quarterly" | "biannual" | "annual";

export type TaxEvent = {
  id: string;
  category: TaxEventCategory;
  title: string;
  /** 신고/납부 마감일이 속한 월(1~12) */
  month: number;
  /** 마감일(해당 월의 day). 보통 25일·10일·31일 등 */
  day: number;
  /** 적용되는 사업자 유형 (빈 배열 = 사업주 공통) */
  bizTypes: BizType[] | "ALL";
  cadence: Cadence;
  /** 화면에 표시할 짧은 설명 */
  detail: string;
};

// 매월 반복(원천세·4대보험 등)은 month=0으로 보관하고 expand() 단계에서 1~12로 확장
const MONTHLY = 0 as const;

const RAW_EVENTS: TaxEvent[] = [
  // ===== 부가가치세 =====
  {
    id: "vat-corp-1-prelim",
    category: "vat",
    title: "부가세 1기 예정신고",
    month: 4,
    day: 25,
    bizTypes: ["CORPORATION"],
    cadence: "quarterly",
    detail: "법인사업자 1~3월 실적, 4/1~4/25 신고·납부",
  },
  {
    id: "vat-1h-final",
    category: "vat",
    title: "부가세 1기 확정신고",
    month: 7,
    day: 25,
    bizTypes: ["CORPORATION", "SOLE_GENERAL"],
    cadence: "biannual",
    detail: "법인 4~6월 / 개인 일반 1~6월 실적, 7/1~7/25 신고·납부",
  },
  {
    id: "vat-corp-2-prelim",
    category: "vat",
    title: "부가세 2기 예정신고",
    month: 10,
    day: 25,
    bizTypes: ["CORPORATION"],
    cadence: "quarterly",
    detail: "법인사업자 7~9월 실적, 10/1~10/25 신고·납부",
  },
  {
    id: "vat-2h-final",
    category: "vat",
    title: "부가세 2기 확정신고",
    month: 1,
    day: 25,
    bizTypes: ["CORPORATION", "SOLE_GENERAL"],
    cadence: "biannual",
    detail: "법인 10~12월 / 개인 일반 7~12월 실적, 1/1~1/25 신고·납부",
  },
  {
    id: "vat-simplified",
    category: "vat",
    title: "간이과세자 부가세 신고",
    month: 1,
    day: 25,
    bizTypes: ["SOLE_SIMPLIFIED"],
    cadence: "annual",
    detail: "간이과세자 1년치(1~12월) 1/1~1/25 신고·납부",
  },

  // ===== 사업장현황신고 (면세) =====
  {
    id: "biz-status-tax-free",
    category: "business-status",
    title: "사업장현황신고 (면세사업자)",
    month: 2,
    day: 10,
    bizTypes: ["SOLE_TAX_FREE"],
    cadence: "annual",
    detail: "면세사업자 1년치 수입금액·계산서 합계표, 2/1~2/10 신고",
  },

  // ===== 종합소득세 (개인 전 유형) =====
  {
    id: "income-may",
    category: "income",
    title: "종합소득세 정기신고",
    month: 5,
    day: 31,
    bizTypes: ["SOLE_GENERAL", "SOLE_SIMPLIFIED", "SOLE_TAX_FREE"],
    cadence: "annual",
    detail: "전년도(1.1~12.31) 종합소득 5/1~5/31 신고·납부 + 지방소득세",
  },
  {
    id: "income-june-shihseong",
    category: "income",
    title: "성실신고확인 대상자 종소세",
    month: 6,
    day: 30,
    bizTypes: ["SOLE_GENERAL"],
    cadence: "annual",
    detail: "성실신고확인 대상자(업종별 매출 기준 이상) 6/30까지 신고",
  },
  {
    id: "income-nov-jungganye",
    category: "income",
    title: "종합소득세 중간예납",
    month: 11,
    day: 30,
    bizTypes: ["SOLE_GENERAL", "SOLE_SIMPLIFIED", "SOLE_TAX_FREE"],
    cadence: "annual",
    detail: "전년도 산출세액의 50% 가량을 11/1~11/30 중간예납",
  },

  // ===== 법인세 (법인) =====
  {
    id: "corp-tax-mar",
    category: "income",
    title: "법인세 신고 (12월 결산법인)",
    month: 3,
    day: 31,
    bizTypes: ["CORPORATION"],
    cadence: "annual",
    detail: "결산일(보통 12/31)로부터 3개월 이내 신고·납부",
  },
  {
    id: "corp-tax-aug-prelim",
    category: "income",
    title: "법인세 중간예납",
    month: 8,
    day: 31,
    bizTypes: ["CORPORATION"],
    cadence: "annual",
    detail: "사업연도 개시일로부터 6개월(상반기) 종료 후 2개월 이내",
  },

  // ===== 원천세 (사업주 공통, 매월) =====
  {
    id: "withholding-monthly",
    category: "withholding",
    title: "원천징수이행상황신고",
    month: MONTHLY,
    day: 10,
    bizTypes: "ALL",
    cadence: "monthly",
    detail: "전월 지급한 사업·기타·근로소득에 대한 원천세, 다음달 10일까지",
  },
  {
    id: "withholding-yearend",
    category: "withholding",
    title: "근로소득 연말정산",
    month: 2,
    day: 28,
    bizTypes: "ALL",
    cadence: "annual",
    detail: "전년도 근로소득 연말정산, 2월 급여 지급 시 정산 → 3/10 신고",
  },

  // ===== 4대보험 (사업주 공통) =====
  {
    id: "insurance-monthly",
    category: "insurance",
    title: "4대보험료 납부",
    month: MONTHLY,
    day: 10,
    bizTypes: "ALL",
    cadence: "monthly",
    detail: "건강·국민연금·고용·산재. 매월 10일까지 (자동이체 권장)",
  },
  {
    id: "insurance-payroll-report",
    category: "insurance",
    title: "고용·산재 보수총액 신고",
    month: 3,
    day: 15,
    bizTypes: "ALL",
    cadence: "annual",
    detail: "전년도 보수총액 신고, 3/15까지 (근로복지공단)",
  },
  {
    id: "insurance-health-adjust",
    category: "insurance",
    title: "건강보험 보수월액 정산",
    month: 4,
    day: 30,
    bizTypes: "ALL",
    cadence: "annual",
    detail: "전년도 정산결과로 4월분 보험료에서 추가/환급 (4월급여 분할 가능)",
  },
  {
    id: "insurance-pension-adjust",
    category: "insurance",
    title: "국민연금 기준소득월액 정기결정",
    month: 7,
    day: 1,
    bizTypes: "ALL",
    cadence: "annual",
    detail: "7월부터 새 기준소득월액 적용 (전년도 신고소득 기준)",
  },
];

/** 매월 반복 이벤트를 1~12월로 펼치고, 모든 이벤트를 반환 */
export function allEvents(): TaxEvent[] {
  const out: TaxEvent[] = [];
  for (const e of RAW_EVENTS) {
    if (e.month === MONTHLY) {
      for (let m = 1; m <= 12; m++) {
        out.push({ ...e, id: `${e.id}-${m}`, month: m });
      }
    } else {
      out.push(e);
    }
  }
  return out;
}

/** 사업자 유형에 해당하는 이벤트만 필터 */
export function eventsFor(bizType: BizType): TaxEvent[] {
  return allEvents().filter(
    (e) => e.bizTypes === "ALL" || e.bizTypes.includes(bizType),
  );
}

/** 월별 그룹핑 */
export function groupByMonth(events: TaxEvent[]): Record<number, TaxEvent[]> {
  const grouped: Record<number, TaxEvent[]> = {};
  for (let m = 1; m <= 12; m++) grouped[m] = [];
  for (const e of events) grouped[e.month].push(e);
  for (const m of Object.keys(grouped)) {
    grouped[Number(m)].sort((a, b) => a.day - b.day);
  }
  return grouped;
}

export type DueTaxEvent = TaxEvent & { due: Date };

/** 오늘로부터 days일 이내의 이벤트만 (체크리스트용) */
export function upcoming(events: TaxEvent[], today: Date, days: number): DueTaxEvent[] {
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + days);
  const yearNow = today.getFullYear();

  return events
    .map<DueTaxEvent>((e) => {
      // 마감일이 이미 지난 경우 다음 해로 롤오버
      let due = new Date(yearNow, e.month - 1, e.day);
      if (due < today) due = new Date(yearNow + 1, e.month - 1, e.day);
      return { ...e, due };
    })
    .filter((e) => e.due <= horizon)
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

export const CATEGORY_LABEL: Record<TaxEventCategory, string> = {
  vat: "부가세",
  income: "소득세/법인세",
  withholding: "원천세",
  insurance: "4대보험",
  "business-status": "사업장현황",
};

export const CATEGORY_COLOR: Record<TaxEventCategory, string> = {
  vat: "bg-blue-50 text-blue-700 border-blue-200",
  income: "bg-amber-50 text-amber-700 border-amber-200",
  withholding: "bg-purple-50 text-purple-700 border-purple-200",
  insurance: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "business-status": "bg-slate-50 text-slate-700 border-slate-200",
};

