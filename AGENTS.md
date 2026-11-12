# AI Agent Operating Instructions for samata-ml

## Repository purpose and mandatory specification reading

**samata-ml** is the frontend app for training machine learning models inside a web browser. These
instructions apply to coding agents working in this repository.

At the beginning of **every task**, before planning or modifying code, you **must** read [`specification/README.md`](specification/README.md) to find the documents relevant to the task. Before implementing, refactoring, testing, or reviewing affected functionality, read every applicable specification and follow its links to related requirements. Revisit those documents whenever requirements or implementation decisions change.

## Modern Web Development

This project's Baseline target is Baseline Widely available.

### Web Platform Guidance

- Use the installed `modern-web-guidance` skill when
  designing, implementing, refactoring or reviewing
  browser-facing functionality.
- Search and retrieve relevant Modern Web Guidance
  guides before implementing unfamiliar web features.
- Prefer native semantic HTML, CSS and browser APIs
  over custom JavaScript implementations where suitable.
- Verify compatibility with Chrome, Firefox, Safari
  and Edge.
- Use progressive enhancement when newer features are
  not supported across the project's target browsers.
- Avoid experimental browser APIs unless explicitly
  approved and provided with appropriate fallbacks.

### Accessibility

- Prefer native HTML semantics over unnecessary ARIA.
- Ensure keyboard and assistive technology accessibility.
- Maintain visible focus indicators.
- Respect reduced motion and user text-size preferences.
- Verify accessible names, roles and states for
  interactive components.

### Verification

- Test functionality and browser compatibility.
- Run relevant automated tests and accessibility checks.
- Do not treat the guidance as a substitute for testing.
- Document intentional departures from these standards.
