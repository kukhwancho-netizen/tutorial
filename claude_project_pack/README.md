# Claude Project Pack — 주간 블로그 편성봇

OpenAI 파이프라인(`weekly_blog_bot_package_v3/`)을 Claude Project로 옮기기 위한 자료 묶음. **코드 실행 환경 없이** 프롬프트·스키마·규칙만으로 spec/draft/edit 사이클을 돌린다.

## 무엇을 잃고 무엇을 얻는가

**유지**:
- 3-PASS 운영 모델(spec → draft → edit)
- 압력 분배(spec 가볍게, draft에 본문, edit에 검수만)
- 한국어 법률 문체 보정 (R3 규칙 그대로)
- 의사결정 표(검수 결과 → 통과/수정/보류)

**잃음**:
- JSON Schema 강제 검증 (Claude는 자연어 가이드만 — 출력 형식 위반 가능, 사용자가 검증)
- R1/R2/R3 분리 호출의 신뢰성 (한 모델이 자기 검수 — 중립성 떨어짐)
- 비용·토큰 추적, abort 카테고리, 알림 (인프라 부재)
- Calendar / Slack / 이메일 자동화
- 파이프라인 자동 진행 (각 명령은 사용자가 직접 트리거 — 본래 명령 봇 모델과 일치)

## 셋업 (5분)

### 빠른 길 — 번들 스크립트 사용

**macOS / Linux** (또는 Windows의 Git Bash):
```bash
bash claude_project_pack/bundle.sh
# → /tmp/claude_project_knowledge.zip 생성 (Tier 1+2, 84KB)

unzip /tmp/claude_project_knowledge.zip -d ~/claude_project_bundle
```

**Windows PowerShell**:
```powershell
.\claude_project_pack\bundle.ps1
# → $env:TEMP\claude_project_knowledge.zip 생성

Expand-Archive "$env:TEMP\claude_project_knowledge.zip" -DestinationPath "$HOME\claude_project_bundle"
```

이후 (운영체제 무관):
1. [claude.ai](https://claude.ai) → **Projects** → **New project** → 이름 임의 (예: "조국환 변호사 주간봇")
2. **"Set custom instructions"** 클릭 → 번들에서 푼 `PROJECT_INSTRUCTIONS.md` 내용 통째로 붙여넣고 저장
3. **"Add knowledge"** 클릭 → `knowledge/` 폴더 안의 24개 파일을 일괄 드래그
4. 첫 시운전: `블 (민+가+행) 7 ㄱㄱ` → spec sketch JSON 7건이 나오면 OK

판례 DB(1.5MB)도 함께 올리려면:
- bash: `bash claude_project_pack/bundle.sh full`
- PowerShell: `.\claude_project_pack\bundle.ps1 -Mode full`

### 수동 길 — 매니페스트 따라 개별 업로드

`KNOWLEDGE_MANIFEST.md` 참조. 파일별로 저장소에서 찾아 업로드. (번들 스크립트가 안 돌면 사용)

## 사용 패턴

### Round 1 — spec sketch
```
블 (민+가+행) 7 ㄱㄱ
```
Claude가 토픽 7건 JSON을 낸다. 사용자가 검토하고 본문화할 토픽 1건 결정.

### Round 2 — draft 생성
```
draft 콘텐츠 3 길이 풀+요약+핵심

parent: <spec.items[2] JSON 그대로 붙여넣기>
```
Claude가 변주 3건 + R1/R2/R3 + 최종 상태 판정. 사용자가 본문 검토.

### Round 3 — 사용자 편집 → 재검수
```
edit 콘텐츠 3.풀

<편집된 변주 JSON 붙여넣기>
```
Claude가 R1/R2/R3 다시. 필요 시 자동 보정 1회.

사용자가 만족할 때까지 Round 3 반복. 발행은 사람이 한다.

## 파일 구조

```
claude_project_pack/
├── README.md                    # 본 문서
├── PROJECT_INSTRUCTIONS.md      # Project Instructions에 붙여넣을 마스터 디스패처
├── KNOWLEDGE_MANIFEST.md        # Knowledge에 업로드할 파일 목록 (저장소 경로 기준)
├── EXAMPLE_TRANSCRIPT.md        # 첫 사이클 입출력 예시 (검증용 비교 기준)
└── bundle.sh                    # Knowledge 파일을 zip으로 묶어주는 스크립트
```

업로드 대상 파일은 모두 저장소 안에 이미 존재. 본 pack은 메타데이터·가이드만.

## 한계와 우회

| 문제 | 우회 |
|---|---|
| Claude가 JSON 스키마 어겨도 강제 fail 안 됨 | 사용자가 jsonschema 도구로 사후 검증 (오프라인) |
| R1/R2/R3가 같은 모델이라 자기 검수 한계 | 사용자가 R2 결과를 의심 가는 항목만 직접 확인 |
| 1.5MB 판례 DB 검색 | Project lite에선 사용자가 필요한 판례를 직접 첨부 |
| 비용 추적 없음 | Anthropic 콘솔에서 일별 사용량 확인 |
| 캘린더 자동 등록 | 사용자가 Google Calendar에 직접 입력 |

## OpenAI 파이프라인과의 관계

본 pack은 OpenAI 코드를 대체하지 않는다 — **운영 옵션 A** (사람-루프 중심) 의 자료다. 자동화 신뢰성·재현성이 더 중요하면 옵션 B(Anthropic SDK 포팅) 또는 옵션 C(OpenAI 그대로 운영)로 가야 한다 — `weekly_blog_bot_package_v3/README.md` 참조.

A로 가다가 자동화가 더 필요해지면 같은 자산(prompts/schemas/rules)을 그대로 OpenAI 또는 Anthropic 코드 어댑터에 끼워 넣을 수 있다 — pack의 모든 자료가 LLM-provider-agnostic.
