"""환경변수·config·경로를 한곳에서 정리.

코드 곳곳에 흩어진 ``os.getenv``, ``config.get(...)`` 호출을 줄이는 단일 진입점.
첫 실행 때 누락된 필수 값을 즉시 알려준다.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
from dataclasses import dataclass
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

import yaml
from dotenv import load_dotenv


REVIEWERS = ("R1", "R2", "R3")
SCOPES = ("https://www.googleapis.com/auth/calendar",)


@dataclass(frozen=True)
class Paths:
    root: pathlib.Path
    config: pathlib.Path
    prompts: pathlib.Path
    schemas: pathlib.Path
    outputs: pathlib.Path


def load_yaml(path: pathlib.Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_text(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def load_json(path: pathlib.Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: pathlib.Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def now_in_tz(tz_name: str) -> dt.datetime:
    return dt.datetime.now(ZoneInfo(tz_name))


def iso(dt_obj: dt.datetime) -> str:
    return dt_obj.isoformat(timespec="seconds")


def make_paths(config_path: pathlib.Path, config: Optional[Dict[str, Any]] = None) -> Paths:
    root = config_path.parent.parent.resolve()
    output_dir = (config or {}).get("outputs", {}).get("directory", "outputs")
    return Paths(
        root=root,
        config=config_path,
        prompts=root / "prompts",
        schemas=root / "schemas",
        outputs=root / output_dir,
    )


def load_environment() -> None:
    """``.env`` 파일이 있으면 로드한다."""
    load_dotenv()


def model_ids_from_config(config: Dict[str, Any]) -> Dict[str, str]:
    """config + 환경변수 오버라이드를 합쳐 모델 ID 사전을 돌려준다."""
    models_cfg = config.get("openai", {}).get("models", {})
    reviewers = models_cfg.get("reviewers", {})
    return {
        "generator": os.getenv("OPENAI_MODEL_GENERATOR", models_cfg.get("generator", "gpt-5.5")),
        "repair": os.getenv("OPENAI_MODEL_REPAIR", models_cfg.get("repair", models_cfg.get("generator", "gpt-5.5"))),
        "report": os.getenv("OPENAI_MODEL_REPORT", models_cfg.get("report", "gpt-5.4-mini")),
        "R1": os.getenv("OPENAI_MODEL_REVIEWER_R1", reviewers.get("R1", models_cfg.get("reviewer", "gpt-5.4-mini"))),
        "R2": os.getenv("OPENAI_MODEL_REVIEWER_R2", reviewers.get("R2", models_cfg.get("reviewer", "gpt-5.5"))),
        "R3": os.getenv("OPENAI_MODEL_REVIEWER_R3", reviewers.get("R3", models_cfg.get("reviewer", "gpt-5.4-mini"))),
    }


def resolve_reviewer_model(config: Dict[str, Any], reviewer: str) -> str:
    return model_ids_from_config(config)[reviewer]


def model_facing_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """모델 호출 payload에 노출할 안전한 부분집합. cost/notifications/env 키 제외."""
    return {
        "order": config.get("order", {}),
        "review": {
            "reviewers": config.get("review", {}).get("reviewers", []),
            "max_repair_rounds": config.get("review", {}).get("max_repair_rounds", 1),
            "block_high_risk": config.get("review", {}).get("block_high_risk", True),
            "require_human_approval_for": config.get("review", {}).get("require_human_approval_for", []),
        },
        "knowledge": config.get("knowledge", {}),
        "safety": config.get("safety", {}),
        "human_review": {
            "review_deadline": config.get("human_review", {}).get("review_deadline"),
            "escalation_deadline": config.get("human_review", {}).get("escalation_deadline"),
        },
        "timezone": config.get("timezone"),
    }
