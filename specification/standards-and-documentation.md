# Code Standards & Documentation

**Status:** implemented — TSDoc is required across `src/` and `scripts/` and enforced locally (`bun run lint`) and in CI using `oxc-parser`, `@microsoft/tsdoc`, `@microsoft/tsdoc-config`, and `tsdoc.json`.

## Documentation Standards (TSDoc)

- **Strict Inline Documentation:** This project strictly uses standard TSDoc for all inline code documentation. Every exported function, class, component, and type MUST include a TSDoc comment block.
- **Synchronous Updates:** Whenever you create, modify, or refactor a function, interface, class, or type alias, you **MUST** simultaneously generate or update the corresponding TSDoc comment block. Do not write code without its accompanying documentation.
- **Required Tags and Lint Enforcement:** Use `@param`, `@returns`, and `@throws` for all functions, and `@fires` for custom element events (configured in `tsdoc.json`). Run `bun run lint` (`scripts/lint-tsdoc.ts`), which parses `src/` and `scripts/` with `oxc-parser` and checks every `/** ... */` block comment via `@microsoft/tsdoc` (enforced locally and in CI).
- **Provide Examples:** For complex data transformations or utility functions, include an `@example` tag with a brief TypeScript code snippet demonstrating its use.

## Naming and placement

- TypeScript and CSS filenames are kebab-case; established role suffixes are `.store`, `.styles`, `.worker`, `.stories`, `.test`, `.e2e` and `.d`.
- A production custom element's filename is its tag. Reusable `ui-*` elements live in `src/components/`; `app-*` elements live directly in `src/features/<feature>/`. Its class is PascalCase of the complete tag (for example `app-content-dialog` → `AppContentDialog`).
- `src/common/` is framework-free and imports neither Lit nor `@nanostores/lit`. Shared style modules live in `src/styles/`; contracts live in `src/types/`.
- `tests/repository-conventions.test.ts` enforces CONV-1–4 with negative filename, placement, class and import fixtures. Story-only test hosts are excluded from production element placement checks.
