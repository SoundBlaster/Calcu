# P5-T6 Validation Report

**Date:** 2026-09-27
**Result:** PASS — bounded second-consumer comparison completed; runtime
extraction was not justified by the evidence.

## Evidence

The detailed comparison and recorded validation results are in
`P5-T6_Consumer_Comparison.md`. The Hello consumer installed a locally packed
SDK artifact, imported public package-root exports, and passed its positive and
negative consumer tests. The SDK package checks, build, and pack checks passed;
the consumer and Calcu CI checks reported in the comparison also passed.

The experiment establishes offline representation-level reuse only. It does
not establish identity verification, consent, Grant issuance, session
lifecycle, authorization, receipts' producer authenticity, transport reuse,
runtime extraction, or ASP conformance. Calcu continues to pin its recorded SDK
artifact; the comparison found no runtime payload change that justified
replacing it.
