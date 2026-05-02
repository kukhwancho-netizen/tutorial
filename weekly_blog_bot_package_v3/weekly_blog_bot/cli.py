"""명령행 진입점.

``python -m weekly_blog_bot`` 또는 ``weekly_blog_bot.py`` 셸을 통해 호출된다.
abort는 항상 abort 리포트를 시도하고, 그 자체가 실패해도 원래 원인을 stderr에 남긴다.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

from . import runner, stages
from .adapters.openai_client import validate_configured_models


def main() -> None:
    parser = argparse.ArgumentParser(description="주간 블로그 자동 생성·검수 봇")
    parser.add_argument("--config", default="config/weekly_blog_bot.yaml", help="config yaml path")
    parser.add_argument("--dry-run", action="store_true", help="API 호출 없이 샘플 리포트 생성")
    parser.add_argument("--no-calendar", action="store_true", help="Calendar 읽기/쓰기 비활성화")
    parser.add_argument("--validate-models", action="store_true", help="client.models.list() + 짧은 ping으로 설정 모델 검증")
    parser.add_argument("--skip-model-ping", action="store_true", help="models.list 검증만 수행하고 ping 생략")
    args = parser.parse_args()

    config_path = pathlib.Path(args.config).resolve()
    try:
        if args.validate_models:
            result = validate_configured_models(config_path, ping=not args.skip_model_ping)
        else:
            result = runner.run(config_path, dry_run=args.dry_run, no_calendar=args.no_calendar)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as exc:
        # write_abort_report 자체 실패에도 원래 abort 원인이 stderr에 남도록 감싼다.
        try:
            abort_result = stages.write_abort_report(config_path, exc)
            print(json.dumps(abort_result, ensure_ascii=False, indent=2), file=sys.stderr)
        except Exception as report_exc:
            print(
                json.dumps(
                    {
                        "run_status": "aborted",
                        "abort_report_failed": True,
                        "original_error": {"category": getattr(exc, "category", "aborted"), "message": str(exc)},
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
