# ASP SDK package snapshots

## Current inline receipt pilot candidate

Installed base: `0al-agent-surface-0.1.0-experimental.0-920f85c.tgz`.
Test-only dev dependency: `0al-offline-proposal-exchange-experiment-0.0.0-experiment-920f85c.tgz`.
Both come from exact SDK commit `920f85cedda7ab7f5e1da4511577aefb9b3613c2`
([SDK PR #40](https://github.com/0al-spec/agent-surface-js/pull/40)), deliberately
not merged or published. The base's embedded source lock pins merged ASP commit
`814084f4d7d06ac85be358ba84533d0718607746`. Archive SHA-256 values:

- Base: `1e697f9b88c66e246fc5d46361ce1ace91624fe72123701c6ee36f6a7375e2d2`.
- Private experiment: `e2bc8c5d96872f4765ddd1860626adc036d5adc7e3e4dc739073fe881b3cd997`.

The superseded `5f044d5` archives remain unchanged as historical pilot inputs.
The current snapshot rejects a valid Grant paired with another prepared surface.

The private experiment is Node-only and used only by the test fixture; no
browser or live demo import is added. Its MIT notice is retained in
`offline-proposal-exchange-LICENSE.txt`; the base archive contains LICENSE.
Reproduce from a clean checkout at that commit: `npm ci`,
`npm run test:proposal-exchange`, then pack the base and
`./experiments/offline-proposal-exchange` into a new empty staging directory and
rename to the commit-qualified paths. The lockfile pins both archive integrities.
The default Calcu surface remains `0.1.3`; only the opt-in pilot selects the new
descriptor. See [pilot evidence](../docs/INLINE_RECEIPT_PILOT.md).

## Historical input-profile candidate

The previously installed archive is `0al-agent-surface-0.1.0-experimental.0-e5321de.tgz`,
built from exact SDK candidate commit
`e5321deab9231782cb375cd7dc4851daad625124`
([SDK PR #39](https://github.com/0al-spec/agent-surface-js/pull/39)).
It is not yet a merged SDK release. SHA-256:
`a94816c7a180822667108aadcc22c149050f4e3bc1be62fdc8a2af368ee4773b`.
The lockfile pins its integrity; the embedded ASP source lock and MIT license
are unchanged. It adds explicit `input_hash_profile` support. Calcu selects
surface `0.1.3`; see [alignment evidence](../docs/RECEIPT_INPUT_PROFILE_ALIGNMENT.md).
Reproduce using the clean exact candidate commit and the commands below.

## Historical public-authoring snapshot

`0al-agent-surface-0.1.0-experimental.0-c8908ab.tgz` is an unpublished npm
package built from [agent-surface-js](https://github.com/0al-spec/agent-surface-js)
merge commit `c8908ab865e698b9e92bc8f70b85be359d0e12a0` (SDK PR #32), licensed
MIT (LICENSE is in the archive). This snapshot adds the optional public
`@0al/agent-surface/authoring` entry point. The earlier commit-named `4cd3397`
and unqualified archives remain unchanged as historical snapshots.

Historical snapshot SHA-256:
`3425336616ed71128635aa66dea69dbd5abf430fd8b9d0550e991b734334a54c`.
The lockfile pins its SHA-512 integrity. Ordinary `npm ci` uses this
repository-local archive: no sibling checkout, npm publication or GitHub branch
resolution is needed to install the SDK. Registry access is still needed for
uncached transitive dependencies.

## Reproduce or deliberately update

In a clean checkout of the SDK at the exact commit above:

```sh
npm ci
npm run check
npm pack --pack-destination /absolute/path/to/an/empty/staging-directory
```

`prepack` builds the package. This snapshot was produced with Node 26.5.0 and
npm 11.17.0; compare the resulting archive digest (not just its version
string), then copy it to the commit-named path above. Always stage outside
`vendor`: npm's default version-only filename can collide with an older
snapshot. Changes require a reviewed SDK commit, rebuilt archive, updated
provenance and lockfile, and Calcu's full checks. Do not overwrite an archive
silently or use `npm link`. Once a suitable version is published, switching to
an exact registry version is a separate dependency update.

The embedded spec-lock pins ASP commit
`da550fde6f8be4ff0c1ded15524afb66c2912287` and the selected Core,
Authorization, Privacy, Safe Effects and Evidence sources. The SDK types used
here validate bounded offline representations only. They do not authenticate
identity, prove consent, issue authority, manage sessions, enforce live expiry,
admit an action, or establish ASP certification; Calcu retains those
application-side checks.

Compared with the `4cd3397` archive, all 24 pre-existing non-index `dist` files
and `spec-lock.json` are byte-identical. The existing root JS/type entry points
add only the `OfflineRequestGrantComposition` export; its implementation and
the authoring files are additions. Calcu does not adopt the composition export
in this slice. No dependency version used by the old base validators changes.

The base package and TypeBox `0.34.52` are runtime dependencies, satisfying the
SDK's optional authoring peer explicitly. The server manifest module now imports
the shared application declaration and can prepare the versioned SDK candidate.
That activation selected the qualified SDK-authored `0.1.2` description.
Neither authoring nor TypeBox is imported into the browser. The archive,
source lock and dependency versions are unchanged by activation. See
[P5-T8A preparation evidence](../docs/LIVE_SDK_MANIFEST_PREPARATION.md) and
[P5-T8B activation](../docs/LIVE_SDK_MANIFEST_ACTIVATION.md).

## Historical private offline authoring experiment

`0al-offline-action-authoring-prototype-0.0.0-prototype.tgz` is built from SDK
commit `307cbc693c98375f155d051fad2728e004749444`. It is an unpublished private
experiment, formerly installed as a dev dependency; it is no longer installed.
Its MIT notice is retained in `offline-action-authoring-LICENSE.txt`.

Archive SHA-256:
`ee1a49edc9a1f8afb220469134e6f4a0b9ec67b4c5302643947ef2289558dc03`.
The archive and notice are retained as migration evidence. Reproduce from that
clean SDK checkout with:

```sh
npm ci
npm run build:action-authoring-prototype
npm pack ./experiments/offline-action-authoring --pack-destination /absolute/path/to/an/empty/staging-directory
```

The current consumer imports the public authoring module, not the prototype or
its historical Calcu fixture. Calcu still owns the action declaration and
current disclosure policy. See [the migration report](../docs/OFFLINE_ACTION_AUTHORING.md).
