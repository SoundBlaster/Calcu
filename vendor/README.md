# ASP SDK package snapshot

`0al-agent-surface-0.1.0-experimental.0.tgz` is an unpublished npm package built
from [agent-surface-js](https://github.com/0al-spec/agent-surface-js) commit
`3b44cbadd22f46fd66370be37f4fe6abadb61fd4`, licensed MIT (LICENSE is in the archive).
It is generated output, not a fork to edit. The SDK's exact runtime dependencies
are resolved by Calcu's package-lock.json, not embedded in the archive.

SHA-256: `d1ff6514e5db159db683eeaa9afec6233fcd7f5a4d2befa908a89f63b346dea5`.
The lockfile also pins the archive's SHA-512 integrity. Ordinary `npm ci` uses
this repository-local archive: no sibling checkout, npm publication or GitHub
branch resolution is needed to install the SDK. Registry access is still needed
for uncached transitive dependencies.

## Reproduce or deliberately update

In a clean checkout of the SDK at the exact commit above:

```sh
npm ci
npm run check
npm pack --pack-destination /absolute/path/to/Calcu/vendor
```

`prepack` builds the package. This snapshot was produced with Node 26.5.0 and
npm 11.17.0; compare the resulting archive digest (not just its version string).
Changes require a reviewed SDK commit, rebuilt archive, updated provenance and
lockfile, and Calcu's full checks. Do not overwrite an archive silently or use
`npm link`. Once a suitable version is published, switching to an exact registry
version is a separate dependency update.

The embedded spec-lock pins ASP commit
`951871c2d55db25d35512f29cc0970c69aa5cfd9` and evidence module only. This snapshot
provides hashing, not complete manifest validation or ASP certification.
