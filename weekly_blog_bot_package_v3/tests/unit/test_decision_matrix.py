"""의사결정 표 단위 테스트.

각 규칙이 우선순위 순으로 작동하는지, ``block_high_risk`` 설정을 존중하는지
(코덱스 P2 #2 결함 방지) 검증한다.
"""
from __future__ import annotations

from weekly_blog_bot import decision


def _input(**kwargs):
    base = dict(
        item_status="publish_candidate",
        risk_level="low",
        human_gate_required=False,
        reviewer_statuses=("pass", "pass", "pass"),
        r2_status="pass",
        repair_attempted=False,
        block_high_risk=True,
    )
    base.update(kwargs)
    return decision.ItemDecisionInput(**base)


def test_all_skipped_yields_dry_run():
    result = decision.decide_final_status(_input(reviewer_statuses=("skipped",) * 3, r2_status="skipped"))
    assert result == decision.FINAL_DRY_RUN


def test_high_risk_blocked_when_setting_on():
    result = decision.decide_final_status(_input(risk_level="high"))
    assert result == decision.FINAL_BLOCKED


def test_high_risk_NOT_blocked_when_setting_off():
    """block_high_risk=false면 high-risk만으로는 보류로 가지 않는다 (P2 #2 결함 방지)."""
    result = decision.decide_final_status(_input(risk_level="high", block_high_risk=False))
    assert result != decision.FINAL_BLOCKED


def test_high_risk_with_human_gate_off_setting_yields_pass():
    """block_high_risk=false이고 다른 결함이 없으면 통과까지 갈 수 있다."""
    result = decision.decide_final_status(_input(risk_level="high", block_high_risk=False))
    assert result == decision.FINAL_PASS


def test_item_status_blocked_yields_block():
    result = decision.decide_final_status(_input(item_status="blocked"))
    assert result == decision.FINAL_BLOCKED


def test_any_fail_yields_block():
    result = decision.decide_final_status(_input(reviewer_statuses=("pass", "fail", "pass")))
    assert result == decision.FINAL_BLOCKED


def test_repair_attempted_with_r2_partial_yields_block():
    result = decision.decide_final_status(_input(
        reviewer_statuses=("pass", "partial", "pass"),
        r2_status="partial",
        repair_attempted=True,
    ))
    assert result == decision.FINAL_BLOCKED


def test_partial_yields_needs_repair():
    result = decision.decide_final_status(_input(reviewer_statuses=("pass", "partial", "pass"), r2_status="partial"))
    assert result == decision.FINAL_NEEDS_REPAIR


def test_human_gate_yields_needs_repair():
    result = decision.decide_final_status(_input(human_gate_required=True))
    assert result == decision.FINAL_NEEDS_REPAIR


def test_clean_yields_pass():
    result = decision.decide_final_status(_input())
    assert result == decision.FINAL_PASS
