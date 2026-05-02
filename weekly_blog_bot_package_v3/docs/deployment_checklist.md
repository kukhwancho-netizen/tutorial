# 배포 체크리스트

## 로컬

- [ ] `python -m py_compile weekly_blog_bot.py`
- [ ] `pytest -q`
- [ ] `python weekly_blog_bot.py --dry-run --no-calendar --config config/weekly_blog_bot.yaml`
- [ ] `python weekly_blog_bot.py --validate-models --no-calendar --config config/weekly_blog_bot.yaml`

## GitHub Secrets

- [ ] `OPENAI_API_KEY`
- [ ] `GOOGLE_TOKEN_JSON`
- [ ] `GOOGLE_CLIENT_SECRET_JSON` 선택
- [ ] `SLACK_WEBHOOK_URL` 선택

## GitHub Variables

- [ ] `ENABLE_WEEKLY_CRON=false` 또는 미설정 상태로 PR merge
- [ ] workflow_dispatch dry_run=true 확인
- [ ] workflow_dispatch dry_run=false 실제 실행 1회
- [ ] 성공 후 `ENABLE_WEEKLY_CRON=true`

## Calendar OAuth

- [ ] refresh token 포함 여부 확인
- [ ] 권한 회수 시 `auth_error` 알림 확인
- [ ] 캘린더 결과 이벤트 생성 확인

## 비용

- [ ] `config.cost.pricing` 공식 표 기준 갱신일 확인
- [ ] `jq '.report.usage' outputs/*weekly_report.json` 확인
