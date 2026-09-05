# REVIEW REPORT — P5-T4 ASP demo adoption readiness

**Scope:** `e00b525..HEAD`
**Subject:** P5-T4 verification, browser-bundle boundary, and adoption reporting

## Summary verdict

- [x] Approve
- [ ] Approve with comments
- [ ] Request changes
- [ ] Block

## Critical issues

None.

## Secondary issues

None.

## Artifact and lifecycle review

- The browser-bundle check validates the produced `dist` artifact, not merely
  the presence of source files or a configuration declaration.
- `npm run build` is the authoritative producer path and immediately invokes
  the verifier; CI now runs that same command before tests.
- Tests import the verifier's exported `SERVER_ONLY_MARKERS`, so acceptance and
  rejection expectations cannot silently drift from the production check.
- Recursive file ordering and relative diagnostics are deterministic. Tests use
  unique temporary directories and remove them after each case.
- The verifier fails closed for an empty/non-scannable build directory and does
  not print surrounding asset contents when rejecting a marker.
- Documentation accurately limits the guarantee: the deny-list is a regression
  guard for known server-only protocol material, not taint analysis, universal
  secret scanning, or ASP certification.

## Architecture and security notes

P5-T4 does not add a second execution route or weaken the P5-T2/P5-T3 boundary.
The build remains browser-only; the task service, bearer, Grant, identity/session
state, HTTPS executor, and Codex child process stay server-side. The adoption
report clearly distinguishes deterministic mock evidence from the one manual
authenticated provider smoke and retains all non-claims for Human Approval,
receipts, Proof-Bound transport, production identity, and independent interop.

The reported implementation size is a meaningful adoption finding. It supports
future SDK extraction but does not justify introducing that larger refactor into
this verification task.

## Validation reviewed

- `npm run check` — PASS: 153 Vitest tests, 6 preflight tests, 10 bundle tests
- `npm run build` — PASS: production bundle plus three-file isolation scan
- `npm run test:coverage` — PASS: 84.67% line coverage
- `npm audit --omit=dev` — PASS: 0 vulnerabilities
- `git diff --check` — PASS
- 760 × 1000 compact and 1440 × 900 wide screenshot/DOM audits — PASS
- ordinary calculator input/reset smoke during visual audit — PASS

## Follow-up decision

No corrective FOLLOW-UP task is required. The recommended TypeScript ASP SDK
extraction and second-app validation are product-roadmap decisions, not defects
in P5-T4, so they remain explicit recommendations rather than silently expanded
scope.
