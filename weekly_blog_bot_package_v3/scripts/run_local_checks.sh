#!/usr/bin/env bash
set -euo pipefail
python -m py_compile weekly_blog_bot.py
pytest -q
python weekly_blog_bot.py --config config/weekly_blog_bot.yaml --dry-run --no-calendar
