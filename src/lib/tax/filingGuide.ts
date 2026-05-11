// 사용자가 홈택스에서 직접 신고할 때 따라할 단계별 가이드를 텍스트로 생성.
// 본 시스템은 자료만 정리해주고 신고 실행은 사용자가 홈택스에서 직접.

import type { BizType } from "./bizType";

export type VatFilingPeriod = "1H_PRELIM" | "1H_FINAL" | "2H_PRELIM" | "2H_FINAL" | "SIMPLIFIED_ANNUAL";

export type VatAggregateInput = {
  salesSupply: number;
  salesVat: number;
  purchaseSupply: number;
  purchaseVat: number;
  payable: number;
};

const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";

const PERIOD_LABEL: Record<VatFilingPeriod, string> = {
  "1H_PRELIM": "1기 예정신고 (1~3월 실적, 4/1~4/25 신고)",
  "1H_FINAL": "1기 확정신고 (개인 1~6월 / 법인 4~6월, 7/1~7/25 신고)",
  "2H_PRELIM": "2기 예정신고 (7~9월 실적, 10/1~10/25 신고)",
  "2H_FINAL": "2기 확정신고 (개인 7~12월 / 법인 10~12월, 1/1~1/25 신고)",
  "SIMPLIFIED_ANNUAL": "간이과세자 연간신고 (1~12월 실적, 1/1~1/25 신고)",
};

export function generateVatFilingGuide(args: {
  bizType: BizType;
  period: VatFilingPeriod;
  clientName: string;
  agg: VatAggregateInput;
}): string {
  const { bizType, period, clientName, agg } = args;
  const refund = agg.payable < 0;
  const finalAmount = Math.abs(agg.payable);

  return [
    `# ${clientName} — 부가가치세 ${PERIOD_LABEL[period]}`,
    "",
    "## 신고 자료 (이 값을 홈택스에 입력)",
    "",
    `- 매출 공급가액: **${fmt(agg.salesSupply)}**`,
    `- 매출세액: **${fmt(agg.salesVat)}**`,
    `- 매입 공급가액: **${fmt(agg.purchaseSupply)}**`,
    `- 매입세액: **${fmt(agg.purchaseVat)}**`,
    `- ${refund ? "환급세액" : "납부세액"}: **${fmt(finalAmount)}**`,
    "",
    "## 홈택스 신고 단계",
    "",
    "1. **홈택스 로그인** — https://www.hometax.go.kr → 공동인증서/금융인증서",
    "2. **신고/납부** → **부가가치세** 메뉴 진입",
    `3. 대상 사업자 선택 → "${PERIOD_LABEL[period].split(" (")[0]}" 클릭`,
    bizType === "SOLE_SIMPLIFIED"
      ? "4. 간이과세자 신고서 화면에서 **공급대가**(부가세 포함 합계) 입력 → 업종별 부가율 자동 적용"
      : "4. 일반과세자 신고서 화면에서 위 \"매출 공급가액·세액\" 그대로 입력",
    "5. **세금계산서/계산서 합계표** 별도 작성 — 본 시스템의 분개에서 거래처별로 정리해 입력",
    "6. **공제·환급·가산세** 항목 확인 (해당 없으면 0)",
    "7. **신고서 작성 완료** → 미리보기로 위 \"신고 자료\" 값과 일치 확인",
    "8. **전자신고** 클릭 → 신고번호 수령 → 저장/출력",
    refund
      ? "9. **환급금 계좌** 입력 (등록 안 된 경우)"
      : "9. **납부서 출력** → 납부 마감일까지 가상계좌/카드/계좌이체로 납부",
    "",
    "## 주의",
    "",
    "- 본 자료는 우리 시스템 분개 기반 집계입니다. 홈택스 화면의 매입세액공제 가능 여부(접대비 등)·의제매입세액공제·신용카드매출전표 발행세액공제는 별도 확인 필요.",
    bizType === "CORPORATION"
      ? "- 법인은 예정고지서 대신 직접 예정신고를 권장합니다 (실적 변동 시)."
      : "- 개인 일반과세자는 1기·2기 예정고지서가 와도 실적 변동 폭이 크면 직접 예정신고 가능합니다.",
    "- 마감일이 공휴일/주말이면 다음 영업일까지 자동 연장.",
  ].join("\n");
}

// ============================================================================
// 종합소득세 (개인)
// ============================================================================

export type IncomeTaxFilingInput = {
  clientName: string;
  taxYear: number;
  /** 분개에서 집계한 매출 (참고용) */
  salesFromJournal?: number;
  /** 사용자가 직접 입력한 종합소득금액 (= 수입 - 필요경비). 없으면 가이드만. */
  incomeAmount?: number;
  /** 부양가족 수 (본인 포함) */
  dependents?: number;
};

export function generateIncomeTaxFilingGuide(args: IncomeTaxFilingInput): string {
  const { clientName, taxYear, salesFromJournal, incomeAmount, dependents } = args;
  const lines: string[] = [
    `# ${clientName} — ${taxYear}년 귀속 종합소득세 신고`,
    "",
    "## 신고 기간",
    "",
    "- **정기신고**: 다음 해 5/1 ~ 5/31",
    "- **성실신고확인 대상**: 다음 해 6/30 (업종별 매출 기준 이상)",
    "- 지연 시 가산세 발생 (무신고 20% + 납부지연 일 0.022%)",
    "",
    "## 신고 자료",
    "",
  ];

  if (salesFromJournal !== undefined) {
    lines.push(`- 분개 기반 매출 합계 (참고): **${fmt(salesFromJournal)}**`);
  }
  if (incomeAmount !== undefined) {
    lines.push(`- 종합소득금액 (입력값): **${fmt(incomeAmount)}**`);
  } else {
    lines.push("- ⚠️ 종합소득금액 미입력 — 아래 산식으로 직접 계산 필요:");
    lines.push("    종합소득금액 = 수입금액 - 필요경비 (단순/기준경비율 또는 장부)");
  }
  if (dependents !== undefined) {
    lines.push(`- 부양가족 수: ${dependents}명 (본인 포함)`);
  }

  lines.push(
    "",
    "## 홈택스 신고 단계",
    "",
    "1. **홈택스 로그인** — https://www.hometax.go.kr",
    "2. **신고/납부** → **종합소득세** 메뉴",
    "3. **정기신고 작성** → 사업자등록번호 / 주민등록번호로 본인 확인",
    "4. **종합소득금액 합산** 화면:",
    "    - 사업소득: 위 \"분개 기반 매출\"에서 필요경비 차감한 금액",
    "    - 근로·이자·배당·연금·기타: 해당되면 추가 (대부분 자동 불러오기 됨)",
    "5. **소득공제**: 인적공제(본인+부양가족 각 150만), 국민연금·연금저축·신용카드 등",
    "6. **세액공제**: 표준세액공제 13만(기본), 자녀(8세이상 1명 25만)",
    "7. **신고서 미리보기** → 산출세액·결정세액·납부세액 확인",
    "8. **전자신고** → 신고번호 수령 → 저장/출력",
    "9. **지방소득세** (결정세액 10%): 위택스(https://www.wetax.go.kr)에서 별도 신고",
    "    - 또는 홈택스 신고 후 \"지방세 연계\" 클릭으로 자동 이관",
    "10. **납부**: 가상계좌·카드·계좌이체 (5/31까지)",
    "",
    "## 권장 사전 점검",
    "",
    "- [ ] 사업용 통장·카드 사용내역 정리",
    "- [ ] 세금계산서 누락분 점검 (홈택스 \"전자세금계산서 합계표\" 다운로드)",
    "- [ ] 인건비 지급내역 → 원천세 신고와 일치 여부",
    "- [ ] 기부금·의료비·신용카드 사용액 자료 (홈택스 연말정산간소화 또는 \"종소세 절세주머니\")",
    "",
    "## 주의",
    "",
    "- 본 자료는 분개 데이터 기반 참고치입니다. 실제 종합소득금액 산정은 단순경비율/기준경비율/장부 작성 방식에 따라 다릅니다.",
    "- 성실신고확인 대상자(직전연도 매출 기준 — 도소매 15억, 제조·음식·숙박 7.5억, 서비스 5억 이상)는 5/31이 아닌 6/30까지.",
    "- 신고세액 1천만원 초과 시 분납 가능 (5/31 + 8/31 두 번에 나눠).",
  );
  return lines.join("\n");
}

// ============================================================================
// 법인세 (법인)
// ============================================================================

export type CorporateTaxFilingInput = {
  clientName: string;
  fiscalYearEnd: string; // YYYY-MM-DD
  /** 분개 매출 합계 (참고) */
  salesFromJournal?: number;
};

export function generateCorporateTaxFilingGuide(args: CorporateTaxFilingInput): string {
  const { clientName, fiscalYearEnd, salesFromJournal } = args;
  const end = new Date(fiscalYearEnd);
  const dueMonth = end.getMonth() + 4 > 12 ? end.getMonth() - 8 : end.getMonth() + 4;
  const dueYear = end.getMonth() >= 9 ? end.getFullYear() + 1 : end.getFullYear();
  const dueDate = new Date(dueYear, dueMonth - 1, 31);

  return [
    `# ${clientName} — 법인세 신고 (결산일 ${fiscalYearEnd})`,
    "",
    "## 신고 기간",
    "",
    `- **결산일 후 3개월 이내**: ~ ${dueDate.toISOString().slice(0, 10)}`,
    "- 12월 결산법인 = 다음 해 3/31",
    "- 중간예납: 사업연도 개시 6개월 후 2개월 이내 (12월 결산은 8/31)",
    "",
    "## 신고 자료 (참고)",
    "",
    salesFromJournal !== undefined
      ? `- 분개 매출 합계: **${fmt(salesFromJournal)}**`
      : "- 분개 매출 합계: 없음",
    "- ⚠️ 법인세는 결산서(재무상태표·손익계산서·잉여금처분계산서·현금흐름표) 기반",
    "    본 시스템 분개만으로는 정확한 산출세액 계산 불가",
    "",
    "## 홈택스 신고 단계",
    "",
    "1. **결산 마감** (외부 회계 처리 — 본 시스템 범위 밖)",
    "2. **홈택스 로그인** → **신고/납부** → **법인세**",
    "3. **정기신고 작성** → 사업자등록번호 입력",
    "4. **표준재무제표** 첨부 (외부에서 만든 결산서)",
    "5. **세무조정계산서** 작성 — 가산·감산 항목 입력",
    "6. **각종 부속서류**:",
    "    - 임대료/지급이자 명세서",
    "    - 접대비·기업업무추진비 한도 초과액",
    "    - 감가상각비 명세서",
    "    - 외환차손익 명세서",
    "7. **결정세액 계산** → 산출세액 - 세액공제(연구개발·고용·중소기업특별)",
    "8. **전자신고** → 신고번호 → 납부 (분납 5천만 초과 시 가능)",
    "",
    "## 본 시스템이 도울 수 있는 것 / 못 하는 것",
    "",
    "- ✅ 매출/매입 분개 → 손익계산서 보조 자료",
    "- ✅ 부가세 신고 자료 → 매출과 일치 여부 점검",
    "- ❌ 표준재무제표 자동 생성 (회계 결산 모듈 별도 필요)",
    "- ❌ 세무조정 (가산·감산 자동 처리)",
    "",
    "법인세 신고는 세무 전문가 동반 권장.",
  ].join("\n");
}

// ============================================================================
// 원천세 (월별)
// ============================================================================

export type WithholdingFilingInput = {
  clientName: string;
  /** 신고대상 월 YYYY-MM */
  targetMonth: string;
  /** 지급한 사업소득(프리랜서) 총액 */
  businessIncomePaid?: number;
  /** 지급한 기타소득 총액 */
  otherIncomePaid?: number;
  /** 지급한 근로소득 총액 */
  wageIncomePaid?: number;
};

export function generateWithholdingFilingGuide(args: WithholdingFilingInput): string {
  const { clientName, targetMonth, businessIncomePaid, otherIncomePaid, wageIncomePaid } = args;
  const [y, m] = targetMonth.split("-").map(Number);
  const dueMonth = m === 12 ? 1 : m + 1;
  const dueYear = m === 12 ? y + 1 : y;

  const lines: string[] = [
    `# ${clientName} — ${targetMonth} 원천세 신고`,
    "",
    "## 신고 기간",
    "",
    `- **마감**: ${dueYear}년 ${dueMonth}월 10일 (지급한 달의 다음달 10일)`,
    "- 반기별 납부 신청자: 1/10 (전년도 7~12월분), 7/10 (당년 1~6월분)",
    "",
    "## 지급내역 (자동 집계)",
    "",
  ];

  let total = 0;
  if (businessIncomePaid !== undefined && businessIncomePaid > 0) {
    const tax = Math.floor(businessIncomePaid * 0.033);
    total += tax;
    lines.push(`- 사업소득(프리랜서) 지급: ${fmt(businessIncomePaid)} → 원천세 3.3% = **${fmt(tax)}**`);
  }
  if (otherIncomePaid !== undefined && otherIncomePaid > 0) {
    const tax = Math.floor(otherIncomePaid * 0.088);
    total += tax;
    lines.push(`- 기타소득 지급: ${fmt(otherIncomePaid)} → 원천세 8.8%(실효) = **${fmt(tax)}**`);
  }
  if (wageIncomePaid !== undefined && wageIncomePaid > 0) {
    lines.push(`- 근로소득 지급: ${fmt(wageIncomePaid)} (간이세액표 적용 — 직원별 부양가족 수에 따라 다름)`);
    lines.push(`    ↳ 정확한 금액은 홈택스 \"근로소득 간이세액표 조회\" 또는 본 시스템 calc_withholding 도구로`);
  }
  if (total > 0) lines.push("", `**대략 납부세액 합계: ${fmt(total)}** (근로소득 제외)`);

  lines.push(
    "",
    "## 홈택스 신고 단계",
    "",
    "1. **홈택스 로그인** → **신고/납부** → **원천세** → **원천징수이행상황신고**",
    "2. **신고서 작성**:",
    "    - 인원수·총 지급액·소득세·지방소득세 입력",
    "    - 사업소득 / 기타소득 / 근로소득 / 퇴직소득 / 일용근로 각 칸",
    "3. **지급명세서** (분기별 또는 연 1회):",
    "    - 사업/기타소득 지급명세서: 분기 익월 말일까지 (예: 1분기 → 4/30)",
    "    - 근로소득 지급명세서: 다음 해 3/10까지",
    "4. **전자신고** → **납부서 출력** → 다음달 10일까지 납부",
    "5. **지방소득세 특별징수분** 0.3%/0.8% — 자동 계산되어 같이 납부",
    "",
    "## 권장 사전 점검",
    "",
    "- [ ] 지급내역과 분개의 비용 라인 일치 확인",
    "- [ ] 사업소득자 원천징수영수증 발급 (지급 직후)",
    "- [ ] 근로소득자 매월 급여명세서 보관",
    "",
    "## 주의",
    "",
    "- 직원이 5인 미만이면 반기별 납부 선택 가능 (한 번 신청하면 1년 유지)",
    "- 미신고 가산세: 산출세액의 10%",
    "- 일용근로자는 일 18.7만 초과분에 대해서만 원천세 (소액부징수)",
  );
  return lines.join("\n");
}

// ============================================================================
// 사업장현황신고 (면세사업자)
// ============================================================================

export type BusinessStatusFilingInput = {
  clientName: string;
  taxYear: number;
  /** 1년치 매출 합계 (분개 기반) */
  annualSales?: number;
};

export function generateBusinessStatusFilingGuide(args: BusinessStatusFilingInput): string {
  const { clientName, taxYear, annualSales } = args;
  return [
    `# ${clientName} — ${taxYear}년 사업장현황신고 (면세사업자)`,
    "",
    "## 신고 기간",
    "",
    `- **${taxYear + 1}년 2월 1일 ~ 2월 10일**`,
    "- 면세사업자는 부가세 신고 의무가 없는 대신 본 신고가 필수",
    "",
    "## 신고 자료",
    "",
    annualSales !== undefined
      ? `- ${taxYear}년 매출 합계 (분개 기반): **${fmt(annualSales)}**`
      : "- 매출 합계 미집계",
    "",
    "## 홈택스 신고 단계",
    "",
    "1. **홈택스 로그인** → **신고/납부** → **사업장현황신고**",
    "2. **신고서 작성**:",
    "    - 수입금액 총액 (위 매출 합계)",
    "    - 매출 계산서·신용카드매출전표·현금영수증 합계표",
    "    - 매입 세금계산서·계산서 합계표 (매입자료)",
    "3. **시설현황** (해당 시): 사업장 면적·종업원 수 등",
    "4. **전자신고** → 신고번호 저장",
    "",
    "## 주의",
    "",
    "- 본 신고는 종합소득세(5월) 신고의 기초자료가 됨 — 두 신고 매출 일치 필수",
    "- 미신고 가산세: 수입금액의 0.5%",
    "- 의료업·교육업·농수산물 도매 등 면세 업종에 해당하는지 사전 확인",
  ].join("\n");
}
