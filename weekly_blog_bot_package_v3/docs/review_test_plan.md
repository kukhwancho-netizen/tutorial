# 검수 분기 테스트 계획

## 목적

dry-run은 R1/R2/R3를 skipped로 두기 때문에 검수 로직 회귀를 잡지 못한다. 분기 로직은 모델 호출 없는 단위 테스트로 검증한다.

## 현재 테스트

- dry-run summary가 `dry_run_skipped=7`인지 확인
- dry-run의 모든 reviewer verdict가 `skipped`인지 확인
- 보정 뒤 R2 partial이면 최종 상태가 `보류`인지 확인
- 보정 malformed JSON fallback이면 R2 fail로 바뀌는지 확인
- context budget 초과 시 `payload_blocked` abort가 나는지 확인
- model config에서 role별 모델 ID를 정확히 읽는지 확인

## 추가 권장

- R1 fail fallback
- R3 fail fallback
- Calendar auth_error mocked alert
- Slack webhook mocked alert
