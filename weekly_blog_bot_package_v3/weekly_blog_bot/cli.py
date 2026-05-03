"""명령행 진입점.

``python -m weekly_blog_bot`` 또는 ``weekly_blog_bot.py`` 셸을 통해 호출된다.
abort는 항상 abort 리포트를 시도하고, 그 자체가 실패해도 원래 원인을 stderr에 남긴다.

본 라운드는 spec PASS만 지원한다. ``--order``는 자유 텍스트 트리거를 받지만
draft 트리거는 명시적으로 거부된다 (parse_order에서 OrderParseError).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from typing import Optional

from . import runner, stages
from .adapters.openai_client import validate_configured_models
from .pass_def import OrderSpec, parse_order, pass_for


def _build_order(args: argparse.Namespace) -> Optional[OrderSpec]:
    if args.order:
        return parse_order(args.order)
    return None


def _pass_label_from_order(order: Optional[OrderSpec]) -> Optional[str]:
    """abort 파일명용 라벨. order가 없으면 spec(기본)."""
    if order is None:
        return "spec"
    try:
        return pass_for(order).output_label
    except Exception:
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="주간 블로그 자동 생성·검수 봇")
    parser.add_argument("--config", default="config/weekly_blog_bot.yaml", help="config yaml path")
    parser.add_argument("--dry-run", action="store_true", help="API 호출 없이 샘플 리포트 생성")
    parser.add_argument("--no-calendar", action="store_true", help="Calendar 읽기/쓰기 비활성화")
    parser.add_argument("--validate-models", action="store_true",
                        help="client.models.list() + 짧은 ping으로 설정 모델 검증")
    parser.add_argument("--skip-model-ping", action="store_true",
                        help="models.list 검증만 수행하고 ping 생략")
    parser.add_argument("--order", default=None,
                        help='자유 텍스트 트리거 (예: "블 (민+가+행) 7 ㄱㄱ"). 본 라운드는 spec만 허용.')
    args = parser.parse_args()

    config_path = pathlib.Path(args.config).resolve()
    order: Optional[OrderSpec] = None
    try:
        if args.validate_models:
            result = validate_configured_models(config_path, ping=not args.skip_model_ping)
        else:
            order = _build_order(args)
            result = runner.run(
                config_path,
                dry_run=args.dry_run,
                no_calendar=args.no_calendar,
                order=order,
            )
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as exc:
        try:
            abort_result = stages.write_abort_report(
                config_path, exc, pass_label=_pass_label_from_order(order)
            )
            print(json.dumps(abort_result, ensure_ascii=False, indent=2), file=sys.stderr)
        except Exception as report_exc:
            print(
                json.dumps(
                    {
                        "run_status": "aborted",
                        "abort_report_failed": True,
                        "original_error": {
                            "category": getattr(exc, "category", "aborted"),
                            "message": str(exc),
                        },
                        "abort_report_error": str(report_exc),
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                file=sys.stderr,
            )
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
