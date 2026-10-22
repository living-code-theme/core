# Maintaining this port

This repository owns its mappings, palette pin, native payloads, installation guide, capture adapter and CI.
Normal generation never reads a sibling repository or fetches a palette. Maintenance needs Node 22.22+,
pnpm 12.9.0 and Python 3. Recapturing additionally needs Nix on x86_64 Linux (or the GitHub Actions runner).
Theme installation itself needs none of those build tools: use the flavor-selected `curl` block in README.

## Build, capture and verify

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm screenshots
pnpm check
pnpm test
pnpm package
```

- `src/generate.mjs`: application-owned pure `generate(flavors)` mappings, returning `{ path, content }` records.
- `palette/theme.json`: resolved core snapshot with reviewed revision and data/input fingerprints.
- `scripts/color.mjs`: reviewed vendored color math, verified against that pin.
- `scripts/generated.json`: exact theme-payload allowlist. Builds change only those files, never documentation,
  descriptors, workflows, screenshot recipes or captures. `--check` reports stale bytes without writing.
- `test/fixtures/upstream.json` and `test/format.test.mjs`: independent native-format and semantic contracts.
- `test/publication.test.mjs`: four-flavor screenshot integrity, clone-free installation, and execution of the
  README download block for every flavor in throwaway homes with spaces/custom config paths. Only the HTTP
  transport and application launch are stubbed in that installer test; requested files must actually exist.

README remains the only authored end-user installation/configuration guide. Preserve its comparison table,
flavor dropdowns, native activation instructions and non-destructive treatment of existing configuration.
Do not turn palette adoption, screenshot capture or release publication into a side effect of theme generation.

## Automatic real-application screenshots

```sh
pnpm screenshots                    # refresh missing/stale captures; no-op when current
pnpm screenshots -- --force         # explicitly recapture all four flavors
pnpm screenshots -- --flavor paper # inspect one flavor in dist/capture-preview/, without replacing published images
pnpm screenshots:check              # offline, read-only freshness and integrity check
```

The logic lives here:

| Path | Owns |
| --- | --- |
| `capture/app.py` | This application's native installation, isolated profile/fixture and readiness-driven UI interactions |
| `capture/config.json` | Scene disclosure, real version command and any additional fixture inputs |
| `capture/flake.nix`, `capture/flake.lock` | Revision/hash-locked application, Xvfb, Kitty, image tools and fonts |
| `scripts/capture.py` | Vendored display/terminal runner, isolated environment, four-flavor staging, PNG/palette checks and provenance |
| `images/{night,frost,paper,signal}.png` | Actual application windows, 2560×1600 at native 2× layout scale; never upscaled, mocked or recolored |
| `images/capture.json` | Input and PNG SHA-256 hashes, native runtime identity and observed palette colors |
| `.github/workflows/check.yml` | Automatic refresh before checks/tests/packaging, artifacts and validated main-branch image commits |

The runner uses a disposable HOME, XDG directories, runtime directory and display. It does not pass through
provider keys, user configuration, Docker sockets or the user's D-Bus session. Agent recipes use native previews,
local fixture history or unsent input, never paid model requests. Application-specific fixture data is disclosed
in `capture/config.json`. Programs and their own color loaders render the UI; Kitty is only a terminal for TUIs.
A graphical terminal port launches that terminal itself, not a substitute shell window.

All supported flavors need captures. `pnpm check`, publication tests and packaging reject stale inputs, changed
PNGs or missing flavor coverage. Source/recipe/runtime changes refresh the images automatically in CI; unchanged
inputs reuse verified committed images, avoiding pointless binary-history churn. A failed capture does not publish
an incomplete flavor set. Pull requests get artifacts but cannot push image commits; accepted pushes to `main`
commit only validated `images/` changes, without force-pushing over newer work. Landing later discovers those files
from the port's immutable commit. Its R2 layer stores optimized copies; it does not capture applications.

Review native screenshots whenever changing the app adapter or runtime pin. `scripts/capture.py` was vendored
from core's `templates/capture/capture.py`; adopt improvements deliberately and recapture, without adding a runtime
core dependency. Do not replace a failing native capture with a generated mockup or silently clear `images`.

## Explicit palette adoption

In a reviewed core checkout, run its build/check/test and commit the palette inputs. Then, in this repository:

```sh
pnpm palette:update /path/to/core
pnpm build
pnpm screenshots
pnpm check
pnpm test
```

The updater verifies committed source/data/math fingerprints and rejects dirty or stale core exports. It changes
only the pin. If core's color math changed, review and copy that revision's `src/color.mjs` into `scripts/color.mjs`
first. Never fetch/adopt a palette at install or load time. Review expected role contracts independently of generation.

## Upstream contracts and packaging

Refresh upstream field fixtures deliberately when the application changes; never derive expected vocabulary from
the generator under test. If this repository exposes `pnpm test:native`, it provides an additional optional native
format/PTY check; its pinned binary setup remains documented in the separate CI job and script.

Packaging verifies committed payloads and capture provenance and includes the README, descriptor, license, native
files and images. It never rebuilds, adopts a palette or captures UI. CI uploads the installable archive and native
preview artifacts. Marketplace submissions, release tags and external registry publication remain explicit operations.
