// Port authoring/discovery rules. Website-specific rendering belongs to the landing.
import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { PORT_FLAVORS, README_MARKER, README_SECTIONS } from "../scripts/readme-template.mjs";

const parseReadme = (source) => new Marked({ gfm: true }).parse(source);

/** Only repository-relative images are downloaded; external images are never fetched by discovery. */
function relativeImagePath(href) {
  if (!href || /^(?:[a-z][\w+.-]*:|\/|#)/i.test(href)) return null;
  try { return decodeURIComponent(href.replace(/^\.\//, "").split(/[?#]/)[0]); } catch { return null; }
}

export function readmeImagePaths(source) {
  const paths = new Set();
  // Parse Markdown and raw HTML images without importing the website's renderer.
  sanitizeHtml(parseReadme(source), {
    allowedTags: ["img"], allowedAttributes: {},
    transformTags: { img(tagName, attrs) {
      const path = relativeImagePath(attrs.src);
      if (path) paths.add(path);
      return { tagName, attribs: {} };
    } },
  });
  return [...paths];
}

/** The template is shared, but prose and activation instructions stay port-owned. */
export function validateReadmeTemplate(source, manifest) {
  if (!source.trimStart().startsWith(README_MARKER)) throw new Error("README.md must use the Living Code port template v1 (see docs/PORTS.md)");
  const placeholder = source.match(/\{\{(?:INSTALLATION|CONFIGURATION|COMPATIBILITY|PORT_EMOJI|PORT_NAME|DESCRIPTION|PREVIEWS|FLAVORS|(?:NIGHT|FROST|PAPER|SIGNAL)_USAGE)\}\}/);
  if (placeholder) throw new Error(`Complete README.md placeholder ${placeholder[0]} before publishing`);
  const headings = new Marked({ gfm: true }).lexer(source).filter((t) => t.type === "heading");
  if (headings.filter((t) => t.depth === 1).length !== 1 || headings.filter((t) => t.depth === 2).map((t) => t.text).join("\n") !== README_SECTIONS.join("\n")) throw new Error(`README.md sections must be: ${README_SECTIONS.join(", ")}; use ### for additional subsections`);
  if (manifest.emoji && !headings.find((t) => t.depth === 1).text.startsWith(`${manifest.emoji} `)) throw new Error("README.md title must start with the port.json emoji");
  const dropdowns = [];
  const tables = [], details = [];
  const gridPaths = new Set(), flavorPaths = new Map();
  let grids = 0;
  sanitizeHtml(parseReadme(source), {
    allowedTags: ["table", "details", "img"], allowedAttributes: {},
    transformTags: {
      table(tagName, attrs) {
        const grid = "data-lc-flavors" in attrs;
        tables.push(grid);
        if (grid) grids++;
        return { tagName, attribs: {} };
      },
      details(tagName, attrs) {
        const flavor = attrs["data-lc-flavor"];
        details.push(flavor);
        if (flavor) dropdowns.push(flavor);
        return { tagName, attribs: {} };
      },
      img(tagName, attrs) {
        const path = relativeImagePath(attrs.src);
        if (path && tables.includes(true)) gridPaths.add(path);
        const flavor = details.findLast(Boolean);
        if (path && flavor) {
          if (!flavorPaths.has(flavor)) flavorPaths.set(flavor, new Set());
          flavorPaths.get(flavor).add(path);
        }
        return { tagName, attribs: {} };
      },
    },
    exclusiveFilter(frame) {
      if (frame.tag === "table") tables.pop();
      if (frame.tag === "details") details.pop();
      return false;
    },
  });
  const expected = PORT_FLAVORS.filter((id) => manifest.flavors.includes(id));
  if (dropdowns.join(",") !== expected.join(",")) throw new Error("README.md needs one flavor dropdown per supported flavor, in Night, Frost, Paper, Signal order");
  if (manifest.images.length && grids !== 1) throw new Error("README.md needs one comparison grid: <table data-lc-flavors>");
  for (const image of manifest.images) {
    if (!gridPaths.has(image.path)) throw new Error(`README.md comparison grid must include: ${image.path}`);
    if (!flavorPaths.get(image.flavor)?.has(image.path)) throw new Error(`README.md ${image.flavor} dropdown must include: ${image.path}`);
  }
}
