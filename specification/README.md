# Specification Index

This directory contains the definitive architectural and engineering specifications for `samata-ml`. AI agents must read this index before planning a task, then read every applicable specification and its related references. If implementation and specification disagree, record the discrepancy instead of silently treating either as the intended behavior.

## Core Specifications

- [Architecture & Routing](ARCHITECTURE.md) - Directory structure, delivery, routing, and code splitting.
- [State & Storage](state-and-storage.md) - Nanostores, IndexedDB (`idb`), and `localStorage` migrations.
- [Components & UI](COMPONENTS.md) - Component tiers, public APIs, Lit practices, styles, accessibility, and Storybook.
- [Content & i18n](content-and-i18n.md) - Markdown documentation build pipeline and localization.
- [Testing](testing.md) - `bun:test` and Playwright mandates.
- [Code Standards & Documentation](standards-and-documentation.md) - TSDoc requirements.
- [Machine Learning Orchestration](machine-learning-orchestrator.md) - Integration with the `web-ml` library and training workers.
