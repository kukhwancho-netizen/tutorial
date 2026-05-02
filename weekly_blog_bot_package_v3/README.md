# 주간 블로그 편성봇

법률 콘텐츠용 주간 자동 편성 파이프라인이다. 기본값은 **제작지시서 7건 생성 + R1/R2/R3 분리 검수 + 보정 1회 + 리포트 저장**이다.

## 핵심 기본값

- `run_draft_generation: false`
- `safety.no_auto_publish: true`
- dry-run은 `R1/R2/R3 = skipped`로 분리
- 보정 1회 뒤 R2가 `pass`가 아니면 자동 보류
- `run_status: aborted`도 Slack/email 알림 대상
- Calendar OAuth 실패는 단일 채널로만 알림 (이중 통보 방지)
- 대형 판례 DB 전체 inline 금지
- live run 진입 시 `validate_configured_models`가 자동 호출됨 (`model_validation.required_before_live_run`)
- OpenAI strict json_schema 비호환 키는 `schema_for_openai`가 자동 sanitize (스키마는 클라이언트 사이드 `validate_json`이 강제)
- 모델 입력 payload에는 `model_facing_config`로 정책 정보만 노출 (env var/SMTP/가격표 미노출)
- 알 수 없는 model_id의 비용은 0으로 처리하되 `usage.cost_warnings`와 stderr에 기록
- 검수 결과의 `temp_id` 중복·누락은 fallback fail로 안전 차단 (KeyError 차단)
- 최종 상태 판정은 `decision.RULES` 의사결정 표가 우선순위 순으로 처리 (`block_high_risk` 설정 존중)
- 이메일 알림은 STARTTLS와 SMTPS 두 모드 모두 지원 (`notifications.email.tls_mode: auto|starttls|smtps`)

## 패키지 구조

```
weekly_blog_bot_package_v3/
├── weekly_blog_bot.py          # 얇은 진입점 (CLI 셸 + 호환 export)
├── weekly_blog_bot/            # 핵심 패키지
│   ├── runner.py               # 파이프라인 오케스트레이터
│   ├── stages.py               # 단계별 함수 (준비→캘린더→생성→검수→보정→리포트→저장→캘린더 쓰기→알림)
│   ├── decision.py             # 최종 상태 의사결정 표 (RULES)
│   ├── reporting.py            # 리포트 빌드 + 비용 추정 + 마크다운
│   ├── budget.py               # 컨텍스트 토큰 예산 가드
│   ├── dry_run.py              # dry-run 샘플 데이터
│   ├── settings.py             # config/env/경로 로드
│   ├── domain.py               # 데이터 형식 (StageContext, UsageByModel)
│   ├── result.py               # Result 형 + abort 카테고리
│   ├── cli.py                  # 명령행 진입점
│   └── adapters/
│       ├── openai_client.py    # OpenAI Responses API + 스키마 sanitizer + 모델 검증
│       ├── calendar.py         # Google Calendar (OAuth + 이벤트)
│       └── notifications.py    # Slack + 이메일 (STARTTLS/SMTPS)
├── tests/
│   ├── unit/                   # 단위 테스트 (빠름, PR 합치기 게이트)
│   └── integration/            # 통합 테스트 (전체 흐름)
├── schemas/                    # JSON Schema 3종
├── prompts/                    # generator·R1·R2·R3·repair 프롬프트
└── config/weekly_blog_bot.yaml
```

## 설치

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

`.env`에 최소한 다음 값을 넣는다.

```text
OPENAI_API_KEY=...
GOOGLE_TOKEN_JSON=...
SLACK_WEBHOOK_URL=...
```

## 로컬 검증

```bash
python -m py_compile weekly_blog_bot.py
pytest tests/unit/ -q          # 빠른 단위 테스트
pytest tests/integration/ -q   # 통합 테스트 (dry-run 포함)
python weekly_blog_bot.py --config config/weekly_blog_bot.yaml --dry-run --no-calendar
```

실제 실행 전 모델 검증:

```bash
python weekly_blog_bot.py --config config/weekly_blog_bot.yaml --validate-models --no-calendar
```

모델 검증은 다음 두 단계를 수행한다.

1. `client.models.list()`에 config 모델 ID가 존재하는지 확인
2. 각 모델에 짧은 `responses.create` ping 호출

## 실제 실행

```bash
python weekly_blog_bot.py --config config/weekly_blog_bot.yaml
```

## GitHub Actions 운영

workflow 파일: `.github/workflows/weekly.yml`. `workflow_dispatch`와 `schedule`을 모두 지원한다. cron은 UTC 기준이다.

```yaml
# Monday 08:30 KST = Sunday 23:30 UTC
- cron: "30 23 * * 0"
```

> **주의**: GitHub Actions의 `schedule` 트리거는 부하 시간대에 15~30분(때로 더) 지연된다. "월요일 08:30 KST"는 명목상이고 실제 실행은 08:45~09:30 사이가 될 수 있다. 사람 검토 마감(`human_review.review_deadline`)은 이 지연을 고려해 정한다.

첫 실제 실행은 `workflow_dispatch`에서 `dry_run=false`로 수동 실행한다. 그 다음 주부터 cron을 켜려면 repository variable `ENABLE_WEEKLY_CRON=true`를 설정한다.

workflow 단계: checkout → 의존성 설치 → `py_compile` + 패키지 import 확인 → 단위 테스트(빠른 게이트) → 통합 테스트 → live 모드면 `--validate-models` → 실행 → `outputs/`를 artifact로 업로드(30일 보관).

R2는 web search를 보정 전후로 각각 호출한다. 즉 1주일에 R2 web search = 7건 × 최대 2회 = 14회까지. 비용은 `cost.pricing.web_search_per_1k_calls_usd` 기준으로 추정된다.

## 가격 기준

가격은 `config/weekly_blog_bot.yaml`의 `cost.pricing`에 분리되어 있다. 이 값은 **2026-05-02 기준 공식 가격표**를 운영 추정용으로 옮긴 것이다. 공식 가격표가 바뀌면 운영자가 YAML을 갱신해야 한다.

## 출력

```text
outputs/YYYY-MM-DD_weekly-..._weekly_report.json
outputs/YYYY-MM-DD_weekly-..._weekly_report.md
```

JSON에는 `report.usage`가 포함된다.

```bash
jq '.report.usage' outputs/*weekly_report.json
```

## 후속 라운드 예정 항목

- 부분 보정: 보정이 7건 전체를 재생성하는 대신 partial/fail 항목만 재생성. 현재 schema가 `minItems:7, maxItems:7`이라 부분 보정 도입 시 별도 schema 분기 필요.
- web search 인용 메타 보존: Responses API output annotations(URL/title)을 reviewer payload에 보존. 현재는 자유 텍스트만 사용.

