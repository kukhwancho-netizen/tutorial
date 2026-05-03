"""PASS 인터페이스 + 명령(OrderSpec) 정의 + 명령 파서.

본 라운드는 spec PASS 1개만 노출한다. draft 등 다른 PASS는 다음 라운드에서
구조적으로 다시 들어온다 — 이번 라운드의 stages/reporting는 PASS 1개를 가정한
형태로 단순화되어 있다.

명령 파서는 자유 텍스트 트리거를 OrderSpec(mode='spec')로 변환한다. draft
형식의 트리거는 명시적으로 거부한다 (조용한 실패 방지).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple

from . import decision


@dataclass(frozen=True)
class BatchPass:
    name: str                              # "spec"
    schema_name: str                       # "WeeklySpecBatch"
    schema_file: str                       # schemas/ 하위 파일명
    generator_prompt_file: str             # prompts/ 하위
    reviewer_prompt_files: Dict[str, str]  # {"R1": "...", ...}
    repair_prompt_file: str
    decision_rules: List[Tuple[Callable, str]]
    use_web_search: bool
    output_label: str


SPEC_PASS = BatchPass(
    name="spec",
    schema_name="WeeklySpecBatch",
    schema_file="spec_batch.schema.json",
    generator_prompt_file="10_generator_system.md",
    reviewer_prompt_files={
        "R1": "20_reviewer_r1_system.md",
        "R2": "21_reviewer_r2_system.md",
        "R3": "22_reviewer_r3_system.md",
    },
    repair_prompt_file="30_repair_system.md",
    decision_rules=decision.SPEC_RULES,
    use_web_search=True,
    output_label="spec",
)

PASS_BY_NAME: Dict[str, BatchPass] = {SPEC_PASS.name: SPEC_PASS}


@dataclass(frozen=True)
class OrderSpec:
    """명령 1건. 본 라운드는 spec 모드만 지원한다."""

    mode: str                               # "spec"
    raw: str
    channel: Optional[str] = None
    distribution: Tuple[str, ...] = ()
    total: int = 7


def pass_for(order: OrderSpec) -> BatchPass:
    if order.mode not in PASS_BY_NAME:
        raise OrderParseError(
            f"mode {order.mode!r} not supported in this round; only 'spec' is wired"
        )
    return PASS_BY_NAME[order.mode]


# ---------- 명령 파서 ----------

# spec : "블 (민+가+행) 7 ㄱㄱ" 또는 "블 민,가,행 7"
_SPEC_TRIGGER_RE = re.compile(
    r"^\s*(?P<channel>블|홈)\s*\(?(?P<dist>[\w가-힣\s,+]+?)\)?\s+(?P<total>\d+)\b",
)
# draft 트리거는 본 라운드에서 명시적으로 거부 (조용한 spec 폴백 방지)
_DRAFT_TRIGGER_PREFIX = re.compile(r"^\s*draft\b")

_CHANNEL_LONG = {"블": "블로그", "홈": "홈페이지"}
_DOMAIN_LONG = {"민": "민사", "가": "가사", "행": "행정", "형": "형사"}


class OrderParseError(ValueError):
    """명령 문자열을 파싱할 수 없을 때."""


def parse_order(text: str) -> OrderSpec:
    raw = (text or "").strip()
    if not raw:
        raise OrderParseError("empty order")
    if _DRAFT_TRIGGER_PREFIX.match(raw):
        raise OrderParseError(
            "draft mode not supported in this round; defer to next phase"
        )
    m = _SPEC_TRIGGER_RE.match(raw)
    if not m:
        raise OrderParseError(f"unrecognized order: {raw!r}")
    channel = _CHANNEL_LONG[m.group("channel")]
    dist_keys = [k.strip() for k in re.split(r"[+,\s]+", m.group("dist")) if k.strip()]
    distribution = tuple(_DOMAIN_LONG.get(k, k) for k in dist_keys)
    total = int(m.group("total"))
    if total < 1:
        raise OrderParseError(f"spec order total must be >= 1: {raw!r}")
    return OrderSpec(
        mode="spec", raw=raw, channel=channel,
        distribution=distribution, total=total,
    )


def order_from_args(*, mode: str, raw: str = "", **_unused) -> OrderSpec:
    """CLI --mode 인자용. 본 라운드는 spec 외 거부."""
    if mode != "spec":
        raise OrderParseError(f"mode {mode!r} not supported in this round")
    return OrderSpec(mode="spec", raw=raw or "spec")
