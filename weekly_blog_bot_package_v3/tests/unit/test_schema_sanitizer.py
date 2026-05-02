"""스키마 sanitizer 단위 테스트.

OpenAI strict json_schema 비호환 키 제거를 검증한다.
"""
from __future__ import annotations


def test_schema_for_openai_strips_strict_unsupported_keys(bot_module, root_path):
    bot = bot_module
    spec_schema = bot.load_json(root_path / "schemas" / "spec_batch.schema.json")
    reviewer_schema = bot.load_json(root_path / "schemas" / "reviewer_result.schema.json")

    def collect_keys(node, found):
        if isinstance(node, dict):
            for k, v in node.items():
                found.add(k)
                collect_keys(v, found)
        elif isinstance(node, list):
            for item in node:
                collect_keys(item, found)

    for schema in (spec_schema, reviewer_schema):
        sanitized = bot.schema_for_openai(schema)
        keys = set()
        collect_keys(sanitized, keys)
        for forbidden in bot.STRICT_UNSUPPORTED_KEYS | {"$schema", "title"}:
            assert forbidden not in keys, f"{forbidden} should be stripped"
        for kept in ("type", "properties", "required", "additionalProperties"):
            assert kept in keys


def test_schema_for_openai_does_not_mutate_input(bot_module, root_path):
    import json

    bot = bot_module
    spec_schema = bot.load_json(root_path / "schemas" / "spec_batch.schema.json")
    before = json.dumps(spec_schema, ensure_ascii=False, sort_keys=True)
    bot.schema_for_openai(spec_schema)
    after = json.dumps(spec_schema, ensure_ascii=False, sort_keys=True)
    assert before == after
