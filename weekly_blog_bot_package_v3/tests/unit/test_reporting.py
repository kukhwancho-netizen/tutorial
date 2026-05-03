"""리포트 빌드 단위 테스트.

검수 결과 ``temp_id`` 중복·누락 시 fallback로 안전 차단되는지 (코덱스 P1 결함
방지), 보정 후 R2 partial 자동 보류, fallback reviewer 등을 검증한다.
"""
from __future__ import annotations


def test_post_repair_r2_partial_is_blocked(bot_module, cfg):
    bot = bot_module
    basis = bot.now_in_tz("Asia/Seoul")
    spec = bot.make_dry_run_spec(cfg, basis)
    reviews = {r: bot.make_dry_run_review(r) for r in bot.REVIEWERS}
    for r in bot.REVIEWERS:
        reviews[r]["verdict"] = "pass"
        for item in reviews[r]["item_results"]:
            item["status"] = "pass"
            item["repair_instruction"] = "해당 없음 [pass]"
    reviews["R2"]["verdict"] = "partial"
    for item in reviews["R2"]["item_results"]:
        item["status"] = "partial"
        item["issues"] = [{"severity": "중대", "quote": "공식 근거", "reason": "공식 근거 미확인", "rule_ref": "R2-최신성"}]
        item["repair_instruction"] = "공식 원문 확인 필요"
    report = bot.build_report_from_data(
        run_id="weekly-test-12345678",
        spec=spec,
        reviews=reviews,
        repair_attempted=True,
        config=cfg,
    )
    assert report["summary"]["blocked"] == 7
    assert report["summary"]["needs_repair"] == 0
    assert all(item["final_status"] == "보류" for item in report["items"])


def test_repair_malformed_fallback_is_fail(bot_module, cfg):
    bot = bot_module
    spec = bot.make_dry_run_spec(cfg, bot.now_in_tz("Asia/Seoul"))
    fallback = bot.make_fallback_reviewer_result("R2", spec, "repair malformed JSON")
    assert fallback["reviewer"] == "R2"
    assert fallback["verdict"] == "fail"
    assert all(item["status"] == "fail" for item in fallback["item_results"])


def test_temp_id_duplicate_in_reviewer_falls_back_safely(bot_module, cfg):
    """검수자가 ``temp_id``를 중복으로 보내면 KeyError 대신 fallback로 안전히 처리한다.

    코덱스 P1 #1 결함 방지: 스키마는 7개를 강제하지만 ``temp_id`` 유일성은
    검사하지 않는다. 라이브 호출에서 모델이 ``콘텐츠 1``을 두 번 출력해도
    봇이 통째로 죽지 않아야 한다.
    """
    bot = bot_module
    basis = bot.now_in_tz("Asia/Seoul")
    spec = bot.make_dry_run_spec(cfg, basis)
    reviews = {r: bot.make_dry_run_review(r) for r in bot.REVIEWERS}
    # R2가 콘텐츠 1을 두 번 출력하고 콘텐츠 7을 누락한 상황을 시뮬레이션.
    reviews["R2"]["item_results"][6]["temp_id"] = "콘텐츠 1"

    report = bot.build_report_from_data(
        run_id="weekly-test-coverage",
        spec=spec,
        reviews=reviews,
        repair_attempted=False,
        config=cfg,
    )
    # KeyError 없이 7개 항목이 다 평가됐고, R2가 fallback fail로 대체돼 모두 보류.
    assert len(report["items"]) == 7
    assert report["summary"]["blocked"] == 7


def test_temp_id_missing_in_reviewer_falls_back_safely(bot_module, cfg):
    """검수자가 ``temp_id``를 누락하면 fallback로 안전히 처리한다."""
    bot = bot_module
    basis = bot.now_in_tz("Asia/Seoul")
    spec = bot.make_dry_run_spec(cfg, basis)
    reviews = {r: bot.make_dry_run_review(r) for r in bot.REVIEWERS}
    reviews["R3"]["item_results"][3]["temp_id"] = "콘텐츠 99"  # spec에 없는 ID로 변조

    report = bot.build_report_from_data(
        run_id="weekly-test-missing",
        spec=spec,
        reviews=reviews,
        repair_attempted=False,
        config=cfg,
    )
    assert len(report["items"]) == 7
    assert report["summary"]["blocked"] == 7


# ---------- 4차 검수 회귀 ----------

def test_report_header_uses_actual_item_count_not_hardcoded_seven(bot_module, cfg):
    """draft 같이 1건짜리 배치도 '7건'으로 잘못 표기되면 안 된다 (Fix N)."""
    bot = bot_module
    basis = bot.now_in_tz("Asia/Seoul")
    draft = bot.make_dry_run_draft(cfg, basis)
    reviews = {r: bot.make_dry_run_review(r, draft) for r in bot.REVIEWERS}
    report = bot.build_report_from_data(
        run_id="weekly-test-draft-md",
        spec=draft,
        reviews=reviews,
        repair_attempted=False,
        config=cfg,
    )
    md = bot.render_report_markdown(report, reviews)
    assert "## 7건 결과" not in md
    assert "## 항목 결과 (1건)" in md


def test_draft_item_markdown_has_no_indent_leakage(bot_module, cfg):
    """render_draft_item_markdown이 4-space 들여쓰기를 내보내면 안 된다 (Fix P)."""
    bot = bot_module
    basis = bot.now_in_tz("Asia/Seoul")
    draft = bot.make_dry_run_draft(cfg, basis)
    item = draft["items"][0]
    md = bot.render_draft_item_markdown(item)
    leaking = [ln for ln in md.splitlines() if ln.startswith("    ")]
    assert not leaking, f"draft markdown leaks indent: {leaking[:3]!r}"


def test_render_item_markdown_dispatches_by_shape(bot_module, cfg):
    """spec/draft item을 같은 함수가 모양으로 분기해 렌더한다."""
    bot = bot_module
    basis = bot.now_in_tz("Asia/Seoul")
    spec_item = bot.make_dry_run_spec(cfg, basis)["items"][0]
    draft_item = bot.make_dry_run_draft(cfg, basis)["items"][0]
    spec_md = bot.render_item_markdown(spec_item)
    draft_md = bot.render_item_markdown(draft_item)
    assert "분야:" in spec_md and "축값:" not in spec_md
    assert "축값:" in draft_md and "분야:" not in draft_md
