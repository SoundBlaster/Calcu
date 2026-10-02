# ASP SDK package snapshots

`0al-agent-surface-0.1.0-experimental.0-c8908ab.tgz` is an unpublished npm
package built from [agent-surface-js](https://github.com/0al-spec/agent-surface-js)
merge commit `c8908ab865e698b9e92bc8f70b85be359d0e12a0` (SDK PR #32), licensed
MIT (LICENSE is in the archive). This snapshot adds the optional public
`@0al/agent-surface/authoring` entry point. The earlier commit-named `4cd3397`
and unqualified archives remain unchanged as historical snapshots.

Current snapshot SHA-256:
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
The live factory selects the qualified SDK-authored `0.1.2` description.
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
