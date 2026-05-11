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
