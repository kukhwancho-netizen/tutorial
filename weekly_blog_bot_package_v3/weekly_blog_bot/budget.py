"""컨텍스트 예산 가드.

tiktoken이 있으면 정확 측정, 없으면 한국어 비중 가중 휴리스틱.
``len(text)/4``는 영어 가정으로 한국어를 3~4배 과소 추정한다.
"""
from __future__ import annotations

import json
import sys
from typing import Any, Dict

from .result import PipelineAbort


def estimate_payload_tokens(obj: Any) -> int:
    text = json.dumps(obj, ensure_ascii=False)
    try:
        import tiktoken  # type: ignore

        try:
            enc = tiktoken.get_encoding("o200k_base")
        except Exception:
            enc = tiktoken.get_encoding("cl100k_base")
        return max(1, len(enc.encode(text)))
    except Exception:
        # CJK 1.7 토큰/char + 그 외 0.25 토큰/char.
        cjk = sum(1 for ch in text if "　" <= ch <= "鿿" or "가" <= ch <= "힯")
        ascii_ish = len(text) - cjk
        return max(1, int(cjk * 1.7 + ascii_ish * 0.25))


def enforce_context_budget(config: Dict[str, Any], payload: Dict[str, Any], stage: str) -> None:
    budget = config.get("context_budget", {})
    warn = int(budget.get("warn_input_tokens", 70_000))
    block = int(budget.get("block_input_tokens", 200_000))
    estimate = estimate_payload_tokens(payload)
    if estimate >= block:
        raise PipelineAbort(
            f"Context budget exceeded at {stage}: estimated {estimate} input tokens >= block threshold {block}.",
            category="payload_blocked",
            details={"stage": stage, "estimated_input_tokens": estimate, "block_input_tokens": block},
        )
    if estimate >= warn:
        print(
            f"[context-budget-warning] {stage}: estimated {estimate} input tokens >= warn threshold {warn}",
            file=sys.stderr,
        )
