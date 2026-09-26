# P5-T5 Validation Report

**Date:** 2026-09-26
**Branch:** `feature/P5-T5-sdk-selected-grant`
**Result:** PASS — local validation complete; pull request and CI remain pending.

## Implemented

- Pinned the merged `@0al/agent-surface` package archive and verified its
  integrity and embedded ASP source lock.
- Built and SDK-validated Calcu's proposal-only manifest, semantic Grant
  request, and selected Grant while retaining application-owned authority.
- Added a server-only unsigned Runtime Receipt before HTTPS dispatch and an
  App Receipt after successful admission/evaluation. The executor validates the
  complete Runtime Receipt, policy-decision hash, receipt hash, and exact
  request tuple before calling the math engine. LocalBackend validates the App
  Receipt, parent hash, tuple, and output hash before returning the result.
- Kept receipt objects and hashes out of browser assets and task events. The
  `runtime_receipt` transport field is a documented Calcu-local HTTPS extension,
  not a claim of portable ASP binding interoperability.
- Added regression cases for missing/mismatched/tampered receipts, duplicate
  JSON members, negative-zero JSON numbers, response forgery, and application
  rejection. Invalid requests do not reach the math engine.

## Validation evidence

| Gate | Result |
| --- | --- |
| `npm run check` | PASS — format, lint, typecheck, 192 Vitest tests, 6 agent-preflight tests, and 13 bundle-isolation tests |
| `npm run build` | PASS — Vite production build; server-only bundle scan passed across 3 assets |
| `npm run test:coverage` | PASS — 192 tests; 84.24% statements, 81.04% branches, 92.41% functions, 85.77% lines |
| `git diff --check` | PASS |

## Limits and non-claims

These receipts are unsigned, transient in-memory evidence for successful
proposal calls. They do not authenticate their producers, prove consent,
authorize execution, provide durable audit, or establish portable
interoperability. Rejected calls can leave a local Runtime Receipt but do not
produce an App Receipt. Human approval, denial-receipt lifecycle, signatures,
durable receipt storage, Proof-Bound transport, and production identity remain
out of scope. The browser API and task-event schema are unchanged.

## Follow-up

Open a focused PR for this branch and await CI/review. Do not merge without a
separate explicit instruction.
