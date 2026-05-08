import { describe, expect, it } from "vitest";
import { JournalImbalanceError, assertBalanced } from "../journal";

describe("복식부기 검증", () => {
  it("차변 = 대변이면 통과", () => {
    expect(() =>
      assertBalanced([
        { accountId: "a", debit: 110_000 },
        { accountId: "b", credit: 100_000 },
        { accountId: "c", credit: 10_000 },
      ]),
    ).not.toThrow();
  });

  it("불일치 시 JournalImbalanceError", () => {
    expect(() =>
      assertBalanced([
        { accountId: "a", debit: 100 },
        { accountId: "b", credit: 50 },
      ]),
    ).toThrow(JournalImbalanceError);
  });

  it("0원 분개는 거부", () => {
    expect(() =>
      assertBalanced([
        { accountId: "a", debit: 0 },
        { accountId: "b", credit: 0 },
      ]),
    ).toThrow(JournalImbalanceError);
  });
});
