"""설정·model ID·model facing config 단위 테스트."""
from __future__ import annotations

import json


def test_model_ids_from_config(bot_module, cfg):
    ids = bot_module.model_ids_from_config(cfg)
    assert ids["generator"] == "gpt-5.5"
    assert ids["repair"] == "gpt-5.4"
    assert ids["R1"] == "gpt-5.4-mini"
    assert ids["R2"] == "gpt-5.5"
    assert ids["R3"] == "gpt-5.4-mini"


def test_model_facing_config_strips_sensitive_keys(bot_module, cfg):
    facing = bot_module.model_facing_config(cfg)
    facing_str = json.dumps(facing, ensure_ascii=False)
    for forbidden in (
        "SLACK_WEBHOOK_URL", "SMTP_PASSWORD", "ALERT_EMAIL_TO",
        "input_per_1m_usd", "slack_webhook_env",
    ):
        assert forbidden not in facing_str, f"{forbidden} should not appear in model-facing config"
    assert facing["safety"]["no_auto_publish"] is True
    assert facing["review"]["block_high_risk"] is True
