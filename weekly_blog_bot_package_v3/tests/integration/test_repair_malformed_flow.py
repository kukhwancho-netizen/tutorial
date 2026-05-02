"""보정 단계 malformed JSON 시 종단 흐름 가드.

R2가 partial을 내고 → 보정이 깨진 JSON을 돌려준 경우, 봇이 통째로 죽지 않고
7건이 모두 자동 보류로 마무리되는지 검증한다.

직접 OpenAI를 부르는 대신, ``call_openai_json``을 monkeypatch해서 단계마다
원하는 응답을 주입한다.
"""
from __future__ import annotations

from typing import Any, Dict


def test_repair_malformed_results_in_all_blocked(monkeypatch, bot_module, cfg, root_path, tmp_path):
    """모의 OpenAI: 생성=정상, R2=partial, 보정=malformed → 7건 보류로 종결."""
    bot = bot_module
    from weekly_blog_bot import stages
    from weekly_blog_bot.adapters import openai_client
    from weekly_blog_bot.domain import ModelCallResult

    # tmp_path에 schemas/prompts 심볼릭 링크 + outputs 격리.
    (tmp_path / "config").mkdir(parents=True, exist_ok=True)
    for name in ("schemas", "prompts"):
        (tmp_path / name).symlink_to(root_path / name, target_is_directory=True)

    cfg["calendar"]["enabled"] = False
    cfg["outputs"]["create_calendar_event"] = False
    cfg["notifications"]["enabled"] = False
    cfg["model_validation"]["required_before_live_run"] = False  # 모델 ping 우회
    cfg_path = tmp_path / "config" / "weekly_blog_bot.yaml"
    cfg_path.write_text(__import__("yaml").safe_dump(cfg, allow_unicode=True), encoding="utf-8")

    # 가짜 OpenAI 클라이언트.
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    class _FakeClient:
        pass

    monkeypatch.setattr(openai_client, "OpenAI", _FakeClient)

    # 호출 카운터로 단계별 응답을 라우팅한다.
    call_log = {"by_schema": []}

    basis = bot.now_in_tz(cfg.get("timezone", "Asia/Seoul"))
    spec = bot.make_dry_run_spec(cfg, basis)

    def fake_call_openai_json(*, client, model, instructions, payload, schema, schema_name, max_output_tokens, use_web_search=False):
        call_log["by_schema"].append(schema_name)
        if schema_name == "WeeklySpecBatch":
            # 첫 호출은 generator: 정상 spec.
            # 이후 호출은 repair: malformed로 던진다.
            if call_log["by_schema"].count("WeeklySpecBatch") == 1:
                return ModelCallResult(
                    data=spec,
                    usage={"input_tokens": 100, "output_tokens": 100, "cached_input_tokens": 0, "web_search_calls": 0},
                )
            raise bot.MalformedModelJSONError("simulated repair malformed JSON")
        if schema_name == "ReviewerResult":
            # R1=pass, R2=partial(보정 트리거), R3=pass 순서로 응답.
            count = call_log["by_schema"].count("ReviewerResult")
            reviewer = ["R1", "R2", "R3"][(count - 1) % 3]
            review = bot.make_dry_run_review(reviewer)
            if reviewer == "R2":
                review["verdict"] = "partial"
                for item in review["item_results"]:
                    item["status"] = "partial"
                    item["issues"] = [{
                        "severity": "중대", "quote": "공식 근거",
                        "reason": "공식 근거 미확인", "rule_ref": "R2-최신성",
                    }]
                    item["repair_instruction"] = "공식 원문 확인 필요"
            else:
                review["verdict"] = "pass"
                for item in review["item_results"]:
                    item["status"] = "pass"
                    item["repair_instruction"] = "해당 없음 [pass]"
            return ModelCallResult(
                data=review,
                usage={"input_tokens": 50, "output_tokens": 50, "cached_input_tokens": 0, "web_search_calls": 0},
            )
        raise AssertionError(f"unexpected schema_name: {schema_name}")

    # stages 모듈이 import한 함수 위치를 monkeypatch.
    monkeypatch.setattr(stages, "call_openai_json", fake_call_openai_json)

    # live run.
    result = bot.run(cfg_path, dry_run=False, no_calendar=True)

    # 봇이 죽지 않고 끝났고 (run_status=completed), 7건 모두 보류.
    assert result["run_status"] == "completed"
    assert result["summary"]["blocked"] == 7
    assert result["summary"]["needs_repair"] == 0
    assert result["summary"]["publish_candidates"] == 0

    # 호출 흐름이 예상대로 진행됐는지 확인:
    # 1) 생성 (WeeklySpecBatch) × 1
    # 2) 검수 (ReviewerResult) × 3
    # 3) 보정 (WeeklySpecBatch) × 1 ← 여기서 malformed가 던져진다.
    spec_calls = call_log["by_schema"].count("WeeklySpecBatch")
    reviewer_calls = call_log["by_schema"].count("ReviewerResult")
    assert spec_calls == 2, f"generator + repair = 2 (got {spec_calls})"
    assert reviewer_calls == 3, f"R1/R2/R3 = 3 (got {reviewer_calls})"
