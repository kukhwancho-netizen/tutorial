"""공용 테스트 설정.

ROOT를 sys.path에 넣고 패키지를 임포트할 수 있게 한다.
모든 테스트는 여기 정의된 ``CONFIG``, ``ROOT``, ``load_config``를 재사용한다.
"""
from __future__ import annotations

import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import weekly_blog_bot as bot  # noqa: E402

CONFIG = ROOT / "config" / "weekly_blog_bot.yaml"


@pytest.fixture
def root_path() -> pathlib.Path:
    return ROOT


@pytest.fixture
def config_path() -> pathlib.Path:
    return CONFIG


@pytest.fixture
def cfg():
    return bot.load_yaml(CONFIG)


@pytest.fixture
def bot_module():
    return bot
