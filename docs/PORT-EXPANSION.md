# Agent and developer-tool port expansion

Research and implementation baseline: **2026-10-21**. This is a rollout record, not a discovery registry.
`port.json` in each public application repository remains the only opt-in to the website.

The first wave adds **16 independently maintained ports**, all with Night, Frost, Paper and Signal.
The candidate website grows from 37 to 53 ports. There are 68 native payload files: four per application,
plus GitUI's four matching syntax palettes. Every color comes from a revision-pinned core snapshot;
none of these ports needs core, a sibling repository, a model service or a network request during generation.

## Agent tools

| Port repository | Native integration | Important boundary |
| --- | --- | --- |
| [claude-code](https://github.com/living-code-theme/claude-code) | `~/.claude/themes/*.json`: base preset and documented token overrides | Requires the custom-theme API, not older preset-only builds; the terminal still owns the main background |
| [codex](https://github.com/living-code-theme/codex) | `$CODEX_HOME/themes/*.tmTheme`, `/theme`, `[tui].theme` | Terminal CLI syntax/Markdown and diff backgrounds, not the desktop app or every chrome element |
| [opencode](https://github.com/living-code-theme/opencode) | TUI v1 JSON documents in the user/project `themes/` directory | Verified against OpenCode 1.19.0; the newer v2/desktop document API is distinct |
| [pi](https://github.com/living-code-theme/pi) | Theme-only Pi package or user theme JSON; explicit HTML export colors | Verified against Pi 1.1.0's schema and native validator; no executable extensions bundled |
| [gemini-cli](https://github.com/living-code-theme/gemini-cli) | Standalone custom JSON document selected through `ui.theme` | Gemini requires theme files to live within the home directory; a theme is not a settings replacement |
| [aider](https://github.com/living-code-theme/aider) | Nine native YAML UI color options | Intentionally leaves `code-theme`/Pygments and the terminal background alone |
| [crush](https://github.com/living-code-theme/crush) | Standalone Palette JSON; `options.tui.active_theme` | Requires a build with custom theme-file loading; all public palette and ANSI fields supplied |
| [herdr](https://github.com/living-code-theme/herdr) | `[theme.custom]` overrides, including panels and selections | Embedded terminal panes retain host/application colors; do not append duplicate TOML tables |

Claude Code **does now expose custom themes** in its current public documentation. Do not rely on older
articles saying only built-in presets exist. Its public token reference and the published Pi schema are
fingerprinted in the respective fixtures. Other ports record exact reviewed upstream Git revisions.

## Other developer tools

| Port repository | Native payload | Coverage |
| --- | --- | --- |
| [bottom](https://github.com/living-code-theme/bottom) | TOML `[styles]` | CPU, memory, temperature, network, battery, graph, table and widget styling |
| [gitui](https://github.com/living-code-theme/gitui) | Optional-override RON + matching `.tmTheme` | Git UI and syntax; unpainted areas still use the terminal palette |
| [lazydocker](https://github.com/living-code-theme/lazydocker) | YAML `gui.theme` fragment | Its four exposed color attributes only; preserve unrelated Docker configuration |
| [television](https://github.com/living-code-theme/television) | Flat TOML theme document | Results, matches, previews, selection and mode badges |
| [nushell](https://github.com/living-code-theme/nushell) | Native `.nu` module returning `color_config` | Syntax shapes, structured values, tables and search; no prompt/environment mutation at import |
| [rio](https://github.com/living-code-theme/rio) | Native TOML `[colors]` | All 16 ANSI slots, cursors, selections, splits, tabs, hints and search |
| [micro](https://github.com/living-code-theme/micro) | Native `.micro` `color-link` directives | Built-in syntax groups/subgroups, editor surfaces, diagnostics and search |
| [posting](https://github.com/living-code-theme/posting) | Native YAML palette | Posting 3 UI, appearance and derived HTTP-method/syntax colors |

No second bat port was added: the existing tmTheme port already covered bat and is now the
[bat port](https://github.com/living-code-theme/bat) (renamed from `tmtheme`). delta keeps its own port for diff
styling and installs the same tmTheme files into bat's cache, which delta reads its syntax themes from. Rebranding
an existing compatible theme or adding instructions for an inherited editor theme
is not counted as a new application implementation.

## What every repository contains

- An application-owned pure generator, four native flavor payloads, and an exact generated-file allowlist.
- A reviewed core palette pin with revision and input/data fingerprints, plus matching vendored color math.
- Explicit palette adoption, changed-only builds, read-only stale checks and symlink/path containment checks.
- `port.json`, completed template README, MIT license, maintainer instructions and a frozen pnpm lockfile.
- Independent native-format/semantic fixtures with upstream provenance; deterministic generation and palette
  adoption regressions. Expected application vocabulary is not imported from the generator under test.
- CI for frozen installation, validation, tests and packaging; verified theme archives uploaded as workflow artifacts.
- Packaging that consumes verified committed payloads, never secretly rebuilding or adopting palette changes.

The capture/install follow-up supplies **64 actual application screenshots**, four per port, at **2560×1600**
with native 2× layout scale (not upscaled). Each port owns `capture/app.py`, a locked Nix runtime, vendored runner,
input/image provenance and automatic CI refresh. Agent scenes use native previews, disclosed local fixtures or
unsent input, not paid model calls. Lazydocker uses a local Docker API fixture; Herdr uses an isolated session.
All 16 READMEs now use flavor-selected direct native-file downloads instead of clone/`cd`/copy installation.
Existing configs are preserved, with explicit merges for Herdr/Lazydocker's embedded theme settings.
See [the mandatory future-port capture/install contract](PORT-CAPTURES.md).

## Verification evidence and its limits

- **208 port tests:** thirteen per repository, including all four native flavor contracts, generation determinism,
  stale checks, containment, palette fingerprints, dirty/stale palette-adoption rejection, 2560×1600 capture
  integrity/freshness, clone-free installation and execution of every flavor's exact download block in temporary
  custom/space-containing homes without overwriting existing configs.
- **Real application checks:** all four flavors render pinned palette colors in real pseudo-terminals under
  bottom 0.14.9, GitUI 0.28.1, Television 0.15.9 and micro 2.0.15. Nushell 0.116.1 imports every module and accepts
  its `color_config` assignment. These five checks are repeatable through `test:native` and separate CI jobs;
  downloaded CI application binaries have pinned SHA-256 checksums.
- **Pi:** all four documents pass the installed Pi 1.1.0 native JSON validator, as well as the committed schema.
- **TextMate:** all four Codex palettes load in bat 0.26.1's actual syntect cache and highlight JavaScript without
  theme warnings. This verifies the shared native format; it is not an assertion of a full Codex visual review.
- **Publication:** each descriptor, README and declared file passes core's real local discovery pipeline.
  An isolated 53-port website builds successfully and passes all **164 website tests** without changing production inputs.
- Other application integrations are checked against documented/native-source field contracts and parsed payloads.
  That is not equivalent to a logged-in end-to-end session in every agent tool. No paid model requests were made.

## Publishing this wave

1. Run frozen installation, `pnpm screenshots`, `pnpm check`, `pnpm test`, applicable `pnpm test:native`, and
   `pnpm package` in each port. A normal capture command reuses verified current images; `-- --force` or manual
   CI dispatch explicitly recaptures the real apps. Native previews and archives are uploaded as CI artifacts.
2. Commit each standalone repository and push its accepted `main` branch to `living-code-theme/<app>`.
3. Check every repository's CI, including native jobs where present. Publishing source is not a marketplace release.
4. Manually dispatch the existing website workflow for immediate discovery:

   ```sh
   gh workflow run sync-ports.yml --repo living-code-theme/landing --ref main
   gh run list --repo living-code-theme/landing --workflow sync-ports.yml
   ```

5. Wait for discovery, candidate build/tests and Cloudflare deployment to succeed. Check every public
   `/ports/<slug>/` route and its immutable source/download links. A successful push alone is not deployment evidence.

No central app list, new website route, cross-repository port secret, generator case in core, marketplace credential
or core workflow pin change is needed for these applications. Landing's already-reviewed schema-2 discovery code
understands their descriptors. Its normal daily poll remains a fallback for later port updates.

## Next investigations, not advertised support

Potential later candidates include Atuin, Superfile, Jujutsu, lsd, Zathura and other tools with native palette
configuration. Before announcing any of them, inspect its current official loading path and field contract, check
whether an existing port already covers it, implement native output and tests, and verify installation in the real app.
For agent clients that inherit VS Code or terminal colors, prefer improving the existing editor/terminal integration
over fabricating a separate full-theme port.
