# P5-T4 Validation Report

## Summary

P5-T4 completed the Calcu ASP demo's reproducibility, build-isolation, visual,
and adoption evidence. The implementation adds a tested browser-bundle guard,
runs the production build in CI, replaces stale top-level setup guidance, and
documents both the demonstrated ASP boundary and its substantial integration
cost. The verdict is **PASS** for the scoped Compatibility Bearer development
demo, with no production ASP certification claim.

## Test-first evidence

The new Node test was first run without its implementation and failed with
`ERR_MODULE_NOT_FOUND`. After implementing the scanner, all 10 cases passed:

- a recursively scanned safe bundle is accepted;
- each of seven known server-only markers is rejected;
- rejected diagnostics identify the marker and relative asset path without
  printing surrounding file contents;
- a directory with no scannable web assets fails closed.

`npm run build` now runs the scanner against the actual Vite output. The checked
production artifact contained three scannable files and passed. This is a
specific regression guard, not general information-flow proof.

## Commands and results

| Command | Result |
| --- | --- |
| `npm run check` | PASS: format, lint, typecheck, 22 Vitest files / 153 tests, 6 preflight tests, and 10 bundle-verifier tests |
| `npm run build` | PASS: Vite transformed 41 modules; three generated browser files passed the server-material scan |
| `npm run test:coverage` | PASS: 84.67% lines, 83.00% statements, 78.55% branches, 91.34% functions |
| `npm audit --omit=dev` | PASS: 0 vulnerabilities |
| `git diff --check` | PASS |

Coverage exceeds the configured 80% line threshold. Default tests use the fake
Codex app-server and synthetic provider fixtures; they require no model
credential and perform no paid inference.

## Rendered layout audit

The production build was served with `npm run agent:demo` and inspected using
screenshots plus DOM measurements. No model task was submitted.

| Viewport | Evidence | Result |
| --- | --- | --- |
| 760 × 1000 | One column; task panel and portrait calculator are both 520 px wide; 30.39 px vertical gap; 19 keypad buttons | PASS: task panel first, full-page content legible, no horizontal overflow |
| 1440 × 900 | Two columns measuring 472.31 px and 839.69 px with a 56 px gap; 49 keypad buttons | PASS: side-by-side composition, both panels visible, no horizontal overflow |

Both Run and calculator controls were enabled. Clicking calculator digit `7`
changed its display to `7`; `AC` restored `0`, confirming that the ordinary
calculator remains usable without invoking Codex. The temporary viewport
override was reset and the local host was stopped after the audit.

## Manual provider evidence

The earlier 2026-09-05 live smoke remains applicable because P5-T4 does not
change adapter or execution behavior: authenticated Codex CLI `0.145.0` using
`gpt-5.6-luna` at `low` effort made exactly one `calculation_propose` call and
returned the executor-verified `240 × 0.15 = 36`. It is local manual evidence,
not CI evidence or independent interoperability.

## Remaining limitations

- Compatibility Bearer and ephemeral development identity only;
- identity represents the Calcu adapter, not attestation of the Codex binary;
- no Human Approval, Receipt Producer, DPoP/mTLS, durable consent, recovery, or
  remote multi-user deployment;
- no reusable ASP SDK, independent implementation, or production certification;
- the bundle marker scan cannot replace code review, architecture boundaries,
  or a production secret scanner.

The public adoption report recommends extracting the repeated protocol machinery
into reusable TypeScript core/server packages, then validating them in a second
small application before expanding the Calcu demo.
