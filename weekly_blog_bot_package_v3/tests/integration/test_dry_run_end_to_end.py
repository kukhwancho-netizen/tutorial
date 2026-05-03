"""dry-run end-to-end 통합 테스트.

오케스트레이터·파일쓰기·결과 형식이 정상인지 확인한다.
실제 OpenAI/캘린더 호출은 dry-run 분기에서 우회된다.
"""
from __future__ import annotations

import pathlib


def test_spec_dry_run_produces_sketch_report(tmp_path, bot_module, cfg, root_path):
    """spec dry-run은 sketch 리포트를 만들고 검수 없이 통과한다."""
    bot = bot_module
    (tmp_path / "config").mkdir(parents=True, exist_ok=True)
    for name in ("schemas", "prompts"):
        (tmp_path / name).symlink_to(root_path / name, target_is_directory=True)

    cfg["outputs"]["directory"] = "outputs"
    cfg["calendar"]["enabled"] = False
    cfg["outputs"]["create_calendar_event"] = False
    cfg["notifications"]["enabled"] = False
    cfg_path = tmp_path / "config" / "weekly_blog_bot.yaml"
    cfg_path.write_text(__import__("yaml").safe_dump(cfg, allow_unicode=True), encoding="utf-8")

    result = bot.run(cfg_path, dry_run=True, no_calendar=True)
    assert result["run_status"] == "dry_run"
    assert result["pass"] == "spec"
    assert result["summary"]["sketches"] == 7
    assert result["summary"]["high_risk_hint"] == 0

    json_path = pathlib.Path(result["json_path"])
    assert tmp_path in json_path.parents, f"report should be inside tmp_path, got {json_path}"
    assert "_spec_" in json_path.name
    data = bot.load_json(json_path)
    # sketch 단계는 reviews가 비어있다.
    assert data["reviews"] == {}
    # report items는 4개 핵심 필드만.
    for item in data["report"]["items"]:
        assert set(item).issuperset({"temp_id", "channel", "topic", "risk_hint"})
        assert "final_status" not in item  # 검수 없음
        assert "domain" not in item        # 슬림 sketch에 없음


def test_draft_dry_run_produces_final_report(tmp_path, bot_module, cfg, root_path):
    """draft + dry-run이 abort 없이 끝나고 _draft_ 라벨로 저장된다."""
    bot = bot_module
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
    cfg_path.write_text(__import__("yaml").safe_dump(cfg, allow_unicode=True), encoding="utf-8")

    order = bot.parse_order("draft 콘텐츠 3 길이 풀+요약+핵심")
    result = bot.run(cfg_path, dry_run=True, no_calendar=True, order=order)
    assert result["run_status"] == "dry_run"
    assert result["pass"] == "draft"
    json_path = pathlib.Path(result["json_path"])
    assert "_draft_" in json_path.name
    data = bot.load_json(json_path)
    # Order-aware dry-run: variants 개수만큼 sample 생성.
    assert len(data["batch"]["items"]) == 3
    assert data["batch"]["parent_spec_id"] == "콘텐츠 3"
    assert data["batch"]["axis"] == "길이"
    for review in data["reviews"].values():
        assert len(review["item_results"]) == 3


def test_draft_live_without_parent_spec_aborts(tmp_path, bot_module, cfg, root_path):
    """draft live는 outputs/에 spec 결과가 없으면 명확히 abort."""
    bot = bot_module
    (tmp_path / "config").mkdir(parents=True, exist_ok=True)
    for name in ("schemas", "prompts"):
        target = tmp_path / name
        if not target.exists():
            target.symlink_to(root_path / name, target_is_directory=True)
    cfg["outputs"]["directory"] = "outputs"
    cfg["calendar"]["enabled"] = False
    cfg["notifications"]["enabled"] = False
    cfg_path = tmp_path / "config" / "weekly_blog_bot.yaml"
    cfg_path.write_text(__import__("yaml").safe_dump(cfg, allow_unicode=True), encoding="utf-8")

    order = bot.parse_order("draft 콘텐츠 3 길이 풀")
    import pytest
    with pytest.raises(bot.PipelineAbort) as excinfo:
        bot.run(cfg_path, dry_run=False, no_calendar=True, order=order)
    assert "spec output" in str(excinfo.value)


def _setup_isolated_outputs(tmp_path, root_path, cfg):
    """tmp_path에 격리된 schemas/prompts/config — 본 모듈 공통 셋업."""
    import yaml
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
    return cfg_path


def test_draft_dry_run_reflects_order(tmp_path, bot_module, cfg, root_path):
    """draft dry-run이 OrderSpec의 parent/axis/variants를 반영해야 한다 (Fix C-i)."""
    bot = bot_module
    cfg_path = _setup_isolated_outputs(tmp_path, root_path, cfg)
    order = bot.parse_order("draft 콘텐츠 5 후보 A B C")
    result = bot.run(cfg_path, dry_run=True, no_calendar=True, order=order)
    json_path = pathlib.Path(result["json_path"])
    data = bot.load_json(json_path)
    batch = data["batch"]
    assert batch["parent_spec_id"] == "콘텐츠 5"
    assert batch["axis"] == "후보"
    assert [it["axis_value"] for it in batch["items"]] == ["A", "B", "C"]
    assert [it["temp_id"] for it in batch["items"]] == ["콘텐츠 5.A", "콘텐츠 5.B", "콘텐츠 5.C"]


def test_edit_dry_run_reflects_target(tmp_path, bot_module, cfg, root_path):
    """edit dry-run이 target_temp_id를 반영해야 한다 (Fix C-i)."""
    bot = bot_module
    cfg_path = _setup_isolated_outputs(tmp_path, root_path, cfg)
    order = bot.parse_order("edit 콘텐츠 7.핵심")
    result = bot.run(cfg_path, dry_run=True, no_calendar=True, order=order)
    json_path = pathlib.Path(result["json_path"])
    data = bot.load_json(json_path)
    items = data["batch"]["items"]
    assert len(items) == 1
    assert items[0]["temp_id"] == "콘텐츠 7.핵"  # axis_value 첫 글자로 suffix
    assert items[0]["axis_value"] == "핵심"
    assert "_edit_" in json_path.name


def test_edit_live_with_existing_draft_reuses_batch(tmp_path, bot_module, cfg, root_path):
    """edit prepare_hook이 outputs/의 기존 draft를 ctx.batch로 로드한다."""
    bot = bot_module
    cfg_path = _setup_isolated_outputs(tmp_path, root_path, cfg)
    # 1) draft dry-run으로 outputs/에 draft batch를 만든다.
    draft_order = bot.parse_order("draft 콘텐츠 2 길이 풀+요약+핵심")
    draft_result = bot.run(cfg_path, dry_run=True, no_calendar=True, order=draft_order)
    assert "_draft_" in draft_result["json_path"]
    # 2) edit live: prepare_hook이 그 draft를 골라온다 (target_temp_id 매칭).
    edit_order = bot.parse_order("edit 콘텐츠 2.풀")
    # live 진입은 OpenAI 호출 시도 → 실제 호출 직전에 prepare_hook은 batch 로드 성공.
    # PipelineAbort 또는 다른 OpenAI 에러를 잡는 게 아니라, prepare_hook 자체의
    # 로딩이 깨지지 않는 것만 확인 — 검수 단계 진입 전에 stage_prepare가 통과해야 한다.
    from weekly_blog_bot import stages
    ctx = stages.stage_prepare(
        cfg_path, dry_run=False, no_calendar=True,
        pass_=bot.EDIT_PASS, order=edit_order,
    )
    assert ctx.batch is not None
    assert any(it["temp_id"] == "콘텐츠 2.풀" for it in ctx.batch["items"])


def test_edit_live_target_not_found_aborts(tmp_path, bot_module, cfg, root_path):
    """edit prepare_hook이 target_temp_id를 못 찾으면 PipelineAbort."""
    bot = bot_module
    cfg_path = _setup_isolated_outputs(tmp_path, root_path, cfg)
    # outputs/에 draft 1건 만들어 두지만 target_temp_id가 다름.
    draft_order = bot.parse_order("draft 콘텐츠 1 길이 풀")
    bot.run(cfg_path, dry_run=True, no_calendar=True, order=draft_order)
    # 존재하지 않는 target.
    edit_order = bot.parse_order("edit 콘텐츠 99.없음")
    import pytest
    from weekly_blog_bot import stages
    with pytest.raises(bot.PipelineAbort) as excinfo:
        stages.stage_prepare(
            cfg_path, dry_run=False, no_calendar=True,
            pass_=bot.EDIT_PASS, order=edit_order,
        )
    assert "콘텐츠 99.없음" in str(excinfo.value)


def test_pass_dispatch_via_callbacks_no_name_branches(bot_module):
    """모든 PASS의 콜백이 callable 또는 None — stages가 if pass_.name 없이 디스패치 가능."""
    bot = bot_module
    for p in [bot.SPEC_PASS, bot.DRAFT_PASS, bot.EDIT_PASS]:
        assert callable(p.dry_run_factory)
        assert callable(p.report_builder)
        assert callable(p.markdown_renderer)
        assert callable(p.summary_formatter)
        assert p.prepare_hook is None or callable(p.prepare_hook)
