# Packaging and publication

Packaging is a **local preparation step**, not publication. Each port owns its format, version,
package command and destinations. Core only discovers that contract, invokes it and collects its
explicit outputs; it does not contain an application-format compiler or a publisher registry.

## Prepare every eligible port

From a checkout layout with core and ports beside one another:

```sh
cd ~/dev/lc/core
pnpm package:ports --ports-root ..
pnpm package:ports --ports-root .. --output ../packages-next --apply
```

The first command is a read-only plan. The second requires a **new output directory** and invokes
`pnpm run package` in each selected, trusted port. Install any maintenance dependencies beforehand.
VS Code's existing packager uses pinned `pnpm dlx @vscode/vsce@4.0.0`, which may need network access
on its first run; that is tooling download, not publication. Some port checks also need Python 3.

You can select a subset without scanning:

```sh
pnpm package:ports ../vscode ../firefox ../pi --output /tmp/living-code-review --apply
```

Use `--json` for machine-readable reports. No command in this tool publishes, signs, commits,
tags, pushes, adopts a palette or captures screenshots. It executes local package scripts, so review
those scripts before opting a third-party checkout into a run. Inputs are the current local files;
review/commit them before a real release rather than treating packaging as a clean-Git attestation.

Packaging/release opt-ins cover **13 registry-backed package ports**: VS Code (two registries),
JetBrains, Firefox, Chrome, Obsidian, Sublime, Zed, the four web/npm packages, Pi and micro.
A local build is not evidence that any package has already been accepted or published.

**Normal file ports have no release workflow or publication-packaging opt-in.** They distribute native
files directly from their repositories. Inclusion in an upstream theme collection is a source contribution,
not a reason to create versioned ZIP releases. Konsole's `.colorscheme` files stay in this category even
if they are manually listed on KDE Store. Potential upstream inclusion does not imply a need for
release automation.

## Release policy

- Only a real package/extension with a marketplace or registry destination gets a release workflow.
  Keep its `publication.json`, native package manifests and package/version checks in that port repo.
- The maintainer reviews and commits the package, bumps its version, then creates an immutable tag
  matching that version: normally `v<version>`, or `<version>` without `v` for Obsidian.
- That port's release workflow validates the tag and existing payloads and attaches its package assets
  to its own GitHub Release. It must not create/move tags, adopt palettes or capture screenshots.
- Registry publication remains explicit. Use the publish workflow at the intended release tag/ref,
  or publish the reviewed artifact with the relevant registry credentials. Do not mistake a GitHub
  Release for a successful marketplace upload. Micro's registry metadata references its release ZIP;
  Obsidian's theme installation also requires the appropriate release assets.
- File ports keep normal checks/tests and native screenshot CI. They need no package-release tags,
  registry publishing workflows or automated GitHub Releases. Existing local archive helpers or CI
  review artifacts do not turn a file port into a registry package.

## Bundle contents and failure behavior

```text
packages-next/
  manifest.json
  SHA256SUMS
  <port-slug>/
    SUBMISSION.md
    <declared package files>
```

`manifest.json` records versions, channel instructions, statuses and artifact sizes/SHA-256 hashes.
Only declared artifacts are copied; unrelated or old files elsewhere in `dist/` are not swept into
the bundle. The palette port's public slug is `json`, so its output directory is `json/`, not `palette/`.
Verify the collected bytes on a system with `sha256sum`:

```sh
cd ../packages-next
sha256sum --check SHA256SUMS
```

The command preflights every selected contract before running any packager. Unsafe paths,
symlinked metadata/files, duplicate slugs and existing/inside-checkout output directories are
rejected. Missing/empty/stale declared artifacts and package-command failures make the run fail.
A partial bundle retains a report with `ready: false` and a nonzero exit status; never submit it as
if it were a complete release. Existing bundles are never overwritten. Use a new directory to retry.

Normal per-port packaging remains available independently:

```sh
cd ../chrome
pnpm package
```

### Native artifact types

| Destination | Prepared files | Submission distinction |
|---|---|---|
| VS Code / Open VSX | `.vsix` | Same extension package; separate publisher/namespace credentials. |
| JetBrains | Plugin ZIP containing JAR | First upload manual; later updates can use the port workflow. |
| Chrome | Night/Paper ZIPs | Separate theme listings, registration and review. |
| Firefox | Night/Paper unsigned XPIs | AMO signing required; new GUIDs do not update old GUIDs. |
| Obsidian | Source ZIP, `manifest.json`, `theme.css` | Registry points to the repository; release tag is manifest version without `v`. |
| Sublime | `.sublime-package`, `package-control.json` | Native package for manual install; registry entry uses repository semver tags. |
| Zed | Source ZIP, `zed-registry.toml` | Registry uses a committed repository submodule, not a ZIP upload. Human submission only. |
| npm (including Pi) | Public-package `.tgz` | Verify name, scope ownership and unused version; publish the reviewed tarball explicitly. |
| micro | Native plugin ZIP, `repo.json` | Loader registers four schemes; release URL must exist before channel submission. |

Read each generated `SUBMISSION.md` before taking an external action. Existing per-port publish
workflows remain explicit maintainer operations; this batch command does not dispatch them.

## Port-owned opt-in contract

A registry-backed package port opts in with `publication.json` at its root. Do not add this metadata
for ordinary downloadable theme files or upstream collection contributions:

```json
{
  "schemaVersion": 1,
  "artifacts": ["living-code-example-{version}.zip"],
  "channels": [
    {
      "name": "Destination name",
      "url": "https://example.com/submit",
      "instructions": "Manual steps, identity requirements, review caveats and required credentials."
    }
  ]
}
```

- The port must also have `port.json`, a versioned `package.json` and a `scripts.package` command.
- Artifact entries are **basenames in `dist/`**, not globs, commands or arbitrary repository paths.
  `{version}` is the only placeholder. List every file needed for submission explicitly.
- Packaging must validate existing native payloads, not silently regenerate them or recapture UI.
- Keep the artifact list and destination instructions with the port. Adding a destination requires
  no new application switch or registry entry in core.
- Channels are descriptive instructions, never commands executed by the collector. Do not put
  secrets in the metadata. The output is a review bundle, not proof of store acceptance.
