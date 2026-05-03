"""주간 블로그 편성봇 패키지.

기존 ``import weekly_blog_bot as bot`` 호환을 위해 자주 쓰이는 심볼을 노출한다.
실제 로직은 하위 모듈(``settings``, ``stages``, ``reporting``, ``decision``,
``budget``, ``dry_run``, ``adapters/*``)에 있다.
"""
from . import runner, stages  # noqa: F401
from .adapters.openai_client import (  # noqa: F401
    STRICT_UNSUPPORTED_KEYS,
    extract_output_text,
    response_usage,
    schema_for_openai,
    validate_configured_models,
    validate_json,
)
from .adapters.notifications import (  # noqa: F401
    notification_events_from_report,
    send_notification,
    should_notify,
)
from .budget import enforce_context_budget, estimate_payload_tokens  # noqa: F401
from .decision import (  # noqa: F401
    FINAL_BLOCKED,
    FINAL_DRY_RUN,
    FINAL_NEEDS_REPAIR,
    FINAL_PASS,
    ItemDecisionInput,
    decide_final_status,
    decision_input_from,
)
from .domain import ModelCallResult, StageContext, UsageByModel  # noqa: F401
from .dry_run import (  # noqa: F401
    make_dry_run_draft,
    make_dry_run_review,
    make_dry_run_spec,
    make_fallback_reviewer_result,
)
from .reporting import (  # noqa: F401
    build_report_from_data,
    build_sketch_report_from_data,
    estimate_cost_usd,
    merge_usage,
    next_actions_for_summary,
    render_draft_item_markdown,
    render_item_markdown,
    render_report_markdown,
    render_sketch_report_markdown,
    render_spec_item_markdown,
)
from .domain import (  # noqa: F401
    CalendarAuthError,
    Err,
    MalformedModelJSONError,
    Ok,
    PipelineAbort,
    Result,
)
from .pass_def import (  # noqa: F401
    DRAFT_PASS,
    PASS_BY_NAME,
    SPEC_PASS,
    BatchPass,
    OrderParseError,
    OrderSpec,
    order_from_args,
    parse_order,
    pass_for,
)
from .settings import (  # noqa: F401
    REVIEWERS,
    Paths,
    iso,
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


def run(*args, **kwargs):
    """기존 ``weekly_blog_bot.run`` 호환."""
    return runner.run(*args, **kwargs)
