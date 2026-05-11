# 세무기장대리 — Claude Project 설정 키트

이 폴더는 본 프로젝트를 **Claude Project**(claude.ai의 Projects 기능)로 사용하기 위한 자료 모음입니다.

## 두 가지 경로

| 경로 | 어디서 | 무엇을 할 수 있나 | 무엇을 못 하나 |
| --- | --- | --- | --- |
| **A. Claude Desktop + MCP** ⭐ 추천 | Claude Desktop 앱 | 실제 분개 입력·조회·집계 등 **모든 것** (10개 MCP 도구) | 모바일/웹에서는 안 됨 |
| **B. Claude.ai 웹 Project** | claude.ai (브라우저) | 질문·계산·일정 안내·신고서식 작성 보조 | **DB 쓰기 불가** (분개 입력은 안 됨) |

두 경로 다 같은 시스템 프롬프트(`project-instructions.md`)와 지식(`knowledge/`)을 씁니다. 차이는 **도구 접근**뿐.

## 빠른 설정

### 경로 A: Claude Desktop + MCP

1. 로컬에서 dev DB 준비:
   ```bash
   cp .env.example .env
   npm install && npm run db:push && npm run db:seed
   ```
2. `~/Library/Application Support/Claude/claude_desktop_config.json`에 추가 (macOS):
   ```json
   {
     "mcpServers": {
       "tax-accounting": {
         "command": "npx",
         "args": ["-y", "tsx", "/절대경로/tutorial/src/mcp/server.ts"],
         "env": {
           "DATABASE_URL": "file:/절대경로/tutorial/prisma/dev.db",
           "MCP_USER_EMAIL": "accountant@example.com"
         }
       }
     }
   }
   ```
3. Claude Desktop 재시작 → 채팅창 아래 🔧 아이콘에 `tax-accounting` 도구 10개 표시
4. 새 Project 생성 → 이름 "세무기장대리" → **Custom Instructions**에 `project-instructions.md` 내용 통째로 붙여넣기
5. **Project Knowledge**에 `knowledge/` 안의 `.md` 파일 전부 업로드

### 경로 B: Claude.ai 웹 Project (도구 없음)

1. claude.ai → Projects → 새 프로젝트
2. **Custom Instructions**에 `project-instructions.md` 붙여넣기 (단, 도구 호출 부분은 자동 무시됨)
3. **Project Knowledge**에 `knowledge/` 안의 `.md` 파일 전부 업로드
4. 끝. 영수증 사진 첨부 → 분개 *제안*을 받아 수동으로 입력하는 방식

## 파일 안내

| 파일 | 용도 |
| --- | --- |
| `project-instructions.md` | Project Custom Instructions에 통째로 붙여넣기 |
| `skill-tree.md` | 본 시스템으로 할 수 있는 일의 트리 — 사용자가 먼저 보고 머릿속에 그림 잡기 |
| `workflows.md` | 흔한 상황별 분기 (영수증 처리 / 부가세 신고 1주 전 / 월말 마감 등) |
| `knowledge/tax-calendar.md` | 사업자 유형별 신고·납부 일정 (2025년 귀속 기준) |
| `knowledge/biztype-rules.md` | 법인/일반/간이/면세 — 어떻게 다른가 |
| `knowledge/account-codes.md` | 시드 계정과목 (분개 시 어느 계정을 쓰는지) |
| `knowledge/special-deductions.md` | 자녀세액공제·전자세금계산서 의무·의제매입세액공제·경비율 |
| `knowledge/hometax-excel-spec.md` | 홈택스 엑셀 임포트 양식 안내 |
| `knowledge/verification-log.md` | 공식 자료와의 교차 검증 로그 (출처 링크 포함) |
| `knowledge/example-prompts.md` | 채팅창에 그대로 붙여 쓸 수 있는 예시 명령 |

## 면책

본 키트는 안내·보조 목적입니다. 실제 신고는 세무 전문가의 검토를 받으세요. 휴일·천재지변으로 마감일은 국세청 고시로 연장될 수 있습니다.
