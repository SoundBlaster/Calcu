# ASP SDK package snapshots

`0al-agent-surface-0.1.0-experimental.0-4cd3397.tgz` is an unpublished npm
package built from [agent-surface-js](https://github.com/0al-spec/agent-surface-js)
merge commit `4cd339796eb43eb9e6a15c934a23b20e9a3ec434`, licensed MIT (LICENSE is
in the archive). This snapshot includes the merged offline selected-Grant and
semantic-request validators. The earlier
`0al-agent-surface-0.1.0-experimental.0.tgz` remains as the previously reviewed
snapshot and is not overwritten.

Current snapshot SHA-256:
`e34d0df0304c14f01b482d9f6e015ccb45d0a886120a22710706ca45ccffcfcd`.
The lockfile pins its SHA-512 integrity. Ordinary `npm ci` uses this
repository-local archive: no sibling checkout, npm publication or GitHub branch
resolution is needed to install the SDK. Registry access is still needed for
uncached transitive dependencies.

## Reproduce or deliberately update

In a clean checkout of the SDK at the exact commit above:

```sh
npm ci
npm run check
npm pack --pack-destination /absolute/path/to/Calcu/vendor
```

`prepack` builds the package. This snapshot was produced with Node 26.5.0 and
npm 11.17.0; compare the resulting archive digest (not just its version
string). Changes require a reviewed SDK commit, rebuilt archive, updated
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
