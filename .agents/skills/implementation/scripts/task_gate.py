#!/usr/bin/env python3
"""Check plan status, task prerequisites and recorded completion (stdlib only).

This checks Markdown records, not the truth of test results or code correctness.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import re
import sys

STATUS_LINE = re.compile(
    r"^\*\*Status:\*\* (draft|ready|implemented) \| \*\*Updated:\*\* (\S+)$"
)
TASK_HEADING = re.compile(r"^### (T\d+) [—-] (.+)$", re.MULTILINE)
DEPENDS = re.compile(r"^- \*\*Depends on:\*\* (.+)$", re.MULTILINE)
PROGRESS = re.compile(r"^- \*\*Progress:\*\* \[([ xX])\] (.+)$", re.MULTILINE)
CHECKBOX = re.compile(r"^[ \t]*- \[([ xX])\] (.+)$", re.MULTILINE)


@dataclass(frozen=True)
class Task:
    id: str
    title: str
    depends_on: tuple[str, ...]
    complete: bool
    acceptance: tuple[bool, ...]


def section(text: str, name: str) -> str:
    heading = re.search(r"^## " + re.escape(name) + r"\s*$", text, re.MULTILINE)
    if heading is None:
        raise ValueError(f"Missing section: ## {name}")
    following = re.search(r"^## ", text[heading.end():], re.MULTILINE)
    return text[heading.end():heading.end() + following.start()] if following else text[heading.end():]


def read_plan(path: Path) -> tuple[str, dict[str, Task], str]:
    if not path.is_file():
        raise ValueError(f"Plan file does not exist: {path}")
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if len(lines) < 2 or not lines[0].startswith("# "):
        raise ValueError("Plan must begin with an H1 title")
    # Status line follows the H1; Prettier inserts a blank line between them.
    metadata = STATUS_LINE.fullmatch(next((l for l in lines[1:] if l.strip()), ""))
    if metadata is None:
        raise ValueError("Invalid status/updated line immediately below H1")
    status, updated = metadata.groups()
    try:
        timestamp = datetime.fromisoformat(updated.replace("Z", "+00:00"))
        if timestamp.utcoffset() is None or timestamp.utcoffset().total_seconds() != 0:
            raise ValueError("timestamp isn't UTC")
    except ValueError as exc:
        raise ValueError(f"Invalid UTC Updated timestamp: {updated}") from exc

    body = section(text, "Implementation tasks")
    matches = list(TASK_HEADING.finditer(body))
    if not matches:
        raise ValueError("No Tn headings in Implementation tasks")
    tasks: dict[str, Task] = {}
    for i, match in enumerate(matches):
        task_id, title = match.groups()
        if task_id in tasks:
            raise ValueError(f"Duplicate task ID: {task_id}")
        task_body = body[match.end(): matches[i + 1].start() if i + 1 < len(matches) else len(body)]
        dependencies = DEPENDS.search(task_body)
        if not dependencies:
            raise ValueError(f"{task_id} lacks Depends on")
        depends_value = dependencies.group(1).strip()
        if depends_value == "None":
            depends = ()
        else:
            depends = tuple(re.findall(r"\bT\d+\b", depends_value))
            if not depends or re.fullmatch(r"T\d+(?:\s*,\s*T\d+)*", depends_value) is None:
                raise ValueError(f"{task_id} has invalid Depends on: {depends_value}")
        progress = PROGRESS.search(task_body)
        if not progress:
            raise ValueError(f"{task_id} lacks a Progress checkbox")
        complete = progress.group(1).lower() == "x"
        acceptance = tuple(check.lower() == "x" for check, _ in CHECKBOX.findall(task_body))
        if not acceptance:
            raise ValueError(f"{task_id} lacks acceptance criteria checkboxes")
        if complete and not all(acceptance):
            raise ValueError(f"{task_id} is marked complete with unchecked acceptance criteria")
        tasks[task_id] = Task(task_id, title, depends, complete, acceptance)

    for task in tasks.values():
        for dependency in task.depends_on:
            if dependency not in tasks:
                raise ValueError(f"{task.id} depends on missing {dependency}")
            if int(dependency[1:]) >= int(task.id[1:]):
                raise ValueError(f"{task.id} has a non-earlier dependency {dependency}")
            if task.complete and not tasks[dependency].complete:
                raise ValueError(f"{task.id} is complete but {dependency} is incomplete")
    return status, tasks, text


def preflight(status: str, tasks: dict[str, Task], requested: str | None) -> str:
    if status != "ready":
        raise ValueError(f"Plan status is {status}; only ready plans may be implemented")
    if requested:
        task = tasks.get(requested)
        if task is None:
            raise ValueError(f"Unknown task {requested}; available: {', '.join(tasks)}")
        if task.complete:
            raise ValueError(f"{task.id} is already marked complete; do not re-implement it")
        missing = [dep for dep in task.depends_on if not tasks[dep].complete]
        if missing:
            raise ValueError(f"{task.id} blocked by incomplete prerequisite(s): {', '.join(missing)}")
        return f"ELIGIBLE {task.id} — {task.title} (depends on: {', '.join(task.depends_on) or 'none'})"
    for task in tasks.values():
        if not task.complete and all(tasks[dep].complete for dep in task.depends_on):
            return f"NEXT {task.id} — {task.title} (depends on: {', '.join(task.depends_on) or 'none'})"
    if all(t.complete for t in tasks.values()):
        raise ValueError("All tasks are marked complete; run --check-complete before final closure")
    raise ValueError("No eligible task; inspect dependency and progress records")


def completion_gate(status: str, tasks: dict[str, Task], text: str) -> str:
    if status not in {"ready", "implemented"}:
        raise ValueError(f"Plan status {status}; cannot check final completion")
    unfinished = [task.id for task in tasks.values() if not task.complete or not all(task.acceptance)]
    if unfinished:
        raise ValueError("Unfinished task(s): " + ", ".join(unfinished))
    done_section = section(text, "Verification and definition of done")
    checks = CHECKBOX.findall(done_section)
    if not checks:
        raise ValueError("No definition-of-done checkboxes found")
    open_checks = [label.strip() for marked, label in checks if marked.lower() != "x"]
    if open_checks:
        raise ValueError("Unverified definition-of-done item(s): " + "; ".join(open_checks))
    return "RECORDED COMPLETE — all task/acceptance/definition-of-done checkboxes ticked; verify real test evidence before changing status"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", type=Path)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--task", metavar="Tn", help="Check whether a specific task can start")
    group.add_argument("--check-complete", action="store_true", help="Check recorded plan completion")
    args = parser.parse_args()
    try:
        status, tasks, text = read_plan(args.plan)
        message = (completion_gate(status, tasks, text) if args.check_complete
                   else preflight(status, tasks, args.task))
        print(message)
        return 0
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"BLOCKED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
