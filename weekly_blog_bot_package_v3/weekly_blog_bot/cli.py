"""명령행 진입점.

``python -m weekly_blog_bot`` 또는 ``weekly_blog_bot.py`` 셸을 통해 호출된다.
abort는 항상 abort 리포트를 시도하고, 그 자체가 실패해도 원래 원인을 stderr에 남긴다.

명령 디스패치:
- ``--order "블 (민+가+행) 7 ㄱㄱ"`` 같은 자유 텍스트 → parse_order로 OrderSpec
- ``--mode draft --parent-spec-id "콘텐츠 3" --axis 길이 --variants 풀 요약 핵심``
  처럼 명시 인자 → order_from_args로 OrderSpec
- 둘 다 없으면 기본 spec PASS
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from typing import Optional

from . import runner, stages
from .adapters.openai_client import validate_configured_models
from .pass_def import OrderSpec, order_from_args, parse_order


def _build_order(args: argparse.Namespace) -> Optional[OrderSpec]:
    if args.order:
        return parse_order(args.order)
    if args.mode:
        return order_from_args(
            mode=args.mode,
            parent_spec_id=args.parent_spec_id,
            axis=args.axis,
            variants=tuple(args.variants or ()),
        )
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
    # 명령 디스패처 인자
    parser.add_argument("--order", default=None,
                        help='자유 텍스트 트리거 (예: "블 (민+가+행) 7 ㄱㄱ" 또는 '
                             '"draft 콘텐츠 3 길이 풀+요약+핵심")')
    parser.add_argument("--mode", choices=["spec", "draft"], default=None,
                        help="명시 모드 (--order 없이 사용)")
    parser.add_argument("--parent-spec-id", default=None,
                        help="draft 모드: 부모 spec temp_id (예: '콘텐츠 3')")
    parser.add_argument("--axis", choices=["각도", "길이", "후보", "버전"], default=None,
                        help="draft 모드: 변주 축")
    parser.add_argument("--variants", nargs="+", default=None,
                        help="draft 모드: 축 위의 값 목록 (예: 풀 요약 핵심)")
    args = parser.parse_args()

    config_path = pathlib.Path(args.config).resolve()
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
