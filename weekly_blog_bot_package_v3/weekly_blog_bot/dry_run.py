"""dry-run용 샘플 데이터.

실제 API 호출 없이 오케스트레이터/저장/리포트 흐름만 검증하기 위한 고정 샘플.
검수자 verdict는 모두 ``skipped``로 두어 회귀 테스트가 검수 로직을 우회한다.
"""
from __future__ import annotations

import datetime as dt
from typing import Any, Dict, Optional


def make_dry_run_spec(config: Dict[str, Any], basis: dt.datetime) -> Dict[str, Any]:
    domains = [
        "민사(건물하자)", "민사(부동산)", "민사(계약)",
        "가사(상속/유류분)", "가사(양육비)",
        "행정", "행정(인허가)",
    ]
    topics = [
        "인테리어 공사대금 일부만 인정되는 이유",
        "전세보증금 반환 지연 때 먼저 확인할 증거",
        "계약 해제 뒤 손해배상 청구에서 놓치는 항목",
        "유류분 청구 전 증여 내역을 확인하는 순서",
        "양육비 미지급 때 이행명령과 감치의 차이",
        "영업정지 처분을 받은 뒤 불복기간을 놓치면 생기는 일",
        "건축 인허가 반려 사유를 다투기 전 확인할 자료",
    ]
    items = []
    for i in range(7):
        items.append({
            "temp_id": f"콘텐츠 {i+1}",
            "channel": "블로그",
            "domain": domains[i],
            "topic": topics[i],
            "reader_situation": "분쟁이 시작됐지만 어떤 자료부터 확인해야 할지 모르는 상황",
            "core_conclusion": "먼저 계약·통지·증거의 순서를 맞춰야 한다.",
            "differentiation": "결론보다 입증 순서를 먼저 정리하는 글로 설계한다.",
            "failure_point": "자료 순서가 어긋나면 청구 금액이나 불복 사유가 불분명해진다.",
            "must_include": ["법적 출발점", "증거 체크", "실무상 실패 지점"],
            "outline": ["법적 출발점", "오해 교정", "증거 준비", "놓치면 생기는 일", "실무 판단 기준", "FAQ"],
            "keyword_strategy": {
                "primary_naver": topics[i].split()[0] + " 상담",
                "primary_google_ai": topics[i] + " 판단 기준",
                "secondary": ["법률상담", "소송 준비"],
                "longtail": [topics[i] + " 증거", topics[i] + " 절차"],
                "practical": ["내용증명", "증거정리"],
                "local": [],
                "intro_reflected": [topics[i].split()[0]],
                "ai_friendly_section": "H2-1 첫 문장",
            },
            "tag_strategy": {
                "representative": ["#법률상담", "#소송준비"],
                "secondary": ["#증거정리", "#분쟁대응"],
                "practical": ["#내용증명"],
                "local": [],
                "excluded": ["#승소"],
                "total_count": 5,
            },
            "local_point": "해당 없음 [dry-run 샘플에는 지역 절차 차이가 입력되지 않음]",
            "related_existing_content": "캘린더 완료 주제 DB 미조회 dry-run",
            "claims": [
                {"value": "블로그 FAQ 2~3개", "tag": "원칙",
                 "source": "config/weekly_blog_bot.yaml 및 트랙 1 블로그 규칙"},
                {"value": "high risk는 사람 승인", "tag": "원칙",
                 "source": "config review.block_high_risk=true"},
            ],
            "risk": {"level": "low", "reason": "dry-run 샘플. 검수는 skipped로 분리한다.",
                     "human_gate_required": False},
            "status": "publish_candidate",
        })
    return {
        "order": config["order"]["trigger_text"],
        "basis_date": basis.strftime("%Y-%m-%d"),
        "context_summary": {
            "calendar_window": "dry-run",
            "used_sources": ["dry-run sample"],
            "excluded_sources": ["calendar disabled in dry-run"],
            "duplicate_scan_basis": ["dry-run placeholder"],
        },
        "items": items,
        "batch_risk": "low",
        "handoff": "dry-run handoff placeholder",
    }


def make_dry_run_draft(config: Dict[str, Any], basis: dt.datetime) -> Dict[str, Any]:
    """dry-run용 draft 배치 샘플 (parent='콘텐츠 1', axis='길이', 1개 변주).

    실제 draft 명령의 parent_spec_id/axis/variants를 알 필요 없이 오케스트레이터·
    저장·리포트 흐름을 검증하기 위한 최소 샘플이다.
    """
    body_outline = ["배경", "법적 출발점", "확인 순서", "주의 지점", "다음 단계"]
    body_paragraphs = [
        "조국환 변호사팀은 분쟁이 시작된 시점부터 어떤 자료를 모아야 할지 단계적으로 안내합니다. 첫 단계는 계약과 통지의 시간 순서를 정리하는 일입니다.",
        "법률상 청구가 가능한 출발점은 통상 통지 시점입니다. 다만 사안에 따라 약정상 해제 사유가 별도로 있을 수 있어 우선 계약서 문언을 확인하시기 바랍니다.",
        "증거는 시점·당사자·금액의 순서로 분류해 두는 편이 유리합니다. 영수증·내용증명·문자 기록 등 기간이 짧은 자료부터 보존하시기 바랍니다.",
        "주의가 필요한 지점입니다 — 청구 금액을 단정하기 전에 손해의 범위가 어디까지 인정되는지 판례 흐름을 따져야 합니다.",
    ]
    items = [{
        "temp_id": "콘텐츠 1.풀",
        "axis_value": "풀",
        "title": "건물하자 분쟁에서 먼저 확인할 증거 정리 — 풀버전",
        "lede": "공사 결과에 다툼이 있어 어떤 자료부터 모아야 할지 막막한 상황이라면, 계약과 통지의 시간 순서부터 정리하시기 바랍니다.",
        "body_outline": body_outline,
        "body_paragraphs": body_paragraphs,
        "claims": [
            {"value": "계약서 문언 우선", "tag": "원칙",
             "source": "민법 일반론 및 트랙 1 작성 규칙 (FRWRITER)"},
        ],
        "tone_profile": "법률상담",
        "length_target": {"min_chars": 600, "max_chars": 900},
        "risk": {"level": "low", "reason": "dry-run 샘플. 검수는 skipped로 분리한다.",
                 "human_gate_required": False},
        "status": "publish_candidate",
    }]
    return {
        "order": config["order"]["trigger_text"],
        "basis_date": basis.strftime("%Y-%m-%d"),
        "parent_spec_id": "콘텐츠 1",
        "parent_basis_date": basis.strftime("%Y-%m-%d"),
        "axis": "길이",
        "items": items,
        "batch_risk": "low",
        "handoff": "dry-run handoff placeholder",
    }


def make_dry_run_review(reviewer: str, spec: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """검수자 더미 결과. spec이 주어지면 그 temp_id를 그대로 미러링한다 (draft 호환).

    spec=None인 경우 옛 동작(콘텐츠 1~7)을 유지한다 — 외부 호출자 호환.
    """
    if spec is not None:
        temp_ids = [it["temp_id"] for it in spec.get("items", [])]
    else:
        temp_ids = [f"콘텐츠 {i+1}" for i in range(7)]
    return {
        "reviewer": reviewer,
        "verdict": "skipped",
        "one_line_conclusion": "dry-run은 검수 로직을 실행하지 않고 오케스트레이터·파일쓰기만 확인한다.",
        "item_results": [
            {
                "temp_id": tid,
                "status": "skipped",
                "issues": [],
                "repair_instruction": "해당 없음 [dry-run skipped]",
            }
            for tid in temp_ids
        ],
        "batch_issues": ["dry_run_skipped"],
    }


def make_fallback_reviewer_result(reviewer: str, spec: Dict[str, Any], reason: str) -> Dict[str, Any]:
    return {
        "reviewer": reviewer,
        "verdict": "fail",
        "one_line_conclusion": reason[:180],
        "item_results": [
            {
                "temp_id": item["temp_id"],
                "status": "fail",
                "issues": [
                    {
                        "severity": "치명",
                        "quote": "모델 응답 또는 보정 결과",
                        "reason": reason,
                        "rule_ref": "pipeline-malformed-json",
                    }
                ],
                "repair_instruction": "자동 보류. 사람이 JSON/검수 결과를 확인해야 한다.",
            }
            for item in spec.get("items", [])
        ],
        "batch_issues": ["fallback_reviewer_result"],
    }
