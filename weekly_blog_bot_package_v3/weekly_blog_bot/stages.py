"""파이프라인 단계 함수.

각 단계는 ``StageContext``를 받아 같은 컨텍스트를 갱신해 돌려준다.
이 모듈은 흐름의 모양을 보여주는 역할이고, 실제 외부 호출은 adapters에 위임한다.
"""
from __future__ import annotations

import json
import sys
import uuid
from typing import Any, Dict, Optional

from .adapters import calendar as calendar_adapter
from .adapters import notifications
from .adapters.openai_client import (
    call_openai_json,
    validate_configured_models,
    validate_json,
)
from .budget import enforce_context_budget
from .domain import StageContext, CalendarAuthError, MalformedModelJSONError
from .dry_run import (
    make_dry_run_review,
    make_dry_run_spec,
    make_fallback_reviewer_result,
)
from .pass_def import SPEC_PASS, BatchPass
from .reporting import build_report_from_data, render_report_markdown
from .settings import (
    REVIEWERS,
    load_environment,
    load_json,
    load_text,
    load_yaml,
    make_paths,
    model_facing_config,
    model_ids_from_config,
    now_in_tz,
    resolve_reviewer_model,
    write_json,
)


# ---------- 단계 1: 준비 ----------

def stage_prepare(config_path, *, dry_run: bool, no_calendar: bool,
                  pass_: BatchPass = SPEC_PASS,
                  order: Optional[Any] = None) -> StageContext:
    """env 로드 + config 로드 + 경로/스키마 준비.

    pass_의 schema_file을 ctx.spec_schema에 로드한다 (본 라운드는 spec_batch만
    가능). order가 주어지면 StageContext에 보존돼 generator payload에 흘러간다.
    """
    load_environment()
    config = load_yaml(config_path)
    if no_calendar:
        config.setdefault("calendar", {})["enabled"] = False
        config.setdefault("outputs", {})["create_calendar_event"] = False
    paths = make_paths(config_path, config)
    paths.outputs.mkdir(parents=True, exist_ok=True)
    tz = config.get("timezone", "Asia/Seoul")
    basis = now_in_tz(tz)
    run_id = f"weekly-{basis.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
    ctx = StageContext(
        config=config,
        config_path=config_path,
        paths=paths,
        basis=basis,
        run_id=run_id,
        dry_run=dry_run,
        no_calendar=no_calendar,
    )
    ctx.spec_schema = load_json(paths.schemas / pass_.schema_file)
    ctx.reviewer_schema = load_json(paths.schemas / "reviewer_result.schema.json")
    ctx.report_schema = load_json(paths.schemas / "final_report.schema.json")
    ctx.pass_label = pass_.output_label
    ctx.order = order
    return ctx


# ---------- 단계 2: dry-run vs live ----------

def stage_dry_run(ctx: StageContext) -> StageContext:
    """dry-run 분기: 샘플 spec/reviews만 만들고 검수 호출은 건너뛴다."""
    ctx.spec = make_dry_run_spec(ctx.config, ctx.basis)
    validate_json(ctx.spec_schema, ctx.spec, "WeeklySpecBatch")
    ctx.reviews = {r: make_dry_run_review(r) for r in REVIEWERS}
    for r, data in ctx.reviews.items():
        validate_json(ctx.reviewer_schema, data, f"ReviewerResult-{r}")
    return ctx


def stage_validate_models_if_required(ctx: StageContext) -> StageContext:
    """live 진입 전 자동 모델 검증."""
    mv_cfg = ctx.config.get("model_validation", {})
    if mv_cfg.get("required_before_live_run", True):
        validate_configured_models(ctx.config_path, ping=bool(mv_cfg.get("ping", True)))
    return ctx


def stage_fetch_calendar(ctx: StageContext) -> StageContext:
    ctx.calendar_context = calendar_adapter.fetch_calendar_context(ctx.config, ctx.basis)
    return ctx


# ---------- 단계 3: 생성 ----------

def _make_order_payload(ctx: StageContext) -> Dict[str, Any]:
    """generator/repair 단계 모델 입력. spec OrderSpec 내용이 있으면 함께 전달."""
    order = ctx.order
    base_order: Dict[str, Any] = {"trigger_text": ctx.config["order"]["trigger_text"]}
    if order is not None:
        base_order.update({
            "mode": order.mode,
            "raw": order.raw,
            "channel": order.channel,
            "distribution": list(order.distribution),
            "total": order.total,
        })
    return {
        "order": base_order,
        "basis_date": ctx.basis.strftime("%Y-%m-%d"),
        "calendar_context": ctx.calendar_context,
        "completed_topic_snapshot": (ctx.calendar_context or {}).get("events", {}).get("completed_topic_db", []),
        "performance_snapshot": (ctx.calendar_context or {}).get("events", {}).get("performance_db", []),
        "case_law_policy": ctx.config.get("knowledge", {}).get("case_law", {}),
        "config": model_facing_config(ctx.config),
    }


def stage_generate(ctx: StageContext, *, client: Any,
                   pass_: BatchPass = SPEC_PASS) -> StageContext:
    """배치 생성 단계 — pass_별 schema/prompt를 사용한다."""
    payload = _make_order_payload(ctx)
    enforce_context_budget(ctx.config, payload, f"generator-{pass_.name}")
    openai_cfg = ctx.config.get("openai", {})
    model_ids = model_ids_from_config(ctx.config)
    max_tokens = int(openai_cfg.get("max_output_tokens", 12000))
    use_web = bool(openai_cfg.get("use_web_search", True)) and pass_.use_web_search
    result = call_openai_json(
        client=client,
        model=model_ids["generator"],
        instructions=load_text(ctx.paths.prompts / pass_.generator_prompt_file),
        payload=payload,
        schema=ctx.spec_schema,
        schema_name=pass_.schema_name,
        max_output_tokens=max_tokens,
        use_web_search=use_web,
    )
    ctx.spec = result.data
    ctx.usage.add(model_ids["generator"], result.usage)
    return ctx


# 옛 이름 호환용 alias.
def stage_generate_spec(ctx: StageContext, *, client: Any) -> StageContext:
    return stage_generate(ctx, client=client, pass_=SPEC_PASS)


# ---------- 단계 4: 검수 ----------

def _call_reviewer(
    *,
    client: Any,
    ctx: StageContext,
    reviewer: str,
    stage_label: str,
    pass_: BatchPass,
) -> Dict[str, Any]:
    openai_cfg = ctx.config.get("openai", {})
    max_tokens = int(openai_cfg.get("max_output_tokens", 12000))
    use_web = bool(openai_cfg.get("use_web_search", True)) and pass_.use_web_search
    reviewer_payload = {
        "spec_batch": ctx.spec,
        "config": model_facing_config(ctx.config),
        "calendar_context": ctx.calendar_context,
    }
    enforce_context_budget(ctx.config, reviewer_payload, stage_label)
    reviewer_model = resolve_reviewer_model(ctx.config, reviewer)
    try:
        reviewer_result = call_openai_json(
            client=client,
            model=reviewer_model,
            instructions=load_text(ctx.paths.prompts / pass_.reviewer_prompt_files[reviewer]),
            payload=reviewer_payload,
            schema=ctx.reviewer_schema,
            schema_name="ReviewerResult",
            max_output_tokens=max_tokens,
            use_web_search=(reviewer == "R2" and use_web),
        )
        ctx.usage.add(reviewer_model, reviewer_result.usage)
        return reviewer_result.data
    except MalformedModelJSONError as exc:
        return make_fallback_reviewer_result(
            reviewer, ctx.spec, f"{stage_label} {reviewer} malformed JSON: {exc}"
        )


def stage_review(ctx: StageContext, *, client: Any,
                 pass_: BatchPass = SPEC_PASS) -> StageContext:
    reviews: Dict[str, Dict[str, Any]] = {}
    for reviewer in ctx.config.get("review", {}).get("reviewers", REVIEWERS):
        reviews[reviewer] = _call_reviewer(
            client=client, ctx=ctx, reviewer=reviewer,
            stage_label=f"review-{pass_.name}-{reviewer}", pass_=pass_,
        )
    ctx.reviews = reviews
    return ctx


# ---------- 단계 5: 보정 ----------

def stage_repair_if_needed(ctx: StageContext, *, client: Any,
                           pass_: BatchPass = SPEC_PASS) -> StageContext:
    needs_repair = any(data["verdict"] in {"partial", "fail"} for data in ctx.reviews.values())
    max_repair_rounds = int(ctx.config.get("review", {}).get("max_repair_rounds", 1))
    if not (needs_repair and max_repair_rounds > 0):
        return ctx

    ctx.repair_attempted = True
    openai_cfg = ctx.config.get("openai", {})
    max_tokens = int(openai_cfg.get("max_output_tokens", 12000))
    use_web = bool(openai_cfg.get("use_web_search", True)) and pass_.use_web_search
    model_ids = model_ids_from_config(ctx.config)
    repair_payload = {
        "spec_batch": ctx.spec,
        "reviews": ctx.reviews,
        "config": model_facing_config(ctx.config),
    }
    enforce_context_budget(ctx.config, repair_payload, f"repair-{pass_.name}")
    try:
        repair_result = call_openai_json(
            client=client,
            model=model_ids["repair"],
            instructions=load_text(ctx.paths.prompts / pass_.repair_prompt_file),
            payload=repair_payload,
            schema=ctx.spec_schema,
            schema_name=pass_.schema_name,
            max_output_tokens=max_tokens,
            use_web_search=use_web,
        )
        ctx.spec = repair_result.data
        ctx.usage.add(model_ids["repair"], repair_result.usage)
    except MalformedModelJSONError as exc:
        # 보정 결과 자체가 깨졌으면 자동 보류로 떨어진다.
        ctx.reviews["R2"] = make_fallback_reviewer_result(
            "R2", ctx.spec, f"repair malformed JSON: {exc}"
        )
        return ctx

    # 보정 성공: 재검수.
    repaired_reviews: Dict[str, Dict[str, Any]] = {}
    for reviewer in list(ctx.reviews.keys()):
        repaired_reviews[reviewer] = _call_reviewer(
            client=client, ctx=ctx, reviewer=reviewer,
            stage_label=f"post-repair-{pass_.name}-{reviewer}", pass_=pass_,
        )
    ctx.reviews = repaired_reviews
    return ctx


# ---------- 단계 6: 리포트 ----------

def stage_build_report(ctx: StageContext) -> StageContext:
    ctx.report = build_report_from_data(
        run_id=ctx.run_id,
        spec=ctx.spec,
        reviews=ctx.reviews,
        repair_attempted=ctx.repair_attempted,
        usage_by_model=ctx.usage.by_model,
        dry_run=ctx.dry_run,
        config=ctx.config,
    )
    validate_json(ctx.report_schema, ctx.report, "WeeklyFinalReport")
    ctx.markdown = render_report_markdown(ctx.report, ctx.reviews)
    return ctx


# ---------- 단계 7: 저장 ----------

def stage_persist(ctx: StageContext) -> StageContext:
    date_part = ctx.basis.strftime("%Y-%m-%d")
    label = f"_{ctx.pass_label}" if ctx.pass_label else ""
    ctx.json_path = ctx.paths.outputs / f"{date_part}_{ctx.run_id}{label}_weekly_report.json"
    ctx.md_path = ctx.paths.outputs / f"{date_part}_{ctx.run_id}{label}_weekly_report.md"
    if ctx.config.get("outputs", {}).get("save_json", True):
        write_json(ctx.json_path, {"report": ctx.report, "spec_batch": ctx.spec, "reviews": ctx.reviews})
    if ctx.config.get("outputs", {}).get("save_markdown", True):
        ctx.md_path.write_text(ctx.markdown, encoding="utf-8")
    return ctx


# ---------- 단계 8: 캘린더 쓰기 ----------

def stage_write_calendar(ctx: StageContext) -> StageContext:
    if ctx.dry_run:
        return ctx
    try:
        ctx.calendar_event_id = calendar_adapter.write_calendar_result(
            ctx.config, ctx.basis, ctx.markdown
        )
    except CalendarAuthError:
        # 알림은 main()의 abort 핸들러가 단일 채널로 보낸다 (이중 통보 방지).
        raise
    except Exception as exc:
        print(f"[calendar-write-skipped] {exc}", file=sys.stderr)
    return ctx


# ---------- 단계 9: 알림 ----------

def stage_notify(ctx: StageContext) -> StageContext:
    events = notifications.notification_events_from_report(ctx.report)
    if not events:
        return ctx
    summary = ctx.report.get("summary", {})
    title = f"주간 블로그 봇 알림: {', '.join(events)}"
    body = (
        f"run_id={ctx.report.get('run_id')}\n"
        f"basis_date={ctx.report.get('basis_date')}\n"
        f"통과={summary.get('publish_candidates')} / 수정={summary.get('needs_repair')} "
        f"/ 보류={summary.get('blocked')} / 사람확인={summary.get('human_gate')}\n"
        f"report={ctx.md_path}"
    )
    notifications.send_notification(ctx.config, title=title, body=body, events=events)
    return ctx


# ---------- abort 리포트 ----------

def write_abort_report(config_path, exc: Exception, *,
                       pass_label: Optional[str] = None) -> Dict[str, Any]:
    """abort 시 최소한의 결과 파일을 남기고 알림을 보낸다.

    pass_label이 주어지면 abort 파일명에도 spec/draft 라벨이 박혀, 같은 시각에
    여러 PASS가 abort했을 때 구분 가능하다.
    """
    config = load_yaml(config_path) if config_path.exists() else {}
    paths = make_paths(config_path, config)
    paths.outputs.mkdir(parents=True, exist_ok=True)
    tz = config.get("timezone", "Asia/Seoul")
    basis = now_in_tz(tz)
    run_id = f"weekly-{basis.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
    category = getattr(exc, "category", "aborted")
    details = getattr(exc, "details", {})
    report = {
        "run_id": run_id,
        "run_status": "aborted",
        "basis_date": basis.strftime("%Y-%m-%d"),
        "order": config.get("order", {}).get("trigger_text", "unknown"),
        "summary": {"publish_candidates": 0, "needs_repair": 0, "blocked": 0, "human_gate": 0, "dry_run_skipped": 0},
        "usage": {
            "by_model": {},
            "total": {"input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0, "web_search_calls": 0},
            "estimated_cost_usd": 0.0,
            "cost_warnings": [],
        },
        "error": {"category": category, "message": str(exc), "details": details},
        "items": [],
        "next_actions": ["aborted 원인을 확인하고, 필요 시 OAuth·모델 ID·컨텍스트 예산을 수정한다."],
    }
    # final_report.schema.json에 abort 모양도 통과하도록 error를 옵셔널 필드로 둔다.
    # 검증이 가능하면 시도하되, 스키마 로드 실패는 abort 경로를 막지 않는다.
    try:
        schema = load_json(paths.schemas / "final_report.schema.json")
        validate_json(schema, report, "WeeklyFinalReport(aborted)")
    except Exception as schema_exc:  # noqa: BLE001 — abort 경로는 추가 abort를 던지지 않는다
        report["next_actions"].append(
            f"abort report schema 검증 실패(무시): {schema_exc}"
        )

    date_part = basis.strftime("%Y-%m-%d")
    label = f"_{pass_label}" if pass_label else ""
    json_path = paths.outputs / f"{date_part}_{run_id}{label}_abort_report.json"
    md_path = paths.outputs / f"{date_part}_{run_id}{label}_abort_report.md"
    write_json(json_path, {"report": report})
    md_path.write_text(
        f"# 주간 블로그 봇 중단 보고 — {date_part}\n\n"
        f"- run_id: {run_id}\n"
        f"- run_status: aborted\n"
        f"- category: {category}\n"
        f"- message: {str(exc)}\n\n"
        f"## details\n\n```json\n{json.dumps(details, ensure_ascii=False, indent=2)}\n```\n",
        encoding="utf-8",
    )
    notifications.send_notification(
        config,
        title=f"주간 블로그 봇 중단: {category}",
        body=f"run_id={run_id}\nmessage={str(exc)}\nreport={md_path}",
        events=["aborted", category],
    )
    return {
        "run_id": run_id,
        "json_path": str(json_path),
        "markdown_path": str(md_path),
        "run_status": "aborted",
        "error_category": category,
    }
