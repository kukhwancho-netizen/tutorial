"""알림 어댑터 단위 테스트.

이메일 TLS 모드 결정(STARTTLS vs SMTPS) 로직을 검증한다.
코덱스 P2 #3 결함 방지: 포트 465에서 STARTTLS만 시도하던 버그가 재발하지 않게.
"""
from __future__ import annotations

from weekly_blog_bot.adapters.notifications import resolve_tls_mode


def test_tls_mode_auto_smtps_on_port_465():
    assert resolve_tls_mode({"tls_mode": "auto"}, 465) == "smtps"


def test_tls_mode_auto_starttls_on_port_587():
    assert resolve_tls_mode({"tls_mode": "auto"}, 587) == "starttls"


def test_tls_mode_auto_starttls_default_port_25():
    assert resolve_tls_mode({"tls_mode": "auto"}, 25) == "starttls"


def test_tls_mode_auto_when_unspecified():
    """tls_mode 키가 아예 없을 때도 포트로 추정 (기본값=auto)."""
    assert resolve_tls_mode({}, 465) == "smtps"
    assert resolve_tls_mode({}, 587) == "starttls"


def test_tls_mode_explicit_overrides_port():
    """명시 모드는 포트와 무관하게 적용된다."""
    assert resolve_tls_mode({"tls_mode": "smtps"}, 587) == "smtps"
    assert resolve_tls_mode({"tls_mode": "starttls"}, 465) == "starttls"
