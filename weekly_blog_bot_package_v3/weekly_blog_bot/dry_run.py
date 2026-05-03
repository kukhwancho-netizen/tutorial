"""dry-run용 샘플 데이터.

실제 API 호출 없이 오케스트레이터/저장/리포트 흐름만 검증하기 위한 고정 샘플.
검수자 verdict는 모두 ``skipped``로 두어 회귀 테스트가 검수 로직을 우회한다.
"""
from __future__ import annotations

import datetime as dt
from typing import Any, Dict, Optional


def make_dry_run_spec(config: Dict[str, Any], basis: dt.datetime,
                      order: Optional[Any] = None) -> Dict[str, Any]:
    """dry-run용 슬림 spec sketch.

    order가 주어지면 order.total 만큼의 토픽을 만들고 channel을 반영한다.
    None이면 7건 기본.
    """
    base_topics = [
        "인테리어 공사대금 일부만 인정되는 이유",
        "전세보증금 반환 지연 때 먼저 확인할 증거",
        "계약 해제 뒤 손해배상 청구에서 놓치는 항목",
        "유류분 청구 전 증여 내역을 확인하는 순서",
        "양육비 미지급 때 이행명령과 감치의 차이",
        "영업정지 처분을 받은 뒤 불복기간을 놓치면 생기는 일",
        "건축 인허가 반려 사유를 다투기 전 확인할 자료",
        "부당해고 구제신청 절차에서 자주 빠뜨리는 자료",
        "임대차 계약 갱신 거절 통지의 시점 계산",
    ]
    total = order.total if order is not None else 7
    channel = order.channel if order is not None and order.channel else "블로그"
    topics = base_topics[:total] if total <= len(base_topics) else (
        base_topics + [f"법률 상담 사례 {i+1}" for i in range(total - len(base_topics))]
    )
    items = [{
        "temp_id": f"콘텐츠 {i+1}",
        "channel": channel,
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


def make_dry_run_draft(config: Dict[str, Any], basis: dt.datetime,
                       order: Optional[Any] = None) -> Dict[str, Any]:
    """dry-run용 draft 샘플.

    order가 주어지면 parent_spec_id/axis/variants를 반영해 변주 N건을 만든다.
    None이면 콘텐츠 1.풀 1건 (옛 동작).
    edit dry-run도 이 함수를 재사용 — order.target_temp_id가 있으면
    parent와 axis_value를 거기서 추출 ("콘텐츠 5.핵심" → parent=콘텐츠 5, value=핵심).
    """
    body_outline = ["배경", "법적 출발점", "확인 순서", "주의 지점", "다음 단계"]
    base_paragraphs = [
        "조국환 변호사팀은 분쟁이 시작된 시점부터 어떤 자료를 모아야 할지 단계적으로 안내합니다. 첫 단계는 계약과 통지의 시간 순서를 정리하는 일입니다.",
        "법률상 청구가 가능한 출발점은 통상 통지 시점입니다. 다만 사안에 따라 약정상 해제 사유가 별도로 있을 수 있어 우선 계약서 문언을 확인하시기 바랍니다.",
        "증거는 시점·당사자·금액의 순서로 분류해 두는 편이 유리합니다. 영수증·내용증명·문자 기록 등 기간이 짧은 자료부터 보존하시기 바랍니다.",
        "주의가 필요한 지점입니다 — 청구 금액을 단정하기 전에 손해의 범위가 어디까지 인정되는지 판례 흐름을 따져야 합니다.",
    ]

    parent = "콘텐츠 1"
    axis = "길이"
    values = ["풀"]
    if order is not None:
        if order.mode == "draft" and order.parent_spec_id:
            parent = order.parent_spec_id
            axis = order.axis or "길이"
            values = list(order.variants) if order.variants else ["풀"]
        elif order.mode == "edit" and order.target_temp_id:
            # "콘텐츠 5.핵심" → parent=콘텐츠 5, value=핵심
            parts = order.target_temp_id.rsplit(".", 1)
            if len(parts) == 2:
                parent, axis_value = parts
                values = [axis_value]
                axis = "길이"  # edit dry-run은 axis 정보 없음 — 기본값

    items = []
    for v in values:
        suffix = v[0] if v else "x"
        items.append({
            "temp_id": f"{parent}.{suffix}",
            "axis_value": v,
            "title": f"{parent} 본문 — {v}",
            "lede": "공사 결과에 다툼이 있어 어떤 자료부터 모아야 할지 막막한 상황이라면, 계약과 통지의 시간 순서부터 정리하시기 바랍니다.",
            "body_outline": body_outline,
            "body_paragraphs": base_paragraphs,
            "claims": [
                {"value": "계약서 문언 우선", "tag": "원칙",
                 "source": "민법 일반론 및 트랙 1 작성 규칙 (FRWRITER)"},
            ],
            "tone_profile": "법률상담",
            "length_target": {"min_chars": 600, "max_chars": 900},
            "risk": {"level": "low",
                     "reason": "dry-run 샘플. 검수는 skipped로 분리한다.",
                     "human_gate_required": False},
            "status": "publish_candidate",
        })
    return {
        "order": config["order"]["trigger_text"],
        "basis_date": basis.strftime("%Y-%m-%d"),
        "parent_spec_id": parent,
        "parent_basis_date": basis.strftime("%Y-%m-%d"),
        "axis": axis,
        "items": items,
        "batch_risk": "low",
        "handoff": "dry-run handoff placeholder",
    }


def make_dry_run_review(reviewer: str, spec: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """spec이 주어지면 그 temp_id를 미러링한다 (draft 호환)."""
    if spec is not None:
        temp_ids = [it["temp_id"] for it in spec.get("items", [])]
    else:
        temp_ids = [f"콘텐츠 {i+1}" for i in range(7)]
    return {
        "reviewer": reviewer,
        "verdict": "skipped",
        "one_line_conclusion": "dry-run은 검수 로직을 실행하지 않고 오케스트레이터·파일쓰기만 확인한다.",
        "item_results": [
            {"temp_id": tid, "status": "skipped", "issues": [],
             "repair_instruction": "해당 없음 [dry-run skipped]"}
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
