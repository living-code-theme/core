// Scaffold once; the resulting README belongs to the port repository, never to a mirror.
// Built-ins only: scaffolding the README never needs a website checkout.
import { readFileSync } from "node:fs";

export const README_MARKER = "<!-- living-code-readme:1 -->";
export const README_SECTIONS = ["Previews", "Installation", "Flavors", "Configuration", "Compatibility", "Contributing", "License"];
export const FLAVOR_LABELS = {
  night: { name: "Night", description: "Dark · full palette" },
  frost: { name: "Frost", description: "Dark · softer chroma" },
  paper: { name: "Paper", description: "Light · near-white slate" },
  signal: { name: "Signal", description: "Dark · teal accent" },
};
export const PORT_FLAVORS = Object.keys(FLAVOR_LABELS);
const html = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const screenshot = (image, width) => `<a href="${html(encodeURI(image.path))}"><img src="${html(encodeURI(image.path))}" alt="${html(image.alt)}" width="${width}"></a>`;

// README branding: shields.io badges in Catppuccin-style "for-the-badge" form, coloured from Night.
// Labels sit on surface2; values use Night tones bright enough for shields' dark (#333) text.
const BADGE = { label: "2d3438", teal: "00a692", aqua: "9ae0dd", amber: "f0be6d", rose: "ddaec3", green: "abe2a4", blue: "a1cfe8" };
const LC_GLYPHS = [
  [0, "M185 -110V830H465V715H310V5H465V-110Z"],
  [520, "M389 0Q307 0 257.5 49Q208 98 208 178V617H27V730H333V181Q333 150 350.5 131.5Q368 113 398 113H559V0Z"],
  [1040, "M309 -10Q238 -10 185.5 16.5Q133 43 104 91.5Q75 140 75 206V344Q75 410 104 458.5Q133 507 185.5 533.5Q238 560 309 560Q412 560 474.5 506.5Q537 453 540 361H417Q414 404 384.5 427.5Q355 451 309 451Q258 451 229 423.5Q200 396 200 345V206Q200 155 229 127Q258 99 309 99Q356 99 385 122.5Q414 146 417 189H540Q537 97 474.5 43.5Q412 -10 309 -10Z"],
  [1560, "M135 -110V5H290V715H135V830H415V-110Z"],
];
const svg = (viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
const BADGE_ICONS = {
  // The [lc] mark: JetBrains Mono Bold outlines, same composition as assets/brand/favicon.svg.
  lc: svg("2 17 58.5 30", `<g fill="#${BADGE.teal}" transform="translate(-1.787709 43.26257) scale(0.031285 -0.031285)">${LC_GLYPHS.map(([x, d]) => `<path transform="translate(${x} 0)" d="${d}"/>`).join("")}</g>`),
  star: svg("0 0 24 24", `<path fill="#${BADGE.amber}" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>`),
  issue: svg("0 0 24 24", `<circle cx="12" cy="12" r="9" fill="none" stroke="#${BADGE.rose}" stroke-width="2.5"/><circle cx="12" cy="12" r="3" fill="#${BADGE.rose}"/>`),
  commit: svg("0 0 24 24", `<path stroke="#${BADGE.green}" stroke-width="2.5" stroke-linecap="round" d="M2 12h5.5M16.5 12H22"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#${BADGE.green}" stroke-width="2.5"/>`),
  scale: svg("0 0 24 24", `<g fill="none" stroke="#${BADGE.blue}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 21h10M5 7h14M12 3l-1 4h2z"/><path d="M5 7l-3 7a3.2 3.2 0 0 0 6 0zM19 7l-3 7a3.2 3.2 0 0 0 6 0z"/></g>`),
};
const badge = (href, src, color, icon, alt, extra = "") => {
  const logo = encodeURIComponent(`data:image/svg+xml;base64,${Buffer.from(BADGE_ICONS[icon]).toString("base64")}`);
  return `<a href="${html(href)}"><img src="${html(`${src}?style=for-the-badge&labelColor=${BADGE.label}&color=${BADGE[color]}&logo=${logo}${extra}`)}" alt="${html(alt)}"></a>`;
};
const REPOSITORY = /^https:\/\/github\.com\/(living-code-theme\/[A-Za-z0-9_.-]+)$/;

/** Header badges. GitHub stats need the port's repository; the flavor count comes from port.json. */
export function renderPortBadges(flavorCount, repository) {
  const flavors = `${flavorCount}%20flavor${flavorCount === 1 ? "" : "s"}`;
  const badges = [badge("https://living-code.dev", `https://img.shields.io/badge/Living%20Code-${flavors}-${BADGE.aqua}`, "aqua", "lc", `Living Code: ${flavorCount} flavor${flavorCount === 1 ? "" : "s"}`)];
  const name = repository?.match(REPOSITORY)?.[1];
  if (repository !== undefined && !name) throw new Error("README repository must be a living-code-theme GitHub URL");
  if (name) badges.push(
    badge(`${repository}/stargazers`, `https://img.shields.io/github/stars/${name}`, "amber", "star", "GitHub stars"),
    badge(`${repository}/issues`, `https://img.shields.io/github/issues/${name}`, "rose", "issue", "Open issues"),
    badge(`${repository}/commits/main`, `https://img.shields.io/github/last-commit/${name}`, "green", "commit", "Last commit", "&label=updated"),
  );
  return badges.join("\n");
}

export const LICENSE_BADGE = badge("LICENSE", `https://img.shields.io/badge/license-MIT-${BADGE.blue}`, "blue", "scale", "MIT license");

/** All captures are real, repository-owned files; never fabricate missing flavors. */
export const PORT_REQUEST_URL = "https://github.com/living-code-theme/core/issues/new?template=port-request.yml";

// Issue forms come from living-code-theme/.github, so every port links to the same choices.
function contributing(repository) {
  if (repository !== undefined && !/^https:\/\/github\.com\/living-code-theme\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("README repository must be a living-code-theme GitHub URL");
  const report = repository ? `[Open an issue](${repository}/issues/new/choose)` : "Open an issue in this repository";
  return `Found a problem? ${report} with the app version, the flavor and a screenshot. Want Living Code somewhere else? [Request a port](${PORT_REQUEST_URL}).\n\nPull requests are welcome. Keep this README, \`port.json\` and \`images/\` in sync, and use real screenshots of the app, never mockups.`;
}

export function renderPortReadme(manifest, content = {}) {
  const flavors = PORT_FLAVORS.filter((id) => manifest.flavors.includes(id));
  if (!flavors.length || flavors.length !== manifest.flavors.length) throw new Error("README requires unique, known supported flavors");
  const images = new Map(manifest.images.map((image) => [image.flavor, image]));
  if (images.size !== manifest.images.length || [...images.keys()].some((id) => !flavors.includes(id))) throw new Error("README screenshots must match supported flavors");
  const captures = flavors.filter((id) => images.has(id));
  const cells = captures.map((id) => {
    const flavor = FLAVOR_LABELS[id];
    return `<strong>${flavor.name}</strong><br><sub>${flavor.description}</sub><br><br>\n${screenshot(images.get(id), 640)}`;
  });
  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    const pair = cells.slice(i, i + 2);
    rows.push(`<tr>\n${pair.map((cell) => `<td width="${pair.length === 1 ? "100%" : "50%"}"${pair.length === 1 ? ' colspan="2"' : ""} valign="top">\n${cell}\n</td>`).join("\n")}\n</tr>`);
  }
  const missing = flavors.filter((id) => !images.has(id));
  const previews = rows.length ? `## Previews\n\n<table data-lc-flavors>\n${rows.join("\n")}\n</table>\n\nSelect any preview to view the image at full size.` : "";
  const blocks = {
    PORT_EMOJI: manifest.emoji ? html(manifest.emoji) : "{{PORT_EMOJI}}",
    PORT_NAME: html(manifest.name),
    BADGES: renderPortBadges(flavors.length, content.repository),
    LICENSE_BADGE,
    DESCRIPTION: manifest.description ? html(manifest.description) : `A color theme for ${html(manifest.name)}.`,
    PREVIEWS: previews + (missing.length && rows.length ? `\n\n${missing.map((id) => FLAVOR_LABELS[id].name).join(", ")} ${missing.length === 1 ? "is" : "are"} supported; real captures are not available yet.` : ""),
    INSTALLATION: content.installation ?? "{{INSTALLATION}}",
    FLAVOR_INTRO: captures.length ? "Expand a flavor for its full-size preview and activation instructions." : "Expand a flavor for its activation instructions.",
    FLAVORS: flavors.map((id) => `<details data-lc-flavor="${id}">\n<summary><strong>${FLAVOR_LABELS[id].name}</strong> · ${FLAVOR_LABELS[id].description}</summary>\n\n${images.has(id) ? `<p>${screenshot(images.get(id), 1280)}</p>\n\n` : ""}${content.flavorUsage?.[id] ?? `{{${id.toUpperCase()}_USAGE}}`}\n\n</details>`).join("\n\n"),
    CONFIGURATION: content.configuration ?? "{{CONFIGURATION}}",
    COMPATIBILITY: content.compatibility ?? "{{COMPATIBILITY}}",
    CONTRIBUTING: content.contributing ?? contributing(content.repository),
  };
  return readFileSync(new URL("../templates/port/README.md", import.meta.url), "utf8")
    .replace("{{PREVIEWS}}\n\n", previews ? "{{PREVIEWS}}\n\n" : "")
    .replace(/\{\{([A-Z_]+)\}\}/g, (token, key) => blocks[key] ?? token);
}
