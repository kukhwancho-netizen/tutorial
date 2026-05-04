#!/usr/bin/env bash
#
# Claude Project Knowledge 번들 생성 스크립트.
#
# 사용:
#   bash claude_project_pack/bundle.sh           # tier 1 + 2 (기본)
#   bash claude_project_pack/bundle.sh full      # tier 1 + 2 + 3 (1.5MB 판례 포함)
#
# 출력:
#   /tmp/claude_project_knowledge.zip
#
# 무엇을 하나:
#   저장소에 흩어진 Knowledge 파일을 한 폴더로 모아 zip으로 압축.
#   → claude.ai Project의 "Add knowledge"에 zip 풀어서 드래그.
#
# 본 스크립트는 파일을 *복사*만 한다 (저장소 원본은 정본).
# 매번 새로 만들기 때문에 원본 갱신되면 다시 실행하면 됨.

set -euo pipefail

cd "$(dirname "$0")/.."

MODE=${1:-default}
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/knowledge"

# ----- Tier 1: 필수 (21개) -----
TIER1=(
  "00_파이프라인_v3_최상위_구조.md"
  "01_최우선_규칙.md"
  "02_통합본_메타규칙.md"
  "11_파일_접근_규칙_v2_0.md"
  "20_FRWRITER_v2_7_1.md"
  "21_검토지침_v2_7_2.md"
  "22_법률상담_문체_보정_v1_1.md"
  "30_R1_규칙감사관_v2.md"
  "31_R2_법률검수관_v2.md"
  "32_R3_문서검토관_v2.md"
  "33_내부_검토_다면화_매트릭스.md"
  "34_JSON_schema_2종.md"
  "weekly_blog_bot_package_v3/prompts/10_generator_system.md"
  "weekly_blog_bot_package_v3/prompts/11_draft_generator_system.md"
  "weekly_blog_bot_package_v3/prompts/23_reviewer_r1_draft.md"
  "weekly_blog_bot_package_v3/prompts/24_reviewer_r2_draft.md"
  "weekly_blog_bot_package_v3/prompts/25_reviewer_r3_draft.md"
  "weekly_blog_bot_package_v3/prompts/31_repair_draft_system.md"
  "weekly_blog_bot_package_v3/schemas/spec_batch.schema.json"
  "weekly_blog_bot_package_v3/schemas/draft_batch.schema.json"
  "weekly_blog_bot_package_v3/schemas/reviewer_result.schema.json"
)

# ----- Tier 2: 선택 (3개) -----
TIER2=(
  "40_리서처_실험_로그.md"
  "41_실험_로그_v1_9_추가_항목.md"
  "52_빌더_인스트럭션_압축본.txt"
)

# ----- Tier 3: 데이터 (1.5MB) -----
TIER3=(
  "참조_판례_정리본.txt"
)

count=0
for f in "${TIER1[@]}" "${TIER2[@]}"; do
  [ -f "$f" ] || { echo "MISSING: $f"; exit 1; }
  cp "$f" "$STAGE/knowledge/$(basename "$f")"
  count=$((count + 1))
done

if [ "$MODE" = "full" ]; then
  for f in "${TIER3[@]}"; do
    [ -f "$f" ] || { echo "MISSING: $f"; exit 1; }
    cp "$f" "$STAGE/knowledge/$(basename "$f")"
    count=$((count + 1))
  done
fi

# PROJECT_INSTRUCTIONS도 함께 묶음 (참고용 — Knowledge가 아니라 custom instructions에 붙여넣음)
cp claude_project_pack/PROJECT_INSTRUCTIONS.md "$STAGE/PROJECT_INSTRUCTIONS.md"
cp claude_project_pack/README.md "$STAGE/README.md"

OUT="/tmp/claude_project_knowledge.zip"
[ -f "$OUT" ] && rm "$OUT"
( cd "$STAGE" && zip -r "$OUT" . > /dev/null )

SIZE=$(du -h "$OUT" | cut -f1)
echo "────────────────────────────────────────────────"
echo "  번들: $OUT"
echo "  파일: $count개 (knowledge/) + PROJECT_INSTRUCTIONS.md + README.md"
echo "  크기: $SIZE"
echo ""
echo "  다음 단계:"
echo "    1) unzip $OUT -d ~/claude_project_bundle"
echo "    2) claude.ai → Projects → New project"
echo "    3) Custom instructions에 PROJECT_INSTRUCTIONS.md 내용 붙여넣기"
echo "    4) Add knowledge → ~/claude_project_bundle/knowledge/ 안의 파일 전부 드래그"
echo "    5) 첫 명령: \"블 (민+가+행) 7 ㄱㄱ\""
echo "────────────────────────────────────────────────"
