# Claude Code 워크스페이스 셋업 (PowerShell 버전)
#
# 사용:
#   .\claude_code_pack\bundle.ps1                          # 기본
#   .\claude_code_pack\bundle.ps1 -Mode full               # + 판례 DB (1.5MB)
#   .\claude_code_pack\bundle.ps1 -Dest "C:\blog-cc"       # 경로 지정
#
# 출력 (기본):
#   $HOME\blog-bot-cc\
#   ├── CLAUDE.md
#   ├── .claude\agents\*.md
#   └── knowledge\

[CmdletBinding()]
param(
    [ValidateSet('default', 'full')]
    [string]$Mode = 'default',
    [string]$Dest = (Join-Path $HOME "blog-bot-cc")
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
Set-Location $RepoRoot

$Tier1 = @(
    "00_파이프라인_v3_최상위_구조.md",
    "01_최우선_규칙.md",
    "02_통합본_메타규칙.md",
    "11_파일_접근_규칙_v2_0.md",
    "20_FRWRITER_v2_7_1.md",
    "21_검토지침_v2_7_2.md",
    "22_법률상담_문체_보정_v1_1.md",
    "30_R1_규칙감사관_v2.md",
    "31_R2_법률검수관_v2.md",
    "32_R3_문서검토관_v2.md",
    "33_내부_검토_다면화_매트릭스.md",
    "34_JSON_schema_2종.md",
    "weekly_blog_bot_package_v3/prompts/10_generator_system.md",
    "weekly_blog_bot_package_v3/prompts/11_draft_generator_system.md",
    "weekly_blog_bot_package_v3/prompts/23_reviewer_r1_draft.md",
    "weekly_blog_bot_package_v3/prompts/24_reviewer_r2_draft.md",
    "weekly_blog_bot_package_v3/prompts/25_reviewer_r3_draft.md",
    "weekly_blog_bot_package_v3/prompts/31_repair_draft_system.md",
    "weekly_blog_bot_package_v3/schemas/spec_batch.schema.json",
    "weekly_blog_bot_package_v3/schemas/draft_batch.schema.json",
    "weekly_blog_bot_package_v3/schemas/reviewer_result.schema.json"
)

$Tier2 = @(
    "40_리서처_실험_로그.md",
    "41_실험_로그_v1_9_추가_항목.md",
    "52_빌더_인스트럭션_압축본.txt"
)

$Tier3 = @("참조_판례_정리본.txt")

$KnowledgeDir = Join-Path $Dest "knowledge"
$AgentsDir    = Join-Path $Dest ".claude\agents"

New-Item -ItemType Directory -Path $KnowledgeDir -Force | Out-Null
New-Item -ItemType Directory -Path $AgentsDir -Force | Out-Null

# CLAUDE.md + 서브에이전트 복사
Copy-Item "claude_code_pack\CLAUDE.md" -Destination (Join-Path $Dest "CLAUDE.md") -Force
Copy-Item "claude_code_pack\.claude\agents\*.md" -Destination $AgentsDir -Force

$count = 0
$files = $Tier1 + $Tier2
if ($Mode -eq 'full') { $files += $Tier3 }

foreach ($f in $files) {
    if (-not (Test-Path $f)) {
        Write-Host "MISSING: $f" -ForegroundColor Red
        exit 1
    }
    $name = Split-Path -Leaf $f
    Copy-Item $f -Destination (Join-Path $KnowledgeDir $name) -Force
    $count++
}

$AgentCount = (Get-ChildItem $AgentsDir -Filter '*.md').Count

Write-Host ""
Write-Host "────────────────────────────────────────────────"
Write-Host "  워크스페이스: $Dest"
Write-Host "  Knowledge: $count개"
Write-Host "  서브에이전트: $AgentCount개"
Write-Host ""
Write-Host "  다음 단계:"
Write-Host "    1) cd '$Dest'"
Write-Host "    2) claude         # Claude Code 시작"
Write-Host "    3) 첫 명령: 블 (민+가+행) 7 ㄱㄱ"
Write-Host "       → 디스패처가 spec-sketcher 호출 → JSON 7건"
Write-Host "────────────────────────────────────────────────"
