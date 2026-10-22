import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { brandFiles, brandSvg } from "../src/brand.mjs";
import { icoFromPngs } from "../scripts/brand-icons.mjs";
import { contrast } from "../src/color.mjs";
import { GLYPHS } from "../src/glyphs.mjs";
import { resolveAll } from "../src/resolve.mjs";

const night = resolveAll().find((f) => f.id === "night");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("brand vectors use exactly the authentic [lc] JetBrains Mono Bold glyphs and Night colors", () => {
  for (const { path, content } of brandFiles(night)) {
    assert.equal(read(path).toString(), content, path);
    assert.equal((content.match(/<path /g) ?? []).length, 4);
    for (const glyph of "[lc]") assert.ok(content.includes(`d="${GLYPHS[glyph]}"`), glyph);
    assert.ok(content.includes(`fill="${night.c("base")}"`));
    assert.ok(content.includes(`fill="${night.c("teal")}"`));
    assert.match(content, /JetBrains Mono 2\.304 Bold/);
    assert.doesNotMatch(content, /<text|<image|<filter|font-family|https?:\/\/(?!www\.w3\.org)/);
  }
  assert.ok(contrast(night.raw.teal, night.raw.base) >= 4.5);
  assert.throws(() => brandSvg(night, { purpose: "unknown" }), /Unknown brand composition/);
});

test("avatar artwork is centered by visible bounds and safe inside GitHub's circular crop", () => {
  const svg = brandSvg(night);
  const [, x, y, scale] = svg.match(/translate\(([\d.-]+) ([\d.-]+)\) scale\(([\d.-]+)/).map(Number);
  const left = x + 185 * scale;
  const right = x + 2215 * scale;
  const top = y - 830 * scale;
  const bottom = y + 110 * scale;
  assert.ok(Math.abs((left + right) / 2 - 512) < 0.001);
  assert.ok(Math.abs((top + bottom) / 2 - 512) < 0.001);
  for (const px of [left, right]) for (const py of [top, bottom]) assert.ok(Math.hypot(px - 512, py - 512) < 480, "glyph bounds have crop clearance");
  assert.match(svg, /width="1024" height="1024"/);
  assert.doesNotMatch(svg, /rx=/, "GitHub controls the avatar mask; upload a full-bleed square");
});

test("favicon uses a separate tighter composition with transparent rounded corners", () => {
  const svg = brandSvg(night, { purpose: "favicon" });
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.match(svg, /rx="10"/);
  assert.match(svg, /translate\(520 0\)/);
  assert.match(svg, /optically spaced for small sizes/);
});

test("raster assets are current with their source vectors and have the required PNG dimensions", () => {
  const manifest = JSON.parse(read("assets/brand/raster-sources.json"));
  assert.equal(manifest.schemaVersion, 1);
  for (const [path, expected] of Object.entries({ ...manifest.sources, ...manifest.outputs })) assert.equal(hash(read(path)), expected, `${path}: run pnpm build && pnpm icons:brand`);
  const expected = {
    "assets/brand/github-avatar.png": 1024,
    "assets/brand/apple-touch-icon.png": 180,
    "assets/brand/publisher-128.png": 128,
    ...Object.fromEntries([16, 32, 48].map((size) => [`assets/brand/favicon-${size}.png`, size])),
  };
  for (const [path, size] of Object.entries(expected)) {
    const png = read(path);
    assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), path);
    assert.equal(png.readUInt32BE(16), size, `${path}: width`);
    assert.equal(png.readUInt32BE(20), size, `${path}: height`);
  }
});

test("ICO contains the exact 16, 32 and 48 pixel PNGs at valid directory offsets", () => {
  const images = [16, 32, 48].map((size) => ({ size, bytes: read(`assets/brand/favicon-${size}.png`) }));
  const ico = read("assets/brand/favicon.ico");
  assert.ok(ico.equals(icoFromPngs(images)));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  images.forEach(({ size, bytes }, i) => {
    const entry = 6 + i * 16;
    assert.equal(ico[entry], size);
    assert.equal(ico[entry + 1], size);
    const offset = ico.readUInt32LE(entry + 12);
    assert.ok(ico.subarray(offset, offset + ico.readUInt32LE(entry + 8)).equals(bytes));
  });
});
