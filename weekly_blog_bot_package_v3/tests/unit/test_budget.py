"""컨텍스트 예산·토큰 추정 단위 테스트."""
from __future__ import annotations

import pytest


def test_context_budget_blocks_payload(bot_module, cfg):
    cfg["context_budget"]["block_input_tokens"] = 10
    with pytest.raises(bot_module.PipelineAbort) as ei:
        bot_module.enforce_context_budget(cfg, {"x": "a" * 1000}, "test")
    assert ei.value.category == "payload_blocked"


def test_estimate_payload_tokens_korean_outweighs_ascii(bot_module):
    """한국어가 ASCII보다 char당 토큰 비용이 큰지 확인."""
    korean = bot_module.estimate_payload_tokens({"t": "법" * 1000})
    ascii_ = bot_module.estimate_payload_tokens({"t": "a" * 1000})
    assert korean > ascii_, f"korean={korean} should be > ascii={ascii_}"
