# Creating and contributing a port

A port is an independently maintained application theme, not a new case in a central compiler. It owns its mappings,
implementation, generator, tests, README, screenshots, version and release process.

For existing-port changes, start with that repository's `CONTRIBUTING.md`. For new ports, use the workflow below.
Contributors without organization access can submit a prototype through the
[port-request form](https://github.com/living-code-theme/core/issues/new?template=port-request.yml); maintainers arrange
review and an organization repository. You do not need permission to edit landing.

## 1. Prepare maintainer tooling

Use Node 22.22+ and pnpm 12.9.0. Clone core, and optionally landing for website previews:

```sh
git clone https://github.com/living-code-theme/core.git
git clone https://github.com/living-code-theme/landing.git
cd core
pnpm install --frozen-lockfile
pnpm check
```

Use a reviewed core revision. The committed resolved export at `exports/ports/palette.json` contains the four
flavors, semantic roles, raw color values, ANSI colors and source fingerprints. Do not fetch a palette at install,
build or theme-loading time.

## 2. Scaffold an empty port directory

From core:

```sh
pnpm new:port ../my-app --name "My App" --group "Editors" --emoji "📝"
# Optional: --flavors night,paper --slug stable-route --no-images
```

Choose an application-specific emoji, not the shared chameleon mascot. The directory must be empty. The command
creates only `README.md`, `port.json`, `LICENSE` and `images/`. It does **not** create a Git repository, application
implementation, palette pin, generator, package, tests or CI. Never use it to update an existing port.

## 3. Implement the application and its local build

Map the application's vocabulary to Living Code semantic roles. For example, a constant *value* and an identifier
holding a constant are not necessarily the same syntax category. Preserve the application's native format and any
handwritten runtime/plugin logic. Do not guess colors from screenshots or duplicate role policy as hard-coded hex.

For the standard regeneratable port layout, provide:

| File | Responsibility |
|---|---|
| `src/generate.mjs` | Pure `generate(flavors)` returning `{ path, content }` records for this application's theme files |
| `palette/theme.json` | Checked-in resolved core export, with the full reviewed core SHA in `source.revision` |
| `scripts/color.mjs` | Reviewed vendored color math matching the pin's `source.inputs["src/color.mjs"]` |
| `scripts/palette.mjs` | Local palette validation/reading; no network or sibling imports |
| `scripts/generated.json` | Exact allowlist of generated theme files; never README, package metadata, captures or workflows |
| `scripts/generate.mjs` | Safe, changed-only writes to that allowlist; `--check` reports stale bytes without writing |
| `scripts/update-palette.mjs` | Explicit adoption from a committed local core revision, validating source/data/math fingerprints |
| `package.json`, `pnpm-lock.yaml` | Pinned maintenance dependencies and package commands |
| `test/` | Deterministic generation, semantic/native-format checks and relevant application contracts |
| `CONTRIBUTING.md` | This port's build, palette adoption, fixture refresh and release instructions |

The documentation-only scaffold does not install this harness. Supply/review it as port-owned code; maintainers can
help adapt an existing port's harness. Do not copy another app's mappings, identity, README instructions or release
credentials. These files are part of the new port's review, not an implicit dependency on core.

When creating the first palette pin, copy the reviewed core export and record its exact Git revision in
`source.revision`. The data fingerprint excludes the `source` object; leave the exported data and its fingerprint
unchanged. The first vendored math file must match the recorded core input hash. Later adoption goes through the
port's own updater, not hand-editing colors or provenance.

Expose the standard maintainer commands:

```json
{
  "scripts": {
    "palette:update": "node scripts/update-palette.mjs",
    "build": "node scripts/generate.mjs",
    "check": "node scripts/check.mjs",
    "test": "node --test test/*.test.mjs"
  }
}
```

`check` includes generated-byte verification plus any app-native checks. A standalone port may use a different
native build system, but the batch updater requires this reviewed maintenance contract. Package/release commands
must consume committed files, not secretly regenerate or adopt a palette.

## 4. Finish metadata, instructions and real captures

Follow [the port.json and README contract](PORTS.md). In particular:

- List only supported flavors and actual distributable files in `port.json`. Use the hosted schema URL; do not add a
  local schema copy. Keep a published slug stable.
- Complete every README placeholder with tested installation, activation, configuration and compatibility steps.
  Keep the README version marker, section order, comparison table and flavor dropdown attributes.
- Capture the actual application with the theme loaded. Declared image paths must exist. If there are no captures,
  use `images: []` and honest README copy, not fake screenshots. Check contrast, syntax distinctions and native UI.
- Preserve legal/font credits. Packaging/marketplace identity and versions are owned by this repository; do not use
  another port's publisher identifiers or assume an organization marketplace listing already exists.

## 5. Verify locally and preview the website

In the new port, after providing its maintenance code:

```sh
pnpm install
pnpm build
pnpm check
pnpm test
```

Commit the resulting lockfile. CI should subsequently use `pnpm install --frozen-lockfile`. Validate installation in
the real application as well; a valid JSON/XML file alone does not establish correct highlighting.

From core, preview the port without publishing:

```sh
pnpm preview:port ../my-app --landing ../landing
```

This validates the descriptor, README, declared files and captures, then frozen-installs/builds an isolated website
copy. It does not modify production, upload captures or query GitHub. The local fingerprint is not a published
commit, and the preview banner explains that source/download links require publication. Re-run after editing.

## 6. Review, merge and publish

Submit the implementation, pin, generator, tests, documentation and captures for review together. Maintainers
create/use `living-code-theme/<repository-name>` and publish the accepted default branch, normally `main`.
No central website registration, cross-repository token or per-port discovery workflow is required.

Landing polls the public organization approximately every 15 minutes, validates one immutable revision per port,
builds/tests its candidate publication and deploys it. An invalid new port is skipped with a diagnostic. An invalid
update keeps the port's last accepted website version. Manual dispatch of landing's `sync-ports` workflow can give
quicker maintainer feedback; normal local website builds do not refresh GitHub inputs.

After deployment, check `/ports/<slug>/`, source/install links, screenshot flavors and compact installation details.
A Git push publishes the source and makes it discoverable; app stores, registries and release assets still have their
own explicit release/tag/submission requirements.

For later color updates, see [Palette rollouts](PALETTE-ROLLOUTS.md). For discovery/storage details and optional R2,
see [Port publication and capacity](PORT-PUBLICATION.md).
