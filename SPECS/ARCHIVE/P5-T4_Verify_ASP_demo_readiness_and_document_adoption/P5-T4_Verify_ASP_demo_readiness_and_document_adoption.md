# P5-T4: Verify ASP demo readiness and document adoption

## Objective and scope

Complete the Calcu ASP experiment with reproducible evidence that another
developer can run and assess without treating the demo as production ASP
conformance. The task verifies the implemented P5-T1 through P5-T3 path, records
what the implementation proves, measures its adoption cost, and keeps all
remaining security and interoperability gaps explicit.

The existing `codex/calcu-asp-demo-plan` branch and pull request #2 are reused.
P5-T4 is the concluding verification slice of that focused demo; splitting it
onto a branch without the preceding implementation would make the evidence
non-executable. The pinned ASP baseline remains
`951871c2d55db25d35512f29cc0970c69aa5cfd9` and no normative ASP repository
change is in scope.

Difficulty: **medium**. Reasoning effort: **high**, because the main risk is an
overstated conformance claim rather than implementation complexity.

## Deliverables

- A deterministic post-build check that fails if known server-only Grant,
  identity, session, credential, or private-key markers appear in the browser
  bundle. The check is a focused regression guard, not proof that arbitrary
  secrets can never leak.
- Tests for both the accepting and rejecting paths of that bundle check, wired
  into the repository's existing test/build commands.
- A public ASP adoption report covering architecture, exact prerequisites,
  reproduction, evidence, code/dependency footprint, limitations, and
  recommended next steps.
- Updated top-level and server documentation that describes the implemented
  demo rather than calling it a future plan.
- Measured narrow and wide rendered-layout evidence from the real local demo.
- A Flow validation report containing exact commands and results.

## Acceptance criteria

1. `npm run agent:demo` remains the single documented live-demo command after
   installing dependencies and authenticating exact Codex CLI `0.145.0`.
2. Default CI remains deterministic and uses no model credentials or paid model
   inference; fake app-server fixtures remain clearly labelled as mocks.
3. The built browser assets are checked for an explicit deny-list of
   server-only protocol markers, and a fixture containing any marker fails.
4. Existing adapter, HTTPS boundary, task-host, UI, authority-rejection, quota,
   timeout, cancellation, and correlation tests remain green.
5. The adoption report distinguishes local executable evidence, one manual live
   smoke, incomplete ASP role coverage, and unsupported production properties.
6. Narrow and wide audits include screenshots plus DOM measurements for panel
   order, width, overflow, and the calculator's continued usability.
7. `npm run check`, `npm run build`, `npm run test:coverage`, and
   `git diff --check` pass locally with at least 80% line coverage.

## Test-first implementation plan

### Phase 1 — Build-boundary regression

Write failing Node tests for a verifier that accepts a safe generated asset,
recurses through nested build output, and rejects each server-only marker with a
non-secret diagnostic. Implement the smallest filesystem scanner needed to make
those tests pass. Invoke it after `vite build` so the check evaluates the actual
artifact rather than only source imports.

Validation: focused Node tests pass, an intentionally contaminated temporary
bundle fails, and the current production bundle passes.

### Phase 2 — Adoption and reproduction documentation

Replace the stale README statement that the runtime is only planned. Add a
concise public report with prerequisites, the one-command live path, trust
boundaries, evidence-to-test mapping, implementation/dependency footprint, and
remaining work. Update the server conformance report and demo plan status without
claiming Receipt Producer, Human Approval, Proof-Bound transport, independent
interop, or production agent identity.

Validation: all referenced commands and repository-relative links resolve; the
report names the exact CLI/model/effort and separates deterministic CI from the
2026-09-05 manual smoke.

### Phase 3 — Rendered verification and full gates

Start the real local demo without sending another model task. Inspect compact
and wide layouts with browser screenshots and DOM rectangles. Verify ordering,
equal panel widths where expected, spacing, no horizontal overflow, and ordinary
calculator controls. Record the measured evidence, then run all configured
quality gates and produce the Flow validation report.

Validation: visual evidence is reproducible, the repository gates pass, and no
secret or ephemeral TLS material is committed.

## Assumptions and non-goals

- The earlier authenticated Luna `low` smoke is valid local evidence; P5-T4 does
  not repeat paid inference unless implementation changes invalidate it.
- Browser-bundle marker scanning supplements architecture and tests. It is not
  a general taint-analysis or secret-scanning product.
- No human approval, signed receipt, DPoP/mTLS, durable identity, recovery,
  remote deployment, general-purpose ASP SDK, or ASP normative edit is added.
- Any newly discovered production requirement becomes a separately identified
  follow-up rather than being hidden inside this verification task.

---
**Archived:** 2026-09-05
**Verdict:** PASS
