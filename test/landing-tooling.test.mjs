import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { copyLanding, landingCheckout } from "../src/landing-checkout.mjs";
import { exportLanding } from "../scripts/export-landing.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const exec = promisify(execFile);

async function checkout(t) {
  const directory = await mkdtemp(join(tmpdir(), "living-code-website-inputs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "package.json"), JSON.stringify({ dependencies: { astro: "^7.4.0" }, scripts: { build: "astro build" } }));
  return directory;
}

test("maintainer commands require an explicit Astro checkout, not core or process.cwd()", async (t) => {
  const directory = await checkout(t);
  assert.equal(await landingCheckout(directory), directory);
  await assert.rejects(landingCheckout(), /--landing/);
  await assert.rejects(landingCheckout(root), /Not an Astro landing checkout/);
  for (const [script, args] of [
    ["sync-ports.mjs", []], ["check-standalone.mjs", []], ["export-landing.mjs", []], ["preview-port.mjs", [directory]],
  ]) {
    await assert.rejects(exec(process.execPath, [join(root, "scripts", script), ...args], { cwd: directory }), /--landing/);
  }
});

test("landing exports update only generated theme and schema inputs", async (t) => {
  const directory = await checkout(t);
  await mkdir(join(directory, "data"));
  await mkdir(join(directory, "public/port-images"), { recursive: true });
  await writeFile(join(directory, "data/ports.json"), "existing discovery\n");
  await writeFile(join(directory, "data/legacy-ports.json"), "existing fallback\n");
  await writeFile(join(directory, "public/port-images/capture.webp"), "existing capture\n");
  await exec(process.execPath, [join(root, "scripts/export-landing.mjs"), "--landing", directory], { cwd: tmpdir() });
  for (const [source, target] of [["theme.json", "data/theme.json"], ["theme.css", "src/styles/theme.css"], ["port.schema.json", "public/port.schema.json"]]) {
    assert.deepEqual(await readFile(join(directory, target)), await readFile(join(root, "exports/landing", source)));
  }
  assert.equal(await readFile(join(directory, "data/ports.json"), "utf8"), "existing discovery\n");
  assert.equal(await readFile(join(directory, "data/legacy-ports.json"), "utf8"), "existing fallback\n");
  assert.equal(await readFile(join(directory, "public/port-images/capture.webp"), "utf8"), "existing capture\n");
  await exportLanding(directory);
  assert.equal(await readFile(join(directory, "data/ports.json"), "utf8"), "existing discovery\n");
});

test("isolated copies omit dependencies, output, caches and credentials", async (t) => {
  const source = await checkout(t);
  const target = await checkout(t);
  for (const path of ["node_modules", "dist", ".astro", ".git", ".wrangler"]) {
    await mkdir(join(source, path));
    await writeFile(join(source, path, "excluded"), "do not copy");
  }
  for (const path of [".env", ".env.local", ".dev.vars", ".dev.vars.production"]) await writeFile(join(source, path), "secret");
  await mkdir(join(source, "src"));
  await writeFile(join(source, "src/page.astro"), "<p>Website</p>");
  await copyLanding(source, target);
  assert.deepEqual((await readdir(target)).sort(), ["package.json", "src"]);
  assert.equal(await readFile(join(target, "src/page.astro"), "utf8"), "<p>Website</p>");
});

test("isolated copies reject symlinked build inputs", async (t) => {
  const source = await checkout(t);
  const target = await checkout(t);
  await symlink(join(source, "package.json"), join(source, "linked.json"));
  await assert.rejects(copyLanding(source, target), /symlinks/);
});

test("core tooling and tests never import a landing checkout", async () => {
  for (const directory of ["src", "scripts", "test"]) {
    for (const path of await readdir(join(root, directory), { recursive: true })) {
      if (!path.endsWith(".mjs")) continue;
      const sourcePath = join(root, directory, path);
      const source = await readFile(sourcePath, "utf8");
      for (const [, reference] of source.matchAll(/(?:\bfrom\s+|new URL\(\s*)["'](\.[^"']+)["']/g)) {
        const local = relative(root, resolve(dirname(sourcePath), reference));
        assert.ok(local !== ".." && !local.startsWith("../") && !local.startsWith("..\\") && !isAbsolute(local), `${directory}/${path}: ${reference}`);
      }
    }
  }
});
