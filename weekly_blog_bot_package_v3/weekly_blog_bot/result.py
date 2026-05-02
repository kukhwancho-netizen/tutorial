"""결과형 + 정렬된 abort 분류.

성공/실패를 명시적인 두 갈래로 나타낸다. 호출자는 매치를 통해 둘 다 처리한다.
abort 카테고리는 알림 트리거와 1:1 대응한다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Generic, Optional, TypeVar, Union

T = TypeVar("T")

# abort 카테고리 (notifications.notify_on과 매칭).
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


Result = Union[Ok[T], Err]


class PipelineAbort(RuntimeError):
    """제어된 abort. 단일 abort 핸들러가 잡아 알림으로 변환한다."""

    def __init__(self, message: str, *, category: str = "aborted", details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        if category not in ABORT_CATEGORIES:
            # 알림 트리거 누락을 막기 위해 명시 카테고리만 허용.
            raise ValueError(f"unknown abort category: {category}")
        self.category = category
        self.details = details or {}


class CalendarAuthError(PipelineAbort):
    def __init__(self, message: str, *, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, category="auth_error", details=details)


class MalformedModelJSONError(PipelineAbort):
    def __init__(self, message: str, *, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, category="malformed_json", details=details)
