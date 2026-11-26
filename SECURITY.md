# Security Policy

## Supported Versions

| Version        | Supported | Notes                                                |
| -------------- | --------- | ---------------------------------------------------- |
| `0.1.x` (beta) | Yes       | Active public beta series hosted at `beta.samata.ml` |
| `< 0.1.0`      | No        | Pre-release development snapshots                    |

## Browser Security Invariants

`samata-ml` is a client-only machine learning web application built with Lit, TypeScript, and `web-ml` WebAssembly workers. Every production build preserves the following invariants:

1. **Strict Content Security Policy (CSP):** Production HTML sets `script-src 'self' 'wasm-unsafe-eval'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, and `worker-src 'self'`, alongside `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` in `_headers`.
2. **Cross-Origin Isolation:** All pages, bundles, and workers are served with `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, and `Cross-Origin-Resource-Policy: same-origin` so WebAssembly workers operate under browser isolation.
3. **Supply-Chain Integrity (SHA-256):** Vendored `web-ml` releases (`vendor/web-ml/`), prebuilt WASM/worker assets, and sample datasets (`content/datasets/`) are pinned and verified against recorded SHA-256 digests during builds and asset tests.
4. **Local-Only User Data:** CSV parsing, feature selection, model training, evaluation, and IndexedDB persistence execute strictly in browser memory and dedicated Web Workers on the user's device. Uploaded datasets, column names, row values, model configurations, results, error stacks, and cookies are never transmitted.
5. **Beta-Only Analytics Gating:** When built with `BETA_TELEMETRY_ENABLED=true` and accessed on `https://beta.samata.ml`, cookieless Umami analytics load only after explicit **Get Started** acceptance and only send allowlisted canonical route paths, UI milestone event names, and fixed error-category codes. Non-beta origins and V1 builds disable telemetry completely.

## Reporting a Vulnerability

Please report suspected security vulnerabilities privately rather than opening a public issue:

- **GitHub Private Vulnerability Reporting:** Submit a private security advisory through this repository's **Security -> Advisories -> Report a vulnerability** page once published.
- **Maintainer Contact:** If GitHub Private Vulnerability Reporting is unavailable, contact the repository maintainer directly (see `specification/HUMAN.md` for pre-publication maintainer contact setup).

When reporting an issue, please include steps to reproduce, the affected version or build commit, and any relevant HTTP headers or browser console findings (without uploading confidential datasets).
