#!/usr/bin/env python3
"""Validate the structure of Markdown implementation plans (standard library only).

With no arguments, validates every plan in specification/plans/ (except README.md).
Always also checks that each spec's status line matches its row in specification/README.md.
Checks structure only, not whether the plan's decisions are correct.
"""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import re
import sys

SPEC_DIR = Path("specification")
PLANS_DIR = SPEC_DIR / "plans"
SPEC_INDEX = SPEC_DIR / "README.md"
SPEC_CHANGES = "Specification changes"
# Required for `ready` plans. Older `draft` and `implemented` plans without it only get a warning.
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
METADATA = re.compile(r"^\*\*Status:\*\* (draft|ready|implemented|stub) \| \*\*Updated:\*\* (\S+)$")
TASK_HEADING = re.compile(r"^### (T\d+) [—-] .+$", re.MULTILINE)
# Template placeholders such as <Concise plan title>, <path>, <exact/path>. Lower-case HTML/custom
# element names such as <dialog> or <ui-table> are not matched unless listed here.
PLACEHOLDER = re.compile(
    r"<(?:[A-Z][^<>\n]*|path|command|exact/path|existing command|guide-id|section|n–m|path or API)>"
    r"|YYYY-MM-DD"
)


def strip_code_blocks(text: str) -> str:
    return re.sub(r"^```.*?^```", "", text, flags=re.MULTILINE | re.DOTALL)


CHECKBOX = re.compile(r"^[ \t]*- \[([ xX])\] (.+)$", re.MULTILINE)
SPEC_STATUS = re.compile(r"^\*{0,2}Status:\*{0,2}\s*([A-Za-z]+)")


def section_body(text: str, name: str) -> str | None:
    heading = re.search(rf"^## {re.escape(name)}\s*$", text, re.MULTILINE)
    if heading is None:
        return None
    following = re.search(r"^## ", text[heading.end():], re.MULTILINE)
    return text[heading.end(): heading.end() + following.start()] if following else text[heading.end():]


def validate_spec_changes(text: str, status: str | None) -> tuple[list[str], list[str]]:
    """Check the _Specification changes_ section: present, well formed and, once implemented, done."""
    errors: list[str] = []
    body = section_body(text, SPEC_CHANGES)
    if body is None:
        message = f"Missing section: ## {SPEC_CHANGES}"
        return ([message], []) if status == "ready" else ([], [message + " (required for ready plans)"])
    items = CHECKBOX.findall(strip_code_blocks(body))
    if not items:
        return [f"## {SPEC_CHANGES} needs at least one '- [ ]' item (or '- [ ] None — <reason>')."], []
    labels = [label.strip() for _, label in items]
    if any(label.startswith("None") for label in labels) and len(labels) > 1:
        errors.append(f"## {SPEC_CHANGES}: 'None' must be the only item.")
    for label in labels:
        if label.startswith(("None", "Known gap")):
            continue
        paths = re.findall(r"`(specification/[^`]+?\.md)`", label)
        if not paths:
            errors.append(f"## {SPEC_CHANGES}: item names no `specification/….md` path: {label[:60]}")
        # A plan may create a spec (mark it "(new)") or later delete one, so only check existence
        # for existing specs a plan has yet to change.
        if status != "implemented" and "(new)" not in label:
            errors.extend(
                f"## {SPEC_CHANGES}: spec does not exist: {p}" for p in paths if not Path(p).is_file()
            )
    if status == "implemented":
        errors.extend(
            f"## {SPEC_CHANGES}: unticked item in an implemented plan: {label.strip()[:60]}"
            for marked, label in items
            if marked.lower() != "x"
        )
    return errors, []


def validate_spec_index(index: Path = SPEC_INDEX) -> list[str]:
    """Check that every spec listed in the index has a status line matching its index row."""
    if not index.is_file():
        return [f"Spec index does not exist: {index}"]
    errors: list[str] = []
    for line in index.read_text(encoding="utf-8").splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 2 or not (link := re.fullmatch(r"\[[^\]]+\]\(([^)#]+\.md)\)", cells[0])):
            continue
        spec = index.parent / link.group(1)
        if not spec.is_file():
            errors.append(f"Index lists a spec that does not exist: {spec}")
            continue
        head = spec.read_text(encoding="utf-8").splitlines()[:6]
        found = next((m.group(1).lower() for l in head if (m := SPEC_STATUS.match(l))), None)
        if found is None:
            errors.append(f"{spec} has no status line under its title.")
        elif found != cells[1].lower():
            errors.append(f"{spec} says status '{found}' but {index} says '{cells[1]}'.")
    return errors


def validate(path: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not path.is_file():
        return [f"File does not exist: {path}"], warnings
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
        errors.append("Line after the H1 must be '**Status:** draft|ready|implemented|stub | **Updated:** ISO-8601-UTC'.")
    else:
        status, timestamp = match.groups()
        try:
            parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            if parsed.utcoffset() is None or parsed.utcoffset().total_seconds() != 0:
                errors.append("Updated timestamp must specify UTC (Z or +00:00).")
        except ValueError:
            errors.append(f"Updated timestamp is invalid: {timestamp}")

    if status == "stub":
        index = path.parent / "README.md"
        if index.is_file():
            row = next((l for l in index.read_text(encoding="utf-8").splitlines() if f"({path.name})" in l), None)
            if row is None:
                errors.append(f"Plan is not listed in {index}.")
            elif not re.search(r"\bstub\b", row):
                errors.append(f"Status in {index} does not match plan status 'stub'.")
        return errors, warnings

    found = set(re.findall(r"^## (.+?)\s*$", text, re.MULTILINE))
    for section in REQUIRED_SECTIONS:
        if section not in found:
            errors.append(f"Missing required section: ## {section}")
    spec_errors, spec_warnings = validate_spec_changes(text, status)
    errors.extend(spec_errors)
    warnings.extend(spec_warnings)

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
    return errors, warnings


def report(name: Path, errors: list[str], warnings: list[str]) -> bool:
    """Print the result for one file; return True if it failed."""
    stream = sys.stderr if errors else sys.stdout
    print(f"{'FAIL' if errors else 'PASS'} {name}", file=stream)
    for error in errors:
        print(f"  - {error}", file=stream)
    for warning in warnings:
        print(f"  ! {warning}", file=stream)
    stream.flush()
    return bool(errors)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plans", nargs="*", type=Path, help="Plan file(s); default: all in specification/plans/")
    args = parser.parse_args()
    plans = args.plans or sorted(p for p in PLANS_DIR.glob("*.md") if p.name != "README.md")
    failed = False
    if not plans:
        print(f"No plans found in {PLANS_DIR}/")
    for plan in plans:
        failed |= report(plan, *validate(plan))
    failed |= report(SPEC_INDEX, validate_spec_index(), [])
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
