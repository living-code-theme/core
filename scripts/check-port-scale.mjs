#!/usr/bin/env node
// Full synthetic 400-port acceptance run, including a real isolated offline Astro build and website tests.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { copyLanding, landingCheckout } from "../src/landing-checkout.mjs";
import { exerciseScale } from "../test/fixtures/scale-acceptance.mjs";

const { values } = parseArgs({ options: { landing: { type: "string" }, keep: { type: "boolean" }, report: { type: "string" } } });
const source = await landingCheckout(values.landing);
const reportPath = values.report ? resolve(values.report) : null;
if (reportPath) {
  const target = join(await realpath(dirname(reportPath)), basename(reportPath));
  const local = relative(source, target);
  if (!isAbsolute(local) && local !== ".." && !local.startsWith(`..${sep}`)) throw new Error("Write the scale report outside the source website");
  const exists = await lstat(reportPath).catch((error) => { if (error.code !== "ENOENT") throw error; return null; });
  if (exists) throw new Error("Choose a new report filename; existing files must not be overwritten");
}
const original = await readFile(join(source, "data/ports.json"));
const directory = await mkdtemp(join(tmpdir(), "living-code-400-"));
console.log(`Synthetic, unpublished scale fixture: ${directory}`);
try {
  await copyLanding(source, directory);
  const metrics = await exerciseScale(directory, { largeImages: true });
  const layout = join(directory, "src/layouts/Base.astro");
  const banner = '<aside role="status" data-local-port-preview class="shell" style="padding-block:12px;background:var(--lc-surface0);color:var(--lc-fg)">Synthetic 400-port test: not published. Repositories, revisions, instructions and calibration images are fixtures.</aside>';
  await writeFile(layout, (await readFile(layout, "utf8")).replace('<main id="main">', `<main id="main">${banner}`));
  const run = (args, overrides = {}) => {
    const env = { ...process.env, CI: "true", FORCE_COLOR: "0", INIT_CWD: directory, PWD: directory };
    delete env.NODE_PATH; delete env.NODE_OPTIONS;
    for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
    Object.assign(env, overrides);
    return execFileSync("pnpm", args, { cwd: directory, env, encoding: "utf8", timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  };
  console.log("Installing from the frozen website lockfile…");
  run(["install", "--frozen-lockfile", "--prefer-offline"]);
  const guard = join(directory, ".offline-build.mjs");
  await writeFile(guard, 'import http from "node:http"; import https from "node:https"; import { syncBuiltinESMExports } from "node:module"; const deny = () => { throw new Error("Network is forbidden during the website build/test"); }; globalThis.fetch = deny; http.request = http.get = https.request = https.get = deny; syncBuiltinESMExports();\n');
  const env = { ASTRO_TELEMETRY_DISABLED: "1", NODE_OPTIONS: `--import=${guard}` };
  let start = performance.now();
  const build = run(["build"], env);
  metrics.buildMs = performance.now() - start;
  await writeFile(join(directory, "build.log"), build);
  start = performance.now();
  const tests = run(["test"], env);
  metrics.testMs = performance.now() - start;
  metrics.websiteTests = Number(tests.match(/\btests (\d+)/)?.[1]);
  await writeFile(join(directory, "test.log"), tests);
  assert.ok(metrics.websiteTests > 100);
  const first = JSON.parse(await readFile(join(directory, "data/ports.json"), "utf8")).ports[0].id;
  metrics.portPageBytes = (await stat(join(directory, "dist/ports", first, "index.html"))).size;
  metrics.indexPageBytes = (await stat(join(directory, "dist/ports/index.html"))).size;
  metrics.homePageBytes = (await stat(join(directory, "dist/index.html"))).size;
  const page = await readFile(join(directory, "dist/ports", first, "index.html"), "utf8");
  assert.doesNotMatch(page.match(/<dialog[\s\S]*?<\/dialog>/)[0], /role="option"/);
  assert.equal((await readFile(join(directory, "dist/index.html"), "utf8")).match(/data-app-panel=/g).length, 5);
  assert.ok((await readFile(join(source, "data/ports.json"))).equals(original), "production inputs remain untouched");
  const report = { directory: values.keep ? directory : null, ...metrics, offlineBuildVerified: true, productionCatalogUnchanged: true };
  if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(report, null, 2));
} finally {
  assert.ok((await readFile(join(source, "data/ports.json"))).equals(original), "the scale runner must never modify production inputs");
  if (!values.keep) await rm(directory, { recursive: true, force: true });
}
