# Knowledge 업로드 목록

Claude Project의 **Knowledge** 영역에 다음 파일들을 업로드. 본 manifest는 저장소 기준 상대 경로.

## 필수 (Tier 1) — 13개

작성·검수 전 단계의 정본. 누락하면 봇 동작 무너짐.

```
00_파이프라인_v3_최상위_구조.md
01_최우선_규칙.md
02_통합본_메타규칙.md
11_파일_접근_규칙_v2_0.md
20_FRWRITER_v2_7_1.md
21_검토지침_v2_7_2.md
22_법률상담_문체_보정_v1_1.md
30_R1_규칙감사관_v2.md
31_R2_법률검수관_v2.md
32_R3_문서검토관_v2.md
33_내부_검토_다면화_매트릭스.md
34_JSON_schema_2종.md
weekly_blog_bot_package_v3/prompts/10_generator_system.md
weekly_blog_bot_package_v3/prompts/11_draft_generator_system.md
weekly_blog_bot_package_v3/prompts/23_reviewer_r1_draft.md
weekly_blog_bot_package_v3/prompts/24_reviewer_r2_draft.md
weekly_blog_bot_package_v3/prompts/25_reviewer_r3_draft.md
weekly_blog_bot_package_v3/prompts/31_repair_draft_system.md
weekly_blog_bot_package_v3/schemas/spec_batch.schema.json
weekly_blog_bot_package_v3/schemas/draft_batch.schema.json
weekly_blog_bot_package_v3/schemas/reviewer_result.schema.json
```

## 선택 (Tier 2) — 운영 로그·외부 트랙

봇 동작에 직접 필요하지는 않지만 R2가 사례 검색하거나 사용자가 정책 근거 인용할 때 유용. 용량 여유 있으면 업로드.

```
40_리서처_실험_로그.md
41_실험_로그_v1_9_추가_항목.md
52_빌더_인스트럭션_압축본.txt
```

## 데이터 (Tier 3) — 판례 RAG

```
참조_판례_정리본.txt   # 1.5MB
```

> **주의**: 1.5MB는 Claude Project Knowledge 단일 파일 한도에 가까움. 판례 인용 정확성을 높이려면 파일 그대로 올리지 말고 **벡터 스토어 / 파일 검색 도구**가 있는 환경에서 별도 처리 권장. Project lite 모드에선 사용자가 필요한 판례 인용을 직접 첨부하는 게 안전.

## 미포함 (의도적)

- `23_옥토리타스_v3_3_1-4doc_db.md` — 트랙 2(인스타). 이 봇은 트랙 1만.
- `weekly_blog_bot_package_v3/prompts/30_repair_system.md` — 옛 spec repair (slim spec 후 미사용).
- `weekly_blog_bot_package_v3/prompts/90_manual_run_prompt.md` — CLI 운영 가이드 (Project 무관).
- `weekly_blog_bot_package_v3/schemas/sketch_report.schema.json`, `final_report.schema.json` — 봇 출력 검증용 (Project는 어차피 자체 강제 안 함).
- 모든 Python 코드 (`weekly_blog_bot_package_v3/weekly_blog_bot/**/*.py`).

## 업로드 순서 권장

1. Project 생성 → Project Instructions에 `PROJECT_INSTRUCTIONS.md` 내용 붙여넣기.
2. Tier 1 13개 업로드.
3. Tier 2 3개 업로드.
4. (선택) Tier 3 판례 텍스트.
5. 첫 명령 시운전: `블 (민+가+행) 7 ㄱㄱ` → spec sketch JSON이 나오는지 확인.
