#!/usr/bin/env python3
"""주간 블로그 편성봇 — 얇은 진입점.

실제 로직은 ``weekly_blog_bot/`` 패키지에 있다. 이 파일은 기존 명령행/워크플로우
호출(``python weekly_blog_bot.py ...``)만 유지한다.

기본 역할:
- 블로그 7건 제작지시서 생성
- R1/R2/R3 분리 검수
- 보정 1회
- 통과/수정/보류/검수 생략 리포트 저장

안전 기본값:
- run_draft_generation=false
- no_auto_publish=true
- dry-run은 R1/R2/R3를 skipped로 둔다

호환:
- ``import weekly_blog_bot as bot``로 부르는 경우 패키지 디렉터리가 우선되며,
  공개 심볼은 ``weekly_blog_bot/__init__.py``가 노출한다.
- 이 파일은 ``__main__`` 진입에만 의미가 있다.
"""
from __future__ import annotations

import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from weekly_blog_bot.cli import main  # noqa: E402


if __name__ == "__main__":
    main()
