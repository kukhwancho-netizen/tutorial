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
    name: str                              # "spec" | "draft" | "edit"
    schema_name: str
    schema_file: str
    generator_prompt_file: Optional[str]   # edit는 generation 없음
    reviewer_prompt_files: Dict[str, str]
    repair_prompt_file: Optional[str]
    decision_rules: List[Tuple[Callable, str]]
    use_web_search: bool
    output_label: str
    report_schema_file: str
    has_generation: bool                   # edit는 False
    has_review: bool
    has_calendar_write: bool


SPEC_PASS = BatchPass(
    name="spec",
    schema_name="WeeklySpecBatch",
    schema_file="spec_batch.schema.json",
    generator_prompt_file="10_generator_system.md",
    reviewer_prompt_files={},
    repair_prompt_file=None,
    decision_rules=decision.SPEC_RULES,
    use_web_search=True,
    output_label="spec",
    report_schema_file="sketch_report.schema.json",
    has_generation=True,
    has_review=False,
    has_calendar_write=False,
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
    decision_rules=decision.SPEC_RULES,
    use_web_search=True,
    output_label="draft",
    report_schema_file="final_report.schema.json",
    has_generation=True,
    has_review=True,
    has_calendar_write=True,
)

EDIT_PASS = BatchPass(
    name="edit",
    schema_name="WeeklyDraftBatch",
    schema_file="draft_batch.schema.json",
    generator_prompt_file=None,            # 사용자 편집을 그대로 받음 — 생성 없음
    reviewer_prompt_files={
        "R1": "23_reviewer_r1_draft.md",
        "R2": "24_reviewer_r2_draft.md",
        "R3": "25_reviewer_r3_draft.md",
    },
    repair_prompt_file="31_repair_draft_system.md",
    decision_rules=decision.SPEC_RULES,
    use_web_search=True,                   # R2 인용 검증
    output_label="edit",
    report_schema_file="final_report.schema.json",
    has_generation=False,
    has_review=True,
    has_calendar_write=True,
)

PASS_BY_NAME: Dict[str, BatchPass] = {
    SPEC_PASS.name: SPEC_PASS,
    DRAFT_PASS.name: DRAFT_PASS,
    EDIT_PASS.name: EDIT_PASS,
}


@dataclass(frozen=True)
class OrderSpec:
    """명령 1건. spec / draft / edit."""

    mode: str                               # "spec" | "draft" | "edit"
    raw: str
    # spec
    channel: Optional[str] = None
    distribution: Tuple[str, ...] = ()
    total: int = 7
    # draft
    parent_spec_id: Optional[str] = None    # "콘텐츠 3"
    axis: Optional[str] = None              # "각도" | "길이" | "후보" | "버전"
    variants: Tuple[str, ...] = ()
    # edit
    target_temp_id: Optional[str] = None    # "콘텐츠 3.풀" — 단일 변주
    source_file: Optional[str] = None       # 명시 입력 파일 (없으면 최신 자동 탐색)


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
_CHANNEL_LONG = {"블": "블로그", "홈": "홈페이지"}
_DOMAIN_LONG = {"민": "민사", "가": "가사", "행": "행정", "형": "형사"}


class OrderParseError(ValueError):
    """명령 문자열을 파싱할 수 없을 때."""


_DRAFT_TRIGGER_RE = re.compile(
    r"^\s*draft\s+(?P<parent>콘텐츠\s*[1-9][0-9]?)\s+"
    r"(?P<axis>각도|길이|후보|버전)\s+(?P<variants>.+?)\s*$",
)

# edit 콘텐츠 3.풀 [from path/to/draft.json]
_EDIT_TRIGGER_RE = re.compile(
    r"^\s*edit\s+(?P<target>콘텐츠\s*[1-9][0-9]?\.[A-Za-z0-9가-힣]+)"
    r"(?:\s+from\s+(?P<src>\S.+?))?\s*$",
)


def parse_order(text: str) -> OrderSpec:
    raw = (text or "").strip()
    if not raw:
        raise OrderParseError("empty order")
    m = _EDIT_TRIGGER_RE.match(raw)
    if m:
        target = re.sub(r"\s+", " ", m.group("target")).strip()
        return OrderSpec(
            mode="edit", raw=raw,
            target_temp_id=target,
            source_file=m.group("src"),
        )
    m = _DRAFT_TRIGGER_RE.match(raw)
    if m:
        parent = re.sub(r"\s+", " ", m.group("parent")).strip()
        variants_text = m.group("variants").strip()
        variants = tuple(v for v in re.split(r"[+,\s]+", variants_text) if v)
        if not variants:
            raise OrderParseError(f"draft order without variants: {raw!r}")
        return OrderSpec(
            mode="draft", raw=raw,
            parent_spec_id=parent, axis=m.group("axis"), variants=variants,
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


def order_from_args(*, mode: str, raw: str = "",
                    parent_spec_id: Optional[str] = None,
                    axis: Optional[str] = None,
                    variants: Tuple[str, ...] = ()) -> OrderSpec:
    """CLI 명시 인자용."""
    if mode == "spec":
        return OrderSpec(mode="spec", raw=raw or "spec")
    if mode == "draft":
        if not (parent_spec_id and axis and variants):
            raise OrderParseError("draft mode requires parent_spec_id + axis + variants")
        return OrderSpec(
            mode="draft",
            raw=raw or f"draft {parent_spec_id} {axis} {' '.join(variants)}",
            parent_spec_id=parent_spec_id, axis=axis, variants=tuple(variants),
        )
    raise OrderParseError(f"unknown mode: {mode!r}")
