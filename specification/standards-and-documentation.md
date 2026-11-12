# Code Standards & Documentation

**Status:** partial — TSDoc required; no ESLint config or CI exists yet

## Documentation Standards (TSDoc)

- **Strict Inline Documentation:** This project strictly uses standard TSDoc for all inline code documentation. Every exported function, class, component, and type MUST include a TSDoc comment block.
- **Synchronous Updates:** Whenever you create, modify, or refactor a function, interface, class, or type alias, you **MUST** simultaneously generate or update the corresponding TSDoc comment block. Do not write code without its accompanying documentation.
- **Required Tags:** Use `@param`, `@returns`, and `@throws` for all functions. `eslint-plugin-tsdoc` is enforced in the CI pipeline. Agents must ensure all generated code passes this linting rule.
- **Provide Examples:** For complex data transformations or utility functions, include an `@example` tag with a brief TypeScript code snippet demonstrating its use.
