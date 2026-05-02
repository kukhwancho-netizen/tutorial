"""도메인 데이터 형식 + Result/abort 분류.

런타임에 이리저리 흘러다니는 자료 구조와 단일 abort 채널 분류를 한곳에 모은다.
JSON Schema는 schemas/에 두고 검증은 jsonschema가 한다 — 여기는 타입 힌트용.
abort 카테고리는 알림 트리거(notify_on)와 1:1 대응한다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union

T = TypeVar("T")


@dataclass
class ModelCallResult:
    data: Dict[str, Any]
    usage: Dict[str, int]


@dataclass
class UsageByModel:
    """모델 ID별 누적 토큰·웹 검색 호출 사용량."""

    by_model: Dict[str, Dict[str, int]] = field(default_factory=dict)

    def add(self, model_id: str, usage: Dict[str, int]) -> None:
        existing = self.by_model.setdefault(
            model_id,
            {"input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0, "web_search_calls": 0},
        )
        for key, value in usage.items():
            existing[key] = int(existing.get(key, 0)) + int(value or 0)


@dataclass
class StageContext:
    """파이프라인 단계 사이를 흐르는 누적 상태."""

    config: Dict[str, Any]
    config_path: Any  # pathlib.Path; 순환 의존 피하려고 Any
    paths: Any  # weekly_blog_bot.settings.Paths
    basis: Any  # datetime
    run_id: str
    dry_run: bool
    no_calendar: bool
    usage: UsageByModel = field(default_factory=UsageByModel)
    spec_schema: Optional[Dict[str, Any]] = None
    reviewer_schema: Optional[Dict[str, Any]] = None
    report_schema: Optional[Dict[str, Any]] = None
    calendar_context: Optional[Dict[str, Any]] = None
    spec: Optional[Dict[str, Any]] = None
    reviews: Optional[Dict[str, Dict[str, Any]]] = None
    repair_attempted: bool = False
    report: Optional[Dict[str, Any]] = None
    markdown: Optional[str] = None
    json_path: Any = None
    md_path: Any = None
    calendar_event_id: Optional[str] = None
    notes: List[str] = field(default_factory=list)


# ---------- Result + abort 카테고리 (옛 result.py에서 흡수) ----------

ABORT_CATEGORIES = {
    "aborted",
    "auth_error",
    "openai_error",
    "calendar_error",
    "malformed_json",
    "payload_blocked",
    "model_validation_failed",
}


@dataclass(frozen=True)
class Ok(Generic[T]):
    value: T

    @property
    def is_ok(self) -> bool:
        return True


@dataclass(frozen=True)
class Err:
    category: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_ok(self) -> bool:
        return False


Result = Union["Ok[T]", "Err"]


class PipelineAbort(RuntimeError):
    """제어된 abort. 단일 abort 핸들러가 잡아 알림으로 변환한다."""

    def __init__(self, message: str, *, category: str = "aborted",
                 details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        if category not in ABORT_CATEGORIES:
            raise ValueError(f"unknown abort category: {category}")
        self.category = category
        self.details = details or {}


class CalendarAuthError(PipelineAbort):
    def __init__(self, message: str, *, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, category="auth_error", details=details)


class MalformedModelJSONError(PipelineAbort):
    def __init__(self, message: str, *, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, category="malformed_json", details=details)
