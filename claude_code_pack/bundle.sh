#!/usr/bin/env bash
#
# Claude Code 워크스페이스 셋업 스크립트.
#
# 사용:
#   bash claude_code_pack/bundle.sh                 # 기본 (Tier 1+2, 24개)
#   bash claude_code_pack/bundle.sh full            # + 1.5MB 판례 DB (Tier 3)
#   bash claude_code_pack/bundle.sh full ~/blog-cc  # 출력 경로 지정
#
# 출력 (기본):
#   ~/blog-bot-cc/
#   ├── CLAUDE.md                  # 디스패처 (claude_code_pack/CLAUDE.md 복사)
#   ├── .claude/agents/*.md        # 서브에이전트 6개
#   └── knowledge/                 # 규칙·프롬프트·스키마 24~25개
#
# 무엇을 하나:
#   저장소에 흩어진 Knowledge·프롬프트·스키마를 워크스페이스 한 폴더에 모은다.
#   → 그 폴더에서 `claude` 명령으로 Claude Code 켜면 디스패처가 동작.

set -euo pipefail

cd "$(dirname "$0")/.."

MODE=${1:-default}
DEST=${2:-$HOME/blog-bot-cc}

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

# 워크스페이스 디렉토리 생성
mkdir -p "$DEST/knowledge"
mkdir -p "$DEST/.claude/agents"

# CLAUDE.md (디스패처) + 서브에이전트 복사
cp claude_code_pack/CLAUDE.md "$DEST/CLAUDE.md"
cp claude_code_pack/.claude/agents/*.md "$DEST/.claude/agents/"

count=0
for f in "${TIER1[@]}" "${TIER2[@]}"; do
  [ -f "$f" ] || { echo "MISSING: $f"; exit 1; }
  cp "$f" "$DEST/knowledge/$(basename "$f")"
  count=$((count + 1))
done

if [ "$MODE" = "full" ]; then
  for f in "${TIER3[@]}"; do
    [ -f "$f" ] || { echo "MISSING: $f"; exit 1; }
    cp "$f" "$DEST/knowledge/$(basename "$f")"
    count=$((count + 1))
  done
fi

echo "────────────────────────────────────────────────"
echo "  워크스페이스: $DEST"
echo "  Knowledge: $count개"
echo "  서브에이전트: $(ls "$DEST/.claude/agents" | wc -l | tr -d ' ')개"
echo ""
echo "  다음 단계:"
echo "    1) cd $DEST"
echo "    2) claude         # Claude Code 시작"
echo "    3) 첫 명령: \"블 (민+가+행) 7 ㄱㄱ\""
echo "    → 디스패처가 spec-sketcher 호출 → JSON 7건"
echo "────────────────────────────────────────────────"
