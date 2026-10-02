# Small retrospective: cancellation race in PR #15

Date: 2026-10-02 UTC. Scope: process lifecycle tests and CI diagnostics only.

## What happened

The initial authoring candidate passed local checks, including full coverage.
CI's normal test job also passed. The coverage job passed all 235 assertions
but failed on an unhandled `EPIPE` emitted by Codex's stdin during cancellation.
See [the failed run](https://github.com/SoundBlaster/Calcu/actions/runs/36937630811).
Different scheduling exposed a pre-existing process-boundary race; the logs
do not establish that schema authoring itself caused it.

Checking `stdin.writable` cannot guarantee that the peer will still be alive
when a write completes. A cancellation callback could also settle the task
before the adapter attempted its initial handshake write. The old test checked
the rejected task and directory cleanup but did not force the asynchronous
pipe error or assert that cancellation prevented subsequent writes.

## Changes and lessons

- Commit `93c8206` keeps stdin error handling through shutdown and stops writes
  after settlement. Deterministic error injection covers active failure and
  cancellation, with zero backend calls and temporary-directory cleanup.
- This follow-up explicitly checks the write count: one initial handshake on
  active failure, zero writes if cancellation happens in the starting callback.
- Coverage now produces reports on failure and CI attempts to upload them.
  Missing reports remain an error after a successful coverage step; after a
  failed producer they are a warning so the original failure stays visible.
  Cancelled jobs do not attempt upload. Artifacts are diagnostics, not proof of
  a passing run, and must not contain user tasks, credentials or private keys.

Local success is evidence for that run, not evidence that every scheduling
order works. Prefer deterministic lifecycle regressions over repeated lucky
runs, arbitrary delays, test retries or suppressing unhandled errors.
Coverage thresholds and required test failures are not weakened.

The previous fix was independently green in
[CI](https://github.com/SoundBlaster/Calcu/actions/runs/36982466985) and
[Coverage](https://github.com/SoundBlaster/Calcu/actions/runs/36982467023).
Those results apply to `93c8206`, not automatically to this follow-up.

## Authoring experiment boundary

The candidate still runs offline only. It gives one shared field declaration
and inferred types, not a demonstrated reduction in total integration code.
The redundant string keyword changes hashes and prevents a transparent live
replacement. Keep the production manifest and independent authority checks;
qualify a supported authoring module before a separately reviewed migration.

## Follow-up verification

Local `check`, full coverage (237 tests), build and whitespace checks passed.
A temporary synthetic failing test returned exit code 1 while generating
non-empty HTML and LCOV reports in a fresh temporary directory; the probe was
removed before commit. YAML parsing and producer/upload guards were checked
locally. The modified GitHub upload step itself awaits this follow-up's CI;
the local probe does not establish remote artifact-upload success.
