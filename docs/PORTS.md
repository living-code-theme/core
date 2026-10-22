# Port repositories

Every Living Code port is a public repository in [living-code-theme](https://github.com/living-code-theme). It owns its
theme files, README, screenshots, metadata, version and workflows. A valid root `port.json` opts it into
[living-code.dev](https://living-code.dev): there is no central list to edit and no token to install in the port.

Core owns the schema, README template, scaffold, discovery and local-preview tooling. Install its dependencies
with `pnpm install --frozen-lockfile` and run the commands below from this checkout. The
[landing repository](https://github.com/living-code-theme/landing) only renders committed website inputs; it does not
run maintainer tooling or import core during a build.

## Add a port

See [Creating and contributing a port](PORT-AUTHORING.md) for the complete contributor workflow, generator/palette
harness responsibilities, local verification and organization review. Contributors without organization access can
propose a prototype through the core port-request form. The short version:

1. Scaffold the documentation and metadata in an empty directory, from this core checkout:

   ```sh
   pnpm new:port ../my-app --name "My App" --group "Editors" --emoji "📝"
   # Optional: --slug existing-route --flavors night,paper --no-images
   ```

   It creates a README from the shared template, `port.json` referencing the hosted schema, the MIT license and an
   empty `images/` directory plus `capture/README.md` with the mandatory capture/install checklist. It refuses non-empty directories. It does not write the theme, initialize Git, or create
   the palette pin, generator, package, tests or maintenance harness; those must be supplied/reviewed by the port.
2. Add the theme files and port-owned maintainer tooling. Take every color from a semantic role in
   [`palette.json`](../palette.json), never from a hand-picked hex value, so the same kind of token gets the same
   color in every app.
3. Add an automated native capture recipe and real **2560×1600** screenshots for every supported flavor
   (never mockups or upscaled smaller images). Fill README installation with direct, flavor-selected native
   downloads, not clone/copy steps. Follow [the capture/install contract](PORT-CAPTURES.md).
4. Preview it on the website without publishing, from this core checkout. Pass an existing landing checkout explicitly:

   ```sh
   pnpm preview:port ../my-app --landing ../landing
   # Optional: --port 4412
   ```

   This validates the draft through discovery and installs/builds an isolated website copy. It does not fetch GitHub
   or edit the production catalog. The page is marked as a local preview; source links use a local fingerprint,
   not a published commit. Re-run after editing the port.

5. Review the implementation and metadata. A maintainer creates/uses the public organization repository and pushes
   its accepted default branch. The next discovery lists it; app-store/registry releases remain separate.

Repository layout:

```text
port.json
README.md
images/
  night.png
  frost.png
  paper.png
  signal.png
LICENSE
# The app's actual theme/plugin files also live here.
```

## `port.json`

```json
{
  "$schema": "https://living-code.dev/port.schema.json",
  "schemaVersion": 1,
  "name": "Neovim",
  "emoji": "📝",
  "slug": "neovim",
  "group": "Editors",
  "description": "Living Code for Neovim, with Tree-sitter and LSP highlights.",
  "homepage": "https://neovim.io",
  "quick": "Install with your plugin manager",
  "aliases": ["nvim", "vim", "lazyvim"],
  "flavors": ["night", "frost", "paper", "signal"],
  "files": ["colors/living-code.lua", "lua/living-code/init.lua"],
  "images": [
    { "flavor": "night", "path": "images/night.png", "alt": "Neovim running Living Code Night" },
    { "flavor": "frost", "path": "images/frost.png", "alt": "Neovim running Living Code Frost" },
    { "flavor": "paper", "path": "images/paper.png", "alt": "Neovim running Living Code Paper" },
    { "flavor": "signal", "path": "images/signal.png", "alt": "Neovim running Living Code Signal" }
  ]
}
```

The machine-readable contract is core's [`schemas/port.schema.json`](../schemas/port.schema.json); discovery also
checks repository paths and images. `pnpm build` exports the schema to `exports/landing/port.schema.json`.
The website serves a committed copy at <https://living-code.dev/port.schema.json>; ports do not need a local copy.

- Required: `schemaVersion`, `name`, `group`, `flavors`, `images`. The protocol still reads `[]` for legacy/draft
  descriptors; a **new published port** must have an automatically captured 2560×1600 image for every flavor.
- `slug` defaults to the repository name. Set it when they differ (`nvim` → `neovim`, `palette` → `json`). Published
  slugs are stable; discovery rejects a silent change.
- `group` is a display label; a new group appears on the website automatically.
- `description` (40–300 characters), `homepage`, `quick` (a short plain-text label), `icon` (a Simple Icons slug),
  `aliases` and `files` are optional. Each listed file must exist and be at most 1 MiB.
- `emoji` is one application-specific emoji for the README title: Neovim 📝, Kitty 🐈, Ghostty 👻, Firefox 🦊,
  Obsidian 💎. The chameleon 🦎 is Living Code's own mascot and stays in the shared README footer.
- `flavors` is a non-empty subset of `night`, `frost`, `paper`, `signal`. Browser themes ship Night and Paper only.
- `images` lists at most one real screenshot per flavor: repository-relative PNG, JPEG or WebP, with alt text.

## README

`README.md` is the port's only authored documentation. It follows the shared template, with these level-two sections
in this order:

1. **Previews**, only when `port.json` declares images: a 2×2 comparison grid of the real captures
   (Night, Frost, Paper, Signal). Omit the entire section when `images` is empty; do not publish a
   “screenshots have not been captured yet” placeholder.
2. **Installation**: application-specific native installation and activation. File-based ports use a temporary
   `flavor=night` variable and quoted `curl --create-dirs` downloads to the correct app directory, preserving
   existing config. Cloning/building is for maintainers, not the primary end-user installation.
3. **Flavors**: one native `<details>` dropdown per supported flavor, with activation steps and its capture
   when available. Image-free ports keep these instructions without preview wording or missing-capture notices.
4. **Configuration**: supported settings and defaults.
5. **Compatibility**: real requirements, integrations and limitations. Do not invent supported versions.
6. **Contributing**
7. **License**

Image-free libraries and integrations must not promise an application preview that does not exist. This
presentation rule does not waive the real-capture requirements for new application ports. Discovery continues
to accept the older image-free layout so an unchanged published revision is not invalidated.

The Contributing section links to the port's issue forms, which every repository inherits from
[living-code-theme/.github](https://github.com/living-code-theme/.github), and to port requests in core.

Keep the `<!-- living-code-readme:1 -->` marker and the `data-lc-flavors` / `data-lc-flavor` attributes. Use `###`
headings for extra topics. Only advertise flavors listed in `port.json`.

GitHub shows the full README. Discovery compiles a versioned Markdown guide: installation, configuration,
compatibility and reference definitions, independent of the GitHub table/dropdowns. The website renders that guide
with installation first, optional details collapsed and its own flavor controls/screenshots. It sanitizes Markdown
and never runs repository scripts. There is no separately authored website documentation.

Discovery validates the structure, rejects unfinished placeholders and checks that declared captures appear in the
grid and in their flavor's dropdown. An invalid update keeps the port's last working version on the website.

Limits: 32 KiB metadata, 64 KiB README, 10 MiB and 20 million pixels per input image, 24 distinct gallery/guide images per port.

## Discovery

Run discovery from core against an explicit website checkout:

```sh
GH_TOKEN="$(gh auth token)" pnpm sync:ports --landing ../landing --dry-run
GH_TOKEN="$(gh auth token)" pnpm sync:ports --landing ../landing
# Optional: --refresh to revalidate and redownload unchanged commits
```

Core lists the organization's public repositories and reads `port.json`, the README, listed files and screenshots
from **one commit** of each. Review and commit `data/ports.json`, `data/ports/` and any local capture changes in landing.
Authenticated discovery batches heads in groups of 100 and downloads changed public blobs without forwarding its
token. Large catalogs require `GH_TOKEN`; small anonymous runs remain supported. Visitors never query GitHub.
Landing owns the scheduled publication/deployment workflow, not core.

- No `port.json`: not opted in. A new invalid port is reported and skipped.
- A malformed update, timeout or unreadable capture keeps that port's last working snapshot.
- Archiving or deleting a repository, making it private, or removing `port.json` removes it from the website.
- Incomplete listings, authentication failures and rate limits abort without replacing the snapshot.

### Catalog and capture capacity

Schema 2 separates a small metadata index (`data/ports.json`) from immutable, content-addressed per-port documents
(`data/ports/<slug>.<sha256>.json`). Unchanged documents are not rewritten; there is no growing route-history list.
The website loads only a port's own guide for its page. Both tools read the previous catalog format during rollout.

Publication validates retained captures and write targets under a writer lock, writes assets/documents first,
atomically replaces the index, then prunes only obsolete generated regular files. Invalid individual updates keep
their last working version; aggregate budget failures abort without dropping ports or truncating instructions.

Local capture storage remains the default. Optional `--r2` publishes verified immutable captures before the index,
keeping future image churn out of Git. It requires explicitly configured bucket-scoped credentials and a working
public URL; it never creates a bucket, changes DNS or automatically deletes remote deployment assets.

See [Port publication and capacity](PORT-PUBLICATION.md) for the versioned contract, budgets, request counts,
R2 setup/retention policy, safe rollout and the reproducible **400-port acceptance check**:

```sh
pnpm test:scale --landing ../landing --keep --report /tmp/living-code-scale.json
```

Landing still checks out a reviewed, pinned core revision. Publish the new core code and advance that SHA to adopt
this behavior; local tests do not activate it in production. Normal website builds remain independent of core.

## Deliver generated website inputs

```sh
pnpm build
pnpm export:landing --landing ../landing
pnpm test:standalone --landing ../landing
# Optional: --keep to retain the isolated verification checkout
```

The export copies theme JSON, matching CSS and the hosted port schema, never discovered content or legacy inputs.
Review and commit the delivered files in landing. The standalone runner installs, builds and tests an isolated copy
of only the website, excluding dependencies, output, caches, credentials and symlinks. Neither command assumes a
sibling repository or runs during a normal Astro build.

## After a palette change

Ordinary core builds never update a port. The explicit batch orchestrator delegates to port-owned commands;
it does not own or compile any application format. Each port owns `src/generate.mjs`, its application vocabulary,
`test/` contracts/fixtures and its `scripts/generated.json` allowlist. Core owns only the app-agnostic palette/math
and the resolved export at `exports/ports/palette.json`.

1. In core, change `palette/flavors.mjs`, then run `pnpm build`, `pnpm check` and `pnpm test`. Commit the reviewed
   palette/math inputs so another checkout can reproduce the same revision.
2. In each port that should adopt it, run `pnpm palette:update /path/to/core`. This explicit maintainer command
   verifies the export against the committed palette/resolver/math files, records that Git revision and a content
   fingerprint in `palette/theme.json`, and refuses dirty/stale inputs. If the math implementation changed, review
   and copy core's committed `src/color.mjs` to the port's `scripts/color.mjs` before adopting it.
3. Run `pnpm build`, `pnpm check` and `pnpm test` in that port. Build uses **only the checked-in palette pin**, never
   core, GitHub or another port. It regenerates only the allowlisted theme payload, not READMEs, screenshots,
   package metadata, marketplace identities, icons, licenses or publishing workflows.
4. Review the pin, application-specific mappings and generated diff in that port's pull request. Refresh real
   screenshots if the change is visible. Relevant grammar/capture/UI/ANSI/native-format tests live with the port;
   update the expected role contracts intentionally rather than silencing a mismatch.

Changes to port mappings or this port's format belong in that repository even when its palette pin stays unchanged.
`pnpm check` and packaging refuse stale generated payloads; they never regenerate during installation or publishing.
See each port's `CONTRIBUTING.md` for its maintenance commands and any fixture-refresh tools.

For multiple ports, use the opt-in [batch palette rollout](PALETTE-ROLLOUTS.md):

```sh
pnpm palette:update:ports --ports-root ..          # read-only plan
pnpm palette:update:ports --ports-root .. --apply  # clean checkouts only; no commits/pushes
```

The entire selection is preflighted before any update. Existing dirty work blocks apply, and runtime failures keep
reviewable partial diffs rather than resetting them. See the rollout guide for selection, locks, cancellation,
math migrations, JSON results, screenshot review and updating the website's own palette.
