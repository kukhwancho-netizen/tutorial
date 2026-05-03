"""최종 상태 판정의 의사결정 표.

if/elif 사다리 대신 (조건 → 상태) 규칙을 우선순위 순으로 정의한다.
첫 번째로 매치되는 규칙이 적용된다. 새 케이스 추가는 표에 한 줄 추가.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Tuple


# ItemDecisionInput: 한 콘텐츠 항목에 대한 판정 입력
@dataclass(frozen=True)
class ItemDecisionInput:
    item_status: str               # spec의 item.status (publish_candidate/needs_repair/blocked)
    risk_level: str                # low/medium/high
    human_gate_required: bool
    reviewer_statuses: Tuple[str, ...]  # ("pass", "partial", ...)
    r2_status: str                 # R2의 status. 없으면 "missing"
    repair_attempted: bool
    block_high_risk: bool          # config.review.block_high_risk


# 결과 상수
FINAL_DRY_RUN = "검수 생략(dry-run)"
FINAL_BLOCKED = "보류"
FINAL_NEEDS_REPAIR = "수정 필요"
FINAL_PASS = "통과"


# 규칙: (조건 함수, 결과 상태). 위에서부터 첫 매치 적용.
RULES: List[Tuple[Callable[[ItemDecisionInput], bool], str]] = [
    # 모든 검수자가 skipped면 dry-run 흐름.
    (lambda x: bool(x.reviewer_statuses) and all(s == "skipped" for s in x.reviewer_statuses),
     FINAL_DRY_RUN),

    # block_high_risk가 켜진 상태에서 risk=high면 보류.
    (lambda x: x.block_high_risk and x.risk_level == "high",
     FINAL_BLOCKED),

    # spec 자체가 blocked로 나왔거나, 어떤 검수자든 fail이면 보류.
    (lambda x: x.item_status == "blocked",
     FINAL_BLOCKED),
    (lambda x: any(s == "fail" for s in x.reviewer_statuses),
     FINAL_BLOCKED),

    # 보정 후에도 R2가 pass가 아니면 보류 (post_repair_r2_partial_policy=auto_block).
    (lambda x: x.repair_attempted and x.r2_status != "pass",
     FINAL_BLOCKED),

    # partial이 하나라도 있거나 사람 게이트가 켜졌으면 수정 필요.
    (lambda x: any(s == "partial" for s in x.reviewer_statuses) or x.human_gate_required,
     FINAL_NEEDS_REPAIR),
]


# 모든 PASS가 같은 의사결정 표를 공유. PASS별로 분기되어야 한다면 새 상수를
# 추가하고 BatchPass.decision_rules가 골라 잡는다 — 현재는 RULES 1개로 충분.


def decide_final_status(input: ItemDecisionInput) -> str:
    for predicate, status in RULES:
        if predicate(input):
            return status
    return FINAL_PASS


def decision_input_from(
    *,
    item: Dict[str, Any],
    item_reviews: Dict[str, Dict[str, Any]],
    repair_attempted: bool,
    config: Dict[str, Any],
) -> ItemDecisionInput:
    """런타임 상태로부터 의사결정 표 입력을 만든다."""
    statuses = tuple(x["status"] for x in item_reviews.values())
    r2_status = item_reviews.get("R2", {}).get("status", "missing")
    block_high_risk = bool(config.get("review", {}).get("block_high_risk", True))
    return ItemDecisionInput(
        item_status=item["status"],
        risk_level=item["risk"]["level"],
        human_gate_required=bool(item["risk"].get("human_gate_required")),
        reviewer_statuses=statuses,
        r2_status=r2_status,
        repair_attempted=repair_attempted,
        block_high_risk=block_high_risk,
    )
