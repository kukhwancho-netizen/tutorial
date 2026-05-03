"""PASS 인터페이스 + parse_order 단위 테스트.

본 라운드는 spec PASS 1개만 노출한다. draft 트리거는 명시적으로 거부된다.
"""
from __future__ import annotations

import pytest

from weekly_blog_bot import pass_def
from weekly_blog_bot.pass_def import (
    DRAFT_PASS,
    SPEC_PASS,
    OrderParseError,
    OrderSpec,
    order_from_args,
    parse_order,
    pass_for,
)


# ---------- BatchPass / dispatch ----------

def test_pass_for_dispatches_by_mode():
    assert pass_for(OrderSpec(mode="spec", raw="x")) is SPEC_PASS
    assert pass_for(OrderSpec(mode="draft", raw="x")) is DRAFT_PASS


def test_pass_for_unknown_mode_raises():
    with pytest.raises(OrderParseError):
        pass_for(OrderSpec(mode="bogus", raw="x"))


def test_pass_by_name_table_has_spec_and_draft():
    assert set(pass_def.PASS_BY_NAME) == {"spec", "draft"}


def test_spec_pass_is_sketch_only():
    assert SPEC_PASS.has_review is False
    assert SPEC_PASS.has_calendar_write is False


def test_draft_pass_is_full_pipeline():
    assert DRAFT_PASS.has_review is True
    assert DRAFT_PASS.has_calendar_write is True
    assert set(DRAFT_PASS.reviewer_prompt_files) == {"R1", "R2", "R3"}
    assert DRAFT_PASS.repair_prompt_file is not None


# ---------- 패키지 레벨 재노출 ----------

def test_top_level_reexports_pass_symbols():
    """`import weekly_blog_bot as bot` 사용자가 PASS/Order API에 접근할 수 있어야 한다."""
    import weekly_blog_bot as bot
    expected = {
        "BatchPass", "SPEC_PASS", "PASS_BY_NAME",
        "OrderSpec", "OrderParseError",
        "parse_order", "order_from_args", "pass_for",
    }
    missing = [name for name in expected if not hasattr(bot, name)]
    assert not missing, f"missing top-level re-exports: {missing}"


# ---------- parse_order: spec ----------

def test_parse_order_spec_paren_form():
    o = parse_order("블 (민+가+행) 7 ㄱㄱ")
    assert o.mode == "spec"
    assert o.channel == "블로그"
    assert o.distribution == ("민사", "가사", "행정")
    assert o.total == 7


def test_parse_order_spec_comma_form():
    o = parse_order("홈 민,가 5")
    assert o.mode == "spec"
    assert o.channel == "홈페이지"
    assert o.distribution == ("민사", "가사")
    assert o.total == 5


# ---------- parse_order: errors ----------

def test_parse_order_empty_raises():
    with pytest.raises(OrderParseError):
        parse_order("")


def test_parse_order_garbage_raises():
    with pytest.raises(OrderParseError):
        parse_order("aimless text without channel")


def test_parse_order_draft_plus_form():
    o = parse_order("draft 콘텐츠 3 길이 풀+요약+핵심")
    assert o.mode == "draft"
    assert o.parent_spec_id == "콘텐츠 3"
    assert o.axis == "길이"
    assert o.variants == ("풀", "요약", "핵심")


def test_parse_order_draft_space_form():
    o = parse_order("draft 콘텐츠 5 후보 A B C")
    assert o.mode == "draft"
    assert o.variants == ("A", "B", "C")


def test_parse_order_spec_zero_total_raises():
    with pytest.raises(OrderParseError):
        parse_order("블 (민) 0")


def test_parse_order_spec_negative_total_via_format_rejected():
    with pytest.raises(OrderParseError):
        parse_order("블 (민) -3")


# ---------- order_from_args ----------

def test_order_from_args_spec_minimal():
    o = order_from_args(mode="spec")
    assert o.mode == "spec"
    assert o.raw == "spec"


def test_order_from_args_unknown_mode_raises():
    with pytest.raises(OrderParseError):
        order_from_args(mode="bogus")


def test_order_from_args_draft_full():
    o = order_from_args(
        mode="draft", parent_spec_id="콘텐츠 2", axis="각도",
        variants=("증거 정리", "절차 흐름", "실패 사례"),
    )
    assert o.mode == "draft"
    assert o.parent_spec_id == "콘텐츠 2"
    assert o.variants == ("증거 정리", "절차 흐름", "실패 사례")


def test_order_from_args_draft_missing_required_raises():
    with pytest.raises(OrderParseError):
        order_from_args(mode="draft", parent_spec_id="콘텐츠 1")  # axis/variants 누락


# ---------- BatchPass file references resolve ----------

def test_spec_pass_schema_and_prompts_exist(root_path):
    """SPEC_PASS는 sketch 모드 — generator + report schema만 필수."""
    pass_ = SPEC_PASS
    assert (root_path / "schemas" / pass_.schema_file).is_file()
    assert (root_path / "schemas" / pass_.report_schema_file).is_file()
    assert (root_path / "prompts" / pass_.generator_prompt_file).is_file()
    # sketch 모드는 reviewer/repair 없음.
    assert pass_.reviewer_prompt_files == {}
    assert pass_.repair_prompt_file is None
    assert pass_.has_review is False
    assert pass_.has_calendar_write is False


# ---------- spec OrderSpec → payload ----------

def _prepared_ctx(tmp_path, root_path, cfg, *, order):
    import yaml
    from weekly_blog_bot import stages
    (tmp_path / "config").mkdir(parents=True, exist_ok=True)
    for name in ("schemas", "prompts"):
        target = tmp_path / name
        if not target.exists():
            target.symlink_to(root_path / name, target_is_directory=True)
    cfg["outputs"]["directory"] = "outputs"
    cfg["calendar"]["enabled"] = False
    cfg["outputs"]["create_calendar_event"] = False
    cfg["notifications"]["enabled"] = False
    cfg_path = tmp_path / "config" / "weekly_blog_bot.yaml"
    cfg_path.write_text(yaml.safe_dump(cfg, allow_unicode=True), encoding="utf-8")
    return stages.stage_prepare(
        cfg_path, dry_run=True, no_calendar=True, pass_=SPEC_PASS, order=order,
    )


def test_make_order_payload_carries_spec_order_content(tmp_path, root_path, cfg):
    """parse_order의 channel/distribution/total이 generator payload까지 흘러간다."""
    from weekly_blog_bot import stages
    order = parse_order("블 (민+가+행) 7 ㄱㄱ")
    ctx = _prepared_ctx(tmp_path, root_path, cfg, order=order)
    payload = stages._make_order_payload(ctx)
    assert payload["order"]["mode"] == "spec"
    assert payload["order"]["channel"] == "블로그"
    assert payload["order"]["distribution"] == ["민사", "가사", "행정"]
    assert payload["order"]["total"] == 7


def test_make_order_payload_falls_back_to_yaml_trigger_when_no_order(tmp_path, root_path, cfg):
    """--order가 없으면 YAML의 trigger_text가 사용된다 (호환성)."""
    from weekly_blog_bot import stages
    ctx = _prepared_ctx(tmp_path, root_path, cfg, order=None)
    payload = stages._make_order_payload(ctx)
    assert "mode" not in payload["order"]
    assert payload["order"]["trigger_text"] == cfg["order"]["trigger_text"]
