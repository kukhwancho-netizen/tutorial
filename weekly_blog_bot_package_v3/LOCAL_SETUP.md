# 로컬 머신 셋업 — 실무 가이드

OpenAI Python 파이프라인을 노트북·데스크탑에서 직접 운영. 가장 단순한 옵션.

## 0. 사전 점검 (1분)

| 필요 | 확인 |
|---|---|
| Python 3.11+ | `python3 --version` |
| pip | `pip --version` |
| 디스크 | ≥ 200MB (.venv + 출력) |
| 인터넷 | OpenAI / Google Calendar 호출 |
| OpenAI 계정 | Responses API 접근 가능 (대부분 paid plan) |

## 1. 한 줄 셋업 (3분)

```bash
git clone <YOUR_REPO_URL> tutorial
cd tutorial/weekly_blog_bot_package_v3
bash scripts/setup_local.sh
```

스크립트가 하는 일:
1. Python 3.11+ 확인
2. `.venv` 생성 + 활성화
3. `pip install -r requirements.txt`
4. `.env.example` → `.env` 복사 (이미 있으면 그대로 둠)
5. `python -m py_compile` + `pytest tests/unit/`
6. `--dry-run --no-calendar` smoke 실행

성공 시 `output: 2026-MM-DD_..._spec_weekly_report.json`이 outputs/에 생긴다.

## 2. 키·설정 채우기 (5분)

### 2-1. OpenAI 키 (필수)

```bash
${EDITOR:-nano} .env
```

```dotenv
OPENAI_API_KEY=sk-실제키...
```

### 2-2. 모델 ID 확인 (필수 — 현 config는 gpt-5.x placeholder)

```bash
grep -n 'gpt-' config/weekly_blog_bot.yaml
```

현재 값:
- `generator: gpt-5.5` / `repair: gpt-5.4` / `R1: gpt-5.4-mini` / `R2: gpt-5.5` / `R3: gpt-5.4-mini`

이 ID들이 실제 OpenAI에 존재하지 않으면 **모든 live 호출이 fail**. 본인 계정에서 사용 가능한 모델로 갱신 (예: `gpt-4o`, `gpt-4o-mini`, `o3` 등). 갱신 후 검증:

```bash
source .venv/bin/activate
python weekly_blog_bot.py --validate-models
```

→ `client.models.list()` + 각 모델에 짧은 ping. 한 줄이라도 fail이면 어떤 ID가 잘못됐는지 알려줌.

### 2-3. Google Calendar (선택 — 안 쓰면 매 호출에 `--no-calendar`)

캘린더에 결과 자동 등록하고 컨텍스트(완료 토픽 DB) 자동 조회하려면:

1. [Google Cloud Console](https://console.cloud.google.com) → 프로젝트 생성 → **Calendar API 활성화**
2. **OAuth consent screen** 설정 (Internal/External 중 선택, scopes에 `auth/calendar` 추가)
3. **Credentials → Create OAuth 2.0 Client ID → Desktop app** → JSON 다운로드 → `weekly_blog_bot_package_v3/client_secret.json` 으로 저장
4. 첫 실행 시 브라우저 OAuth 흐름이 열림 → `token.json` 생성됨
5. `token.json` 내용을 `.env`의 `GOOGLE_TOKEN_JSON`에 한 줄로 붙여넣기 (개행 제거)

```bash
# token.json → 한 줄로 변환
python -c "import json; print(json.dumps(json.load(open('token.json'))))" 
# 출력을 GOOGLE_TOKEN_JSON= 뒤에 붙여넣기
```

**팁**: token.json 자체를 `.env` 옆에 두면 `GOOGLE_TOKEN_JSON` 비워두고도 캘린더 어댑터가 token.json 파일을 직접 읽음. `.gitignore`에 둘 다 들어 있어 안전.

### 2-4. Slack / 이메일 알림 (선택)

```dotenv
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=alerts@example.com
SMTP_PASSWORD=app-password   # Gmail은 App Password 사용
ALERT_EMAIL_FROM=alerts@example.com
ALERT_EMAIL_TO=you@example.com
```

`config/weekly_blog_bot.yaml`의 `notifications.notify_on` 리스트가 어떤 이벤트를 알릴지 결정 (`aborted`, `blocked`, `needs_repair`, `human_gate` 등).

## 3. 첫 사이클 실행 (5분)

### Round 1 — spec sketch
```bash
source .venv/bin/activate

python weekly_blog_bot.py --order "블 (민+가+행) 7 ㄱㄱ" --no-calendar
```

→ `outputs/2026-MM-DD_..._spec_weekly_report.json` + `.md` 생성. 마크다운 열어 7건 토픽 검토:

```bash
ls -t outputs/*_spec_*.md | head -1 | xargs ${EDITOR:-cat}
```

### Round 2 — 본문 변주
```bash
python weekly_blog_bot.py --order "draft 콘텐츠 3 길이 풀+요약+핵심" --no-calendar
```

→ 봇이 `outputs/`에서 가장 최근 spec output을 자동으로 골라 콘텐츠 3 item을 부모로 사용. draft 변주 3건 + R1/R2/R3 + (필요 시) 보정 + 최종 상태 판정.

### Round 3 — 사람 편집 → 재검수

```bash
# draft.json 안의 body_paragraphs 등을 직접 편집
${EDITOR:-nano} outputs/$(ls -t outputs/*_draft_*.json | head -1 | xargs basename)

python weekly_blog_bot.py --order "edit 콘텐츠 3.풀" --no-calendar
```

→ 봇이 가장 최근 draft/edit output에서 콘텐츠 3.풀 변주를 골라 R1/R2/R3 다시. 만족할 때까지 편집·재실행 반복.

## 4. 일상 운영 명령

```bash
# 가상 환경 활성화 (매 새 셸)
source .venv/bin/activate

# 빠른 테스트
pytest tests/unit/ -q

# 전체 테스트 (통합 포함)
pytest -q

# 빠른 수정 흐름 검증 (API 호출 없음)
python weekly_blog_bot.py --order "..." --dry-run --no-calendar

# 모델 ID·키 살아 있는지 확인
python weekly_blog_bot.py --validate-models

# 결과 확인
ls -lt outputs/ | head
jq '.report.summary' outputs/$(ls -t outputs/*.json | head -1 | xargs basename)
jq '.report.usage.estimated_cost_usd' outputs/$(ls -t outputs/*.json | head -1 | xargs basename)
```

## 5. 흔한 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| `OPENAI_API_KEY is required` | .env에 키 없음 / 다른 셸 | `cat .env`로 확인, `source .venv/bin/activate` 다시 |
| `validate-models`에서 `model not found` | config의 ID가 placeholder | `config/weekly_blog_bot.yaml`의 `generator/repair/reviewers` 갱신 |
| `aborted: draft mode requires a prior spec output` | outputs/에 spec 결과 없음 | 먼저 `--order "블 ... ㄱㄱ"`로 spec 만들기 |
| `aborted: edit needs a prior draft/edit output` | outputs/에 draft 결과 없음 | 먼저 `--order "draft ..."` 실행 |
| `aborted: parent_spec_id 'X' not found` | 입력한 콘텐츠 번호가 spec output에 없음 | spec output의 temp_id 확인 |
| `auth_error` (Calendar) | token.json 만료/invalid | OAuth 재발급 또는 `--no-calendar`로 우회 |
| `payload_blocked` | 컨텍스트 토큰 budget 초과 | `config.cost.budget` 증가 또는 `calendar_context` 줄이기 |
| 검수 결과가 `partial`만 가득 | 단정 표현·source 누락 | draft prompt 11_*.md의 "claim.tag = 추정" 규칙 강조 |

## 6. 파일·폴더 안전

`.gitignore`에 다음이 있어 실수 commit 방지:
```
.env
.client_secret_from_env.json
token.json
outputs/
__pycache__/
.pytest_cache/
.venv/
```

`.env`와 `token.json`은 절대 git push 금지. `outputs/`는 .gitignore에 있어도 필요하면 별도 위치에 백업 권장.

## 7. 다음 단계

- 사이클 운영이 안정되면 → GitHub Actions(B 옵션)로 secrets 옮기고 어디서든 트리거
- 자동화 신뢰성 더 필요하면 → Anthropic SDK 포팅 (B 옵션 다른 의미)
- Claude Project lite (A 옵션 — 사람-루프 중심)와 병행 가능 — 같은 prompts/schemas 공유

자세한 운영·아키 흐름: `README.md`, `docs/architecture.md`.
