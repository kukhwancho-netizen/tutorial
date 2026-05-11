// 사업자등록번호 검증 + 국세청 진위/상태 조회.
//
// 1) 체크섬 검증: 오프라인. https://www.nts.go.kr/ 공개 알고리즘.
// 2) 국세청 상태 조회: data.go.kr "사업자등록정보 진위확인 및 상태조회 서비스" API.
//    환경변수 NTS_BUSINESSMAN_API_KEY 필요 (data.go.kr에서 무료 발급).
//    https://api.odcloud.kr/api/nts-businessman/v1/status

export type BizNoStatus =
  | { ok: true; bNo: string; bStt: string; bSttCd: string; taxType: string | null; endDate: string | null }
  | { ok: false; reason: string };

/** 하이픈 제거 + 10자리 검증 */
export function normalizeBizNo(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, "");
  return digits.length === 10 ? digits : null;
}

/**
 * 사업자등록번호 체크섬(가중치) 검증.
 * 가중치: 1, 3, 7, 1, 3, 7, 1, 3, 5
 * 9번째 자리에 5를 곱한 결과의 십의 자리도 더함.
 * 합계의 10의 자리 보수가 10번째 자리와 같아야 한다.
 */
export function checksumValid(bizNo: string): boolean {
  const n = normalizeBizNo(bizNo);
  if (!n) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(n[i]) * weights[i];
  sum += Math.floor((Number(n[8]) * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(n[9]);
}

/** 국세청 상태 조회. 키 없으면 ok=false 폴백. */
export async function fetchNtsStatus(bizNo: string): Promise<BizNoStatus> {
  const normalized = normalizeBizNo(bizNo);
  if (!normalized) return { ok: false, reason: "사업자번호가 10자리가 아닙니다." };
  if (!checksumValid(normalized)) {
    return { ok: false, reason: "체크섬 검증 실패 (형식 자체가 잘못됨)" };
  }

  const key = process.env.NTS_BUSINESSMAN_API_KEY;
  if (!key) {
    return {
      ok: false,
      reason:
        "NTS_BUSINESSMAN_API_KEY 환경변수가 설정되지 않았습니다. data.go.kr에서 발급해 .env에 추가하세요.",
    };
  }

  const url = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(
    key,
  )}&returnType=JSON`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ b_no: [normalized] }),
    });
  } catch (e) {
    return { ok: false, reason: `네트워크 오류: ${(e as Error).message}` };
  }

  if (!res.ok) {
    return { ok: false, reason: `국세청 API 오류 ${res.status}` };
  }

  const json = (await res.json()) as {
    data?: Array<{
      b_no: string;
      b_stt: string;
      b_stt_cd: string;
      tax_type?: string;
      end_dt?: string;
    }>;
  };
  const row = json.data?.[0];
  if (!row) return { ok: false, reason: "응답 데이터가 비어있습니다." };

  // b_stt_cd: 01=계속사업자, 02=휴업자, 03=폐업자, 그 외 미등록
  return {
    ok: true,
    bNo: normalized,
    bStt: row.b_stt || "미등록",
    bSttCd: row.b_stt_cd || "00",
    taxType: row.tax_type || null,
    endDate: row.end_dt || null,
  };
}
