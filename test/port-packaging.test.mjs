import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { packagePorts, publicationDirectories } from "../src/port-packaging.mjs";

async function fixture(t, name = "sample", source) {
  const parent = await mkdtemp(join(tmpdir(), "lc-package-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = join(parent, name); await mkdir(root);
  await writeFile(join(root, "port.json"), JSON.stringify({ slug: name }));
  await writeFile(join(root, "package.json"), JSON.stringify({ version: "1.2.3", packageManager: "pnpm@12.9.0", scripts: { package: "node package.mjs" } }));
  const publication = { schemaVersion: 1, artifacts: ["theme-{version}.zip"], channels: [{ name: "A registry", url: "https://example.com/submit", instructions: "Review the theme and upload manually." }] };
  await writeFile(join(root, "publication.json"), JSON.stringify(publication));
  await writeFile(join(root, "package.mjs"), source ?? `import {mkdir,writeFile} from 'node:fs/promises'; await mkdir('dist',{recursive:true}); await writeFile('dist/theme-1.2.3.zip','verified payload'); await writeFile('dist/unrelated.zip','never collect'); await writeFile('executed','yes');`);
  return { parent, root, publication, output: join(parent, "bundle") };
}
const exists = path => lstat(path).then(() => true, error => { if (error.code !== "ENOENT") throw error; return false; });

test("discovery is opt-in, immediate and skips symlink directories", async t => {
  const f = await fixture(t);
  await mkdir(join(f.parent, "not-a-port"));
  await symlink(f.root, join(f.parent, "linked"));
  assert.deepEqual(await publicationDirectories(f.parent), [f.root]);
});
test("plan does not execute scripts or create an output directory", async t => {
  const f = await fixture(t);
  const report = await packagePorts([f.root], { output: f.output });
  assert.equal(report.ready, true); assert.equal(report.ports[0].status, "planned");
  assert.deepEqual(report.ports[0].artifacts, ["theme-1.2.3.zip"]);
  assert.equal(await exists(join(f.root, "executed")), false);
  assert.equal(await exists(f.output), false);
});
test("apply delegates locally and stages only explicit artifacts with checksums and instructions", async t => {
  const f = await fixture(t);
  const report = await packagePorts([f.root], { apply: true, output: f.output });
  assert.equal(report.ready, true, JSON.stringify(report));
  assert.equal(report.ports[0].status, "packaged");
  const bytes = await readFile(join(f.output, "sample/theme-1.2.3.zip"));
  assert.equal(bytes.toString(), "verified payload");
  assert.equal(await exists(join(f.output, "sample/unrelated.zip")), false);
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(await readFile(join(f.output, "SHA256SUMS"), "utf8"), `${digest}  sample/theme-1.2.3.zip\n`);
  assert.match(await readFile(join(f.output, "sample/SUBMISSION.md"), "utf8"), /upload manually/);
  assert.equal(JSON.parse(await readFile(join(f.output, "manifest.json"))).ready, true);
});
test("all selected metadata is preflighted before any packaging", async t => {
  const f = await fixture(t);
  const report = await packagePorts([f.root, join(f.parent, "missing")], { apply: true, output: f.output });
  assert.equal(report.ready, false); assert.equal(report.ports[1].status, "blocked");
  assert.equal(await exists(join(f.root, "executed")), false); assert.equal(await exists(f.output), false);
  assert.equal((await packagePorts([f.root, f.root])).ready, false);
});
test("unsafe artifact names and linked metadata are rejected in plan mode", async t => {
  const f = await fixture(t);
  for (const artifact of ["../secret", "/secret", "sub/file.zip", "a\\b.zip", "SUBMISSION.md", "bad-{unknown}.zip"]) {
    await writeFile(join(f.root, "publication.json"), JSON.stringify({ ...f.publication, artifacts: [artifact] }));
    assert.equal((await packagePorts([f.root])).ready, false, artifact);
  }
  await rm(join(f.root, "publication.json"));
  await writeFile(join(f.parent, "outside.json"), JSON.stringify(f.publication));
  await symlink(join(f.parent, "outside.json"), join(f.root, "publication.json"));
  assert.equal((await packagePorts([f.root])).ready, false);
});
test("apply cannot overwrite a bundle or write inside a selected checkout", async t => {
  const f = await fixture(t);
  await mkdir(f.output);
  await assert.rejects(packagePorts([f.root], { apply: true, output: f.output }), /already exists/);
  await assert.rejects(packagePorts([f.root], { apply: true, output: join(f.root, "bundle") }), /outside/);
  await assert.rejects(packagePorts([f.root], { apply: true }), /requires --output/);
  assert.equal(await exists(join(f.root, "executed")), false);
});
test("failed commands and missing artifacts never become successful release bundles", async t => {
  for (const source of ["process.exit(2)", "console.log('no artifact')"]) {
    const f = await fixture(t, "broken", source);
    const report = await packagePorts([f.root], { apply: true, output: f.output });
    assert.equal(report.ready, false); assert.equal(report.ports[0].status, "failed");
    assert.equal(JSON.parse(await readFile(join(f.output, "manifest.json"))).ready, false);
    assert.equal(await readFile(join(f.output, "SHA256SUMS"), "utf8"), "");
  }
});
test("a successful no-op cannot reuse an existing artifact, even one created just before the run", async t => {
  const f = await fixture(t, "stale", "console.log('no-op')");
  await mkdir(join(f.root, "dist")); await writeFile(join(f.root, "dist/theme-1.2.3.zip"), "old artifact");
  const report = await packagePorts([f.root], { apply: true, output: f.output });
  assert.equal(report.ready, false); assert.match(report.ports[0].error, /stale artifact/);
});
test("a package script changing its publication contract cannot stage a misleading bundle", async t => {
  const f = await fixture(t, "changed", `import {appendFile} from 'node:fs/promises'; await appendFile('publication.json',' ');`);
  const report = await packagePorts([f.root], { apply: true, output: f.output });
  assert.equal(report.ready, false); assert.match(report.ports[0].error, /metadata changed/);
});
test("linked artifacts are not collected", async t => {
  const f = await fixture(t, "linked", `import {mkdir,writeFile,symlink} from 'node:fs/promises'; await mkdir('dist'); await writeFile('secret','not an artifact'); await symlink('../secret','dist/theme-1.2.3.zip');`);
  const report = await packagePorts([f.root], { apply: true, output: f.output });
  assert.equal(report.ready, false); assert.match(report.ports[0].error, /symlinked/);
});
