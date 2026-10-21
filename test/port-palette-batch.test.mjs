import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstat, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { batchPaletteUpdate } from "../src/port-palette-batch.mjs";
import { batchFixture, git } from "./fixtures/palette-batch.mjs";

const lock = (port) => join(port, ".git/living-code-palette.lock");
const noLock = async (port) => assert.equal(await lstat(lock(port)).catch(() => null), null);

test("default plan executes no port code and leaves Git and all owned files unchanged", async (t) => {
  const f = await batchFixture(t);
  const report = await batchPaletteUpdate(f.core, f.ports);
  assert.equal(report.apply, false); assert.equal(report.ready, true);
  assert.deepEqual(report.ports.map(p => p.id), ["port-0", "port-1"]);
  assert.ok(report.ports.every(p => p.status === "planned"));
  for (const port of f.ports) { assert.equal(await f.events(port), ""); assert.equal(git(port, "status", "--porcelain"), ""); await noLock(port); }
});

test("apply runs each owner's updater/build/check/test, records exact revision and preserves Git history", async (t) => {
  const f = await batchFixture(t);
  const heads = f.ports.map(p => git(p, "rev-parse", "HEAD"));
  const report = await batchPaletteUpdate(f.core, f.ports, { apply: true, revision: f.revision, concurrency: 2 });
  assert.ok(report.ready, JSON.stringify(report)); assert.ok(report.ports.every(p => p.status === "updated"), JSON.stringify(report));
  for (const [i, port] of f.ports.entries()) {
    assert.equal(git(port, "rev-parse", "HEAD"), heads[i]); assert.equal(git(port, "diff", "--cached", "--name-only"), "");
    assert.equal(await f.events(port), "palette:update\nbuild\ncheck\ntest\n");
    assert.deepEqual(report.ports[i].changed, ["palette/theme.json", "theme.conf"]);
    assert.equal(JSON.parse(await readFile(join(port, "palette/theme.json"))).source.revision, f.revision);
    assert.equal(await readFile(join(port, "README.md"), "utf8"), "Port-owned documentation\n"); await noLock(port);
  }
  const blocked = await batchPaletteUpdate(f.core, f.ports, { apply: true });
  assert.ok(!blocked.ready && blocked.ports.every(p => p.status === "blocked"));
  // Explicit maintainer review/commit is required before repeating the operation.
  for (const port of f.ports) { git(port, "add", "."); git(port, "commit", "-m", "reviewed palette adoption"); }
  const again = await batchPaletteUpdate(f.core, f.ports, { apply: true });
  assert.ok(again.ports.every(p => p.status === "unchanged"));
});

test("one dirty checkout blocks the entire batch before any updater runs", async (t) => {
  const f = await batchFixture(t);
  for (const type of ["untracked", "tracked", "staged"]) {
    const file = type === "untracked" ? "new.txt" : "README.md";
    await writeFile(join(f.ports[1], file), `maintainer ${type} work\n`);
    if (type === "staged") git(f.ports[1], "add", file);
    const report = await batchPaletteUpdate(f.core, f.ports, { apply: true });
    assert.equal(report.ready, false); assert.match(report.ports[1].error, /Dirty port worktree/);
    assert.equal(await f.events(f.ports[0]), ""); assert.equal(await f.events(f.ports[1]), "");
    git(f.ports[1], "add", "."); git(f.ports[1], "commit", "-m", `review ${type}`);
  }
});

test("wrong core revision, dirty inputs and uncommitted/stale exports fail before port commands", async (t) => {
  const f = await batchFixture(t);
  await assert.rejects(batchPaletteUpdate(f.core, f.ports, { revision: "b".repeat(40) }), /Core HEAD differs/);
  const input = join(f.core, "palette/flavors.mjs");
  await writeFile(input, (await readFile(input, "utf8")) + "\n// dirty\n");
  await assert.rejects(batchPaletteUpdate(f.core, f.ports), /uncommitted palette input/);
  const previous = git(f.core, "show", "HEAD:palette/flavors.mjs"); await writeFile(input, previous + "\n");
  const path = join(f.core, "exports/ports/palette.json"); await writeFile(path, (await readFile(path, "utf8")) + "\n");
  await assert.rejects(batchPaletteUpdate(f.core, f.ports), /Commit the generated core export/);
  assert.equal(await f.events(f.ports[0]), "");
});

test("duplicates, subdirectories, missing owner scripts and incompatible math never start a partial batch", async (t) => {
  const f = await batchFixture(t);
  assert.equal((await batchPaletteUpdate(f.core, [f.ports[0], f.ports[0]], { apply: true })).ready, false);
  assert.equal((await batchPaletteUpdate(f.core, [join(f.ports[0], "scripts")])).ready, false);
  const pkg = JSON.parse(await readFile(join(f.ports[0], "package.json"))); delete pkg.scripts.test;
  await writeFile(join(f.ports[0], "package.json"), JSON.stringify(pkg)); git(f.ports[0], "add", "."); git(f.ports[0], "commit", "-m", "incomplete scripts");
  assert.match((await batchPaletteUpdate(f.core, f.ports)).ports[0].error, /Missing port-owned pnpm test/);
  await writeFile(join(f.ports[1], "scripts/color.mjs"), "// different math\n"); git(f.ports[1], "add", "."); git(f.ports[1], "commit", "-m", "math change");
  assert.match((await batchPaletteUpdate(f.core, f.ports)).ports[1].error, /Color math changed/);
  for (const port of f.ports) assert.equal(await f.events(port), "");
});

test("unsafe allowlists and symlinked palette/control inputs are refused", async (t) => {
  const f = await batchFixture(t);
  await writeFile(join(f.ports[0], "scripts/generated.json"), JSON.stringify(["README.md"])); git(f.ports[0], "add", "."); git(f.ports[0], "commit", "-m", "bad allowlist");
  assert.match((await batchPaletteUpdate(f.core, f.ports)).ports[0].error, /Protected generated path/);
  const target = join(f.ports[1], "palette/alias.json"); await writeFile(target, await readFile(join(f.ports[1], "palette/theme.json")));
  const { unlink } = await import("node:fs/promises"); await unlink(join(f.ports[1], "palette/theme.json")); await symlink("alias.json", join(f.ports[1], "palette/theme.json")); git(f.ports[1], "add", "."); git(f.ports[1], "commit", "-m", "symlink pin");
  assert.match((await batchPaletteUpdate(f.core, f.ports)).ports[1].error, /symlinked/);
});

test("an existing writer lock is not stolen and other acquired locks are released", async (t) => {
  const f = await batchFixture(t); await writeFile(lock(f.ports[1]), "existing owner\n");
  const report = await batchPaletteUpdate(f.core, f.ports, { apply: true });
  assert.equal(report.ready, false); assert.match(report.error, /Another palette batch holds/);
  assert.equal(await readFile(lock(f.ports[1]), "utf8"), "existing owner\n"); await noLock(f.ports[0]);
  for (const port of f.ports) assert.equal(await f.events(port), "");
});

test("ordinary test failure retains reviewable changes and still checks the other selected ports", async (t) => {
  const f = await batchFixture(t, [{ fail: "test" }, {}]);
  const report = await batchPaletteUpdate(f.core, f.ports, { apply: true, concurrency: 1 });
  assert.deepEqual(report.ports.map(p => p.status), ["failed", "updated"]);
  assert.match(report.ports[0].steps.at(-1).output, /intentional test failure/);
  assert.equal(JSON.parse(await readFile(join(f.ports[0], "palette/theme.json"))).source.revision, f.revision);
  for (const port of f.ports) await noLock(port);
});

test("unexpected documentation edits stop not-yet-started ports without resetting maintainer diffs", async (t) => {
  const f = await batchFixture(t, [{ outside: true }, {}]);
  const report = await batchPaletteUpdate(f.core, f.ports, { apply: true, concurrency: 1 });
  assert.deepEqual(report.ports.map(p => p.status), ["failed", "skipped"]);
  assert.match(report.ports[0].error, /outside its palette\/generated allowlist/);
  assert.equal(await readFile(join(f.ports[0], "README.md"), "utf8"), "unexpected edit");
  assert.equal(await f.events(f.ports[1]), "");
});

test("inherited Git selectors and Node import paths cannot redirect child maintenance commands", async (t) => {
  const f = await batchFixture(t, [{}]);
  const names = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "NODE_PATH", "NODE_OPTIONS"];
  const previous = names.map(name => process.env[name]);
  try {
    for (const name of names) process.env[name] = name === "NODE_OPTIONS" ? "--import=/this-must-not-be-imported.mjs" : "/this-must-not-be-used";
    assert.equal((await batchPaletteUpdate(f.core, f.ports, { apply: true })).ports[0].status, "updated");
  } finally { names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; }); }
});

test("cancellation drains the process group, prevents late writes and releases locks", async (t) => {
  const f = await batchFixture(t, [{ hang: "build" }]); const controller = new AbortController();
  const pending = batchPaletteUpdate(f.core, f.ports, { apply: true, signal: controller.signal });
  for (let i = 0; i < 200 && !(await f.events(f.ports[0])).includes("build"); i++) await new Promise(r => setTimeout(r, 25));
  controller.abort(); const report = await pending;
  assert.equal(report.ports[0].status, "failed"); await noLock(f.ports[0]);
  await new Promise(r => setTimeout(r, 1400)); assert.equal(await lstat(join(f.ports[0], ".git/late-write")).catch(() => null), null);
});

test("core changes during a run stop the next phase and not-yet-started ports", async (t) => {
  const f = await batchFixture(t, [{ changeCore: true }, {}]);
  const report = await batchPaletteUpdate(f.core, f.ports, { apply: true, concurrency: 1 });
  assert.deepEqual(report.ports.map(p => p.status), ["failed", "skipped"]);
  assert.match(report.ports[0].error, /Core changed during the batch/);
  assert.equal(await f.events(f.ports[0]), "palette:update\n");
  for (const port of f.ports) await noLock(port);
});

test("missing dependencies and invalid concurrency are caught before commands run", async (t) => {
  const f = await batchFixture(t, [{}]);
  const pkg = JSON.parse(await readFile(join(f.ports[0], "package.json"))); pkg.devDependencies = { "fixture-missing": "1.0.0" };
  await writeFile(join(f.ports[0], "package.json"), JSON.stringify(pkg)); git(f.ports[0], "add", "."); git(f.ports[0], "commit", "-m", "dependencies required");
  assert.match((await batchPaletteUpdate(f.core, f.ports)).ports[0].error, /Install this port's dependencies/);
  for (const concurrency of [0, 5, 1.5]) await assert.rejects(batchPaletteUpdate(f.core, f.ports, { concurrency }), /between 1 and 4/);
  assert.equal(await f.events(f.ports[0]), "");
});

test("excessive child output is bounded and reported as a failed phase", async (t) => {
  const f = await batchFixture(t, [{ flood: "test" }]);
  const report = await batchPaletteUpdate(f.core, f.ports, { apply: true });
  assert.equal(report.ports[0].status, "failed");
  assert.match(report.ports[0].error, /output budget/);
  assert.ok(report.ports[0].steps.at(-1).output.length <= 8192);
  await noLock(f.ports[0]);
});

test("CLI scans only immediate real port directories, defaults to plan and provides JSON reports", async (t) => {
  const f = await batchFixture(t); await symlink(f.ports[0], join(f.directory, "alias"), "dir");
  const cli = fileURLToPath(new URL("../scripts/update-port-palettes.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "--core", f.core, "--ports-root", f.directory, "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout);
  assert.equal(report.ports.length, 2); assert.equal(report.apply, false); assert.equal(await f.events(f.ports[0]), "");
  const invalid = spawnSync(process.execPath, [cli, "--core", f.core, "--ports-root", f.directory, f.ports[0]], { encoding: "utf8" });
  assert.equal(invalid.status, 1); assert.match(invalid.stderr, /OR --ports-root/);
});
