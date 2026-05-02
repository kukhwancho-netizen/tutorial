# 모델·비용 운영 노트

## OpenAI 모델 ID

2026-05-02 기준 운영 config는 다음 ID를 사용한다.

- `gpt-5.5`
- `gpt-5.4`
- `gpt-5.4-mini`

배포 전 `weekly_blog_bot.py --validate-models`가 `client.models.list()`와 짧은 ping으로 확인한다. 이 검증 없이 live run을 켜지 않는다.

## 기본 배치

| 역할 | 모델 |
|---|---|
| generator | gpt-5.5 |
| R1 | gpt-5.4-mini |
| R2 | gpt-5.5 |
| R3 | gpt-5.4-mini |
| repair | gpt-5.4 |
| report | gpt-5.4-mini |

## 가격 기준

가격은 2026-05-02 기준 공식 표에서 가져온 운영 추정값이다. 공식 가격표가 바뀌면 운영자가 `config/weekly_blog_bot.yaml`을 갱신해야 한다.

| 모델 | Input / 1M | Cached input / 1M | Output / 1M |
|---|---:|---:|---:|
| gpt-5.5 | $5.00 | $0.50 | $30.00 |
| gpt-5.4 | $2.50 | $0.25 | $15.00 |
| gpt-5.4-mini | $0.75 | $0.075 | $4.50 |
| web_search | 해당 없음 | 해당 없음 | $10.00 / 1k calls |

## Claude 대응표

Anthropic provider adapter를 붙일 때만 사용한다. 현재 코드는 OpenAI Responses API 기준이다.

| 역할 | 후보 |
|---|---|
| generator | Claude Opus 4.7 또는 Sonnet 4.6 |
| R1 | Claude Haiku 4.5 |
| R2 | Claude Opus 4.7 또는 Sonnet 4.6 |
| R3 | Claude Haiku 4.5 |
| repair | Claude Sonnet 4.6 |

Claude 가격도 공식 표 기준으로 주기 갱신해야 한다.
