"""리포트 생성 + 비용 추정 + 마크다운 렌더.

검수 결과 묶기 단계에서 ID 중복·누락 검증으로 KeyError를 차단한다 (P1 결함 방지).
최종 상태 판정은 decision 모듈의 의사결정 표를 호출한다.
"""
from __future__ import annotations

import sys
import textwrap
from typing import Any, Dict, Iterable, List, Optional

from .decision import (
    FINAL_BLOCKED,
    FINAL_DRY_RUN,
    FINAL_NEEDS_REPAIR,
    FINAL_PASS,
    decide_final_status,
    decision_input_from,
)
from .dry_run import make_fallback_reviewer_result


# ---------- 비용 ----------

def merge_usage(usages: Iterable[Dict[str, int]]) -> Dict[str, int]:
    total = {"input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0, "web_search_calls": 0}
    for usage in usages:
        for key in total:
            total[key] += int(usage.get(key, 0))
    return total


def estimate_cost_usd(
    config: Dict[str, Any],
    usage_by_model: Dict[str, Dict[str, int]],
    *,
    warnings: Optional[List[str]] = None,
) -> float:
    pricing = config.get("cost", {}).get("pricing", {}).get("openai", {})
    web_price_per_1k = float(config.get("cost", {}).get("pricing", {}).get("web_search_per_1k_calls_usd", 10.0))
    total = 0.0
    web_calls = 0
    for model_id, usage in usage_by_model.items():
        if model_id not in pricing:
            msg = f"pricing not configured for model_id={model_id}; cost contribution treated as 0.0"
            print(f"[cost-warning] {msg}", file=sys.stderr)
            if warnings is not None:
                warnings.append(msg)
        p = pricing.get(model_id, {})
        input_price = float(p.get("input_per_1m_usd", 0.0))
        cached_price = float(p.get("cached_input_per_1m_usd", input_price))
        output_price = float(p.get("output_per_1m_usd", 0.0))
        input_tokens = int(usage.get("input_tokens", 0))
        cached_tokens = int(usage.get("cached_input_tokens", 0))
        uncached_tokens = max(input_tokens - cached_tokens, 0)
        total += (uncached_tokens / 1_000_000) * input_price
        total += (cached_tokens / 1_000_000) * cached_price
        total += (int(usage.get("output_tokens", 0)) / 1_000_000) * output_price
        web_calls += int(usage.get("web_search_calls", 0))
    total += (web_calls / 1000) * web_price_per_1k
    return round(total, 6)


# ---------- 검수 결과 매핑 (P1 방지) ----------

def _coverage_check_or_fix(
    reviews: Dict[str, Dict[str, Any]],
    spec: Dict[str, Any],
) -> Dict[str, Dict[str, Any]]:
    """각 검수자의 item_results가 spec의 모든 temp_id를 정확히 한 번씩 다루는지 검증.

    중복 또는 누락이 있으면 해당 검수자 결과를 fallback fail로 대체한다.
    schema 단계에서 ``minItems:7, maxItems:7``은 강제하지만 ``temp_id`` 유일성은
    검사하지 않으므로 여기서 안전망을 둔다 (P1 코덱스 결함 방지).
    """
    expected_ids = [item["temp_id"] for item in spec["items"]]
    expected_set = set(expected_ids)
    fixed = {}
    for reviewer, data in reviews.items():
        ids_seen: List[str] = [r["temp_id"] for r in data["item_results"]]
        seen_set = set(ids_seen)
        duplicates = len(ids_seen) != len(seen_set)
        missing = expected_set - seen_set
        unexpected = seen_set - expected_set
        if duplicates or missing or unexpected:
            reason = (
                f"{reviewer} item_results coverage broken: "
                f"duplicates={duplicates}, missing={sorted(missing)}, unexpected={sorted(unexpected)}"
            )
            fixed[reviewer] = make_fallback_reviewer_result(reviewer, spec, reason)
        else:
            fixed[reviewer] = data
    return fixed


# ---------- 리포트 빌드 ----------

def build_report_from_data(
    *,
    run_id: str,
    spec: Dict[str, Any],
    reviews: Dict[str, Dict[str, Any]],
    repair_attempted: bool = False,
    usage_by_model: Optional[Dict[str, Dict[str, int]]] = None,
    dry_run: bool = False,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    config = config or {}

    # 결함 방지: 검수 결과 ID 중복·누락 시 fallback로 대체.
    reviews = _coverage_check_or_fix(reviews, spec)

    items_out = []
    publish_candidates = 0
    needs_repair = 0
    blocked = 0
    human_gate = 0
    dry_run_skipped = 0

    # 안전 매핑: by_reviewer[reviewer][temp_id] -> item_result.
    by_reviewer = {
        reviewer: {entry["temp_id"]: entry for entry in data["item_results"]}
        for reviewer, data in reviews.items()
    }

    for item in spec["items"]:
        temp_id = item["temp_id"]
        item_reviews = {r: by_reviewer[r][temp_id] for r in by_reviewer}
        gate = bool(item["risk"].get("human_gate_required", False))
        if gate:
            human_gate += 1

        decision_in = decision_input_from(
            item=item,
            item_reviews=item_reviews,
            repair_attempted=repair_attempted,
            config=config,
        )
        final_status = decide_final_status(decision_in)
        if final_status == FINAL_DRY_RUN:
            dry_run_skipped += 1
        elif final_status == FINAL_BLOCKED:
            blocked += 1
        elif final_status == FINAL_NEEDS_REPAIR:
            needs_repair += 1
        elif final_status == FINAL_PASS:
            publish_candidates += 1

        review_summary = "; ".join(
            f"{r}: {item_reviews[r]['status']}" for r in sorted(item_reviews.keys())
        )
        items_out.append({
            "temp_id": temp_id,
            "domain": _item_domain(item, spec),
            "topic": _item_topic(item),
            "final_status": final_status,
            "risk": item["risk"]["level"],
            "review_summary": review_summary,
            "spec_markdown": render_item_markdown(item),
        })

    usage_by_model = usage_by_model or {}
    usage_total = merge_usage(usage_by_model.values())
    cost_warnings: List[str] = []
    estimated_cost = estimate_cost_usd(config, usage_by_model, warnings=cost_warnings) if usage_by_model else 0.0

    return {
        "run_id": run_id,
        "run_status": "dry_run" if dry_run else "completed",
        "basis_date": spec["basis_date"],
        "order": spec["order"],
        "summary": {
            "publish_candidates": publish_candidates,
            "needs_repair": needs_repair,
            "blocked": blocked,
            "human_gate": human_gate,
            "dry_run_skipped": dry_run_skipped,
        },
        "usage": {
            "by_model": usage_by_model,
            "total": usage_total,
            "estimated_cost_usd": estimated_cost,
            "cost_warnings": cost_warnings,
        },
        "items": items_out,
        "next_actions": next_actions_for_summary(publish_candidates, needs_repair, blocked, dry_run_skipped),
    }


# ---------- sketch 리포트 (검수 없는 spec 단계) ----------

def build_sketch_report_from_data(
    *,
    run_id: str,
    spec: Dict[str, Any],
    usage_by_model: Optional[Dict[str, Dict[str, int]]] = None,
    dry_run: bool = False,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """검수 없이 spec sketch만 묶는다. summary는 sketches/high_risk_hint만."""
    items_out = [
        {
            "temp_id": it["temp_id"],
            "channel": it["channel"],
            "topic": it["topic"],
            "risk_hint": it["risk_hint"],
            **({"rationale": it["rationale"]} if "rationale" in it else {}),
        }
        for it in spec.get("items", [])
    ]
    high_risk_hint = sum(1 for it in items_out if it["risk_hint"] == "high")

    usage_by_model = usage_by_model or {}
    usage_total = merge_usage(usage_by_model.values())
    cost_warnings: List[str] = []
    estimated_cost = estimate_cost_usd(config, usage_by_model, warnings=cost_warnings) if usage_by_model else 0.0

    next_actions = []
    if items_out:
        next_actions.append(
            "스케치 검토 후 draft 명령으로 본문 생성: 'draft 콘텐츠 N (axis values...)'"
        )
    if high_risk_hint:
        next_actions.append(
            f"risk_hint=high {high_risk_hint}건은 draft 단계에서 사람 게이트 권장"
        )

    return {
        "run_id": run_id,
        "run_status": "dry_run" if dry_run else "completed",
        "basis_date": spec["basis_date"],
        "order": spec["order"],
        "summary": {"sketches": len(items_out), "high_risk_hint": high_risk_hint},
        "usage": {
            "by_model": usage_by_model,
            "total": usage_total,
            "estimated_cost_usd": estimated_cost,
            "cost_warnings": cost_warnings,
        },
        "items": items_out,
        "next_actions": next_actions or ["처리할 후속 액션 없음"],
    }


def render_sketch_report_markdown(report: Dict[str, Any]) -> str:
    summary = report["summary"]
    usage = report.get("usage", {})
    lines = [
        f"# 주간 블로그 sketch 결과 — {report['basis_date']}",
        "",
        f"- run_id: {report['run_id']}",
        f"- run_status: {report['run_status']}",
        f"- 주문: {report['order']}",
        f"- 토픽 수: {summary['sketches']}",
        f"- risk_hint=high: {summary['high_risk_hint']}",
        f"- estimated_cost_usd: {usage.get('estimated_cost_usd', 0.0)}",
        "",
        f"## 토픽 ({summary['sketches']}건)",
        "",
    ]
    for it in report["items"]:
        lines.append(f"### {it['temp_id']} — {it['topic']}")
        lines.append("")
        lines.append(f"- 채널: {it['channel']}")
        lines.append(f"- risk_hint: {it['risk_hint']}")
        if it.get("rationale"):
            lines.append(f"- 선정 근거: {it['rationale']}")
        lines.append("")
    lines.extend(["## 다음 액션", ""])
    lines.extend(f"- {x}" for x in report["next_actions"])
    return "\n".join(lines).strip() + "\n"


def next_actions_for_summary(publish: int, repair: int, blocked: int, skipped: int) -> List[str]:
    if skipped:
        return [
            "dry-run 결과는 검수 생략 상태다. 검수 로직 회귀는 tests/ 단위 테스트로 확인한다.",
            "실제 실행 전 workflow_dispatch dry_run=false로 1회 수동 실행한다.",
        ]
    actions = []
    if publish:
        actions.append("통과 건은 사람이 제작지시서 확인 후 오키 확정")
    if repair:
        actions.append("수정 필요 건은 review_summary와 R1/R2/R3 issues 기준으로 보정")
    if blocked:
        actions.append("보류 건은 공식 원문·최신성·중복성 확인 후 재주문")
    return actions or ["처리할 후속 액션 없음"]


# ---------- 마크다운 렌더 (검수 있는 PASS, 현재는 draft) ----------

def _is_draft_item(item: Dict[str, Any]) -> bool:
    return "axis_value" in item


def _item_topic(item: Dict[str, Any]) -> str:
    return item.get("topic") or item.get("title") or item.get("temp_id", "")


def _item_domain(item: Dict[str, Any], spec: Dict[str, Any]) -> str:
    if "domain" in item:
        return item["domain"]
    axis = spec.get("axis")
    return f"draft·{axis}" if axis else "draft"


def render_item_markdown(item: Dict[str, Any]) -> str:
    """검수 PASS의 item 1건. draft 변주를 렌더."""
    if _is_draft_item(item):
        return render_draft_item_markdown(item)
    # 이 경로는 현재 사용되지 않음 (spec은 sketch 경로). 호환을 위해 남김.
    return render_spec_item_markdown(item)


def render_draft_item_markdown(item: Dict[str, Any]) -> str:
    outline = "\n".join(f"{idx+1}. {x}" for idx, x in enumerate(item["body_outline"]))
    paragraphs = "\n\n".join(item["body_paragraphs"])
    claims = "\n".join(
        f"- ({c['tag']}) {c['value']} — {c['source']}" for c in item.get("claims", [])
    )
    lt = item.get("length_target", {})
    return "\n".join([
        f"### {item['temp_id']} — {item.get('title', '')}",
        "",
        f"- 축값: {item.get('axis_value', '')}",
        f"- 톤: {item.get('tone_profile', '')}",
        f"- 길이 목표: {lt.get('min_chars', '?')}~{lt.get('max_chars', '?')}자",
        f"- 위험도: {item['risk']['level']} / 사람 확인: {item['risk']['human_gate_required']}",
        f"- lede: {item.get('lede', '')}",
        "",
        "구성안:",
        outline,
        "",
        "본문:",
        "",
        paragraphs,
        "",
        "근거:",
        claims,
    ])


def render_spec_item_markdown(item: Dict[str, Any]) -> str:
    must = "\n".join(f"- {x}" for x in item["must_include"])
    outline = "\n".join(f"{idx+1}. {x}" for idx, x in enumerate(item["outline"]))
    tags = []
    for key in ["representative", "secondary", "practical", "local"]:
        tags.extend(item["tag_strategy"].get(key, []))
    return textwrap.dedent(f"""
    ### {item['temp_id']} — {item['topic']}

    - 채널: {item['channel']}
    - 분야: {item['domain']}
    - 위험도: {item['risk']['level']} / 사람 확인: {item['risk']['human_gate_required']}
    - 독자 상황: {item['reader_situation']}
    - 핵심결론: {item['core_conclusion']}
    - 차별화 포인트: {item['differentiation']}
    - 실패 포인트: {item['failure_point']}

    반드시 포함할 내용:
    {must}

    구성안:
    {outline}

    태그 전략: {' '.join(tags)}
    제외 태그: {', '.join(item['tag_strategy'].get('excluded', []))}
    로컬반영포인트: {item['local_point']}
    연결 권장 기존 글: {item['related_existing_content']}
    """).strip()


def render_report_markdown(report: Dict[str, Any], reviews: Optional[Dict[str, Any]] = None) -> str:
    summary = report["summary"]
    usage = report.get("usage", {})
    lines = [
        f"# 주간 블로그 편성봇 결과 — {report['basis_date']}",
        "",
        f"- run_id: {report['run_id']}",
        f"- run_status: {report['run_status']}",
        f"- 주문: {report['order']}",
        f"- 통과: {summary['publish_candidates']}",
        f"- 수정 필요: {summary['needs_repair']}",
        f"- 보류: {summary['blocked']}",
        f"- 사람 확인 필요: {summary['human_gate']}",
        f"- dry-run 검수 생략: {summary['dry_run_skipped']}",
        f"- estimated_cost_usd: {usage.get('estimated_cost_usd', 0.0)}",
        "",
        f"## 항목 결과 ({len(report['items'])}건)",
        "",
    ]
    for item in report["items"]:
        lines.extend([
            f"### {item['temp_id']} — {item['topic']}",
            "",
            f"- 분야: {item['domain']}",
            f"- 최종 상태: {item['final_status']}",
            f"- 위험도: {item['risk']}",
            f"- 검수 요약: {item['review_summary']}",
            "",
            item["spec_markdown"],
            "",
        ])
    lines.extend(["## 다음 액션", ""])
    lines.extend(f"- {x}" for x in report["next_actions"])
    if reviews:
        lines.extend(["", "## R1/R2/R3 배치 판정", ""])
        for name, data in reviews.items():
            lines.append(f"- {name}: {data['verdict']} — {data['one_line_conclusion']}")
    return "\n".join(lines).strip() + "\n"
