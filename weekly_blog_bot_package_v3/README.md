# 주간 블로그 편성봇

법률 콘텐츠용 주간 자동 편성 파이프라인이다. 기본값은 **제작지시서 7건 생성 + R1/R2/R3 분리 검수 + 보정 1회 + 리포트 저장**이다. PASS 추상화로 spec(제작지시서) 모드와 draft(초안) 모드를 같은 단계 흐름이 공유한다.

## 근거 규칙 문서 (저장소 루트)

봇 코드와 프롬프트는 저장소 루트의 규칙 문서를 정본으로 따른다. 본 README는 발췌이며, 충돌 시 루트 문서가 우선한다.

| 계층 | 파일 | 봇 내 사용처 |
|---|---|---|
| L0 구조 | [`00_파이프라인_v3_최상위_구조.md`](../00_파이프라인_v3_최상위_구조.md) | 파일 존재성 계약 (§2.1) |
| L1 메타 | [`01_최우선_규칙.md`](../01_최우선_규칙.md), [`02_통합본_메타규칙.md`](../02_통합본_메타규칙.md) | 전 단계 |
| L2 실행 | [`11_파일_접근_규칙_v2_0.md`](../11_파일_접근_규칙_v2_0.md) | `settings.py` 경로/소환 규칙 |
| L3 작성 | [`20_FRWRITER_v2_7_1.md`](../20_FRWRITER_v2_7_1.md), [`22_법률상담_문체_보정_v1_1.md`](../22_법률상담_문체_보정_v1_1.md) | `prompts/10_generator_*`, `prompts/11_draft_generator_*` |
| L3 검토 | [`21_검토지침_v2_7_2.md`](../21_검토지침_v2_7_2.md), [`33_내부_검토_다면화_매트릭스.md`](../33_내부_검토_다면화_매트릭스.md) | 검토관 일반 지침 |
| L3 인스타 | [`23_옥토리타스_v3_3_1-4doc_db.md`](../23_옥토리타스_v3_3_1-4doc_db.md) | 트랙 2 (본 봇 미사용) |
| L4 검토관 | [`30_R1_규칙감사관_v2.md`](../30_R1_규칙감사관_v2.md), [`31_R2_법률검수관_v2.md`](../31_R2_법률검수관_v2.md), [`32_R3_문서검토관_v2.md`](../32_R3_문서검토관_v2.md) | `prompts/20~22_reviewer_r*_system.md` (spec), `prompts/23~25_reviewer_r*_draft.md` (draft) |
| L4 스키마 | [`34_JSON_schema_2종.md`](../34_JSON_schema_2종.md) | `schemas/spec_batch.schema.json`, `schemas/draft_batch.schema.json` |
| L5 운영 | [`40_리서처_실험_로그.md`](../40_리서처_실험_로그.md), [`41_실험_로그_v1_9_추가_항목.md`](../41_실험_로그_v1_9_추가_항목.md) | 운영 로그 |
| L7 정본 | [`52_빌더_인스트럭션_압축본.txt`](../52_빌더_인스트럭션_압축본.txt) | Custom GPT Builder Instructions |
| 데이터 | [`참조_판례_정리본.txt`](../참조_판례_정리본.txt) | 판례 RAG (벡터 스토어 권장) |

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
│   ├── runner.py               # 파이프라인 오케스트레이터 (PASS 디스패치)
│   ├── stages.py               # 단계별 함수 (준비→캘린더→생성→검수→보정→리포트→저장→캘린더 쓰기→알림)
│   ├── pass_def.py             # BatchPass 추상화 + SPEC_PASS/DRAFT_PASS + parse_order
│   ├── decision.py             # 최종 상태 의사결정 표 (SPEC_RULES/DRAFT_RULES)
│   ├── reporting.py            # 리포트 빌드 + 비용 추정 + 마크다운
│   ├── budget.py               # 컨텍스트 토큰 예산 가드
│   ├── dry_run.py              # dry-run 샘플 데이터 + reporting 순환 차단
│   ├── settings.py             # config/env/경로 로드
│   ├── domain.py               # 데이터 형식 + Result/abort 카테고리
│   ├── cli.py                  # 명령행 진입점
│   └── adapters/
│       ├── openai_client.py    # OpenAI Responses API + 스키마 sanitizer + 모델 검증
│       ├── calendar.py         # Google Calendar (OAuth + 이벤트)
│       └── notifications.py    # Slack + 이메일 (STARTTLS/SMTPS)
├── tests/
│   ├── unit/                   # 단위 테스트 (빠름, PR 합치기 게이트)
│   └── integration/            # 통합 테스트 (전체 흐름)
├── schemas/                    # spec_batch / draft_batch / reviewer_result / final_report
├── prompts/                    # spec: 10/20~22/30  draft: 11/23~25/31
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

## GitHub Actions 운영 (명령 봇 모델)

workflow 파일: `.github/workflows/weekly.yml`. **`workflow_dispatch`만 정상 경로** — cron 자동 실행은 제거됨. 운영자가 매번 명령을 내려야 1회분이 산출된다.

dispatch 입력:
- `order` — 자유 텍스트 트리거 (예: `블 (민+가+행) 7 ㄱㄱ` 또는 `draft 콘텐츠 3 길이 풀+요약+핵심`). 비우면 기본 spec 모드.
- `dry_run` — true면 API/Calendar 호출 없이 sample report만 생성.
- `no_calendar` — true면 Calendar 읽기/쓰기 비활성.

workflow 단계: checkout → 의존성 설치 → `py_compile` + 패키지 import 확인 → 단위 테스트(빠른 게이트) → 통합 테스트 → live 모드면 `--validate-models` → 실행(`--order` 인자 포함) → `outputs/`를 artifact로 업로드(30일 보관).

R2는 web search를 보정 전후로 각각 호출한다. 즉 1주일에 R2 web search = 7건 × 최대 2회 = 14회까지. 비용은 `cost.pricing.web_search_per_1k_calls_usd` 기준으로 추정된다.

## 가격 기준

가격은 `config/weekly_blog_bot.yaml`의 `cost.pricing`에 분리되어 있다. 이 값은 **2026-05-02 기준 공식 가격표**를 운영 추정용으로 옮긴 것이다. 공식 가격표가 바뀌면 운영자가 YAML을 갱신해야 한다.

## 출력

PASS 라벨이 파일명에 박힌다 (`spec` / `draft`).

```text
outputs/YYYY-MM-DD_weekly-..._spec_weekly_report.json
outputs/YYYY-MM-DD_weekly-..._spec_weekly_report.md
outputs/YYYY-MM-DD_weekly-..._draft_weekly_report.json
outputs/YYYY-MM-DD_weekly-..._draft_weekly_report.md
```

JSON에는 `report.usage`가 포함된다.

```bash
jq '.report.usage' outputs/*weekly_report.json
```

## 명령 사용 예

```bash
# spec 생성 (제작지시서 7건)
python weekly_blog_bot.py --order "블 (민+가+행) 7 ㄱㄱ"

# draft 생성 (사람이 spec 검토 후, 통과한 한 건에 대한 변주 생성)
python weekly_blog_bot.py --order "draft 콘텐츠 3 길이 풀+요약+핵심"
python weekly_blog_bot.py --order "draft 콘텐츠 5 후보 A B C"

# 명시 인자 (--order 텍스트 없이)
python weekly_blog_bot.py --mode draft --parent-spec-id "콘텐츠 2" \
    --axis 각도 --variants "증거 정리" "절차 흐름" "실패 사례"

# dry-run / 모델 사전 검증
python weekly_blog_bot.py --order "..." --dry-run
python weekly_blog_bot.py --validate-models
```

## 후속 라운드 예정 항목

- 부분 보정: 현재 spec 보정은 7건 전체를 재생성. draft 모드는 `minItems:1, maxItems:5`라 자연스럽게 부분 보정 가능. spec 측은 별도 schema 분기 필요.
- web search 인용 메타 보존: Responses API output annotations(URL/title)을 reviewer payload에 보존. 현재는 자유 텍스트만 사용.

