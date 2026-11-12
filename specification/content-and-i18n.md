# Content & Internationalization (i18n)

## Localization Store

- All UI text must be routed through `@nanostores/i18n`.
- Lit components must subscribe to the translation store to enable instant, refresh-free language toggling.

## Static Content (Markdown to TS)

- Documentation lives in `/content-src/` organized by locale (e.g., `/content-src/en/`, `/content-src/es/`).
- **Build Step:** A custom Bun script utilizing `gray-matter` MUST parse these markdown files and output compiled TypeScript dictionaries into `/src/content-compiled/[locale]/`.
- The vanilla router will dynamically `import()` the compiled TypeScript file corresponding to the active locale when navigating to a documentation route.
