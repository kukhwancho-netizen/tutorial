# 루틴 알림 — "뭐 해야 한다" 한 줄로 받기

## TL;DR

목적에 따라 둘 중 하나:

### 옵션 1. 캘린더 알림 (가장 간단, 0분 셋업)

이미 만들어진 것. `/calendar?bizType=...` → ".ics 다운로드" → 폰 캘린더에 임포트.
끝. D-7, D-1에 자동 팝업.

→ 정적 일정만. 분개 누락 같은 동적 점검은 못 함.

### 옵션 2. ntfy.sh 폰 푸시 (30초 셋업)

앱 설치 + 토픽 설정만 하면 cron에서 한 줄 보내면 폰에 푸시 도착.

```bash
# 1. https://ntfy.sh 앱 설치 (또는 웹) → "Subscribe to topic" → 임의 이름 입력
#    예: tax-alerts-abc123 (남이 알면 보일 수 있으니 충분히 unique하게)

# 2. cron에 추가
0 7 * * * cd /path/to/tutorial && \
    NTFY_TOPIC=tax-alerts-abc123 \
    npx tsx scripts/digest.ts --user accountant@example.com --short --quiet
```

폰에 받는 알림 예:
```
세무 알림
📌 D-1 원천세 신고, D-3 4대보험 · 🚨 점검 1건
```

또는 할 일 없으면 푸시 자체를 안 보냄.

## 수동 한 줄 확인

```bash
npm run digest -- --user accountant@example.com --short
```

→ 출력:
- `✅ 오늘 할 일 없음`
- `📌 D-1 원천세 신고, D-3 4대보험`
- `🚨 D-1 종소세 신고 외 2건 · 🚨 점검 1건`

## 더 자세히 보고 싶을 때

전체 다이제스트 (마크다운):
```bash
npm run digest -- --user accountant@example.com
```

Slack/Discord 채널에 풀 다이제스트 푸시:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ \
  npm run digest -- --user accountant@example.com
```

## 채팅에서

```
사장님: 오늘 할 일?
Claude → daily_digest 호출 → 마크다운 출력
```
