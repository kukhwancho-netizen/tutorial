# 운영 매뉴얼

## 월요일 흐름

1. 08:30 KST 자동 실행
2. 결과 리포트 확인
3. 11:00 KST까지 보류·수정 필요 건 확인
4. 15:00 KST까지 미처리 보류 건 escalate

## 알림 조건

- `blocked > 0`
- `needs_repair > 0`
- `human_gate > 0`
- `run_status=aborted`
- `auth_error`
- `payload_blocked`
- `malformed_json`
- `model_validation_failed`

## 보류 판정

아래 조건은 자동 보류다.

- high risk
- R1/R2/R3 중 fail
- 보정 1회 뒤 R2 partial/fail
- 보정 호출 malformed JSON
- 공식 원문 확인 불가 상태에서 핵심 결론 확정 필요

## dry-run의 의미

dry-run은 스모크 테스트다.

검증하는 것:
- 오케스트레이터 디스패치
- JSON Schema 로컬 검증
- 파일쓰기
- 리포트 렌더링

검증하지 않는 것:
- R1/R2/R3 모델 판단 품질
- web_search 결과 파싱
- Calendar 실제 OAuth
- OpenAI 실제 모델 호출

검수 분기 회귀는 `pytest -q`로 확인한다.
