# Port repositories

Every Living Code port is a public repository in [living-code-theme](https://github.com/living-code-theme). It owns its
theme files, README, screenshots, metadata, version and workflows. A valid root `port.json` opts it into
[living-code.dev](https://living-code.dev): there is no central list to edit and no token to install in the port.

The tooling referenced below (schema, README template, scaffold and local preview) lives in the
[landing repository](https://github.com/living-code-theme/landing).

## Add a port

1. Scaffold the documentation and metadata in an empty directory, from a landing checkout:

   ```sh
   pnpm new:port ../kitty --name "Kitty" --group "Terminals" --emoji "🐈"
   # Optional: --slug existing-route --flavors night,paper --no-images
   ```

   It creates a README from the shared template, `port.json`, the local JSON schema, the MIT license and capture
   instructions. It refuses non-empty directories. It does not write the theme itself.
2. Add the theme files. Take every color from a semantic role in [`palette.json`](../palette.json), never from a
   hand-picked hex value, so the same kind of token gets the same color in every app.
3. Add real screenshots of the application (never mockups) and fill in every README placeholder.
4. Preview it on the website without publishing, from the landing checkout:

   ```sh
   pnpm preview:port ../kitty
   ```

5. Create the repository in the organization and push its default branch. The next discovery lists it.

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
  "$schema": "./port.schema.json",
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
    { "flavor": "night", "path": "images/night.png", "alt": "Neovim running Living Code Night" }
  ]
}
```

The machine-readable contract is the landing's `port.schema.json`; discovery also checks repository paths and images.

- Required: `schemaVersion`, `name`, `group`, `flavors`, `images` (`[]` when there are no captures yet).
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

1. **Previews**: a 2×2 comparison grid of the real captures (Night, Frost, Paper, Signal).
2. **Installation**: application-specific steps and working commands.
3. **Flavors**: one native `<details>` dropdown per supported flavor, with its capture and activation steps.
4. **Configuration**: supported settings and defaults.
5. **Compatibility**: real requirements, integrations and limitations. Do not invent supported versions.
6. **Contributing**
7. **License**

The Contributing section links to the port's issue forms, which every repository inherits from
[living-code-theme/.github](https://github.com/living-code-theme/.github), and to port requests in core.

Keep the `<!-- living-code-readme:1 -->` marker and the `data-lc-flavors` / `data-lc-flavor` attributes. Use `###`
headings for extra topics. Only advertise flavors listed in `port.json`.

GitHub shows the full README. The website derives a shorter page from it: installation first, then collapsed
configuration, compatibility and included files, with its own flavor controls and screenshots. It renders sanitized
Markdown only; it never runs repository scripts.

Discovery validates the structure, rejects unfinished placeholders and checks that declared captures appear in the
grid and in their flavor's dropdown. An invalid update keeps the port's last working version on the website.

Limits: 32 KiB metadata, 512 KiB README, 10 MiB and 20 million pixels per image, 24 distinct local images per port.

## Discovery

The landing periodically lists the organization's public repositories, reads `port.json`, the README, listed files and
screenshots from **one commit** of each, and commits a validated snapshot. Visitors never query GitHub.

- No `port.json`: not opted in. A new invalid port is reported and skipped.
- A malformed update, timeout or unreadable capture keeps that port's last working snapshot.
- Archiving or deleting a repository, making it private, or removing `port.json` removes it from the website.

## After a palette change

The core never writes into port repositories. When `palette/flavors.mjs` changes, update each port's theme files in
that port's own pull request, then refresh its screenshots if the change is visible.
