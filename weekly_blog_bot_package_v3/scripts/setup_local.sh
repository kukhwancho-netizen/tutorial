#!/usr/bin/env bash
#
# 로컬 머신 1회 셋업 스크립트.
# 사용:  bash scripts/setup_local.sh
# (또는 chmod +x scripts/setup_local.sh && ./scripts/setup_local.sh)
#
# 무엇을 하나:
#  1) Python 3.11+ 확인
#  2) .venv 생성 (존재하면 재사용)
#  3) 의존성 설치
#  4) .env 없으면 .env.example에서 복사
#  5) 컴파일 + 단위 테스트
#  6) dry-run smoke
#
# 무엇을 안 하나:
#  - OpenAI 키 채우기 (사람이 .env 편집)
#  - Google OAuth 발급 (사람이 별도 작업)
#  - 모델 ID 검증 (--validate-models는 사람이 키 채운 뒤 별도 실행)

set -euo pipefail

cd "$(dirname "$0")/.."

green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }

# 1) Python 버전
PY=python3
if ! command -v "$PY" >/dev/null 2>&1; then
  PY=python
fi
PY_VER=$("$PY" -c "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')")
if [ "$(echo "$PY_VER < 3.11" | bc -l 2>/dev/null || echo 1)" = "1" ] && [ "$PY_VER" \< "3.11" ]; then
  red "[1/6] Python 3.11+ 필요 — 현재 $PY_VER"
  exit 1
fi
green "[1/6] Python $PY_VER OK"

# 2) venv
if [ -d .venv ]; then
  yellow "[2/6] .venv 이미 존재 — 재사용"
else
  green "[2/6] .venv 생성"
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

# 3) 의존성
green "[3/6] requirements 설치"
pip install --upgrade pip > /dev/null
pip install -r requirements.txt

# 4) .env
if [ -f .env ]; then
  yellow "[4/6] .env 이미 존재 — 그대로 둠"
else
  cp .env.example .env
  green "[4/6] .env 생성됨 — OPENAI_API_KEY 등을 채워주세요"
fi

# 5) 컴파일 + 단위 테스트
green "[5/6] 컴파일 + 단위 테스트"
python -m py_compile weekly_blog_bot.py
pytest tests/unit/ -q

# 6) dry-run smoke (API 호출 없음)
green "[6/6] dry-run smoke"
python weekly_blog_bot.py --config config/weekly_blog_bot.yaml --dry-run --no-calendar > /tmp/smoke.json
python -c "
import json
d = json.load(open('/tmp/smoke.json'))
assert d['run_status'] == 'dry_run', d
assert d['summary']['sketches'] == 7, d['summary']
print('  smoke OK — pass:', d['pass'], 'sketches:', d['summary']['sketches'])
print('  output:', d['json_path'].split('/')[-1])
"

cat <<'EOF'

────────────────────────────────────────────────────────
셋업 완료. 다음 단계:

  1) .env 편집해서 최소 OPENAI_API_KEY 채우기
       $ ${EDITOR:-nano} .env

  2) (선택) config/weekly_blog_bot.yaml의 모델 ID를 실제 사용 가능한 값으로 갱신
       grep -n 'gpt-' config/weekly_blog_bot.yaml

  3) 키 검증
       $ source .venv/bin/activate
       $ python weekly_blog_bot.py --validate-models
       → 어떤 모델 ID가 잘못됐으면 여기서 알려줌

  4) 첫 실제 spec sketch
       $ python weekly_blog_bot.py --order "블 (민+가+행) 7 ㄱㄱ" --no-calendar
       → outputs/ 디렉토리에 _spec_weekly_report.json/.md 저장됨

  5) draft → edit 사이클은 README 또는 docs/architecture.md 참조
────────────────────────────────────────────────────────
EOF
