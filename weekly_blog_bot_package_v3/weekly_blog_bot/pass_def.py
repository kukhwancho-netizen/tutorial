"""PASS 인터페이스 + 명령(OrderSpec) 정의 + 명령 파서 + PASS-별 콜백.

세 가지 PASS:
- spec  : 토픽 sketch (검수·캘린더 없음)
- draft : 부모 sketch → 본문 변주 (R1/R2/R3 + 보정 + 캘린더)
- edit  : 사용자 편집된 draft 재검수 (생성 없음, R1/R2/R3 + 보정 + 캘린더)

stages 모듈은 PASS 종류를 모른다. 모든 분기 동작은 BatchPass의 콜백/플래그로
결정된다. 새 PASS 추가 = BatchPass 인스턴스 1개 등록.
"""
from __future__ import annotations

import datetime as dt
import pathlib
import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

from . import decision
from . import dry_run as dry_run_mod
from . import reporting


# ---------- BatchPass 인터페이스 ----------

@dataclass(frozen=True)
class BatchPass:
    """한 PASS의 정적 정체성. capability flags + 단계별 콜백.

    새 PASS 추가 시 손대야 할 곳 (hidden coupling 주의):
    1. BatchPass 인스턴스 등록 + PASS_BY_NAME에 추가.
    2. OrderSpec에 mode-별 필드 추가 (필요시).
    3. parse_order에 mode-별 정규식·디스패치 추가.
    4. OrderSpec.to_payload_dict에 mode-별 분기 추가.
    5. dry_run_factory / prepare_hook / report_builder / markdown_renderer /
       summary_formatter 함수 작성 (필요한 것만).

    PASS-별 계약:
    - prepare_hook: stage_prepare에서 live(not dry_run) 진입 시 호출. ctx를
      변형한다. has_generation=False인 PASS는 prepare_hook이 ctx.batch를
      직접 set해서 generator를 대체하는 의미를 갖는다 (EDIT_PASS의 경우).
      ctx.batch가 set되면 stage_prepare가 즉시 schema 검증한다.
    - dry_run_factory: (config, basis, order) → batch dict. order를 반영해
      샘플 모양을 결정한다 (None이면 PASS 기본).
    - report_builder: (run_id, batch, reviews, repair_attempted,
      usage_by_model, dry_run, config) → report dict. 통일 키워드. sketch
      builder는 reviews/repair_attempted를 무시한다.
    - markdown_renderer: (report, reviews) → str. sketch는 reviews 무시.
    - summary_formatter: report.summary dict → 알림 본문 한 줄.
    """

    name: str
    schema_name: str
    schema_file: str
    generator_prompt_file: Optional[str]
    reviewer_prompt_files: Dict[str, str]
    repair_prompt_file: Optional[str]
    decision_rules: List[Tuple[Callable, str]]
    use_web_search: bool
    output_label: str
    report_schema_file: str
    report_schema_name: str          # 검증 라벨 (오류 메시지용 — 실제 schema title과 일치해야 한다)
    # capability flags
    has_generation: bool
    has_review: bool
    has_calendar_write: bool
    fetches_calendar: bool
    # 단계 콜백 (위 docstring의 계약 참조)
    prepare_hook: Optional[Callable[[Any], None]]
    dry_run_factory: Callable[[Dict[str, Any], dt.datetime, Optional[Any]], Dict[str, Any]]
    report_builder: Callable[..., Dict[str, Any]]
    markdown_renderer: Callable[[Dict[str, Any], Optional[Dict[str, Any]]], str]
    summary_formatter: Callable[[Dict[str, Any]], str]


# ---------- prepare_hook 구현 (PASS-별 디스크 로딩) ----------

def _load_json(path: pathlib.Path) -> Dict[str, Any]:
    """순환 import 회피용 로컬 헬퍼 — settings.load_json와 동일 동작."""
    import json
    return json.loads(path.read_text(encoding="utf-8"))


def _draft_prepare_hook(ctx: Any) -> None:
    """draft live: outputs/의 가장 최근 spec 출력에서 parent_spec_id 항목 로드."""
    if ctx.dry_run or ctx.order is None:
        return
    from .domain import PipelineAbort
    parent_spec_id = ctx.order.parent_spec_id
    outputs_dir = ctx.paths.outputs
    if not parent_spec_id:
        raise PipelineAbort("draft order missing parent_spec_id", category="aborted")
    candidates = sorted(outputs_dir.glob("*_spec_weekly_report.json"), reverse=True)
    if not candidates:
        raise PipelineAbort(
            f"draft mode requires a prior spec output; none found in {outputs_dir}",
            category="aborted",
            details={"parent_spec_id": parent_spec_id, "outputs_dir": str(outputs_dir)},
        )
    latest = candidates[0]
    data = _load_json(latest)
    parent_batch = data.get("batch") or {}
    for item in parent_batch.get("items", []):
        if item.get("temp_id") == parent_spec_id:
            ctx.payload_extras["parent_spec_item"] = item
            return
    raise PipelineAbort(
        f"parent_spec_id {parent_spec_id!r} not found in {latest.name}",
        category="aborted",
        details={"parent_spec_id": parent_spec_id, "source_file": str(latest)},
    )


def _edit_prepare_hook(ctx: Any) -> None:
    """edit live: target_temp_id를 포함한 draft batch를 ctx.batch로 로드."""
    if ctx.dry_run or ctx.order is None:
        return
    from .domain import PipelineAbort
    target_temp_id = ctx.order.target_temp_id
    source_file = ctx.order.source_file
    outputs_dir = ctx.paths.outputs
    if not target_temp_id:
        raise PipelineAbort("edit order missing target_temp_id", category="aborted")
    if source_file:
        path = pathlib.Path(source_file)
        if not path.exists():
            raise PipelineAbort(
                f"edit source file not found: {source_file}",
                category="aborted",
                details={"target_temp_id": target_temp_id, "source_file": source_file},
            )
        candidates = [path]
    else:
        candidates = sorted(
            list(outputs_dir.glob("*_draft_weekly_report.json"))
            + list(outputs_dir.glob("*_edit_weekly_report.json")),
            reverse=True,
        )
        if not candidates:
            raise PipelineAbort(
                f"edit needs a prior draft/edit output; none found in {outputs_dir}",
                category="aborted",
                details={"target_temp_id": target_temp_id, "outputs_dir": str(outputs_dir)},
            )
    for path in candidates:
        data = _load_json(path)
        batch = data.get("batch") or {}
        for item in batch.get("items", []):
            if item.get("temp_id") == target_temp_id:
                ctx.batch = batch
                return
    raise PipelineAbort(
        f"target_temp_id {target_temp_id!r} not found in any candidate output",
        category="aborted",
        details={"target_temp_id": target_temp_id,
                 "scanned": [str(c) for c in candidates[:5]]},
    )


# ---------- summary_formatter (PASS-별 알림 본문) ----------

def _spec_summary_format(s: Dict[str, Any]) -> str:
    return f"sketches={s.get('sketches')} / high_risk_hint={s.get('high_risk_hint')}"


def _full_summary_format(s: Dict[str, Any]) -> str:
    return (
        f"통과={s.get('publish_candidates')} / 수정={s.get('needs_repair')} "
        f"/ 보류={s.get('blocked')} / 사람확인={s.get('human_gate')}"
    )


# ---------- PASS 인스턴스 ----------

SPEC_PASS = BatchPass(
    name="spec",
    schema_name="WeeklySpecBatch",
    schema_file="spec_batch.schema.json",
    generator_prompt_file="10_generator_system.md",
    reviewer_prompt_files={},
    repair_prompt_file=None,
    decision_rules=decision.RULES,
    use_web_search=True,
    output_label="spec",
    report_schema_file="sketch_report.schema.json",
    report_schema_name="WeeklySketchReport",
    has_generation=True,
    has_review=False,
    has_calendar_write=False,
    fetches_calendar=True,
    prepare_hook=None,
    dry_run_factory=dry_run_mod.make_dry_run_spec,
    report_builder=reporting.build_sketch_report_from_data,
    markdown_renderer=reporting.render_sketch_report_markdown,
    summary_formatter=_spec_summary_format,
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
    decision_rules=decision.RULES,
    use_web_search=True,
    output_label="draft",
    report_schema_file="final_report.schema.json",
    report_schema_name="WeeklyFinalReport",
    has_generation=True,
    has_review=True,
    has_calendar_write=True,
    fetches_calendar=True,
    prepare_hook=_draft_prepare_hook,
    dry_run_factory=dry_run_mod.make_dry_run_draft,
    report_builder=reporting.build_report_from_data,
    markdown_renderer=reporting.render_report_markdown,
    summary_formatter=_full_summary_format,
)

EDIT_PASS = BatchPass(
    name="edit",
    schema_name="WeeklyDraftBatch",
    schema_file="draft_batch.schema.json",
    generator_prompt_file=None,
    reviewer_prompt_files={
        "R1": "23_reviewer_r1_draft.md",
        "R2": "24_reviewer_r2_draft.md",
        "R3": "25_reviewer_r3_draft.md",
    },
    repair_prompt_file="31_repair_draft_system.md",
    decision_rules=decision.RULES,
    use_web_search=True,
    output_label="edit",
    report_schema_file="final_report.schema.json",
    report_schema_name="WeeklyFinalReport",
    has_generation=False,
    has_review=True,
    has_calendar_write=True,
    fetches_calendar=False,                    # edit는 캘린더 컨텍스트 불필요 (이미 본문 존재)
    prepare_hook=_edit_prepare_hook,
    dry_run_factory=dry_run_mod.make_dry_run_draft,  # edit dry-run은 draft 샘플 재사용
    report_builder=reporting.build_report_from_data,
    markdown_renderer=reporting.render_report_markdown,
    summary_formatter=_full_summary_format,
)

PASS_BY_NAME: Dict[str, BatchPass] = {
    SPEC_PASS.name: SPEC_PASS,
    DRAFT_PASS.name: DRAFT_PASS,
    EDIT_PASS.name: EDIT_PASS,
}


# ---------- OrderSpec ----------

@dataclass(frozen=True)
class OrderSpec:
    """명령 1건. 모드별로 의미 있는 필드가 다른 tagged union."""

    mode: str
    raw: str
    # spec
    channel: Optional[str] = None
    distribution: Tuple[str, ...] = ()
    total: int = 7
    # draft
    parent_spec_id: Optional[str] = None
    axis: Optional[str] = None
    variants: Tuple[str, ...] = ()
    # edit
    target_temp_id: Optional[str] = None
    source_file: Optional[str] = None

    def to_payload_dict(self, *, default_trigger: str) -> Dict[str, Any]:
        """generator/repair 페이로드의 'order' 필드를 만든다.

        모드별 분기는 OrderSpec 안에 둠 (intrinsic to tagged union).
        """
        base: Dict[str, Any] = {
            "trigger_text": default_trigger,
            "mode": self.mode,
            "raw": self.raw,
        }
        if self.mode == "spec":
            base.update({
                "channel": self.channel,
                "distribution": list(self.distribution),
                "total": self.total,
            })
        elif self.mode == "draft":
            base.update({
                "parent_spec_id": self.parent_spec_id,
                "axis": self.axis,
                "variants": list(self.variants),
            })
        elif self.mode == "edit":
            base.update({
                "target_temp_id": self.target_temp_id,
                "source_file": self.source_file,
            })
        return base


def pass_for(order: OrderSpec) -> BatchPass:
    if order.mode not in PASS_BY_NAME:
        raise OrderParseError(f"unknown mode: {order.mode!r}")
    return PASS_BY_NAME[order.mode]


# ---------- 명령 파서 ----------

# spec  : "블 (민+가+행) 7 ㄱㄱ" 또는 "블 민,가,행 7"
# draft : "draft 콘텐츠 3 길이 풀+요약+핵심"
# edit  : "edit 콘텐츠 3.풀 [from PATH]"
_SPEC_TRIGGER_RE = re.compile(
    r"^\s*(?P<channel>블|홈)\s*\(?(?P<dist>[\w가-힣\s,+]+?)\)?\s+(?P<total>\d+)\b",
)
_DRAFT_TRIGGER_RE = re.compile(
    r"^\s*draft\s+(?P<parent>콘텐츠\s*[1-9][0-9]?)\s+"
    r"(?P<axis>각도|길이|후보|버전)\s+(?P<variants>.+?)\s*$",
)
_EDIT_TRIGGER_RE = re.compile(
    r"^\s*edit\s+(?P<target>콘텐츠\s*[1-9][0-9]?\.[A-Za-z0-9가-힣]+)"
    r"(?:\s+from\s+(?P<src>\S.+?))?\s*$",
)

_CHANNEL_LONG = {"블": "블로그", "홈": "홈페이지"}
_DOMAIN_LONG = {"민": "민사", "가": "가사", "행": "행정", "형": "형사"}


class OrderParseError(ValueError):
    """명령 문자열을 파싱할 수 없을 때."""


def parse_order(text: str) -> OrderSpec:
    raw = (text or "").strip()
    if not raw:
        raise OrderParseError("empty order")

    m = _EDIT_TRIGGER_RE.match(raw)
    if m:
        target = re.sub(r"\s+", " ", m.group("target")).strip()
        return OrderSpec(
            mode="edit", raw=raw,
            target_temp_id=target, source_file=m.group("src"),
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
                    variants: Tuple[str, ...] = (),
                    target_temp_id: Optional[str] = None,
                    source_file: Optional[str] = None) -> OrderSpec:
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
    if mode == "edit":
        if not target_temp_id:
            raise OrderParseError("edit mode requires target_temp_id")
        return OrderSpec(
            mode="edit",
            raw=raw or f"edit {target_temp_id}" + (f" from {source_file}" if source_file else ""),
            target_temp_id=target_temp_id, source_file=source_file,
        )
    raise OrderParseError(f"unknown mode: {mode!r}")
