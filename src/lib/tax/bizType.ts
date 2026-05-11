// 사업자 유형 단일 정의. 다른 모듈은 모두 여기서 import.

export const BIZ_TYPES = [
  "CORPORATION",
  "SOLE_GENERAL",
  "SOLE_SIMPLIFIED",
  "SOLE_TAX_FREE",
] as const;

export type BizType = (typeof BIZ_TYPES)[number];

export const BIZ_TYPE_LABEL: Record<BizType, string> = {
  CORPORATION: "법인사업자",
  SOLE_GENERAL: "개인 일반과세자",
  SOLE_SIMPLIFIED: "개인 간이과세자",
  SOLE_TAX_FREE: "면세사업자",
};

/** 외부 입력값(쿼리스트링·DB string 등)이 BizType인지 검증 */
export function isBizType(v: unknown): v is BizType {
  return typeof v === "string" && (BIZ_TYPES as readonly string[]).includes(v);
}
