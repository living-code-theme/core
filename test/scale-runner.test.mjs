import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runner = new URL("../scripts/check-port-scale.mjs", import.meta.url);
test("scale reports cannot modify source inputs, traverse a symlink into the website, or overwrite an existing file", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "living-code-scale-report-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const landing = join(directory, "landing");
  await mkdir(landing);
  await writeFile(join(landing, "package.json"), JSON.stringify({ dependencies: { astro: "test" }, scripts: { build: "astro build" } }));
  const alias = join(directory, "alias");
  await symlink(landing, alias, "dir");
  const previous = join(directory, "report.json");
  await writeFile(previous, "retained report");
  for (const [path, message] of [[join(landing, "new.json"), /outside the source website/], [join(alias, "new.json"), /outside the source website/], [previous, /existing files must not be overwritten/]]) {
    const child = spawnSync(process.execPath, [fileURLToPath(runner), "--landing", landing, "--report", path], { encoding: "utf8" });
    assert.equal(child.status, 1);
    assert.match(child.stderr, message);
    assert.doesNotMatch(child.stdout, /Synthetic, unpublished scale fixture/);
  }
  assert.equal(await readFile(previous, "utf8"), "retained report");
});
