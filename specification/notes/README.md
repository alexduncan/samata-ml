# Notes inbox

The human's rough notes: ideas, research and draft rules, in any format. Notes are neither specs nor plans. Nothing here is normative, and no agent implements from a note.

- **Adding a note:** save it here as `<kebab-case>.md`. To act on it, ask a planner to plan it. Until a plan claims it, it stays in [HUMAN.md](../HUMAN.md) as a reminder.
- **Planners:** during _Orient_, check this folder for notes relevant to the change. A plan that uses a note:
    - links it under _Required reading_ or _Codebase context_;
    - records what it changed from the note and why, as [data-ingestion-and-storage](../plans/data-ingestion-and-storage.md#review-of-the-input-notes) does;
    - lists `delete specification/notes/<file>.md` under _Specification changes_, so its `Sync specification` task removes the note once the rules live in a spec.
- **Agents never edit a note.** Record disagreements with it in the plan, and ask the human about anything unclear through HUMAN.md.
- **Unclaimed notes:** an agent that finds a note no plan has claimed adds a HUMAN.md item asking the human to commission one.
