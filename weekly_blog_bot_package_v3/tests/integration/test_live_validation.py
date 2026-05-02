"""live run 진입 시 모델 검증 자동 호출 통합 테스트."""
from __future__ import annotations

import pytest


def test_live_run_auto_calls_model_validation(monkeypatch, bot_module, config_path):
    """live run 진입 시 model_validation이 자동 호출되는지 확인한다."""
    from weekly_blog_bot import stages
    from weekly_blog_bot.adapters import openai_client

    bot = bot_module
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(openai_client, "OpenAI", object)
    called = {"n": 0}

    def fake_validate(_path, ping=True):
        called["n"] += 1
        raise bot.PipelineAbort("validation triggered", category="model_validation_failed")

    monkeypatch.setattr(stages, "validate_configured_models", fake_validate)

    with pytest.raises(bot.PipelineAbort) as ei:
        bot.run(config_path, dry_run=False, no_calendar=True)
    assert called["n"] == 1
    assert ei.value.category == "model_validation_failed"
