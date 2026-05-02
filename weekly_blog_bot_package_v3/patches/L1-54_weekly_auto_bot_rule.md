# L1-54. 주간 자동 편성봇 규칙 v3

계층: L1 운영 자동화 규칙
적용: 트랙 1 블로그/홈페이지 강화형

## 1. 기본 구조

주간봇은 외부 오케스트레이터로 실행한다.

```text
스케줄러 → 생성 호출 → R1/R2/R3 분리 검수 → 보정 1회 → 최종 리포트 → 사람 승인
```

## 2. 안전 기본값

- 초안 자동 생성 금지
- 자동 발행 금지
- high risk 자동 보류
- 보정 1회 뒤 R2 partial/fail 자동 보류
- dry-run은 R1/R2/R3를 skipped로 둔다

## 3. 사전 검증

실제 실행 전 모델 ID를 `client.models.list()`와 짧은 ping 호출로 검증한다.

## 4. 알림

다음 상태는 알림 대상이다.

- blocked
- needs_repair
- human_gate
- aborted
- auth_error
- payload_blocked
- malformed_json
- model_validation_failed

## 5. 컨텍스트 예산

대형 판례 DB 전체 inline을 금지한다. `block_input_tokens` 초과 시 조용히 실패하지 않고 abort report와 알림을 남긴다.

끝.
