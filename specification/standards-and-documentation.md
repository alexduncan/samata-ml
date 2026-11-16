# Code Standards & Documentation

**Status:** partial — TSDoc is required and mostly present in `src/`; `eslint-plugin-tsdoc` is installed, but there is no ESLint config, `lint` script or CI ([Known gap](README.md#known-gaps) 7).

## Documentation Standards (TSDoc)

- **Strict Inline Documentation:** This project strictly uses standard TSDoc for all inline code documentation. Every exported function, class, component, and type MUST include a TSDoc comment block.
- **Synchronous Updates:** Whenever you create, modify, or refactor a function, interface, class, or type alias, you **MUST** simultaneously generate or update the corresponding TSDoc comment block. Do not write code without its accompanying documentation.
- **Required Tags:** Use `@param`, `@returns`, and `@throws` for all functions. `eslint-plugin-tsdoc` is installed; lint/CI enforcement remains target until its configuration and command exist (Known gap 7).
- **Provide Examples:** For complex data transformations or utility functions, include an `@example` tag with a brief TypeScript code snippet demonstrating its use.

## Naming and placement

- TypeScript and CSS filenames are kebab-case; established role suffixes are `.store`, `.styles`, `.worker`, `.stories`, `.test`, `.e2e` and `.d`.
- A production custom element's filename is its tag. Reusable `ui-*` elements live in `src/components/`; `app-*` elements live directly in `src/features/<feature>/`. Its class is PascalCase of the complete tag (for example `app-content-dialog` → `AppContentDialog`).
- `src/common/` is framework-free and imports neither Lit nor `@nanostores/lit`. Shared style modules live in `src/styles/`; contracts live in `src/types/`.
- `tests/repository-conventions.test.ts` enforces CONV-1–4 with negative filename, placement, class and import fixtures. Story-only test hosts are excluded from production element placement checks.
