# P5-T6: Second-Consumer Comparison

**Date:** 2026-09-26  
**Status:** Preliminary local evidence; [SDK PR #14](https://github.com/0al-spec/agent-surface-js/pull/14) review pending  
**Consumer:** separate fixed-output Hello application, importing a packed local
`@0al/agent-surface` tarball through the package root

## What the experiment proves

The existing SDK package is consumable outside its own test imports for the
bounded offline value layer:

- `JsonDocument`, `CanonicalObjectHash` and `SurfaceSnapshot`;
- `OfflineSchemaResources` and `OfflineProposalManifest`;
- `OfflineSemanticGrantRequest` and `OfflineSelectedGrant`;
- schema instance validation and derived exposure projection.

The consumer uses its own `greeting.propose` IDs, schemas, data class, manifest,
semantic request and selected-Grant representation. Positive checks succeed and
a malformed manifest fails before any application behavior. Tests install the
packed SDK tarball in a fresh temporary directory, so they do not import SDK
`src/`, tests, or workspace links.

This demonstrates **representation-level code reuse**, not runtime reuse. The
fixture identity and Grant are intentionally synthetic: their validator success
does not make them authentic or authorized.

## Cost observed in the small consumer

| Consumer artifact | Lines | Interpretation |
| --- | ---: | --- |
| Native `greet()` behavior | 8 | Ordinary application behavior; no ASP dependency. |
| Manifest, schema resources, synthetic request/Grant construction and SDK preparation | 298 | Mostly application declarations and explicit representation wiring. SDK validates these values but does not generate them from a typed operation model. |
| Consumer tests | 33 | Three smoke/negative cases; not a conformance suite. |
| Pack/install/run harness | 55 | SDK-repository test infrastructure, not per-application integration code. |

The resulting application-first shape is clear, but the current SDK does not
yet deliver the concise action-registration or host-composition ergonomics in
the design sketches. In this consumer, describing the complete offline
representation dominates the eight-line native app. This is one fixture, not a
general effort estimate.

## Reuse classification after the spike

| Concern | Evidence-based disposition |
| --- | --- |
| Strict JSON, selected schemas, integrity/surface hashing, bounded manifest/request/Grant representation and exposure projection | Reusable SDK behavior is demonstrated by both Calcu and the independent Hello package consumer. The SDK validates rather than authorizes. |
| Application action/schema/data-class declarations and handler mapping | Remain application-owned. The SDK has no verified authoring model/generator that can safely derive them. |
| Identity evidence verification and current lifecycle status | Trust source and verifier policy remain app/deployment-specific. Hello uses a synthetic representation only; this experiment adds no identity verification abstraction. |
| User authentication, consent and issuer policy | Remain application-owned decisions. No Grant is issued by the Hello consumer. |
| Grant/session authority state, revocation, quotas and concurrency/fencing | Not proven reusable by this spike. Calcu has a concrete in-memory implementation; Hello has no stateful runtime. Transaction, restart and race guarantees need separate contracts and tests. |
| Runtime/App Receipt creation and verification | Calcu now has unsigned, transient, server-only receipt behavior. Hello does not implement receipt production/verification, so portability is not demonstrated. Keep this as a candidate, not an extraction decision. |
| HTTP/TLS server/client, request limits and cancellation | Deployment-specific in Calcu; Hello uses no network. A reusable adapter must qualify the required transport and cancellation semantics on another host. |
| Executor, mediator, Codex CLI adapter, task host/UI and calculator engine | Application/provider/deployment-specific today, or not enough second-consumer evidence to generalize. |

## Validation performed

- `npm run test:hello-consumer`: PASS — packed SDK install, 3 consumer tests,
  and native Hello output.
- SDK `npm run check`: PASS — 407 existing SDK tests plus the three packaged
  consumer tests.
- SDK `npm run build`: PASS.
- SDK `npm pack --dry-run`: PASS — package contains `dist`, metadata and
  `spec-lock.json`; the consumer example is excluded.
- `git diff --check`: PASS.

The above results are local to the unmerged SDK branch; they are not GitHub CI
or evidence about the post-merge artifact.

## Recommendation

Keep current offline value validators in the SDK. Do not extract Calcu's live
issuer, identity verifier, session store, executor, receipts or TLS stack yet.
The next justified API investigation is a small authoring layer that reduces
the repeated declaration/wiring cost while preserving closed schemas, exact
wire field names, explicit exposure and handler allow-lists. It should first
derive offline manifests/schemas only and must not claim that a descriptor
authenticates, grants or enforces authority.

The official ASP adoption backlog still owns ADP-09 status and sequencing. This
local experiment is evidence toward that review; it does not mark ADP-09
complete or unblock it.
