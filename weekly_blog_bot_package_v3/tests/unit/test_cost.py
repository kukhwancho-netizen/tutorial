"""비용 추정 단위 테스트."""
from __future__ import annotations

import pytest


def test_estimate_cost_warns_on_unknown_model(bot_module, cfg, capsys):
    warnings: list = []
    usage = {
        "phantom-model-9.9": {
            "input_tokens": 1_000_000, "output_tokens": 1_000_000,
            "cached_input_tokens": 0, "web_search_calls": 0,
        }
    }
    cost = bot_module.estimate_cost_usd(cfg, usage, warnings=warnings)
    assert cost == 0.0
    assert warnings and "phantom-model-9.9" in warnings[0]
    captured = capsys.readouterr()
    assert "phantom-model-9.9" in captured.err


def test_estimate_cost_known_model(bot_module, cfg):
    warnings: list = []
    usage = {
        "gpt-5.4-mini": {
            "input_tokens": 1_000_000, "output_tokens": 1_000_000,
            "cached_input_tokens": 0, "web_search_calls": 0,
        }
    }
    cost = bot_module.estimate_cost_usd(cfg, usage, warnings=warnings)
    # gpt-5.4-mini: input 0.75 + output 4.50 = 5.25
    assert cost == pytest.approx(5.25, rel=1e-6)
    assert warnings == []
