# 아키텍처

## 3-PASS 명령 봇

세 가지 명령이 같은 파이프라인 골격을 공유하지만, PASS의 capability flag(`has_generation` / `has_review` / `has_calendar_write`)로 단계가 켜지고 꺼진다.

```text
GitHub Actions workflow_dispatch (운영자 수동 트리거 — cron 없음)
  ↓
weekly_blog_bot.py → cli.main() → runner.run(order)
  ↓
  pass_for(order) ∈ { SPEC_PASS, DRAFT_PASS, EDIT_PASS }
  ↓
  stage_prepare
    ├─ spec   : (sketch 스키마 로드, no parent, no source)
    ├─ draft  : + parent_spec_item 디스크 로드 (outputs/*_spec_*.json)
    └─ edit   : + 기존 draft batch 디스크 로드 (target_temp_id 매칭)
  ↓
  if dry_run: stage_dry_run (PASS별 샘플)
  else:
    stage_validate_models_if_required        (생성/검수 PASS만)
    stage_fetch_calendar                     (spec, draft만 — edit는 스킵)
    if pass_.has_generation: stage_generate  (edit는 스킵 — 사용자 편집 그대로)
    if pass_.has_review:
      stage_review              (R1/R2/R3 순차)
      stage_repair_if_needed    (1회 보정)
  ↓
  stage_build_report  (sketch_report or final_report)
  stage_persist       (outputs/_{spec|draft|edit}_weekly_report.{json,md})
  if pass_.has_calendar_write: stage_write_calendar
  stage_notify
  ↓
  abort 시: cli except → stages.write_abort_report (pass_label 라벨 박힘)
```

## PASS별 capability

| PASS | has_generation | has_review | has_calendar_write | output_label | report_schema |
|---|:---:|:---:|:---:|---|---|
| SPEC | ✓ | ✗ | ✗ | spec | sketch_report.schema |
| DRAFT | ✓ | ✓ | ✓ | draft | final_report.schema |
| EDIT | ✗ | ✓ | ✓ | edit | final_report.schema |

## 모듈 책임 분리

| 모듈 | 책임 |
|---|---|
| `runner` | PASS capability 디스패치. 단계 순서 보장. |
| `stages` | 단계 함수. 외부 호출은 adapters에 위임. parent_spec/draft 로더 포함. |
| `pass_def` | BatchPass(spec/draft/edit) 정의. OrderSpec dataclass. parse_order. |
| `decision` | 최종 상태 의사결정 표 (`RULES`/`SPEC_RULES`). |
| `reporting` | sketch report / draft·edit final report. 마크다운 렌더 (spec sketch / draft 변주 분리). |
| `budget` | tiktoken/CJK 휴리스틱 토큰 추정 + 컨텍스트 예산 가드. |
| `dry_run` | spec sketch + draft 변주 샘플 + fallback reviewer 빌더. |
| `settings` | config/env/경로 로드, 모델 ID 결정, model_facing config. |
| `domain` | StageContext, UsageByModel, ModelCallResult, Result, abort 카테고리. |
| `cli` | argparse(`--order` + `--dry-run`/`--no-calendar`/`--validate-models`) + abort 핸들러. |
| `adapters/openai_client` | Responses API + 스키마 sanitizer + 모델 검증. |
| `adapters/calendar` | Google Calendar OAuth + 이벤트 쓰기. |
| `adapters/notifications` | Slack + 이메일 (STARTTLS/SMTPS). |

## 의사결정 표 (decision.RULES — draft·edit에 적용)

위에서부터 첫 매치 적용:

1. 모든 검수자 status가 `skipped` → `검수 생략(dry-run)`
2. `block_high_risk=true`이고 `risk_level=high` → `보류`
3. `item.status=blocked` → `보류`
4. 어떤 검수자라도 `fail` → `보류`
5. 보정 시도 후 R2가 `pass`가 아님 → `보류`
6. `partial`이 하나라도 있거나 사람 게이트 켜짐 → `수정 필요`
7. 그 외 → `통과`

## abort 카테고리

| 카테고리 | 발생 |
|---|---|
| `aborted` | 일반 (parent_spec/draft 로드 실패 포함) |
| `auth_error` | Calendar OAuth 등 |
| `openai_error` | OpenAI API 호출 실패 |
| `calendar_error` | 캘린더 일반 |
| `malformed_json` | 응답 JSON 파싱/스키마 실패 |
| `payload_blocked` | 컨텍스트 예산 초과 |
| `model_validation_failed` | `--validate-models` 사전 검사 실패 |

각 카테고리는 알림 트리거(`notify_on`)와 1:1 대응. abort 파일명에 `pass_label`이 박혀 spec/draft/edit이 동시각에 abort해도 구분 가능.

## 사용자 편집 루프 (핵심 운영 패턴)

```
spec 명령
  ↓ outputs/_spec_weekly_report.{json,md}  (4필드 토픽 N건)
사람: spec.md 읽고 어느 토픽으로 갈지 결정
  ↓
draft 콘텐츠 N <axis> <variants>
  ↓ outputs/_draft_weekly_report.{json,md}  (본문 변주 N건 + R1/R2/R3 + 보정)
사람: draft.json의 body_paragraphs/lede/title 편집 (반복 가능)
  ↓
edit 콘텐츠 N.X
  ↓ outputs/_edit_weekly_report.{json,md}  (편집본 R1/R2/R3 + 보정)
사람: edit 결과 보고 다시 편집 → 또 edit  (사이클)
  ↓
사람이 만족 → 발행
```

압력 분배: spec은 가볍고(메타·검수 0), draft는 본문 생성 비용이 들지만 1회, edit는 검수만 (생성 비용 0). 사람 손이 가장 자주 닿는 곳에 비용이 가장 적게 든다.
