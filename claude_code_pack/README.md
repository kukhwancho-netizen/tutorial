# Claude Code Pack — 주간 블로그 편성봇 (옵션 4)

OpenAI 파이프라인(`weekly_blog_bot_package_v3/`)을 **Claude Code 서브에이전트**로 옮기기 위한 자료. spec/draft/edit 사이클을 메인 디스패처 + 6개 서브에이전트로 분담시킨다.

## Project lite(옵션 3) 대비 무엇이 다른가

| 항목 | 옵션 3: Project lite | **옵션 4: Claude Code (본 pack)** |
|---|---|---|
| 시작 | 브라우저에서 claude.ai/projects 접속 | 터미널에서 `claude` 명령 |
| R1/R2/R3 자기 검수 한계 | **있음** (한 컨텍스트가 다 봄) | **풀림** — 각 reviewer 서브에이전트가 격리된 컨텍스트 |
| 병렬 검수 | 불가 (순차) | **R1·R2·R3 동시 실행** (지연 단축) |
| Knowledge 로드 | Project가 한 번에 다 들고 | 에이전트마다 필요한 것만 Read |
| 셋업 위치 | claude.ai (Pro 플랜) | 로컬 PC (Claude Code CLI 설치 필요) |
| JSON 스키마 강제 | 자연어 가이드만 | 자연어 가이드만 (강제 검증은 옵션 B만) |
| 자동화 (cron 등) | 불가 | 불가 (사람이 시작) |
| 비용 | Project 토큰 | 서브에이전트마다 시스템 프롬프트 재로드 → 토큰 ~1.5~2배 |

## 셋업 (5분)

### 0) 사전 조건

- **Claude Code CLI 설치됨**: `claude --version` 확인. 없으면 [docs.anthropic.com/claude-code](https://docs.anthropic.com/) 참조.
- 본 저장소가 PC에 클론되어 있음 (`tutorial/`).

### 1) 워크스페이스 생성

**macOS / Linux / Git Bash**:
```bash
cd tutorial
bash claude_code_pack/bundle.sh
# → ~/blog-bot-cc/ 워크스페이스 생성 (Knowledge 24개 + 에이전트 6개 + CLAUDE.md)

# 판례 DB(1.5MB)도 포함하려면:
bash claude_code_pack/bundle.sh full
```

**Windows PowerShell**:
```powershell
cd tutorial
.\claude_code_pack\bundle.ps1
# → $HOME\blog-bot-cc\ 워크스페이스 생성

# 판례 DB 포함:
.\claude_code_pack\bundle.ps1 -Mode full
```

다른 경로에 두려면 두 번째 인수(또는 `-Dest`)로 지정.

### 2) Claude Code 시작

```bash
cd ~/blog-bot-cc       # PowerShell이면 cd $HOME\blog-bot-cc
claude
```

Claude Code가 워크스페이스의 `CLAUDE.md`를 자동 로드. `.claude/agents/*.md` 6개 서브에이전트도 자동 인식.

### 3) 시운전

프롬프트에 입력:
```
블 (민+가+행) 7 ㄱㄱ
```

디스패처(메인 Claude)가 `spec-sketcher` 서브에이전트 호출 → WeeklySpecBatch JSON 7건 출력. 5~15초.

## 사용 패턴

### Round 1 — spec sketch
```
블 (민+가+행) 7 ㄱㄱ
```
디스패처 → `spec-sketcher` (1회) → JSON 7건.

### Round 2 — draft + 병렬 검수 (옵션 4의 진짜 가치)
```
draft 콘텐츠 3 길이 풀+요약+핵심

parent: <콘텐츠 3 item JSON>
```
디스패처가:
1. `draft-writer` 1회 호출 → 변주 3건 본문 작성
2. **한 응답 안에서** `r1-rule-auditor`, `r2-legal-reviewer`, `r3-doc-reviewer` 동시 호출 → 각자 격리된 컨텍스트에서 독립 검수
3. 의사결정 표 적용 → 최종 한 줄 판정

각 reviewer는 다른 reviewer의 결과를 못 봄 — 자기 검수 중립성 유지.

### Round 3 — edit
```
edit 콘텐츠 3.풀

<편집된 변주 JSON>
```
디스패처가 `draft-writer`는 부르지 않고 R1/R2/R3만 동시 호출. fail/partial 있으면 사용자 동의 후 `repair` 1회.

## 파일 구조

```
claude_code_pack/
├── README.md                    # 본 문서
├── CLAUDE.md                    # 메인 디스패처 (워크스페이스 정본)
├── .claude/
│   └── agents/
│       ├── spec-sketcher.md     # spec PASS
│       ├── draft-writer.md      # draft PASS
│       ├── r1-rule-auditor.md   # R1 검수
│       ├── r2-legal-reviewer.md # R2 검수
│       ├── r3-doc-reviewer.md   # R3 검수
│       └── repair.md            # 보정
├── bundle.sh                    # bash: 워크스페이스 폴더 생성
└── bundle.ps1                   # PowerShell: 동일
```

`knowledge/` 안에 들어가는 24개 파일은 모두 저장소 본체에 이미 있다. bundle 스크립트는 그 파일들을 워크스페이스로 복사할 뿐.

## 한계와 우회

| 문제 | 우회 |
|---|---|
| JSON 스키마 강제 검증 없음 | 사용자가 jsonschema 도구로 사후 검증 (오프라인) |
| 캘린더·Slack 자동화 없음 | 사용자가 직접 입력. 필요하면 옵션 B(Anthropic SDK) |
| 서브에이전트 재호출마다 시스템 프롬프트 재로드 = 토큰 비용 ↑ | draft 1회당 평균 ~1.5~2배. 한 사이클당 비용 감수 |
| 1.5MB 판례 DB는 Read 비용 큼 | 서브에이전트가 grep으로 부분만 읽도록 시스템 프롬프트 가이드 |
| 사람이 매번 `claude` 실행해야 함 | 옵션 4 자체의 한계. 자동화 필요하면 옵션 B |

## 다른 옵션과의 관계

본 pack은 OpenAI 코드를 대체하지 않는다. 운영 옵션 비교:

| 옵션 | 환경 | 자동화 | 자기 검수 중립성 | 셋업 난이도 |
|---|---|---|---|---|
| A: OpenAI Python (`weekly_blog_bot_package_v3/`) | 로컬 PC | cron 가능 | 분리 호출 가능 | 중 |
| B: Anthropic SDK 포팅 | 로컬 PC | cron 가능 | 분리 호출 가능 | 중-상 (포팅 필요) |
| 3: Project lite (`claude_project_pack/`) | claude.ai | 불가 | 한계 있음 | 하 |
| **4: Claude Code (본 pack)** | 로컬 PC | 불가 | **풀림** | 하 |

자산(prompts/schemas/rules)은 모두 LLM-provider-agnostic — 옵션 간 그대로 이식 가능.
