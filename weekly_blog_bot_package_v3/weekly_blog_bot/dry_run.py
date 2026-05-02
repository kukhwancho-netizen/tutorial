"""dry-run용 샘플 데이터.

실제 API 호출 없이 오케스트레이터/저장/리포트 흐름만 검증하기 위한 고정 샘플.
검수자 verdict는 모두 ``skipped``로 두어 회귀 테스트가 검수 로직을 우회한다.
"""
from __future__ import annotations

import datetime as dt
from typing import Any, Dict


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
