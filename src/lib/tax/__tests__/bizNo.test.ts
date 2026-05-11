import { describe, expect, it } from "vitest";
import { checksumValid, normalizeBizNo } from "../bizNo";

describe("bizNo", () => {
  it("normalizeBizNo은 하이픈 제거 후 10자리", () => {
    expect(normalizeBizNo("123-45-67890")).toBe("1234567890");
    expect(normalizeBizNo("1234567890")).toBe("1234567890");
    expect(normalizeBizNo("12-345")).toBeNull();
    expect(normalizeBizNo("abc")).toBeNull();
  });

  it("유효한 사업자번호는 체크섬 통과", () => {
    // 실제 시드 데이터에 쓰는 임의 사업자번호 (체크섬 유효한 값)
    // 가중치 1,3,7,1,3,7,1,3,5 + 9번째 자리에 5 곱한 결과의 십의 자리
    // 1*1+0*3+4*7+1*1+0*3+8*7+1*1+0*3+1*5 = 1+0+28+1+0+56+1+0+5 = 92
    // +floor(1*5/10)=0  → sum=92 → check=(10-2)%10=8
    expect(checksumValid("1041081018")).toBe(true);
  });

  it("체크섬 실패는 false", () => {
    expect(checksumValid("1234567890")).toBe(false);
  });

  it("형식 자체가 잘못되면 false", () => {
    expect(checksumValid("123")).toBe(false);
    expect(checksumValid("abc-de-fghij")).toBe(false);
  });
});
