#!/usr/bin/env node
// Writes every generated file from palette/flavors.mjs. `--check` writes nothing and fails on stale files.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brandFiles } from "../src/brand.mjs";
import { contrast } from "../src/color.mjs";
import { landingFiles, MINIMUM_CONTRAST, TEXT_ROLES } from "../src/landing.mjs";
import { paletteJson } from "../src/outputs.mjs";
import { paletteSnapshotJson } from "../src/palette-snapshot.mjs";
import { readme, swatchPath } from "../src/readme.mjs";
import { resolveAll } from "../src/resolve.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const flavors = resolveAll();
const night = flavors.find((f) => f.id === "night");

function generatedFiles() {
  const text = readme(flavors);
  const swatches = new Set(flavors.flatMap((f) => [...Object.values(f.colors).map((c) => c.hex), ...f.ansi.normal, ...f.ansi.bright]));
  return [
    { path: "palette.json", content: paletteJson(flavors) },
    { path: "exports/ports/palette.json", content: paletteSnapshotJson(flavors) },
    { path: "README.md", content: text },
    ...brandFiles(night),
    ...landingFiles(flavors, { readme: text }),
    ...[...swatches].map((hex) => ({
      path: swatchPath(hex),
      content: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect width="18" height="18" rx="3" fill="${hex}"/><rect x=".5" y=".5" width="17" height="17" rx="2.5" fill="none" stroke="#888" stroke-opacity=".35"/></svg>\n`,
    })),
  ];
}

const audit = [];
for (const f of flavors) {
  for (const role of TEXT_ROLES) {
    const ratio = contrast(f.rr(role), f.raw.base);
    if (ratio < MINIMUM_CONTRAST) audit.push(`${f.id}.${role} (${f.roles[role]}) ${ratio.toFixed(2)}:1`);
  }
}

const files = generatedFiles();
let stale = 0;
// Swatches are only ever generated, so a full rewrite also drops colors no flavor uses anymore.
if (!check) await rm(join(root, "assets/swatches"), { recursive: true, force: true });
for (const { path, content } of files) {
  const abs = join(root, path);
  if (check) {
    const current = await readFile(abs).catch(() => null);
    if (!current?.equals(Buffer.from(content))) { stale++; console.error(`stale: ${path}`); }
    continue;
  }
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content);
}

console.log(`${check ? "checked" : "wrote"} ${files.length} files for ${flavors.length} flavors`);
if (audit.length) {
  console.error(`\ncontrast below ${MINIMUM_CONTRAST}:1:\n  ${audit.join("\n  ")}`);
  process.exitCode = 1;
}
if (stale) {
  console.error(`\n${stale} generated files out of date. Run pnpm build`);
  process.exitCode = 1;
}
