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


def test_draft_order_explicitly_rejected(bot_module):
    """draft 형식 트리거는 본 라운드에서 명시적으로 거부된다."""
    bot = bot_module
    import pytest
    with pytest.raises(bot.OrderParseError):
        bot.parse_order("draft 콘텐츠 3 길이 풀+요약+핵심")
