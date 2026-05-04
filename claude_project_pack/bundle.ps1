# Claude Project Knowledge 번들 생성 (PowerShell 버전)
#
# 사용:
#   .\claude_project_pack\bundle.ps1            # tier 1 + 2 (기본)
#   .\claude_project_pack\bundle.ps1 -Mode full  # tier 1 + 2 + 3 (1.5MB 판례 포함)
#
# 출력:
#   $env:TEMP\claude_project_knowledge.zip
#   (보통 C:\Users\<유저>\AppData\Local\Temp\claude_project_knowledge.zip)
#
# 무엇을 하나:
#   저장소에 흩어진 Knowledge 파일을 한 폴더로 모아 zip으로 압축.
#   → claude.ai Project의 "Add knowledge"에 zip 풀어서 드래그.

[CmdletBinding()]
param(
    [ValidateSet('default', 'full')]
    [string]$Mode = 'default'
)

$ErrorActionPreference = 'Stop'

# 이 스크립트 위치를 기준으로 저장소 루트 결정
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
Set-Location $RepoRoot

# Tier 1 (필수 21개)
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

# Tier 2 (선택 3개)
$Tier2 = @(
    "40_리서처_실험_로그.md",
    "41_실험_로그_v1_9_추가_항목.md",
    "52_빌더_인스트럭션_압축본.txt"
)

# Tier 3 (1.5MB 판례 DB)
$Tier3 = @("참조_판례_정리본.txt")

# Staging 디렉토리
$Stage = Join-Path $env:TEMP "claude_project_stage"
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
$KnowledgeDir = Join-Path $Stage "knowledge"
New-Item -ItemType Directory -Path $KnowledgeDir -Force | Out-Null

$count = 0
$files = $Tier1 + $Tier2
if ($Mode -eq 'full') { $files += $Tier3 }

foreach ($f in $files) {
    if (-not (Test-Path $f)) {
        Write-Host "MISSING: $f" -ForegroundColor Red
        exit 1
    }
    $name = Split-Path -Leaf $f
    Copy-Item $f -Destination (Join-Path $KnowledgeDir $name)
    $count++
}

# PROJECT_INSTRUCTIONS와 README도 zip 루트에 함께 (Knowledge가 아니라 참고용)
Copy-Item "claude_project_pack/PROJECT_INSTRUCTIONS.md" -Destination (Join-Path $Stage "PROJECT_INSTRUCTIONS.md")
Copy-Item "claude_project_pack/README.md" -Destination (Join-Path $Stage "README.md")

# zip 생성
$Out = Join-Path $env:TEMP "claude_project_knowledge.zip"
if (Test-Path $Out) { Remove-Item $Out }
Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Out

# 정리
Remove-Item -Recurse -Force $Stage

$Size = "{0:N0} KB" -f ((Get-Item $Out).Length / 1KB)

Write-Host ""
Write-Host "────────────────────────────────────────────────"
Write-Host "  번들: $Out"
Write-Host "  파일: $count개 (knowledge/) + PROJECT_INSTRUCTIONS.md + README.md"
Write-Host "  크기: $Size"
Write-Host ""
Write-Host "  다음 단계:"
Write-Host "    1) 압축 풀기 (탐색기에서 zip 우클릭 → 압축 풀기)"
Write-Host "       또는: Expand-Archive '$Out' -DestinationPath '$HOME\claude_project_bundle'"
Write-Host "    2) claude.ai → Projects → New project"
Write-Host "    3) Custom instructions에 PROJECT_INSTRUCTIONS.md 내용 붙여넣기"
Write-Host "    4) Add knowledge → '~\claude_project_bundle\knowledge\' 안의 파일 전부 드래그"
Write-Host "    5) 첫 명령: 블 (민+가+행) 7 ㄱㄱ"
Write-Host "────────────────────────────────────────────────"
