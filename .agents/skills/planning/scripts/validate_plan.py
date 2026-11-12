#!/usr/bin/env python3
"""Validate the structure of a Markdown implementation plan (standard library only)."""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import re
import sys

REQUIRED_SECTIONS = (
    "Goal",
    "Scope",
    "Codebase context",
    "Technical decisions",
    "Implementation tasks",
    "Verification and definition of done",
    "Risks and open questions",
    "Implementation and verification log",
    "Change log",
)
METADATA = re.compile(
    r"^\*\*Status:\*\* (draft|ready|implemented) \| \*\*Updated:\*\* (\S+)$"
)


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    if not path.exists() or not path.is_file():
        return [f"File does not exist: {path}"]
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*\.md", path.name):
        errors.append("Filename must be lower-case kebab-case with .md extension.")

    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or not re.match(r"^# \S", lines[0]):
        errors.append("First line must be an H1 plan title.")
    if len(lines) < 2 or not (match := METADATA.fullmatch(lines[1])):
        errors.append("Second line must be '**Status:** draft|ready|implemented | **Updated:** ISO-8601-UTC'.")
    else:
        timestamp = match.group(2)
        try:
            parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            if parsed.utcoffset() is None or parsed.utcoffset().total_seconds() != 0:
                errors.append("Updated timestamp must specify UTC (Z or +00:00).")
        except ValueError:
            errors.append(f"Updated timestamp is invalid: {timestamp}")

    found = set(re.findall(r"^## (.+)$", "\n".join(lines), re.MULTILINE))
    for section in REQUIRED_SECTIONS:
        if section not in found:
            errors.append(f"Missing required section: ## {section}")
    if not re.search(r"^### T1 [—-] ", "\n".join(lines), re.MULTILINE):
        errors.append("No first task found ('### T1 — ...').")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plans", nargs="+", type=Path, help="Markdown plan file(s) to validate")
    args = parser.parse_args()
    failed = False
    for plan in args.plans:
        errors = validate(plan)
        if errors:
            failed = True
            print(f"FAIL {plan}", file=sys.stderr)
            for error in errors:
                print(f"  - {error}", file=sys.stderr)
        else:
            print(f"PASS {plan}")
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
