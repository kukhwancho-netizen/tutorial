# 아키텍처

## 흐름

```text
GitHub Actions / cron (Sunday 23:30 UTC = Monday 08:30 KST)
  ↓
weekly_blog_bot.py (얇은 진입점)
  ↓
weekly_blog_bot.cli.main()
  ↓
weekly_blog_bot.runner.run()
  ↓ stage_prepare           (env + config + paths + run_id)
  ↓ stage_dry_run             OR     stage_validate_models_if_required
  ↓                                  stage_fetch_calendar
  ↓                                  stage_generate_spec
  ↓                                  stage_review        (R1/R2/R3)
  ↓                                  stage_repair_if_needed (최대 1회)
  ↓ stage_build_report      (decision matrix 적용 + temp_id 검증)
  ↓ stage_persist           (JSON + Markdown to outputs/)
  ↓ stage_write_calendar    (live만)
  ↓ stage_notify            (blocked/needs_repair/human_gate/aborted/...)
  ↓
abort 시 → cli.main()의 except → stages.write_abort_report()
```

## 모듈 책임 분리

| 모듈 | 책임 |
|---|---|
| `runner` | 단계 순서 보장. 비즈니스 로직 없음. |
| `stages` | 각 단계 함수. 외부 호출은 adapters에 위임. |
| `decision` | 최종 상태 의사결정 표 (`RULES`). 우선순위 순. |
| `reporting` | 리포트 빌드 + 비용 추정 + 마크다운 렌더 + temp_id 검증. |
| `budget` | tiktoken/CJK 휴리스틱 토큰 추정 + 컨텍스트 예산 가드. |
| `dry_run` | dry-run 샘플 데이터 + fallback reviewer 빌더. |
| `settings` | config/env/경로 로드, 모델 ID 결정, 모델 facing config. |
| `domain` | StageContext, UsageByModel, ModelCallResult. |
| `result` | Result/Ok/Err + abort 카테고리. |
| `cli` | argparse + abort 핸들러. |
| `adapters/openai_client` | Responses API 호출, 스키마 sanitizer, 모델 검증. |
| `adapters/calendar` | Google Calendar OAuth + 이벤트 검색·쓰기. |
| `adapters/notifications` | Slack + 이메일 (STARTTLS/SMTPS 모두 지원). |

## 설계 고정값

- 생성과 검수는 분리 호출한다.
- R1/R3는 기본적으로 `gpt-5.4-mini`로 낮춘다.
- R2는 최신성·법률 리스크 때문에 `gpt-5.5`를 유지한다.
- dry-run은 검수 verdict를 `skipped`로 둔다.
- 검수 분기 회귀는 `tests/unit/test_decision_matrix.py`가 담당한다.
- `temp_id` 중복·누락 방어는 `reporting._coverage_check_or_fix()`가 담당한다.

## 실패 모드

| 실패 모드 | 처리 | 알림 카테고리 |
|---|---|---|
| model_not_found | `--validate-models` 사전 차단 | `model_validation_failed` |
| Calendar OAuth 실패 | abort. 단일 채널 알림. | `auth_error` |
| 컨텍스트 토큰 초과 | `enforce_context_budget`이 abort | `payload_blocked` |
| 생성 JSON malformed | abort report 후 알림 | `malformed_json` |
| 검수 JSON malformed | 해당 reviewer fail fallback | (보고서에 batch_issues로 표시) |
| 보정 JSON malformed | R2 fail fallback → 자동 보류 | (보고서에 표시) |
| 보정 뒤 R2 partial/fail | 자동 보류 (decision matrix 규칙) | `blocked` |
| 검수 결과 temp_id 중복/누락 | 해당 reviewer fail fallback (KeyError 차단) | (보고서에 표시) |
| `block_high_risk=true`이고 risk=high | 자동 보류 | `blocked` |
| `block_high_risk=false`이고 risk=high | human_gate 흐름으로 (다른 결함이 없으면 통과 가능) | `human_gate` |

## 의사결정 표

`decision.RULES` (우선순위 순):

1. 모든 검수자 status가 `skipped` → `검수 생략(dry-run)`
2. `block_high_risk=true`이고 `risk_level == "high"` → `보류`
3. `item.status == "blocked"` → `보류`
4. 어떤 검수자라도 `fail` → `보류`
5. 보정 시도됐고 R2가 `pass`가 아님 → `보류`
6. `partial`이 하나라도 있거나 사람 게이트 켜짐 → `수정 필요`
7. 그 외 → `통과`
