# Required capture and installation contract

Every new Living Code port must ship a real **2560×1600** image for **each supported flavor**, rendered natively
at 2× layout scale (never upscaled), and an application-owned, automatically repeatable capture recipe. A native-format parser or PTY smoke test is not a screenshot.
Do not publish a new port with `images: []`, handwritten fake previews, a one-off `/tmp` capture script,
or clone/build steps as its normal end-user installation.

Read [core's port-capture guide](https://github.com/living-code-theme/core/blob/main/docs/PORT-CAPTURES.md)
and [port authoring](https://github.com/living-code-theme/core/blob/main/docs/PORT-AUTHORING.md).
Core maintains reusable reviewed templates in `templates/capture/`:

- Vendor `capture.py` into `scripts/capture.py`; the port does not need core at capture/check time.
- Implement `capture/app.py`: `prepare(context)` returns the actual application command; `drive(context)` waits
  for the app's native UI and performs only safe fixture interactions. Optional `cleanup(context)` stops owned
  background processes. Graphical applications set `GRAPHICAL = True` and launch the real graphical application.
- Add `capture/config.json` with `schemaVersion: 1`, a truthful `scene`, a native `versionCommand` array, and
  `fixtures: []` (or list every additional recipe input). The runner fingerprints these plus every theme payload,
  its own code, the adapter, descriptor, palette and runtime pin.
- Add a reviewed `capture/flake.nix` and `capture/flake.lock` containing the actual app and pinned screenshot tools.
  The worked agent/developer-tool ports demonstrate isolated native environments; do not copy another app's adapter.
- Add `screenshots` and `screenshots:check` package commands, wire the latter into `check` and packaging, and
  adapt `check.yml` so CI captures before validation. Preserve app-specific native checks and publishing rules.
- Adapt `publication.test.mjs` and supply `capture/install.json` with independently reviewed source/destination
  expectations. This executes the README's flavor-selected download block for every flavor in temporary homes,
  checks real distributable file names and preserves existing user configs.
- Run the capture command, inspect all flavors together, and commit `images/*.png` and `images/capture.json`.
  Keep the 2×2 README comparison and flavor dropdowns in sync with `port.json`.

## End-user installation

For file-based themes, match the original ports' direct-download convention:

```sh
flavor=night # night, frost, paper, or signal
curl -fsSL --create-dirs -o "<native theme directory>/living-code-$flavor.<extension>" "https://raw.githubusercontent.com/living-code-theme/<repo>/main/<payload directory>/living-code-$flavor.<extension>"
```

Replace every angle-bracket item with the application's verified path/format before publication. Honor native
config/data-directory overrides, quote paths and show activation immediately after download. Download every
required companion file. Never use `curl ... | sh`, overwrite the user's whole settings file, invent a theme-import
feature, or make a clone/`cd`/build step the primary installation. If the app accepts only embedded theme settings,
download a separate fragment and explain a non-destructive merge. State shell/platform differences explicitly.

Package-manager/plugin-manager installation can be an additional app-native option where appropriate. It does
not excuse missing captures or inaccurate config paths. Leave existing authored ports' release identities intact.
