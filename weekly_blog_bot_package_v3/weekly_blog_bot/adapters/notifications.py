"""Slack + 이메일 알림.

이메일은 STARTTLS(587 등)와 SMTPS(465 등) 두 모드를 모두 지원한다.
모드는 config의 ``notifications.email.tls_mode`` 또는 포트 번호로 결정한다.
"""
from __future__ import annotations

import json
import os
import smtplib
import ssl
import sys
import urllib.request
from email.message import EmailMessage
from typing import Any, Dict, Iterable, List


def _slack_send(slack_url: str, title: str, body: str) -> None:
    data = json.dumps({"text": f"*{title}*\n{body}"}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        slack_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310 - user-provided webhook
        resp.read()


def resolve_tls_mode(email_cfg: Dict[str, Any], port: int) -> str:
    """tls_mode가 명시 안 됐으면 포트로 추정.

    tls_mode 값:
    - "starttls" — 평문 연결 후 starttls (보통 포트 587/25)
    - "smtps"    — 처음부터 SSL/TLS (보통 포트 465)
    - "auto"     — 포트 465이면 smtps, 그 외 starttls
    """
    mode = (email_cfg.get("tls_mode") or "auto").lower()
    if mode == "auto":
        return "smtps" if port == 465 else "starttls"
    return mode


def _email_send(email_cfg: Dict[str, Any], title: str, body: str) -> None:
    host = os.getenv(email_cfg.get("smtp_host_env", "SMTP_HOST"), "")
    port = int(os.getenv(email_cfg.get("smtp_port_env", "SMTP_PORT"), "587"))
    username = os.getenv(email_cfg.get("smtp_user_env", "SMTP_USER"), "")
    password = os.getenv(email_cfg.get("smtp_password_env", "SMTP_PASSWORD"), "")
    sender = os.getenv(email_cfg.get("from_env", "ALERT_EMAIL_FROM"), username)
    recipients = [
        x.strip()
        for x in os.getenv(email_cfg.get("to_env", "ALERT_EMAIL_TO"), "").split(",")
        if x.strip()
    ]
    if not host or not sender or not recipients:
        raise RuntimeError("email notification missing SMTP_HOST/from/to")

    tls_mode = resolve_tls_mode(email_cfg, port)
    msg = EmailMessage()
    msg["Subject"] = title
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    msg.set_content(body)
    context = ssl.create_default_context()

    if tls_mode == "smtps":
        with smtplib.SMTP_SSL(host, port, timeout=10, context=context) as server:
            if username:
                server.login(username, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.starttls(context=context)
            if username:
                server.login(username, password)
            server.send_message(msg)


def notification_events_from_report(report: Dict[str, Any]) -> List[str]:
    """리포트 요약 기준으로 발생한 알림 이벤트 분류 목록을 돌려준다."""
    summary = report.get("summary", {})
    events: List[str] = []
    if report.get("run_status") == "aborted":
        events.append("aborted")
    if int(summary.get("blocked", 0)) > 0:
        events.append("blocked")
    if int(summary.get("needs_repair", 0)) > 0:
        events.append("needs_repair")
    if int(summary.get("human_gate", 0)) > 0:
        events.append("human_gate")
    return events


def should_notify(config: Dict[str, Any], events: Iterable[str]) -> bool:
    notif_cfg = config.get("notifications", {})
    if not notif_cfg.get("enabled", False):
        return False
    notify_on = set(notif_cfg.get("notify_on", []))
    return any(event in notify_on for event in events)


def send_notification(config: Dict[str, Any], *, title: str, body: str, events: Iterable[str]) -> None:
    if not should_notify(config, events):
        return
    notif_cfg = config.get("notifications", {})
    errors: List[str] = []

    slack_env = notif_cfg.get("slack_webhook_env", "SLACK_WEBHOOK_URL")
    slack_url = os.getenv(slack_env, "").strip()
    if slack_url:
        try:
            _slack_send(slack_url, title, body)
        except Exception as exc:  # pragma: no cover
            errors.append(f"slack: {exc}")

    email_cfg = notif_cfg.get("email", {})
    if email_cfg.get("enabled", False):
        try:
            _email_send(email_cfg, title, body)
        except Exception as exc:  # pragma: no cover
            errors.append(f"email: {exc}")

    if errors:
        print("[notification-errors] " + "; ".join(errors), file=sys.stderr)
