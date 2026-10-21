// README.md is generated so its palette tables always match palette/flavors.mjs.
import { ACCENT_ORDER, ANSI_ORDER, NEUTRAL_ORDER } from "./resolve.mjs";
import { SLOGAN, TEXT_ROLES } from "./landing.mjs";

const USES = {
  crust: "sidebars, tab bars, status lines", base: "background", mantle: "floats, cards, popups",
  surface0: "line highlight, inactive tabs", surface1: "borders, ANSI black", surface2: "selection",
  overlay: "line numbers, punctuation", comment: "comments, operators", subtext: "muted text, ANSI white",
  text2: "properties, parameters", text: "foreground",
};
const SYNTAX = ["keyword", "function", "type", "string", "number", "decorator", "property", "operator", "comment"];
export const swatchPath = (hex) => `assets/swatches/${hex.slice(1)}.svg`;
const sw = (hex) => `<img src="${swatchPath(hex)}" width="18" height="18" alt="${hex}">`;

export function readme(flavors) {
  const night = flavors.find((f) => f.id === "night");
  const uses = (f, name) => {
    if (USES[name]) return USES[name];
    const roles = Object.entries(f.roles).filter(([, color]) => color === name).map(([role]) => role);
    return roles.length ? roles.join(" · ") : "Available for custom accents";
  };
  const table = (f, names) => [
    "| | Name | Hex | OKLCH | Used for |",
    "|:-:|---|---|---|---|",
    ...names.map((n) => `| ${sw(f.c(n))} | \`${n}\` | \`${f.c(n)}\` | \`${f.colors[n].css}\` | ${uses(f, n)} |`),
  ].join("\n");
  const ansiTable = (f) => [
    `| | ${ANSI_ORDER.join(" | ")} |`,
    "|---|" + ":-:|".repeat(ANSI_ORDER.length),
    "| normal | " + f.ansi.normal.map(sw).join(" | ") + " |",
    "| bright | " + f.ansi.bright.map(sw).join(" | ") + " |",
  ].join("\n");
  const roleTable = [
    `| Role | ${flavors.map((f) => f.name.replace("Living Code ", "")).join(" | ")} |`,
    `|---|${flavors.map(() => "---|").join("")}`,
    ...SYNTAX.map((role) => `| ${role} | ${flavors.map((f) => `${sw(f.r(role))} \`${f.roles[role]}\``).join(" | ")} |`),
  ].join("\n");

  return `<h1 align="center">Living Code</h1>

<p align="center"><b>${SLOGAN}</b><br>
A color scheme where the background stays quiet and the code comes alive.<br>
For editors, terminals, browsers and the web.</p>

<p align="center">
${flavors.map((f) => `<img src="assets/preview-${f.id}.png" width="49%" alt="${f.name}">`).join("\n")}
</p>

This is the **core** of Living Code: the palette, the color math that resolves it, semantic roles, the \`[lc]\` brand and
shared tooling. It is agnostic to any app. Each port lives in its own repository in
[living-code-theme](https://github.com/living-code-theme), and [living-code.dev](https://living-code.dev) lists them all.

## Choose a flavor

Every flavor shares the same slate foundation and semantic roles. Night is the default.

| Flavor | Appearance | Syntax and accents |
|---|---|---|
| [Night](#living-code-night) | Dark slate, full palette | Cool structure, green strings, copper numbers and amber warnings. The default. |
| [Frost](#living-code-frost) | Lifted, bluer slate | Lower-chroma accents with green strings and copper numbers. |
| [Paper](#living-code-paper) | Near-white slate | Darker accents with green strings and copper numbers. |
| [Signal](#living-code-signal) | Dark slate, one accent | Minimal variant of Night: teal keywords and tags, everything else neutral. |

## Install

Install the port for your app: find it on [living-code.dev/ports](https://living-code.dev/ports/) or in the
[organization's repositories](https://github.com/orgs/living-code-theme/repositories). Each port's README has its
installation steps. Nobody needs to clone this repository to use the theme.

## Design

- **The ground stays calm.** Backgrounds, panels, selections, punctuation and comments live on one slate ramp, so the eye goes to the code, not the chrome.
- **Cool for structure, warm for data.** ${sw(night.c("teal"))} Teal, aqua and steel mark keywords, functions and types; ${sw(night.c("moss"))} moss, ${sw(night.c("amber"))} amber and ${sw(night.c("copper"))} copper mark strings, numbers and warnings.
- **Same roles everywhere.** Each port maps the same semantic roles (keyword, string, error, border...), so a theme feels the same in your editor, terminal and browser.
- **Built in OKLCH.** Every palette value is defined in OKLCH; hex and RGB are derived. The build checks ${TEXT_ROLES.length} text roles for WCAG AA contrast (≥ 4.5:1) against each flavor's background.

## Flavors

${flavors.map((f) => `### ${f.name}

${f.description}

<img src="assets/preview-${f.id}.png" width="100%" alt="${f.name}: editor syntax, terminal output and ANSI palette">

${f.id === "signal" ? `Accent names such as \`amber\`, \`copper\` and \`moss\` remain available for port compatibility,
but in Signal they are aliases of teal or neutral colors. Diagnostics are told apart by labels, signs and underlines instead of hue.

` : ""}<details${f.id === "night" ? " open" : ""}>
<summary>Palette</summary>

**Neutrals**

${table(f, NEUTRAL_ORDER)}

**${f.id === "signal" ? "Accent" : "Accents"}**

${table(f, f.id === "signal" ? ["teal"] : ACCENT_ORDER)}

**ANSI**

${ansiTable(f)}

</details>
`).join("\n")}
### Syntax roles

${roleTable}

The table shows resolved roles for every flavor. The full role map (UI, diagnostics, markup) is in
[\`palette/flavors.mjs\`](palette/flavors.mjs): \`defaultRoles\` plus each flavor's \`roles\` overrides.

Ports ship every flavor, except browser themes (Firefox and Chrome), which ship Night and Paper only: in a browser's few
theme slots, Frost and Signal look the same as or barely different from Night, and both stores reject duplicate themes.

## Using the palette in something else

Any app can follow the theme: read [\`palette.json\`](palette.json) (hex, OKLCH, RGB, roles and ANSI for every flavor),
or map these semantic roles onto the app's own color slots:

| Slot | Role | Night |
|---|---|---|
| background / foreground | \`bg\` / \`fg\` | \`${night.r("bg")}\` / \`${night.r("fg")}\` |
| panels, sidebars | \`bgDeep\`, \`bgAlt\` | \`${night.r("bgDeep")}\`, \`${night.r("bgAlt")}\` |
| accent, cursor, focus ring | \`accent\` | \`${night.r("accent")}\` |
| selection | \`selection\` | \`${night.r("selection")}\` |
| borders | \`border\` / \`borderActive\` | \`${night.r("border")}\` / \`${night.r("borderActive")}\` |
| error / warning / info / success | \`error\` … | \`${night.r("error")}\` \`${night.r("warning")}\` \`${night.r("info")}\` \`${night.r("success")}\` |

From JavaScript, install [\`@living-code/palette\`](https://github.com/living-code-theme/palette); for CSS custom
properties, [\`@living-code/css\`](https://github.com/living-code-theme/css).

## Recolor images

Turn any image, such as a wallpaper, into a Living Code version. Requires [ImageMagick 7](https://imagemagick.org).

\`\`\`sh
node scripts/recolor.mjs wallpaper.jpg --flavor night --mode lut
\`\`\`

| Mode | Result |
|---|---|
| \`lut\` | Starts with the theme's slate ramp. Shadows and muted areas stay neutral; colorful midtones receive the selected flavor's accents over that base. Lightness is fitted to the theme's range. Tune the accent amount with \`--color\` (default: 0.65). Core accents are teal, mint, aqua, steel, amber and copper; \`--accents all\` includes the remaining accents. |
| \`gradient\` | Maps brightness onto dark slate, an accent and light text. Pick the accent with \`--accent amber\`. |
| \`remap\` | Posterizes to the exact palette colors. Add \`--no-dither\` for flat areas. |
| \`all\` | Writes one file per mode. |

In \`lut\` mode, \`--color 0\` uses only the slate ramp; \`--color 1\` allows stronger accents while still protecting shadows and muted areas.
Unlike \`--strength\`, lowering \`--color\` does not bring back the original photo's colors. It controls accent blending, not a fixed percentage of the image's area.
Other controls are \`--spread\` (hue blending), \`--keep-light\` (brightness preservation) and \`--smooth\` (color-noise smoothing).
Use \`--flavor signal\` for slate and teal only; compatibility names such as \`amber\` do not add warm hues in Signal.

Output defaults to \`<image>-<flavor>-<mode>.png\` next to the input. Run with \`--help\` for every option.

## Report a problem or request a port

| You want to | Where |
|---|---|
| Report wrong colors or a broken install in one app | That app's repository: open its page on [living-code.dev/ports](https://living-code.dev/ports/), then **Report an issue** |
| Ask for Living Code in another app | [Request a port](https://github.com/living-code-theme/core/issues/new?template=port-request.yml) |
| Change a color or role in every app | [Palette or color feedback](https://github.com/living-code-theme/core/issues/new?template=color-feedback.yml) |

## Contributing a port

Each port is its own repository in [living-code-theme](https://github.com/living-code-theme) with a root \`port.json\`
and a README following the shared template; the website discovers it automatically.
Start with [Creating and contributing a port](docs/PORT-AUTHORING.md), the
[metadata/README contract](docs/PORTS.md), or [CONTRIBUTING.md](CONTRIBUTING.md) to find the right repository.

Map roles, never colors: take every color from a semantic role in [\`palette.json\`](palette.json), so the same kind of
token gets the same color in every app.

## Development

Requires Node 22.22 or newer and pnpm 12.9.0. Run \`pnpm install --frozen-lockfile\` for maintainer tooling.
Palette generation uses only Node built-ins; port tooling dependencies are development-only.

| Command | What it does |
|---|---|
| \`pnpm build\` | Regenerates \`palette.json\`, the portable port palette, this README, swatches, brand SVGs and the landing export from \`palette/flavors.mjs\`. |
| \`pnpm check\` | Fails if a generated file is stale or a text role drops below 4.5:1. CI runs it. |
| \`pnpm test\` | Runs the test suite. |
| \`pnpm preview\` | Live palette preview with sliders and exports at <http://localhost:4173/preview/>. |
| \`pnpm screenshots\` | Recaptures \`assets/preview-*.png\` from the preview with headless Chrome (\`CHROME_BIN\` overrides \`google-chrome\`). |
| \`pnpm icons:brand\` | Rasterizes the brand SVGs to PNG and ICO. See [\`assets/brand\`](assets/brand/README.md). |
| \`pnpm new:port <directory> --name "App" --group "Editors" --emoji "📝"\` | Scaffolds a port's README, metadata and license, not its implementation or maintenance harness. |
| \`pnpm palette:update:ports --ports-root <directory>\` | Plans a local palette rollout. Explicit \`--apply\` invokes each clean port's own updater, build, check and tests; never commits or pushes. |
| \`pnpm sync:ports --landing <checkout>\` | Discovers public ports and writes validated snapshots/captures to the website. Supports \`--dry-run\`, \`--refresh\` and optional \`--r2\` storage. |
| \`pnpm preview:port <directory> --landing <checkout>\` | Validates a local port and previews it in an isolated website copy. |
| \`pnpm export:landing --landing <checkout>\` | Delivers the generated theme JSON, CSS and hosted port schema to the website. Run \`pnpm build\` first. |
| \`pnpm test:standalone --landing <checkout>\` | Installs, builds and tests only the website in isolation. Supports \`--keep\`. |
| \`pnpm test:scale --landing <checkout>\` | Exercises 400 synthetic ports, immutable publication and a real isolated offline website build/test. Supports \`--keep\` and \`--report <new-file>\`. |

To change a color, edit [\`palette/flavors.mjs\`](palette/flavors.mjs) and run \`pnpm build\`. Do not edit generated files directly.

A palette change does not touch any port: each port repository owns its generator, application mappings, tests and files.
Core exports app-agnostic resolved inputs in [\`exports/ports/palette.json\`](exports/ports/palette.json). A port explicitly
adopts a committed core revision with \`pnpm palette:update /path/to/core\`, then regenerates and reviews its own files.
Normal port builds use the checked-in pin and never read a sibling checkout or fetch from GitHub.
For an explicitly reviewed multi-port update, use the [batch palette rollout](docs/PALETTE-ROLLOUTS.md), which delegates
to port-owned commands instead of generating application formats in core.
The website takes committed inputs from [\`exports/landing/\`](exports/landing). After \`pnpm build\`, run
\`pnpm export:landing --landing <checkout>\` and review the changes there. Port discovery, validation, templates and
preview/verification runners live here in core; landing contains Astro and website presentation only. No normal
website build imports core or needs GitHub access. See [Port repositories](docs/PORTS.md) for authoring and
[Port publication and capacity](docs/PORT-PUBLICATION.md) for the split index/documents, batched discovery,
optional external capture storage and 400-port acceptance check.

## License

[MIT](LICENSE) © Elliot Luque
`;
}
