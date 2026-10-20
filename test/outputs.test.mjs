import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { contrast } from "../src/color.mjs";
import { GLYPHS } from "../src/glyphs.mjs";
import { landingFiles, MINIMUM_CONTRAST, REPOSITORY, TEXT_ROLES } from "../src/landing.mjs";
import { exportFiles, paletteData, themeCss } from "../src/outputs.mjs";
import { resolveAll } from "../src/resolve.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const flavors = resolveAll();
const readme = read("README.md");
const files = landingFiles(flavors, { readme });
const snapshot = JSON.parse(files.find((file) => file.path === "exports/landing/theme.json").content);

test("generated files are current and every text role reaches WCAG AA", () => {
  const output = execFileSync(process.execPath, ["scripts/build.mjs", "--check"], { cwd: root, encoding: "utf8" });
  assert.match(output, /^checked \d+ files for 4 flavors/);
  for (const f of flavors) for (const role of TEXT_ROLES) assert.ok(contrast(f.rr(role), f.raw.base) >= MINIMUM_CONTRAST, `${f.id}.${role}`);
});

test("palette.json carries hex, OKLCH, RGB, roles and ANSI for all four flavors", () => {
  const palette = JSON.parse(read("palette.json"));
  assert.deepEqual(palette, paletteData(flavors));
  assert.deepEqual(Object.keys(palette), ["night", "frost", "paper", "signal"]);
  const night = flavors[0];
  assert.deepEqual(palette.night.colors.teal, { hex: night.c("teal"), oklch: night.colors.teal.css, rgb: night.colors.teal.rgb });
  assert.equal(palette.night.roles.keyword, night.roles.keyword);
  assert.deepEqual(palette.paper.ansi, flavors[2].ansi);
});

test("CSS variables declare every color and non-self-referencing role, with an auto light/dark theme", () => {
  const css = themeCss(flavors);
  assert.match(css, /^:root,\n\[data-theme="living-code-night"\] \{/);
  for (const f of flavors) assert.ok(css.includes(`[data-theme="${f.slug}"]`), f.id);
  assert.match(css, /@media \(prefers-color-scheme: light\) \{\n  \[data-theme="living-code-auto"\] \{\n    color-scheme: light;/);
  assert.match(css, /--lc-comment: oklch\(/);
  assert.doesNotMatch(css, /--lc-([\w-]+): var\(--lc-\1\)/, "a variable must not refer to itself");
  assert.deepEqual(exportFiles(flavors).map((file) => file.path), ["palette.json", "living-code.css"]);
});

test("landing snapshot preserves every resolved palette value, glyph and exact contrast measurement", () => {
  assert.equal(read("exports/landing/theme.json"), files[0].content);
  assert.equal(read("exports/landing/theme.css"), themeCss(flavors));
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.minimumContrast, 4.5);
  assert.deepEqual(snapshot.textRoles, TEXT_ROLES);
  assert.deepEqual(snapshot.glyphs, GLYPHS);
  assert.equal(snapshot.source.repository, REPOSITORY);
  assert.match(snapshot.source.sha256, /^[a-f0-9]{64}$/);
  for (const f of flavors) {
    const { contrastToBase, ...palette } = snapshot.flavors.find((entry) => entry.id === f.id);
    assert.deepEqual(palette, JSON.parse(JSON.stringify(f)), f.id);
    for (const name of Object.keys(f.colors)) assert.equal(contrastToBase[name], contrast(f.raw[name], f.raw.base), `${f.id}.${name}`);
  }
  // The landing links to these README sections.
  for (const anchor of ["using-the-palette-in-something-else", "contributing-a-port"]) assert.ok(snapshot.documentationAnchors.includes(anchor), anchor);
});

test("landing export is deterministic and its fingerprint changes with the palette", () => {
  assert.deepEqual(landingFiles(flavors, { readme }), files);
  const changed = flavors.map((f) => ({ ...f, description: `${f.description} Updated.` }));
  assert.notEqual(JSON.parse(landingFiles(changed, { readme })[0].content).source.sha256, snapshot.source.sha256);
});

test("the core stays app-agnostic and self-contained", () => {
  const pkg = JSON.parse(read("package.json"));
  const sources = (dir) => readdirSync(join(root, dir), { recursive: true }).filter((path) => /\.(mjs|md|json|html|css|yml)$/.test(path)).map((path) => `${dir}/${path}`);
  for (const path of [...sources("src"), ...sources("scripts"), ...sources("preview"), ...sources("docs"), ...sources("exports"), "README.md", "package.json"]) {
    const text = read(path);
    assert.doesNotMatch(text, /extras\//, path);
    // Links stay inside the organization (font license credits excepted).
    for (const [, owner] of text.matchAll(/github\.com\/([\w.-]+)/g)) assert.ok(["living-code-theme", "orgs"].includes(owner), `${path} links to github.com/${owner}`);
    if (path.endsWith(".mjs")) for (const [, specifier] of text.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
      assert.ok(specifier.startsWith("node:") || specifier.startsWith(".") || Object.hasOwn(pkg.devDependencies, specifier), `${path} imports undeclared dependency ${specifier}`);
    }
  }
  assert.deepEqual(pkg.dependencies ?? {}, {}, "palette generation remains dependency-free; maintainer tooling uses dev dependencies");
});

test("the website schema export is byte-identical to core's canonical contract", () => {
  const schema = read("schemas/port.schema.json");
  assert.equal(read("exports/landing/port.schema.json"), schema);
  assert.equal(files.find((file) => file.path === "exports/landing/port.schema.json").content, schema);
  assert.equal(JSON.parse(schema).$id, "https://living-code.dev/port.schema.json");
});
