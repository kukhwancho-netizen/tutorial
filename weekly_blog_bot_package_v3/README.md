# 주간 블로그 편성봇 (sketch · draft · edit)

법률 콘텐츠용 주간 자동 편성 파이프라인. 압력을 적재적소에 분배하는 3-PASS 명령 봇.

| PASS | 명령 | 무엇을 만드나 | 검수 | 캘린더 기록 |
|---|---|---|---|---|
| **spec** | `블 (민+가+행) 7 ㄱㄱ` | 토픽 스케치 N건 (4필드: temp_id, channel, topic, risk_hint) | 없음 (DB가 중복 거름) | 없음 |
| **draft** | `draft 콘텐츠 3 길이 풀+요약+핵심` | 부모 스케치 1건 → 본문 변주 N건 (lede + body_paragraphs + claims) | R1/R2/R3 + 1회 보정 | 있음 |
| **edit** | `edit 콘텐츠 3.풀 [from PATH]` | 사용자가 편집한 draft를 R1/R2/R3 다시 (생성 없음) | R1/R2/R3 + 1회 보정 | 있음 |

비용·시간이 가장 많이 드는 곳(draft 본문 + edit 재검수)에 봇 자원이 가장 많이 들어가고, 메타 압력은 spec에서 빠진다.

## 근거 규칙 문서 (저장소 루트)

| 계층 | 파일 | 봇 내 사용처 |
|---|---|---|
| L0 구조 | [`00_파이프라인_v3_최상위_구조.md`](../00_파이프라인_v3_최상위_구조.md) | 파일 존재성 계약 |
| L1 메타 | [`01_최우선_규칙.md`](../01_최우선_규칙.md), [`02_통합본_메타규칙.md`](../02_통합본_메타규칙.md) | 전 단계 |
| L2 실행 | [`11_파일_접근_규칙_v2_0.md`](../11_파일_접근_규칙_v2_0.md) | DB 소환 / 경로 |
| L3 작성 | [`20_FRWRITER_v2_7_1.md`](../20_FRWRITER_v2_7_1.md), [`22_법률상담_문체_보정_v1_1.md`](../22_법률상담_문체_보정_v1_1.md) | `prompts/10_*` (spec), `prompts/11_*` (draft) |
| L3 검토 | [`21_검토지침_v2_7_2.md`](../21_검토지침_v2_7_2.md), [`33_내부_검토_다면화_매트릭스.md`](../33_내부_검토_다면화_매트릭스.md) | reviewer 일반 지침 |
| L4 검토관 | [`30_R1_규칙감사관_v2.md`](../30_R1_규칙감사관_v2.md), [`31_R2_법률검수관_v2.md`](../31_R2_법률검수관_v2.md), [`32_R3_문서검토관_v2.md`](../32_R3_문서검토관_v2.md) | `prompts/23~25_reviewer_*_draft.md` |
| L4 스키마 | [`34_JSON_schema_2종.md`](../34_JSON_schema_2종.md) | `schemas/spec_batch.schema.json`, `schemas/draft_batch.schema.json`, `schemas/sketch_report.schema.json`, `schemas/final_report.schema.json` |
| 데이터 | [`참조_판례_정리본.txt`](../참조_판례_정리본.txt) | 판례 RAG (벡터 스토어 권장) |

## 핵심 기본값

- spec은 토픽만 — 메타 필드(`must_include`, `outline`, `keyword_strategy`, `claims` 등) 없음.
- 토픽 중복은 `calendar_context.events.completed_topic_db` + `performance_snapshot`가 자동으로 거름.
- draft 검수 후 R2가 `pass`가 아니면 자동 보류 (decision matrix).
- `safety.no_auto_publish: true` — 봇은 발행 안 함.
- 알 수 없는 model_id 비용은 0으로 처리 + `usage.cost_warnings` + stderr.
- `temp_id` 중복·누락은 fallback fail (KeyError 차단).
- 이메일 알림 STARTTLS / SMTPS 양 모드.

## 패키지 구조

```
weekly_blog_bot_package_v3/
├── weekly_blog_bot.py              # 얇은 진입점
├── weekly_blog_bot/
│   ├── runner.py                   # PASS capability 디스패치
│   ├── stages.py                   # 단계 함수
│   ├── pass_def.py                 # BatchPass(SPEC/DRAFT/EDIT) + OrderSpec + parse_order
│   ├── decision.py                 # 의사결정 표
│   ├── reporting.py                # sketch report / draft report / 마크다운
│   ├── budget.py                   # 컨텍스트 토큰 예산
│   ├── dry_run.py                  # 샘플 데이터
│   ├── settings.py                 # config / env / 경로
│   ├── domain.py                   # 데이터 형식 + Result/abort
│   ├── cli.py                      # argparse + 단일 abort 채널
│   └── adapters/
│       ├── openai_client.py
│       ├── calendar.py
│       └── notifications.py
├── tests/
│   ├── unit/
│   └── integration/
├── schemas/
│   ├── spec_batch.schema.json      # 슬림 (4필드)
│   ├── draft_batch.schema.json     # 본문 + claims + tone_profile
│   ├── reviewer_result.schema.json # spec/draft 양 모드 호환 패턴
│   ├── sketch_report.schema.json   # spec 결과
│   └── final_report.schema.json    # draft/edit 결과 (error 옵셔널)
├── prompts/
│   ├── 10_generator_system.md      # spec 토픽 스케치
│   ├── 11_draft_generator_system.md # draft 본문
│   ├── 23~25_reviewer_*_draft.md   # R1/R2/R3 (draft·edit 공용)
│   ├── 30_repair_system.md         # 옛 spec 보정 (현재 미사용, draft repair는 31_*)
│   ├── 31_repair_draft_system.md   # draft·edit 보정
│   └── 90_manual_run_prompt.md
└── config/weekly_blog_bot.yaml
```

## 명령 사용 예

```bash
# 1) 주간 토픽 스케치
python weekly_blog_bot.py --order "블 (민+가+행) 7 ㄱㄱ"
# → outputs/2026-05-03_..._spec_weekly_report.json/.md

# 2) 사람이 spec 검토 후, 통과한 한 건의 본문 변주 생성
python weekly_blog_bot.py --order "draft 콘텐츠 3 길이 풀+요약+핵심"
# → outputs/2026-05-03_..._draft_weekly_report.json/.md

# 3) 사람이 _draft_weekly_report.json의 body_paragraphs 등을 편집한 뒤 재검수
python weekly_blog_bot.py --order "edit 콘텐츠 3.풀"
# → outputs/2026-05-03_..._edit_weekly_report.json/.md

# 명시 source 파일 지정 (선택)
python weekly_blog_bot.py --order "edit 콘텐츠 3.풀 from outputs/my_edit.json"

# dry-run (샘플 데이터, API 호출 없음)
python weekly_blog_bot.py --order "..." --dry-run --no-calendar

# 모델 사전 검증
python weekly_blog_bot.py --validate-models
```

## 설치

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

`.env`:

```text
OPENAI_API_KEY=...
GOOGLE_TOKEN_JSON=...
SLACK_WEBHOOK_URL=...
```

## 로컬 검증

```bash
python -m py_compile weekly_blog_bot.py
pytest tests/unit/ -q
pytest tests/integration/ -q
python weekly_blog_bot.py --config config/weekly_blog_bot.yaml --dry-run --no-calendar
```

## GitHub Actions 운영 (명령 봇)

`.github/workflows/weekly.yml`. **`workflow_dispatch`만 정상 경로** (cron 자동 실행 없음).

dispatch 입력:
- `order` — 자유 텍스트 트리거 (3 PASS 모두 지원). 비우면 YAML의 `order.trigger_text`로 spec.
- `dry_run` — true면 샘플 흐름 검증.
- `no_calendar` — Calendar 호출 비활성.

## 출력 라벨

```text
outputs/YYYY-MM-DD_weekly-..._spec_weekly_report.json/.md
outputs/YYYY-MM-DD_weekly-..._draft_weekly_report.json/.md
outputs/YYYY-MM-DD_weekly-..._edit_weekly_report.json/.md
outputs/YYYY-MM-DD_weekly-..._{spec|draft|edit}_abort_report.json/.md
```

## 비용 모델

```bash
jq '.report.usage' outputs/*weekly_report.json
```

가격 기준은 `config/weekly_blog_bot.yaml`의 `cost.pricing` (운영자가 갱신).

## 후속 라운드 어젠다

- BatchPass에 stage 단계별 콜백(payload_builder, dry_run_builder 등) 도입 — 새 PASS 추가 시 stages 직접 수정 없이 끝나도록.
- `ctx.spec` / `ctx.spec_schema` 이름을 `ctx.batch` / `ctx.batch_schema`로 정리 (단일 PASS 가정 잔재 제거).
- web search 인용 메타(URL/title) 보존 → R2 evidence에 포함.
- edit 모드의 변주 1건 단위 재검수: 현재는 batch 전체를 다시 본다. fail/partial 변주만 골라서 재검수하면 비용 절감.
