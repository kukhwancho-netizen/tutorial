"""PASS 추상화 + 명령(OrderSpec) 정의 + 명령 파서.

spec PASS와 draft PASS는 같은 파이프라인(prepare → fetch → generate → review →
repair → report)을 공유한다. 모드별로 다른 건 4가지뿐:

    스키마 / generator·reviewer·repair 프롬프트 / 결정 규칙 / 웹 검색 사용 여부

draft PASS는 부모 spec 1건에서 N개의 변주를 만든다. 변주 4종(각도/길이/후보/
버전)은 모두 한 축(axis) 위의 다른 값으로 압축된다. 봇은 어떤 축인지 알 필요
없고, (parent_spec_id, axis, value) 셋이 한 변주의 정체성이다.

명령 파서는 자유 텍스트 트리거를 OrderSpec으로 디스패치한다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from . import decision


@dataclass(frozen=True)
class BatchPass:
    name: str                              # "spec" | "draft"
    schema_name: str                       # "WeeklySpecBatch" | "WeeklyDraftBatch"
    schema_file: str                       # schemas/ 하위 파일명
    generator_prompt_file: str             # prompts/ 하위
    reviewer_prompt_files: Dict[str, str]  # {"R1": "...", "R2": "...", "R3": "..."}
    repair_prompt_file: str
    decision_rules: List[Tuple[Callable, str]]
    use_web_search: bool
    output_label: str                      # outputs/ 파일명에 박는 라벨


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

DRAFT_PASS = BatchPass(
    name="draft",
    schema_name="WeeklyDraftBatch",
    schema_file="draft_batch.schema.json",
    generator_prompt_file="11_draft_generator_system.md",
    reviewer_prompt_files={
        "R1": "23_reviewer_r1_draft.md",
        "R2": "24_reviewer_r2_draft.md",
        "R3": "25_reviewer_r3_draft.md",
    },
    repair_prompt_file="31_repair_draft_system.md",
    decision_rules=decision.DRAFT_RULES,
    use_web_search=False,
    output_label="draft",
)

PASS_BY_NAME: Dict[str, BatchPass] = {SPEC_PASS.name: SPEC_PASS, DRAFT_PASS.name: DRAFT_PASS}


@dataclass(frozen=True)
class OrderSpec:
    """명령 1건. 봇 진입점이 (mode, params)로 디스패치한다."""

    mode: str                               # "spec" | "draft"
    raw: str                                # 원본 명령 문자열 (감사용)
    # spec 모드
    channel: Optional[str] = None           # "블로그" / "홈페이지"
    distribution: Tuple[str, ...] = ()      # ("민사", "가사", "행정")
    total: int = 7
    # draft 모드
    parent_spec_id: Optional[str] = None    # "콘텐츠 3"
    axis: Optional[str] = None              # "각도" | "길이" | "후보" | "버전"
    variants: Tuple[str, ...] = ()          # ("A안", "B안", "C안") 등


def pass_for(order: OrderSpec) -> BatchPass:
    return PASS_BY_NAME[order.mode]


# ---------- 명령 파서 ----------

# spec  : "블 (민+가+행) 7 ㄱㄱ" 또는 "블 민,가,행 7"
# draft : "draft 콘텐츠 3 길이 풀+요약+핵심" 또는 "draft 콘텐츠 5 후보 A B C"
_SPEC_TRIGGER_RE = re.compile(
    r"^\s*(?P<channel>블|홈)\s*\(?(?P<dist>[\w가-힣\s,+]+?)\)?\s+(?P<total>\d+)\b",
)
_DRAFT_TRIGGER_RE = re.compile(
    r"^\s*draft\s+(?P<parent>콘텐츠\s*[1-7])\s+(?P<axis>각도|길이|후보|버전)\s+(?P<variants>.+?)\s*$",
)

_CHANNEL_LONG = {"블": "블로그", "홈": "홈페이지"}
_DOMAIN_LONG = {"민": "민사", "가": "가사", "행": "행정", "형": "형사"}


class OrderParseError(ValueError):
    """명령 문자열을 파싱할 수 없을 때."""


def parse_order(text: str) -> OrderSpec:
    """자유 텍스트 트리거 → OrderSpec.

    실패 시 OrderParseError를 던진다 — cli.main이 단일 abort 채널로 떨군다.
    """
    raw = (text or "").strip()
    if not raw:
        raise OrderParseError("empty order")

    m = _DRAFT_TRIGGER_RE.match(raw)
    if m:
        parent = re.sub(r"\s+", " ", m.group("parent")).strip()
        variants_text = m.group("variants").strip()
        # "+" 또는 공백 또는 쉼표로 분리
        variants = tuple(v for v in re.split(r"[+,\s]+", variants_text) if v)
        if not variants:
            raise OrderParseError(f"draft order without variants: {raw!r}")
        return OrderSpec(
            mode="draft",
            raw=raw,
            parent_spec_id=parent,
            axis=m.group("axis"),
            variants=variants,
        )

    m = _SPEC_TRIGGER_RE.match(raw)
    if m:
        channel = _CHANNEL_LONG[m.group("channel")]
        dist_raw = m.group("dist")
        dist_keys = [k.strip() for k in re.split(r"[+,\s]+", dist_raw) if k.strip()]
        distribution = tuple(_DOMAIN_LONG.get(k, k) for k in dist_keys)
        total = int(m.group("total"))
        if total < 1:
            raise OrderParseError(f"spec order total must be >= 1: {raw!r}")
        return OrderSpec(
            mode="spec",
            raw=raw,
            channel=channel,
            distribution=distribution,
            total=total,
        )

    raise OrderParseError(f"unrecognized order: {raw!r}")


def order_from_args(*, mode: str, parent_spec_id: Optional[str] = None,
                    axis: Optional[str] = None,
                    variants: Sequence[str] = (),
                    raw: str = "") -> OrderSpec:
    """CLI 인자로 직접 OrderSpec을 만든다 (--order 텍스트 없이 명시 인자만 줄 때)."""
    if mode == "draft":
        if not parent_spec_id or not axis or not variants:
            raise OrderParseError(
                "draft mode requires --parent-spec-id, --axis, --variants"
            )
        return OrderSpec(
            mode="draft",
            raw=raw or f"draft {parent_spec_id} {axis} {' '.join(variants)}",
            parent_spec_id=parent_spec_id,
            axis=axis,
            variants=tuple(variants),
        )
    if mode == "spec":
        return OrderSpec(mode="spec", raw=raw or "spec")
    raise OrderParseError(f"unknown mode: {mode!r}")
