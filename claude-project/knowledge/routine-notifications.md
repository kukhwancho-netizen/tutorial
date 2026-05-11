# 루틴 알림 설정 — 매일/매주 자동으로 받기

본 시스템이 자동으로 매일 또는 매주 "오늘 할 일"을 알려주도록 설정하는 4가지 방법.

## 1. .ics 캘린더 알림 (가장 간단, 즉시)

이미 만들어진 기능. 한 번 설정하면 영구 자동.

```
/calendar?bizType=SOLE_GENERAL → ".ics 다운로드" 버튼 클릭
→ Google Calendar / Apple Calendar / Outlook에 임포트
→ 모든 신고일 + D-7, D-1 자동 알림
```

**장점**: 셋업 5초, 폰/PC 어디든 자동 알림
**단점**: 정적 일정만. 분개 누락 같은 동적 점검은 안 됨

## 2. cron + Slack/Discord 다이제스트 (추천 - 동적 점검)

매일 아침 7시에 분개 이상·신고 임박을 모아 Slack/Discord로 푸시.

### 셋업

1. Slack에서 Incoming Webhook URL 발급 (또는 Discord 채널 웹훅)
2. 서버에 환경변수 등록:
   ```bash
   export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
   ```
3. crontab 추가:
   ```cron
   0 7 * * * cd /path/to/tutorial && \
       npx tsx scripts/digest.ts --user accountant@example.com >> /tmp/tax-digest.log 2>&1
   ```
4. 끝. 매일 7시 Slack에 다이제스트 도착.

### 수동 실행

```bash
npm run digest -- --user accountant@example.com           # 14일 horizon
npm run digest -- --user accountant@example.com --horizon 7   # 일주일만
npm run digest -- --user accountant@example.com --json    # JSON 출력
```

### 다이제스트 예시

```markdown
# 세무 다이제스트 (2026-05-12)

사용자: accountant@example.com · 고객사 5곳
다가오는 마감: 8건 (7일 이내 3건)
이상 감지: 4건 (🚨 alert 1)

## 샘플상사 (개인 일반과세자)

**📅 다가오는 마감**
- 🚨 2026-05-13 (D-1) 원천징수이행상황신고
- ⚠ 2026-05-15 (D-3) 4대보험료 납부
- · 2026-05-31 (D-19) 종합소득세 정기신고

**🔍 이상 감지**
- 🚨 종합소득세 정기신고 임박 — 해당 기간 분개 0건
- ⚠ 매출 급감: 직전월 대비 60% 감소
```

## 3. Claude Desktop + MCP daily_digest 도구 (대화형)

사용자가 채팅창에서 직접 요청:

```
사장님: 오늘 할 일 알려줘
Claude: [daily_digest(horizonDays=14) 호출 → 위와 같은 마크다운 출력]
```

또는 Claude Code 사용자라면 `/loop` 스킬로 주기 실행:

```
/loop 1d daily_digest 실행
```

(Claude Code 세션을 켜둔 상태에서만 작동)

## 4. 이메일 (별도 SMTP 셋업 필요, 미구현)

`scripts/digest.ts`의 출력을 stdin으로 받아 `mailx` / `sendmail`로 전송:

```cron
0 7 * * * /path/to/tutorial/npx tsx scripts/digest.ts --user me@example.com | \
   mail -s "오늘의 세무" me@example.com
```

또는 향후 nodemailer 직접 통합 가능.

## 추천 조합

- **개인 사장님**: .ics (1) + Slack (2) — 일정 알림 + 누락 점검
- **세무사 사무소**: Slack (2) — 모든 고객사 한 번에 일별 점검
- **빠른 확인**: Claude Desktop + MCP (3) — 채팅으로 "오늘 뭐 해야 해?"
