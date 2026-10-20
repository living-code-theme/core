#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { parseArgs } from "node:util";
import { mix, oklabToOklch, oklchToOklab, rgb, rgbToOklab } from "../src/color.mjs";
import { ACCENT_ORDER, NEUTRAL_ORDER, flavorOrder, resolveFlavor } from "../src/resolve.mjs";

const MODES = ["lut", "gradient", "remap"];
const MUTED_CHROMA = 0.04;
const FULL_CHROMA = 0.14;
const LIGHT_SPREAD = 0.2;

const usage = `Recolor an image with a Living Code palette.

Usage:
  node scripts/recolor.mjs <image> [options]

Options:
  -f, --flavor <name>    ${flavorOrder.join(" | ")}  (default: night)
  -m, --mode <mode>      ${MODES.join(" | ")} | all  (default: lut)
  -o, --out <file>       output path (default: <image>-<flavor>-<mode>.png)
  -s, --strength <0-1>   lut: how far the image moves to the palette (default: 1)
      --color <0-1>      lut: accent amount over the slate ramp, 0 is slate only
                         (default: 0.65; shadows and muted areas stay neutral)
      --spread <deg>     lut: hue blend between accents, larger is smoother (default: 25)
      --keep-light <0-1> lut: colored areas keep their own lightness instead of
                         the accent's (default: 0.5)
      --smooth <px>      lut: color noise smoothing before mapping, 0 disables
                         (default: image size / 1300)
      --accents <set>    lut: accents to map hues onto: core | all | comma list
                         (default: core = teal,mint,aqua,steel,amber,copper)
  -a, --accent <color>   gradient: palette color for midtones (default: teal)
      --invert           gradient: map shadows to light and highlights to dark
      --no-dither        remap: snap to the nearest color without dithering
  -h, --help

Modes:
  lut       starts with the slate ramp, adds accents to colorful midtones,
            keeps shadows neutral and fits lightness to the theme's range
  gradient  maps brightness onto dark slate, accent and light text
  remap     posterizes to the exact palette colors
`;

let parsed;
try {
  parsed = parseArgs({
  allowPositionals: true,
  options: {
    flavor: { type: "string", short: "f", default: "night" },
    mode: { type: "string", short: "m", default: "lut" },
    out: { type: "string", short: "o" },
    strength: { type: "string", short: "s", default: "1" },
    color: { type: "string", default: "0.65" },
    spread: { type: "string", default: "25" },
    "keep-light": { type: "string", default: "0.5" },
    accents: { type: "string", default: "core" },
    smooth: { type: "string" },
    accent: { type: "string", short: "a", default: "teal" },
    invert: { type: "boolean", default: false },
    "no-dither": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  });
} catch (e) {
  console.error(`error: ${e.message}\n\n${usage}`);
  process.exit(1);
}
const { values: opt, positionals } = parsed;

const fail = (msg) => {
  console.error(`error: ${msg}\n\n${usage}`);
  process.exit(1);
};

if (opt.help) {
  console.log(usage);
  process.exit(0);
}
const input = positionals[0];
if (!input || positionals.length > 1) fail("expected exactly one input image");
if (!flavorOrder.includes(opt.flavor)) fail(`unknown flavor "${opt.flavor}"`);
const modes = opt.mode === "all" ? MODES : [opt.mode];
if (!modes.every((m) => MODES.includes(m))) fail(`unknown mode "${opt.mode}"`);
if (opt.out && modes.length > 1) fail("--out cannot be used with --mode all");

const num = (name, min, max) => {
  const v = Number(opt[name]);
  if (!Number.isFinite(v) || v < min || v > max) fail(`--${name} must be a number from ${min} to ${max}`);
  return v;
};
const strength = num("strength", 0, 1);
const color = num("color", 0, 1);
const spread = num("spread", 1, 180);
const keepLight = num("keep-light", 0, 1);
const smooth = opt.smooth === undefined ? undefined : num("smooth", 0, 100);

const ACCENT_SETS = { core: ["teal", "mint", "aqua", "steel", "amber", "copper"], all: ACCENT_ORDER };
const lutAccents = ACCENT_SETS[opt.accents] ?? opt.accents.split(",").map((s) => s.trim()).filter(Boolean);
const badAccent = lutAccents.find((n) => !ACCENT_ORDER.includes(n));
if (badAccent || !lutAccents.length) fail(`--accents must be core, all or a comma list of: ${ACCENT_ORDER.join(", ")}`);

const f = resolveFlavor(opt.flavor);
if (!f.raw[opt.accent]) fail(`unknown palette color "${opt.accent}". Use one of: ${Object.keys(f.raw).join(", ")}`);

function magick(args, input) {
  try {
    return execFileSync("magick", args, { input, maxBuffer: 1 << 28, stdio: ["pipe", "pipe", "pipe"] });
  } catch (e) {
    if (e.code === "ENOENT") fail("ImageMagick 7 (`magick`) is required. On NixOS: nix shell nixpkgs#imagemagick");
    throw new Error(e.stderr?.toString().trim() || e.message);
  }
}

const toRaw = (colors) => Buffer.from(colors.flatMap((c) => rgb(c)));

const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (lo, hi, x) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

function paletteMapper() {
  const ramp = NEUTRAL_ORDER.map((n) => oklchToOklab(f.raw[n])).sort((x, y) => x[0] - y[0]);
  const accents = lutAccents.map((n) => ({ lch: f.raw[n], lab: oklchToOklab(f.raw[n]) }));
  const [lo, hi] = [ramp[0][0], ramp.at(-1)[0]];
  const hueK = 1 / (2 * spread * spread);
  const lightK = 1 / (2 * LIGHT_SPREAD * LIGHT_SPREAD);

  const neutralAt = (L) => {
    const k = ramp.findIndex((c) => c[0] >= L);
    const j = k === -1 ? ramp.length - 1 : Math.max(1, k);
    const [a, b] = [ramp[j - 1] ?? ramp[0], ramp[j] ?? ramp.at(-1)];
    const t = b[0] === a[0] ? 0 : Math.min(1, Math.max(0, (L - a[0]) / (b[0] - a[0])));
    return [L, lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  };

  return (p) => {
    const [, C, h] = oklabToOklch(p);
    const L = lerp(lo, hi, p[0]);
    let sum = 0;
    const t = [0, 0, 0];
    for (const { lch, lab } of accents) {
      const dh = Math.abs(((h - lch[2] + 540) % 360) - 180);
      const w = Math.exp(-dh * dh * hueK - (L - lch[0]) ** 2 * lightK);
      sum += w;
      for (let ch = 0; ch < 3; ch++) t[ch] += w * lab[ch];
    }
    const accent = sum > 1e-12 ? t.map((v) => v / sum) : neutralAt(L);
    const s = color * smoothstep(MUTED_CHROMA, FULL_CHROMA, C) * smoothstep(0.2, 0.55, p[0]);
    const outL = lerp(L, lerp(accent[0], L, keepLight), s);
    const gray = neutralAt(outL);
    const q = [outL, lerp(gray[1], accent[1], s), lerp(gray[2], accent[2], s)];
    return p.map((v, ch) => lerp(v, q[ch], strength));
  };
}

function inputInfo() {
  const [w, h, alpha] = magick([input + "[0]", "-format", "%w %h %A", "info:"]).toString().trim().split(" ");
  return { w: +w, h: +h, alpha: !/^(Undefined|False)$/i.test(alpha) };
}

function denoise({ w, h }) {
  const sigma = smooth ?? Math.max(w, h) / 1300;
  if (sigma < 0.3) return [];
  return ["-colorspace", "Lab", "-channel", "G,B", "-blur", `0x${+sigma.toFixed(2)}`, "+channel", "-colorspace", "sRGB"];
}

function lutClut(path) {
  const level = 8;
  const size = level ** 3;
  const identity = magick(["hald:" + level, "-depth", "8", "rgb:-"]);
  const map = paletteMapper();
  const out = Buffer.alloc(identity.length);
  for (let i = 0; i < identity.length; i += 3) {
    const p = rgbToOklab([identity[i], identity[i + 1], identity[i + 2]]);
    out.set(rgb(oklabToOklch(map(p))), i);
  }
  magick(["-size", `${size}x${size}`, "-depth", "8", "rgb:-", path], out);
  return ["-channel", "RGB", "-hald-clut", "+channel"];
}

function gradientClut(path) {
  const [dark, light] = f.light ? [f.raw.text, f.raw.base] : [f.raw.base, f.raw.text];
  const stops = opt.invert ? [light, f.raw[opt.accent], dark] : [dark, f.raw[opt.accent], light];
  const ramp = Array.from({ length: 256 }, (_, i) => {
    const t = i / 255;
    const [a, b, u] = t < 0.5 ? [stops[0], stops[1], t * 2] : [stops[1], stops[2], t * 2 - 1];
    return mix(a, b, u);
  });
  magick(["-size", "256x1", "-depth", "8", "rgb:-", path], toRaw(ramp));
  return ["-colorspace", "gray", "-colorspace", "sRGB"];
}

function remapPalette(path) {
  const colors = Object.values(f.raw);
  magick(["-size", `${colors.length}x1`, "-depth", "8", "rgb:-", path], toRaw(colors));
  return ["-dither", opt["no-dither"] ? "None" : "FloydSteinberg", "-remap", path];
}

const tmp = mkdtempSync(join(tmpdir(), "living-code-"));
try {
  const info = inputInfo();
  const finish = info.alpha ? [] : ["-alpha", "off"];
  for (const mode of modes) {
    const out = opt.out ?? join(dirname(input), `${basename(input, extname(input))}-${f.id}-${mode}.png`);
    const table = join(tmp, `${mode}.png`);
    if (mode === "lut") magick([input, ...denoise(info), table, ...lutClut(table), ...finish, out]);
    if (mode === "gradient") magick([input, ...gradientClut(table), table, "-channel", "RGB", "-clut", "+channel", ...finish, out]);
    if (mode === "remap") {
      const keepAlpha = info.alpha ? ["(", input, "-alpha", "extract", ")", "-alpha", "off", "-compose", "CopyOpacity", "-composite"] : [];
      magick([input, "-alpha", "off", ...remapPalette(table), ...keepAlpha, ...finish, out]);
    }
    console.log(`wrote ${out}`);
  }
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exitCode = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
