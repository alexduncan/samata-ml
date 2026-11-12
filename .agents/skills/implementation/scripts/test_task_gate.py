#!/usr/bin/env python3
"""Exercise core task gate behaviour with the companion planning skill's template."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("task_gate", Path(__file__).with_name("task_gate.py"))
assert SPEC and SPEC.loader
import sys
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)

TEMPLATE = """# Test plan
**Status:** ready | **Updated:** 2026-11-12T12:00:00Z

## Implementation tasks

### T1 — First
- **Depends on:** None
- **Acceptance criteria:**
  - [ ] First condition
- **Progress:** [ ] Not started

### T2 — Second
- **Depends on:** T1
- **Acceptance criteria:**
  - [ ] Second condition
- **Progress:** [ ] Not started

## Verification and definition of done
- [ ] All checks passed

## Implementation and verification log
| When (UTC) | Task | Outcome / commands / evidence |
| --- | --- | --- |
| — | — | Not started |
"""


class TaskGateTests(unittest.TestCase):
    def read(self, text: str):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "plan.md"
            path.write_text(text, encoding="utf-8")
            return module.read_plan(path)

    def test_select_first_ready(self):
        status, tasks, _ = self.read(TEMPLATE)
        self.assertIn("NEXT T1", module.preflight(status, tasks, None))
        with self.assertRaisesRegex(ValueError, "prerequisite"):
            module.preflight(status, tasks, "T2")

    def test_blank_line_after_title(self):
        status, tasks, _ = self.read(TEMPLATE.replace("# Test plan\n", "# Test plan\n\n", 1))
        self.assertEqual(status, "ready")

    def test_select_after_dependency_finished(self):
        text = TEMPLATE.replace("- [ ] First condition", "- [x] First condition").replace(
            "- **Progress:** [ ] Not started", "- **Progress:** [x] Complete", 1
        )
        status, tasks, _ = self.read(text)
        self.assertIn("NEXT T2", module.preflight(status, tasks, None))

    def test_reject_draft(self):
        status, tasks, _ = self.read(TEMPLATE.replace("**Status:** ready", "**Status:** draft"))
        with self.assertRaisesRegex(ValueError, "only ready"):
            module.preflight(status, tasks, None)

    def test_reject_unsupported_missing_dependency(self):
        with self.assertRaisesRegex(ValueError, "missing T9"):
            self.read(TEMPLATE.replace("**Depends on:** T1", "**Depends on:** T9"))

    def test_reject_completed_task_with_open_criteria(self):
        with self.assertRaisesRegex(ValueError, "unchecked acceptance"):
            self.read(TEMPLATE.replace("- **Progress:** [ ] Not started", "- **Progress:** [x] Complete", 1))

    def test_completion_record(self):
        all_done = TEMPLATE.replace("- [ ]", "- [x]").replace(
            "- **Progress:** [ ] Not started", "- **Progress:** [x] Complete"
        )
        status, tasks, full_text = self.read(all_done)
        self.assertIn("RECORDED COMPLETE", module.completion_gate(status, tasks, full_text))
        status, tasks, full_text = self.read(TEMPLATE)
        with self.assertRaisesRegex(ValueError, "Unfinished task"):
            module.completion_gate(status, tasks, full_text)


if __name__ == "__main__":
    unittest.main()
