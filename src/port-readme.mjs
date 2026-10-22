// Port authoring/discovery rules. Website-specific rendering belongs to the landing.
import { Lexer, Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { PORT_FLAVORS, README_MARKER, README_SECTIONS } from "../scripts/readme-template.mjs";

const parseReadme = (source) => new Marked({ gfm: true }).parse(source);

/** The versioned publication contract is content, not the README's GitHub presentation. */
export function extractPortGuide(source) {
  const tokens = new Marked({ gfm: true }).lexer(source);
  const sections = new Map(["installation", "configuration", "compatibility"].map((key) => [key, []]));
  let current;
  for (const token of tokens) {
    if (token.type === "heading" && token.depth <= 2) current = token.depth === 2 ? sections.get(token.text.toLowerCase()) : undefined;
    else if (current) current.push(token.raw);
  }
  return {
    schemaVersion: 1,
    ...Object.fromEntries([...sections].map(([key, parts]) => [key, parts.join("").trim()])),
    // Definitions can live in an omitted section. Keep them as data, not Marked's internal token format.
    links: Object.fromEntries(Object.entries(tokens.links).map(([key, { href, title }]) => [key, { href, title: title ?? "" }])),
  };
}

export function guideImagePaths(guide) {
  const paths = new Set();
  for (const key of ["installation", "configuration", "compatibility"]) {
    const marked = new Marked({ gfm: true });
    const lexer = new Lexer({ gfm: true });
    lexer.tokens.links = Object.assign(Object.create(null), guide.links);
    const tokens = lexer.lex(guide[key]);
    collectImages(marked.parser(tokens), paths);
  }
  return [...paths];
}

/** Only repository-relative images are downloaded; external images are never fetched by discovery. */
function relativeImagePath(href) {
  if (!href || /^(?:[a-z][\w+.-]*:|\/|#)/i.test(href)) return null;
  try { return decodeURIComponent(href.replace(/^\.\//, "").split(/[?#]/)[0]); } catch { return null; }
}

export function readmeImagePaths(source) {
  const paths = new Set();
  collectImages(parseReadme(source), paths);
  return [...paths];
}

function collectImages(html, paths) {
  // Parse Markdown and raw HTML images without importing the website's renderer.
  sanitizeHtml(html, {
    allowedTags: ["img"], allowedAttributes: {},
    transformTags: { img(tagName, attrs) {
      const path = relativeImagePath(attrs.src);
      if (path) paths.add(path);
      return { tagName, attribs: {} };
    } },
  });
}

/** The template is shared, but prose and activation instructions stay port-owned. */
export function validateReadmeTemplate(source, manifest) {
  if (!source.trimStart().startsWith(README_MARKER)) throw new Error("README.md must use the Living Code port template v1 (see docs/PORTS.md)");
  const placeholder = source.match(/\{\{(?:INSTALLATION|CONFIGURATION|COMPATIBILITY|PORT_EMOJI|PORT_NAME|DESCRIPTION|PREVIEWS|FLAVOR_INTRO|FLAVORS|(?:NIGHT|FROST|PAPER|SIGNAL)_USAGE)\}\}/);
  if (placeholder) throw new Error(`Complete README.md placeholder ${placeholder[0]} before publishing`);
  const headings = new Marked({ gfm: true }).lexer(source).filter((t) => t.type === "heading");
  const sections = headings.filter((t) => t.depth === 2).map((t) => t.text);
  // Previews are required for declared images, optional for legacy image-free READMEs.
  // New scaffolds omit the empty section; existing published revisions remain readable.
  const expectedSections = manifest.images.length || sections.includes("Previews") ? README_SECTIONS : README_SECTIONS.filter((section) => section !== "Previews");
  if (headings.filter((t) => t.depth === 1).length !== 1 || sections.join("\n") !== expectedSections.join("\n")) throw new Error(`README.md sections must be: ${expectedSections.join(", ")}; use ### for additional subsections`);
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
