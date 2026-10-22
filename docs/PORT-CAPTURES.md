# Native port screenshots and direct installation

Every **new published port** must include a real capture for **each supported flavor**, a repeatable app-owned
capture recipe, and CI that refreshes missing/stale captures before validation. For file-based themes, installation
must download the selected native files directly into the application's theme/config location; cloning a repository
is a maintainer operation, not the normal install path.

These requirements apply to the 16 agent/developer-tool ports and future ports. They do not centralize application
mappings, create a new discovery registry, or make landing execute port scripts. Older descriptors with incomplete
images remain readable by the publication protocol, but that compatibility is not permission to omit new captures.

## Where the logic lives

| Location | Responsibility |
| --- | --- |
| `<port>/capture/app.py` | Actual app installation/configuration, fixture preparation, readiness-driven UI actions and cleanup |
| `<port>/capture/config.json` | Honest scene description, runtime-version command, additional fixture input paths |
| `<port>/capture/flake.nix` and `flake.lock` | Reviewed, immutable app/tool/font environment |
| `<port>/scripts/capture.py` | Vendored native display/terminal runner, isolation, validation and provenance |
| `<port>/images/*.png` and `images/capture.json` | Published source captures and their input/image hashes |
| `<port>/.github/workflows/check.yml` | Automatic capture, validation, artifacts and validated capture commits on main |
| `core/templates/capture/` | Reviewed reusable runner, workflow, tests, packaging and maintainer-guide templates |
| `core/scripts/screenshots.mjs` | **Palette-preview screenshots only**, not application captures |
| `core/src/port-assets.mjs` | Validation/optimization/content-addressed storage of existing images, optionally in R2 |
| `landing` | Rendering published snapshots; never launching apps or generating screenshot scenes |

The original application images were committed to their owning repositories; there was no universal maintained
per-port native-capture command in the split-repository scaffold. Do not rely on retired monorepo utilities or a
one-off `/tmp` script. The new standalone contract keeps the recipe next to the app it understands. Copy/review a
core template deliberately; capture/check must work without a sibling core checkout or downloads of executable
scripts from a moving branch.

## Resolution and truthful rendering

Source PNGs are **2560×1600**, matching the first batch. This is a **1280×800 layout rendered natively at 2×**:
use a 2560×1600 virtual display and corresponding font/padding scale. **Never upscale a 1280×800 raster**. Enforce
these exact dimensions in offline checks, tests and packaging. The README can still show 640px comparison images
and 1280px expanded images; those display widths do not reduce source resolution. Website/R2 optimization is a
separate derived-asset concern.

For terminal applications, run the actual binary and its own theme loader inside a real terminal emulator on
Xvfb. Kitty provides the terminal, not a reconstruction of the UI. For a terminal-emulator port, launch that actual
emulator and capture its window; a Kitty approximation is not evidence that another emulator loaded its theme.
No HTML mockups, hand-drawn UI, palette-swapped stock images, or synthetic PTY transcripts masquerading as apps.

Fixture project files, structured records and local mock backends are allowed when the real application renders
them. Disclose them in `capture/config.json`. Agent previews must not require a paid provider call. Prefer native
theme previews, clearly labeled local session history or unsent input. Never use a developer's existing sessions,
credentials, container list, project paths or background server to fill a screenshot.

## Native capture interface

The reviewed Python runner uses standard-library modules. A port vendors it as `scripts/capture.py` and implements
an independent `capture/app.py` adapter:

```python
def prepare(context):
    # Install this port's actual payload into the disposable app profile.
    # Return the real application executable and arguments.
    return ["my-app", "--config", context.home / "native-config"]


def drive(context):
    context.wait_text("A native ready-state marker")
    # Safe fixture interactions only; do not submit a paid model prompt.
```

The runner supplies temporary `home`, `work`, `env`, `root`, selected `flavor` and `slug`, plus file-copy/write,
bounded process, terminal-text/key, and tiny Git-project helpers. Graphical adapters set `GRAPHICAL = True` and
wait for their real native window. An optional `cleanup(context)` stops only processes created by that adapter.
Do not bake application cases into the shared runner.

The child environment strips provider credentials, user config/data/cache/state/runtime paths and the user's
D-Bus session. Xvfb listens only locally, and every capture uses its own terminal control socket. A graphical
software renderer is acceptable: the application still owns rendering and theme parsing. Capture flakes must
set `CAPTURE_MESA = "${pkgs.mesa}";` in their development shell. The runner explicitly selects that locked
Mesa EGL/GLX vendor libraries and llvmpipe driver for **both Xvfb and the terminal client**; do not depend on a
NixOS host's `/run/opengl-driver`, which is absent on fresh GitHub runners. Native process diagnostics are retained in the disposable profile and printed on failure.

`capture/config.json` names the native `versionCommand`, truthful `scene`, and all extra `fixtures`. The runner
fingerprints these, its own code, the adapter, descriptor, palette pin, runtime pin and every distributable payload.
It stages **all** supported flavors first, checks real PNG dimensions and observed palette colors, then replaces
published files and provenance only after the entire set succeeds. Read-only checks reject missing/stale inputs,
changed PNG bytes and incomplete flavor coverage. An explicit single-flavor preview writes only under `dist/`.

## Commands and CI

The standard package contract adds:

```json
{
  "scripts": {
    "screenshots": "nix develop path:./capture --command python3 scripts/capture.py",
    "screenshots:check": "python3 scripts/capture.py --check",
    "check": "node scripts/check.mjs && python3 scripts/capture.py --check"
  }
}
```

Maintenance needs Python 3 in addition to Node/pnpm. The committed Nix environment supplies the native app, display,
image tools and fonts for x86_64 Linux. Installing the theme never requires Nix, Python or Node.

```sh
pnpm build
pnpm screenshots                    # no-op if all committed inputs/images are current
pnpm screenshots -- --force         # force four-flavor native recapture
pnpm screenshots -- --flavor paper # preview in dist/capture-preview/, without changing published files
pnpm check
pnpm test
pnpm package
```

Adapt `templates/capture/check.yml` and preserve app-specific native/release jobs. CI must run screenshots **before**
checks/tests/packaging, upload previews as artifacts, and on accepted main-branch pushes commit only validated
`images/` changes. Fork PRs may produce artifacts but must not push. Avoid cross-repository secrets, force pushes,
recursive workflow triggers and binary churn on unchanged inputs. Manual workflow dispatch forces a native
recapture and can publish its validated images. Image updates made with `GITHUB_TOKEN` do not recursively trigger
another Actions run; landing's existing discovery/manual dispatch publishes the resulting immutable commit.

Theme generation and palette adoption remain independent: neither silently launches apps. A capture-aware local
palette change must explicitly run the port's `screenshots` before its freshness-gated checks. Core's deliberately
theme-only batch updater does not authorize screenshot writes; use the port-local sequence above for capture-enabled
ports rather than bypassing freshness checks or widening its allowlist behind the maintainer's back.

## Direct installation, not clone/copy

Follow the existing Alacritty and other file-based ports' convention:

```sh
flavor=night # night, frost, paper, or signal
curl -fsSL --create-dirs -o "<native theme directory>/living-code-$flavor.<extension>" "https://raw.githubusercontent.com/living-code-theme/<repo>/main/<payload path>/living-code-$flavor.<extension>"
```

Replace those illustrative angle-bracket items with the **verified native** path and format in each README. Explain
shell/platform differences. Quote every path; honor supported `XDG_*`, app-home or config-path overrides. For apps
with a native path command, such as `posting locate themes` or Nu's `$nu.default-config-dir`, use that instead of
assuming a Linux folder on every platform. Download all required companion payloads (GitUI needs RON and TextMate).
Show activation next to download and keep each flavor's activation details accurate.

Do not overwrite an existing full settings/config file with a theme fragment. If the app has no standalone import
(Herdr and Lazydocker), download to a separate fragment location and explain how to replace only the relevant theme
tables/keys. Preserve unrelated credentials, model settings, workspaces, keybindings and commands. Do not invent a
loader just to make installation look shorter. Package/plugin-manager installation may be an additional native
option where appropriate, but the app's real conventions win.

Adapt `templates/capture/publication.test.mjs` and independently author `capture/install.json`. Tests must execute
the exact README download block for every flavor in temporary homes (including spaces/custom paths), stub only
HTTP/process transport, check requested files against the real manifest, verify native destinations and ensure
existing configs survive. These tests are not a substitute for real native installation/capture validation.

## Publication checklist

- All supported flavors have native 2560×1600 PNGs, recipe/runtime provenance and matching README/manifest entries.
- Capture refresh is automatic on source/recipe/runtime changes; offline freshness checks do not run apps or fetch.
- All primary install paths are clone-free, flavor-selectable, quoted, native and non-destructive.
- Frozen install, generation checks, native/semantic tests, installer tests and verified packaging pass.
- Review the actual captures in a batched flavor comparison, not just parser output.
- Commit/push the standalone repository, check its CI, then let landing discover the immutable images and guide.
- Verify the live page's four flavor images and direct installation instructions after deployment.
