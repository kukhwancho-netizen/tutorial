"""PASS 추상화 + parse_order 단위 테스트."""
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


# ---------- 패키지 레벨 재노출 ----------

def test_top_level_reexports_pass_symbols():
    """`import weekly_blog_bot as bot` 사용자가 PASS/Order API에 접근할 수 있어야 한다."""
    import weekly_blog_bot as bot
    expected = {
        "BatchPass", "SPEC_PASS", "DRAFT_PASS", "PASS_BY_NAME",
        "OrderSpec", "OrderParseError",
        "parse_order", "order_from_args", "pass_for",
    }
    missing = [name for name in expected if not hasattr(bot, name)]
    assert not missing, f"missing top-level re-exports: {missing}"


# ---------- BatchPass / dispatch ----------

def test_pass_for_dispatches_by_mode():
    assert pass_for(OrderSpec(mode="spec", raw="x")) is SPEC_PASS
    assert pass_for(OrderSpec(mode="draft", raw="x")) is DRAFT_PASS


def test_pass_by_name_table_complete():
    assert set(pass_def.PASS_BY_NAME) == {"spec", "draft"}


def test_spec_pass_assets_distinct_from_draft():
    assert SPEC_PASS.schema_file != DRAFT_PASS.schema_file
    assert SPEC_PASS.generator_prompt_file != DRAFT_PASS.generator_prompt_file
    assert SPEC_PASS.repair_prompt_file != DRAFT_PASS.repair_prompt_file
    assert set(SPEC_PASS.reviewer_prompt_files) == set(DRAFT_PASS.reviewer_prompt_files) == {"R1", "R2", "R3"}


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


# ---------- parse_order: draft ----------

def test_parse_order_draft_plus_form():
    o = parse_order("draft 콘텐츠 3 길이 풀+요약+핵심")
    assert o.mode == "draft"
    assert o.parent_spec_id == "콘텐츠 3"
    assert o.axis == "길이"
    assert o.variants == ("풀", "요약", "핵심")


def test_parse_order_draft_space_form():
    o = parse_order("draft 콘텐츠 5 후보 A B C")
    assert o.mode == "draft"
    assert o.parent_spec_id == "콘텐츠 5"
    assert o.axis == "후보"
    assert o.variants == ("A", "B", "C")


# ---------- parse_order: errors ----------

def test_parse_order_empty_raises():
    with pytest.raises(OrderParseError):
        parse_order("")


def test_parse_order_garbage_raises():
    with pytest.raises(OrderParseError):
        parse_order("aimless text without channel")


def test_parse_order_draft_without_variants_raises():
    # axis는 들어왔는데 variants가 빈 경우
    with pytest.raises(OrderParseError):
        parse_order("draft 콘텐츠 1 길이    ")


def test_parse_order_spec_zero_total_raises():
    with pytest.raises(OrderParseError):
        parse_order("블 (민) 0")


def test_parse_order_spec_negative_total_via_format_rejected():
    # 정규식이 음수 부호를 거부 → unrecognized로 떨어진다.
    with pytest.raises(OrderParseError):
        parse_order("블 (민) -3")


# ---------- order_from_args ----------

def test_order_from_args_spec_minimal():
    o = order_from_args(mode="spec")
    assert o.mode == "spec"
    assert o.raw == "spec"


def test_order_from_args_draft_full():
    o = order_from_args(
        mode="draft",
        parent_spec_id="콘텐츠 2",
        axis="각도",
        variants=("증거 정리", "절차 흐름"),
    )
    assert o.mode == "draft"
    assert o.parent_spec_id == "콘텐츠 2"
    assert o.axis == "각도"
    assert o.variants == ("증거 정리", "절차 흐름")


def test_order_from_args_draft_missing_required_raises():
    with pytest.raises(OrderParseError):
        order_from_args(mode="draft", parent_spec_id="콘텐츠 1")  # axis/variants 빠짐


def test_order_from_args_unknown_mode_raises():
    with pytest.raises(OrderParseError):
        order_from_args(mode="bogus")


# ---------- BatchPass file references resolve ----------

def test_draft_pass_schema_and_prompts_exist(root_path):
    pass_ = DRAFT_PASS
    assert (root_path / "schemas" / pass_.schema_file).is_file()
    assert (root_path / "prompts" / pass_.generator_prompt_file).is_file()
    assert (root_path / "prompts" / pass_.repair_prompt_file).is_file()
    for fname in pass_.reviewer_prompt_files.values():
        assert (root_path / "prompts" / fname).is_file()


def test_spec_pass_schema_and_prompts_exist(root_path):
    pass_ = SPEC_PASS
    assert (root_path / "schemas" / pass_.schema_file).is_file()
    assert (root_path / "prompts" / pass_.generator_prompt_file).is_file()
    assert (root_path / "prompts" / pass_.repair_prompt_file).is_file()
    for fname in pass_.reviewer_prompt_files.values():
        assert (root_path / "prompts" / fname).is_file()


# ---------- 5차 검수: OrderSpec → payload / parent_spec 로드 ----------

def _prepared_ctx(tmp_path, root_path, cfg, *, pass_, order, dry_run=True):
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
        cfg_path, dry_run=dry_run, no_calendar=True, pass_=pass_, order=order,
    )


def test_make_order_payload_carries_spec_order_content(tmp_path, root_path, cfg):
    """parse_order의 channel/distribution/total이 generator payload까지 흘러간다."""
    from weekly_blog_bot import stages
    order = parse_order("블 (민+가+행) 7 ㄱㄱ")
    ctx = _prepared_ctx(tmp_path, root_path, cfg, pass_=SPEC_PASS, order=order)
    payload = stages._make_order_payload(ctx)
    assert payload["order"]["mode"] == "spec"
    assert payload["order"]["channel"] == "블로그"
    assert payload["order"]["distribution"] == ["민사", "가사", "행정"]
    assert payload["order"]["total"] == 7


def test_make_order_payload_carries_draft_order_content(tmp_path, root_path, cfg):
    from weekly_blog_bot import stages
    order = parse_order("draft 콘텐츠 3 길이 풀+요약+핵심")
    # draft + dry_run=True → parent_spec_item 로드는 건너뛴다 (live만 시도)
    ctx = _prepared_ctx(tmp_path, root_path, cfg, pass_=DRAFT_PASS, order=order)
    payload = stages._make_order_payload(ctx)
    assert payload["order"]["mode"] == "draft"
    assert payload["order"]["parent_spec_id"] == "콘텐츠 3"
    assert payload["order"]["axis"] == "길이"
    assert payload["order"]["variants"] == ["풀", "요약", "핵심"]


def test_draft_live_without_parent_spec_aborts_cleanly(tmp_path, root_path, cfg):
    """draft 모드 live 진입에서 부모 spec output이 없으면 PipelineAbort."""
    from weekly_blog_bot.domain import PipelineAbort
    order = parse_order("draft 콘텐츠 3 길이 풀+요약+핵심")
    with pytest.raises(PipelineAbort) as excinfo:
        _prepared_ctx(tmp_path, root_path, cfg, pass_=DRAFT_PASS, order=order, dry_run=False)
    assert "spec output" in str(excinfo.value)


def test_draft_live_with_parent_spec_loads_item(tmp_path, root_path, cfg, bot_module):
    """spec 출력이 outputs/에 있으면 draft live가 그 item을 ctx.parent_spec_item으로 가져온다."""
    bot = bot_module
    # 먼저 dry-run으로 spec 출력을 만든다.
    ctx = _prepared_ctx(tmp_path, root_path, cfg, pass_=SPEC_PASS, order=None)
    bot.run(ctx.config_path, dry_run=True, no_calendar=True)
    # 이제 draft live 진입.
    order = parse_order("draft 콘텐츠 5 후보 A B C")
    drafted = _prepared_ctx(tmp_path, root_path, cfg, pass_=DRAFT_PASS, order=order, dry_run=False)
    assert drafted.parent_spec_item is not None
    assert drafted.parent_spec_item["temp_id"] == "콘텐츠 5"
