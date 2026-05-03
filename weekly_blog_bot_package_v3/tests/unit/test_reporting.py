"""sketch 리포트 빌드 단위 테스트.

Phase 1 재설계 후 spec은 검수가 없으므로 build_sketch_report_from_data를
검증한다. 검수 있는 PASS(draft 등)의 reporting 테스트는 Phase 2에서 재도입.
"""
from __future__ import annotations


def test_build_sketch_report_summary_counts_high_risk(bot_module, cfg):
    bot = bot_module
    basis = bot.now_in_tz("Asia/Seoul")
    spec = bot.make_dry_run_spec(cfg, basis)
    # dry-run 샘플은 모두 risk_hint=low. 한 건만 high로 바꿔본다.
    spec["items"][2]["risk_hint"] = "high"
    report = bot.build_sketch_report_from_data(
        run_id="weekly-test-sketch",
        batch=spec,
        config=cfg,
        dry_run=True,
    )
    assert report["summary"]["sketches"] == 7
    assert report["summary"]["high_risk_hint"] == 1
    assert report["run_status"] == "dry_run"
    assert report["items"][2]["risk_hint"] == "high"


def test_sketch_report_markdown_renders_topics(bot_module, cfg):
    bot = bot_module
    basis = bot.now_in_tz("Asia/Seoul")
    spec = bot.make_dry_run_spec(cfg, basis)
    report = bot.build_sketch_report_from_data(
        run_id="weekly-test-md",
        batch=spec,
        config=cfg,
        dry_run=True,
    )
    md = bot.render_sketch_report_markdown(report)
    assert "# 주간 블로그 sketch 결과" in md
    assert "## 토픽 (7건)" in md
    # spec의 첫 토픽이 본문에 등장해야 함.
    assert spec["items"][0]["topic"] in md


def test_sketch_report_next_actions_reference_draft_command(bot_module, cfg):
    bot = bot_module
    basis = bot.now_in_tz("Asia/Seoul")
    spec = bot.make_dry_run_spec(cfg, basis)
    report = bot.build_sketch_report_from_data(
        run_id="weekly-test-actions",
        batch=spec,
        config=cfg,
        dry_run=True,
    )
    assert any("draft" in action for action in report["next_actions"])
