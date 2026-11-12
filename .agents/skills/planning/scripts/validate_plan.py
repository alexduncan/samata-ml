#!/usr/bin/env python3
"""Validate the structure of Markdown implementation plans (standard library only).

With no arguments, validates every plan in specification/plans/ (except README.md).
Checks structure only, not whether the plan's decisions are correct.
"""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import re
import sys

PLANS_DIR = Path("specification/plans")
REQUIRED_SECTIONS = (
    "Goal",
    "Scope",
    "Required reading",
    "Codebase context",
    "Technical decisions",
    "Implementation tasks",
    "Verification and definition of done",
    "Risks and open questions",
    "Implementation and verification log",
    "Change log",
)
TASK_FIELDS = (
    "Depends on",
    "Risk",
    "Likely files",
    "Must not touch",
    "Implementation",
    "Acceptance criteria",
    "Verification",
    "Progress",
)
METADATA = re.compile(r"^\*\*Status:\*\* (draft|ready|implemented) \| \*\*Updated:\*\* (\S+)$")
TASK_HEADING = re.compile(r"^### (T\d+) [—-] .+$", re.MULTILINE)
# Template placeholders such as <Concise plan title>, <path>, <exact/path>. Lower-case HTML/custom
# element names such as <dialog> or <ui-table> are not matched unless listed here.
PLACEHOLDER = re.compile(
    r"<(?:[A-Z][^<>\n]*|path|command|exact/path|existing command|guide-id|section|n–m|path or API)>"
    r"|YYYY-MM-DD"
)


def strip_code_blocks(text: str) -> str:
    return re.sub(r"^```.*?^```", "", text, flags=re.MULTILINE | re.DOTALL)


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    if not path.is_file():
        return [f"File does not exist: {path}"]
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*\.md", path.name):
        errors.append("Filename must be lower-case kebab-case with .md extension.")

    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    status = None
    if not lines or not re.match(r"^# \S", lines[0]):
        errors.append("First line must be an H1 plan title.")
    # Status line follows the H1; Prettier inserts a blank line between them.
    status_line = next((l for l in lines[1:3] if l.strip()), "")
    if not (match := METADATA.fullmatch(status_line)):
        errors.append("Line after the H1 must be '**Status:** draft|ready|implemented | **Updated:** ISO-8601-UTC'.")
    else:
        status, timestamp = match.groups()
        try:
            parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            if parsed.utcoffset() is None or parsed.utcoffset().total_seconds() != 0:
                errors.append("Updated timestamp must specify UTC (Z or +00:00).")
        except ValueError:
            errors.append(f"Updated timestamp is invalid: {timestamp}")

    found = set(re.findall(r"^## (.+?)\s*$", text, re.MULTILINE))
    for section in REQUIRED_SECTIONS:
        if section not in found:
            errors.append(f"Missing required section: ## {section}")

    tasks = list(TASK_HEADING.finditer(text))
    if not tasks or tasks[0].group(1) != "T1":
        errors.append("No first task found ('### T1 — ...').")
    for i, task in enumerate(tasks):
        end = tasks[i + 1].start() if i + 1 < len(tasks) else len(text)
        next_section = re.search(r"^## ", text[task.end():end], re.MULTILINE)
        body = text[task.end(): task.end() + next_section.start()] if next_section else text[task.end():end]
        for field in TASK_FIELDS:
            if not re.search(rf"^- \*\*{re.escape(field)}:\*\*", body, re.MULTILINE):
                errors.append(f"{task.group(1)} is missing field: **{field}:**")

    for n, line in enumerate(strip_code_blocks(text).splitlines(), start=1):
        if (placeholder := PLACEHOLDER.search(line)) and "Remove this instruction" not in line:
            errors.append(f"Line {n}: unfilled template placeholder {placeholder.group(0)!r}")
        elif "Remove this instruction" in line:
            errors.append(f"Line {n}: template instruction left in plan")

    index = path.parent / "README.md"
    if index.is_file():
        row = next((l for l in index.read_text(encoding="utf-8").splitlines() if f"({path.name})" in l), None)
        if row is None:
            errors.append(f"Plan is not listed in {index}.")
        elif status and not re.search(rf"\b{status}\b", row):
            errors.append(f"Status in {index} does not match plan status '{status}'.")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plans", nargs="*", type=Path, help="Plan file(s); default: all in specification/plans/")
    args = parser.parse_args()
    plans = args.plans or sorted(p for p in PLANS_DIR.glob("*.md") if p.name != "README.md")
    if not plans:
        print(f"No plans found in {PLANS_DIR}/")
        return 0
    failed = False
    for plan in plans:
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
