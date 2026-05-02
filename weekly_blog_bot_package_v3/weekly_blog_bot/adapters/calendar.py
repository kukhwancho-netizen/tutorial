"""Google Calendar 어댑터.

OAuth 토큰 갱신 + 이벤트 검색/쓰기. 인증 실패는 ``CalendarAuthError``로 변환.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import sys
from typing import Any, Dict

from ..result import CalendarAuthError, PipelineAbort
from ..settings import SCOPES, iso


def get_google_calendar_service() -> Any:
    try:
        from google.auth.exceptions import RefreshError
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except Exception as exc:  # pragma: no cover
        raise CalendarAuthError(f"Google Calendar packages are unavailable: {exc}") from exc

    creds = None
    token_json = os.getenv("GOOGLE_TOKEN_JSON", "").strip()
    token_file = os.getenv("GOOGLE_TOKEN_FILE", "token.json").strip()
    client_secret_json = os.getenv("GOOGLE_CLIENT_SECRET_JSON", "").strip()
    client_secret_file = os.getenv("GOOGLE_CLIENT_SECRET_FILE", "client_secret.json").strip()

    try:
        if token_json:
            creds = Credentials.from_authorized_user_info(json.loads(token_json), list(SCOPES))
        elif token_file and pathlib.Path(token_file).exists():
            creds = Credentials.from_authorized_user_file(token_file, list(SCOPES))

        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())

        if not creds or not creds.valid:
            ci_mode = os.getenv("GITHUB_ACTIONS", "").lower() == "true"
            if ci_mode:
                raise CalendarAuthError(
                    "Google Calendar token is missing/invalid in CI. "
                    "Refresh GOOGLE_TOKEN_JSON or re-authorize OAuth.",
                    details={"token_present": bool(token_json), "token_file": token_file},
                )
            if client_secret_json:
                secret_path = pathlib.Path(".client_secret_from_env.json")
                secret_path.write_text(client_secret_json, encoding="utf-8")
                flow = InstalledAppFlow.from_client_secrets_file(str(secret_path), list(SCOPES))
            elif client_secret_file and pathlib.Path(client_secret_file).exists():
                flow = InstalledAppFlow.from_client_secrets_file(client_secret_file, list(SCOPES))
            else:
                raise CalendarAuthError(
                    "Google Calendar credentials not found. "
                    "Set GOOGLE_TOKEN_JSON, or provide client secret for first OAuth login."
                )
            creds = flow.run_local_server(port=0)
            if token_file:
                pathlib.Path(token_file).write_text(creds.to_json(), encoding="utf-8")

        return build("calendar", "v3", credentials=creds)
    except CalendarAuthError:
        raise
    except RefreshError as exc:
        raise CalendarAuthError(
            "Google Calendar refresh token failed. Re-authorize GOOGLE_TOKEN_JSON.",
            details={"error": str(exc)},
        ) from exc
    except Exception as exc:
        raise CalendarAuthError(f"Google Calendar authorization failed: {exc}") from exc


def fetch_calendar_context(config: Dict[str, Any], basis: dt.datetime) -> Dict[str, Any]:
    cal_cfg = config.get("calendar", {})
    if not cal_cfg.get("enabled", False):
        return {"enabled": False, "events": {}, "note": "calendar disabled"}

    try:
        from googleapiclient.errors import HttpError
    except Exception:  # pragma: no cover
        HttpError = Exception  # type: ignore

    service = get_google_calendar_service()
    calendar_id = cal_cfg.get("calendar_id", "primary")
    context_days = int(cal_cfg.get("context_days", 90))
    time_min = iso(basis - dt.timedelta(days=context_days))
    time_max = iso(basis + dt.timedelta(days=1))

    events_by_label: Dict[str, Any] = {}
    for label, q in cal_cfg.get("query_terms", {}).items():
        try:
            result = service.events().list(
                calendarId=calendar_id,
                q=q,
                timeMin=time_min,
                timeMax=time_max,
                maxResults=int(cal_cfg.get("max_results_per_query", 50)),
                singleEvents=True,
                orderBy="startTime",
            ).execute()
        except HttpError as exc:
            status = getattr(getattr(exc, "resp", None), "status", None)
            if status in {401, 403}:
                raise CalendarAuthError(
                    f"calendar.events.list auth error for query '{label}' ({status}). "
                    "Refresh OAuth token or permissions.",
                    details={"query_label": label, "status": status},
                ) from exc
            raise PipelineAbort(
                f"calendar.events.list failed for query '{label}': {exc}",
                category="calendar_error",
            ) from exc
        except Exception as exc:
            raise PipelineAbort(
                f"calendar.events.list failed for query '{label}': {exc}",
                category="calendar_error",
            ) from exc
        items = result.get("items", [])
        events_by_label[label] = [
            {
                "id": e.get("id"),
                "summary": e.get("summary"),
                "start": e.get("start"),
                "end": e.get("end"),
                "description": (e.get("description") or "")[: int(cal_cfg.get("max_description_chars", 4000))],
            }
            for e in items
        ]

    return {
        "enabled": True,
        "calendar_id": calendar_id,
        "window": {"time_min": time_min, "time_max": time_max},
        "events": events_by_label,
    }


def write_calendar_result(config: Dict[str, Any], basis: dt.datetime, markdown: str):
    cal_cfg = config.get("calendar", {})
    out_cfg = config.get("outputs", {})
    if not cal_cfg.get("enabled", False) or not out_cfg.get("create_calendar_event", False):
        return None
    if not cal_cfg.get("write_result_event", False):
        return None

    service = get_google_calendar_service()
    calendar_id = cal_cfg.get("calendar_id", "primary")
    start = basis.replace(hour=9, minute=0, second=0, microsecond=0)
    duration = int(cal_cfg.get("result_event_duration_minutes", 30))
    end = start + dt.timedelta(minutes=duration)
    prefix = cal_cfg.get("result_event_prefix", "[주간봇결과]")

    event = {
        "summary": f"{prefix} {basis.strftime('%Y-%m-%d')} 블로그 7건",
        "description": markdown[: int(cal_cfg.get("result_event_description_chars", 12000))],
        "start": {"dateTime": iso(start), "timeZone": config.get("timezone", "Asia/Seoul")},
        "end": {"dateTime": iso(end), "timeZone": config.get("timezone", "Asia/Seoul")},
    }
    created = service.events().insert(calendarId=calendar_id, body=event).execute()
    return created.get("id")
