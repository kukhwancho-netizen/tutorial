"""OpenAI Responses API 호출, 스키마 sanitizer, 모델 검증.

OpenAI strict json_schema 모드는 일부 키워드를 거절한다. 길이/개수 제약은
클라이언트 사이드 ``validate_json``으로 강제하고, 스키마는 sanitize 후 보낸다.
"""
from __future__ import annotations

import copy
import json
import os
import pathlib
from typing import Any, Dict, List

from jsonschema import Draft202012Validator

from ..domain import ModelCallResult
from ..domain import MalformedModelJSONError, PipelineAbort
from ..settings import load_yaml, model_ids_from_config

try:  # pragma: no cover
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None  # type: ignore


STRICT_UNSUPPORTED_KEYS = {
    "pattern", "minLength", "maxLength",
    "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
    "minItems", "maxItems", "uniqueItems", "minContains", "maxContains",
    "minProperties", "maxProperties", "patternProperties", "propertyNames",
    "format", "default", "examples",
}


def _strip_strict_unsupported(node: Any) -> Any:
    if isinstance(node, dict):
        out: Dict[str, Any] = {}
        for key, value in node.items():
            if key in {"$schema", "title"} or key in STRICT_UNSUPPORTED_KEYS:
                continue
            out[key] = _strip_strict_unsupported(value)
        return out
    if isinstance(node, list):
        return [_strip_strict_unsupported(x) for x in node]
    return node


def schema_for_openai(schema: Dict[str, Any]) -> Dict[str, Any]:
    """strict 비호환 키와 메타를 제거한 스키마."""
    return _strip_strict_unsupported(copy.deepcopy(schema))


def validate_json(schema: Dict[str, Any], data: Dict[str, Any], label: str) -> None:
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
    if errors:
        details = []
        for err in errors[:20]:
            path = "/".join(map(str, err.path)) or "<root>"
            details.append(f"- {path}: {err.message}")
        raise MalformedModelJSONError(f"{label} JSON schema validation failed:\n" + "\n".join(details))


def extract_output_text(response: Any) -> str:
    text = getattr(response, "output_text", None)
    if text:
        return text

    if isinstance(response, dict):
        output = response.get("output", [])
    else:
        output = getattr(response, "output", [])

    chunks: List[str] = []
    for item in output or []:
        content = item.get("content", []) if isinstance(item, dict) else getattr(item, "content", [])
        for c in content or []:
            if isinstance(c, dict):
                if c.get("type") in {"output_text", "text"} and c.get("text"):
                    chunks.append(c["text"])
            else:
                ctype = getattr(c, "type", None)
                ctext = getattr(c, "text", None)
                if ctype in {"output_text", "text"} and ctext:
                    chunks.append(ctext)
    return "\n".join(chunks).strip()


def response_usage(response: Any, *, use_web_search: bool = False) -> Dict[str, int]:
    usage_obj = getattr(response, "usage", None)
    if isinstance(response, dict):
        usage_obj = response.get("usage")

    def get_attr_or_key(obj: Any, key: str, default: int = 0) -> int:
        if obj is None:
            return default
        if isinstance(obj, dict):
            return int(obj.get(key) or default)
        return int(getattr(obj, key, default) or default)

    input_tokens = get_attr_or_key(usage_obj, "input_tokens")
    output_tokens = get_attr_or_key(usage_obj, "output_tokens")
    details = None
    if isinstance(usage_obj, dict):
        details = usage_obj.get("input_tokens_details") or usage_obj.get("input_token_details")
    elif usage_obj is not None:
        details = getattr(usage_obj, "input_tokens_details", None) or getattr(usage_obj, "input_token_details", None)
    cached_input_tokens = get_attr_or_key(details, "cached_tokens")

    web_search_calls = 0
    output = response.get("output", []) if isinstance(response, dict) else getattr(response, "output", [])
    for item in output or []:
        item_type = item.get("type") if isinstance(item, dict) else getattr(item, "type", None)
        if item_type == "web_search_call":
            web_search_calls += 1
    if use_web_search and web_search_calls == 0:
        web_search_calls = 1

    return {
        "input_tokens": input_tokens,
        "cached_input_tokens": cached_input_tokens,
        "output_tokens": output_tokens,
        "web_search_calls": web_search_calls,
    }


def call_openai_json(
    *,
    client: Any,
    model: str,
    instructions: str,
    payload: Dict[str, Any],
    schema: Dict[str, Any],
    schema_name: str,
    max_output_tokens: int,
    use_web_search: bool = False,
) -> ModelCallResult:
    kwargs: Dict[str, Any] = {
        "model": model,
        "instructions": instructions,
        "input": json.dumps(payload, ensure_ascii=False),
        "max_output_tokens": max_output_tokens,
        "text": {
            "format": {
                "type": "json_schema",
                "name": schema_name,
                "strict": True,
                "schema": schema_for_openai(schema),
            }
        },
    }
    if use_web_search:
        kwargs["tools"] = [{"type": "web_search"}]
        kwargs["include"] = ["web_search_call.action.sources"]

    try:
        response = client.responses.create(**kwargs)
    except Exception as exc:
        raise PipelineAbort(
            f"OpenAI call failed for {schema_name} using {model}: {exc}",
            category="openai_error",
        ) from exc

    raw = extract_output_text(response)
    if not raw:
        raise MalformedModelJSONError(f"OpenAI response had no output text for {schema_name}.")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise MalformedModelJSONError(
            f"OpenAI response was not valid JSON for {schema_name}: {raw[:1000]}"
        ) from exc
    validate_json(schema, data, schema_name)
    return ModelCallResult(data=data, usage=response_usage(response, use_web_search=use_web_search))


def validate_configured_models(config_path: pathlib.Path, *, ping: bool = True) -> Dict[str, Any]:
    if OpenAI is None:
        raise PipelineAbort(
            "openai package not available. Run pip install -r requirements.txt",
            category="openai_error",
        )
    if not os.getenv("OPENAI_API_KEY"):
        raise PipelineAbort("OPENAI_API_KEY is required for --validate-models.", category="openai_error")

    config = load_yaml(config_path)
    client = OpenAI()
    configured = model_ids_from_config(config)
    unique_models = sorted(set(configured.values()))

    try:
        model_list = client.models.list()
        available_ids = {getattr(model, "id", None) for model in getattr(model_list, "data", [])}
        available_ids = {m for m in available_ids if m}
    except Exception as exc:
        raise PipelineAbort(f"client.models.list() failed: {exc}", category="openai_error") from exc

    missing = sorted([m for m in unique_models if m not in available_ids])
    ping_results: Dict[str, str] = {}
    if not missing and ping:
        for model_id in unique_models:
            try:
                response = client.responses.create(model=model_id, input="Return only OK.", max_output_tokens=8)
                out = extract_output_text(response)
                ping_results[model_id] = "ok" if out else "ok_no_text"
            except Exception as exc:
                ping_results[model_id] = f"failed: {exc}"

    failed_pings = {m: r for m, r in ping_results.items() if not r.startswith("ok")}
    result = {
        "configured_roles": configured,
        "unique_models": unique_models,
        "models_list_checked": True,
        "missing_from_models_list": missing,
        "ping_enabled": ping,
        "ping_results": ping_results,
        "status": "pass" if not missing and not failed_pings else "fail",
    }
    if missing or failed_pings:
        raise PipelineAbort(
            "Configured model validation failed: " + json.dumps(result, ensure_ascii=False),
            category="model_validation_failed",
            details=result,
        )
    return result


def make_client() -> Any:
    if OpenAI is None:
        raise PipelineAbort(
            "openai package not available. Run pip install -r requirements.txt",
            category="openai_error",
        )
    if not os.getenv("OPENAI_API_KEY"):
        raise PipelineAbort("OPENAI_API_KEY is required unless --dry-run is used.", category="openai_error")
    return OpenAI()
