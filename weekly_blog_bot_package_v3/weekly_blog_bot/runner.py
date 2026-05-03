"""파이프라인 오케스트레이터.

PASS의 capability(has_review / has_calendar_write)를 보고 단계를 건너뛴다.
spec sketch는 generator → report → persist 만 통과. draft 등 검수 PASS는
review/repair/calendar_write까지 통과.
"""
from __future__ import annotations

import pathlib
from typing import Any, Dict, Optional

from . import stages
from .adapters.openai_client import make_client
from .pass_def import OrderSpec, SPEC_PASS, pass_for


def run(config_path: pathlib.Path, *, dry_run: bool = False,
        no_calendar: bool = False,
        order: Optional[OrderSpec] = None) -> Dict[str, Any]:
    pass_ = pass_for(order) if order is not None else SPEC_PASS
    ctx = stages.stage_prepare(
        config_path, dry_run=dry_run, no_calendar=no_calendar,
        pass_=pass_, order=order,
    )

    if ctx.dry_run:
        ctx = stages.stage_dry_run(ctx, pass_=pass_)
    else:
        client = None
        if pass_.has_review or pass_.has_generation:
            ctx = stages.stage_validate_models_if_required(ctx)
            client = make_client()
        if pass_.name in ("spec", "draft"):
            ctx = stages.stage_fetch_calendar(ctx)
        if pass_.has_generation:
            ctx = stages.stage_generate(ctx, client=client, pass_=pass_)
        # edit 모드: stage_prepare가 이미 ctx.spec을 디스크에서 로드해 둠
        if pass_.has_review:
            ctx = stages.stage_review(ctx, client=client, pass_=pass_)
            ctx = stages.stage_repair_if_needed(ctx, client=client, pass_=pass_)

    ctx = stages.stage_build_report(ctx)
    ctx = stages.stage_persist(ctx)
    if pass_.has_calendar_write:
        ctx = stages.stage_write_calendar(ctx)
    ctx = stages.stage_notify(ctx)

    usage = ctx.report.get("usage", {}) or {}
    return {
        "run_id": ctx.run_id,
        "run_status": ctx.report["run_status"],
        "basis_date": ctx.basis.strftime("%Y-%m-%d"),
        "pass": pass_.name,
        "json_path": str(ctx.json_path),
        "markdown_path": str(ctx.md_path),
        "calendar_event_id": ctx.calendar_event_id,
        "summary": ctx.report["summary"],
        "estimated_cost_usd": usage.get("estimated_cost_usd", 0.0),
        "cost_warnings": usage.get("cost_warnings", []),
    }
