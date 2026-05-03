"""dry-run end-to-end 통합 테스트.

오케스트레이터·파일쓰기·결과 형식이 정상인지 확인한다.
실제 OpenAI/캘린더 호출은 dry-run 분기에서 우회된다.
"""
from __future__ import annotations

import pathlib


def test_dry_run_uses_skipped_reviews(tmp_path, bot_module, cfg, root_path):
    """dry-run이 R1/R2/R3=skipped로 동작하고 격리된 outputs에 쓰이는지 확인."""
    bot = bot_module
    # ROOT의 schemas/prompts를 tmp_path에 심볼릭 링크해서 패키지 outputs를 오염시키지 않는다.
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
    assert result["summary"]["dry_run_skipped"] == 7
    assert result["summary"]["needs_repair"] == 0
    assert result["summary"]["blocked"] == 0

    json_path = pathlib.Path(result["json_path"])
    assert tmp_path in json_path.parents, f"report should be inside tmp_path, got {json_path}"
    assert "_spec_" in json_path.name, f"spec dry-run filename should embed pass label: {json_path.name}"
    data = bot.load_json(json_path)
    assert all(review["verdict"] == "skipped" for review in data["reviews"].values())
    assert all(item["final_status"] == "검수 생략(dry-run)" for item in data["report"]["items"])


def test_dry_run_draft_mode(tmp_path, bot_module, cfg, root_path):
    """draft + dry-run이 abort 없이 끝나고 _draft_ 라벨로 저장되는지 확인."""
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

    order = bot.parse_order("draft 콘텐츠 3 길이 풀+요약+핵심")
    result = bot.run(cfg_path, dry_run=True, no_calendar=True, order=order)
    assert result["run_status"] == "dry_run"
    assert result["pass"] == "draft"
    json_path = pathlib.Path(result["json_path"])
    assert "_draft_" in json_path.name, f"draft dry-run filename should embed pass label: {json_path.name}"
    data = bot.load_json(json_path)
    # draft dry-run 샘플은 1 변주만 — items / reviews item_results 모두 1개여야 한다.
    assert len(data["spec_batch"]["items"]) == 1
    for review in data["reviews"].values():
        assert len(review["item_results"]) == 1
        assert review["item_results"][0]["temp_id"].startswith("콘텐츠 1.")
