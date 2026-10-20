import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { oklabToOklch, rgbToOklab } from "../src/color.mjs";
import { flavorOrder, resolveFlavor } from "../src/resolve.mjs";

const script = fileURLToPath(new URL("../scripts/recolor.mjs", import.meta.url));
// recolor.mjs treats ImageMagick 7 as an optional local tool, so skip rather than
// fail where `magick` is absent. Ubuntu runners ship only ImageMagick 6.
const needsMagick = { skip: spawnSync("magick", ["-version"]).status === 0 ? false : "requires ImageMagick 7 (`magick`)" };
const magick = (args, input) => execFileSync("magick", args, { input });
const run = (input, output, args = []) => execFileSync(process.execPath, [script, input, "--out", output, "--smooth", "0", ...args]);
const pixels = (path, channels = "rgb") => magick([path, "-depth", "8", `${channels}:-`]);
const lch = (bytes, index) => oklabToOklch(rgbToOklab([...bytes.subarray(index * 3, index * 3 + 3)]));
const close = (a, b, tolerance = 2) => {
  assert.equal(a.length, b.length);
  a.forEach((v, i) => assert(Math.abs(v - b[i]) <= tolerance, `channel ${i}: ${v} != ${b[i]}`));
};

function workspace(t) {
  const dir = mkdtempSync(join(tmpdir(), "living-code-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function swatches(dir, colors, channels = "rgb") {
  const input = join(dir, "source.png");
  magick(["-size", `${colors.length}x1`, "-depth", "8", `${channels}:-`, input], Buffer.from(colors.flat()));
  return input;
}

test("LUT balances accents over the slate ramp and protects shadows", needsMagick, (t) => {
  const dir = workspace(t);
  const colors = [[0, 0, 0], [255, 255, 255], [128, 128, 128], [124, 130, 134], [5, 20, 12], [0, 170, 140], [220, 160, 30]];
  const input = swatches(dir, colors);
  const neutral = join(dir, "neutral.png");
  const balanced = join(dir, "balanced.png");
  const strong = join(dir, "strong.png");
  run(input, neutral, ["--color", "0"]);
  run(input, balanced);
  run(input, strong, ["--color", "1"]);
  const a = pixels(neutral), b = pixels(balanced), c = pixels(strong);
  const f = resolveFlavor("night");
  close(a.subarray(0, 3), f.colors.crust.rgb);
  close(a.subarray(3, 6), f.colors.text.rgb);
  for (let i = 0; i < colors.length; i++) assert(lch(a, i)[1] < 0.02);
  close(a.subarray(6, 15), b.subarray(6, 15));
  for (const i of [5, 6]) {
    assert(lch(b, i)[1] > lch(a, i)[1] + 0.02);
    assert(lch(c, i)[1] > lch(b, i)[1] + 0.01);
    assert(lch(b, i)[0] > lch(b, 4)[0]);
  }
  assert(lch(b, 5)[2] > 160 && lch(b, 5)[2] < 210);
  assert(lch(b, 6)[2] > 40 && lch(b, 6)[2] < 100);
  assert.equal(magick([balanced, "-format", "%A", "info:"]).toString(), "Undefined");
});

test("slate-only output works for every flavor and preserves tonal ordering", needsMagick, (t) => {
  const dir = workspace(t);
  const input = swatches(dir, [[0, 0, 0], [64, 64, 64], [128, 128, 128], [192, 192, 192], [255, 255, 255]]);
  for (const flavor of flavorOrder) {
    const output = join(dir, `${flavor}.png`);
    run(input, output, ["--flavor", flavor, "--color", "0"]);
    const data = pixels(output);
    const ramp = Object.values(resolveFlavor(flavor).colors).filter((c) => c.oklch[1] < 0.03).sort((a, b) => a.oklch[0] - b.oklch[0]);
    close(data.subarray(0, 3), ramp[0].rgb);
    close(data.subarray(12, 15), ramp.at(-1).rgb);
    for (let i = 1; i < 5; i++) assert(lch(data, i)[0] > lch(data, i - 1)[0]);
  }
});

test("zero strength with smoothing disabled preserves original colors", needsMagick, (t) => {
  const dir = workspace(t);
  const colors = [[0, 0, 0], [255, 255, 255], [70, 110, 130], [120, 210, 50], [0, 170, 140]];
  const input = swatches(dir, colors);
  const output = join(dir, "identity.png");
  run(input, output, ["--strength", "0"]);
  close(pixels(output), Buffer.from(colors.flat()));
});

test("every mode preserves fractional alpha", needsMagick, (t) => {
  const dir = workspace(t);
  const colors = [[80, 120, 140, 0], [0, 150, 140, 64], [255, 150, 50, 128], [0, 160, 150, 255]];
  const input = swatches(dir, colors, "rgba");
  for (const mode of ["lut", "gradient", "remap"]) {
    const output = join(dir, `${mode}.png`);
    run(input, output, ["--mode", mode]);
    const data = pixels(output, "rgba");
    colors.forEach((c, i) => assert.equal(data[i * 4 + 3], c[3]));
  }
});

test("invalid accent amounts fail cleanly", () => {
  for (const color of ["-0.1", "1.1", "not-a-number"]) {
    const result = spawnSync(process.execPath, [script, "unused.png", `--color=${color}`], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /error: --color must be a number from 0 to 1/);
    assert.doesNotMatch(result.stderr, /at file:/);
  }
});
