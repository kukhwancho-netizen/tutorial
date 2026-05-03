"""dry-run용 샘플 데이터.

실제 API 호출 없이 오케스트레이터/저장/리포트 흐름만 검증하기 위한 고정 샘플.
검수자 verdict는 모두 ``skipped``로 두어 회귀 테스트가 검수 로직을 우회한다.
"""
from __future__ import annotations

import datetime as dt
from typing import Any, Dict


def make_dry_run_spec(config: Dict[str, Any], basis: dt.datetime) -> Dict[str, Any]:
    """dry-run용 슬림 spec sketch — 7건 토픽만."""
    topics = [
        "인테리어 공사대금 일부만 인정되는 이유",
        "전세보증금 반환 지연 때 먼저 확인할 증거",
        "계약 해제 뒤 손해배상 청구에서 놓치는 항목",
        "유류분 청구 전 증여 내역을 확인하는 순서",
        "양육비 미지급 때 이행명령과 감치의 차이",
        "영업정지 처분을 받은 뒤 불복기간을 놓치면 생기는 일",
        "건축 인허가 반려 사유를 다투기 전 확인할 자료",
    ]
    items = [{
        "temp_id": f"콘텐츠 {i+1}",
        "channel": "블로그",
        "topic": topic,
        "risk_hint": "low",
        "rationale": "dry-run 샘플 (DB 미조회)",
    } for i, topic in enumerate(topics)]
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


def make_dry_run_review(reviewer: str) -> Dict[str, Any]:
    return {
        "reviewer": reviewer,
        "verdict": "skipped",
        "one_line_conclusion": "dry-run은 검수 로직을 실행하지 않고 오케스트레이터·파일쓰기만 확인한다.",
        "item_results": [
            {
                "temp_id": f"콘텐츠 {i+1}",
                "status": "skipped",
                "issues": [],
                "repair_instruction": "해당 없음 [dry-run skipped]",
            }
            for i in range(7)
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
