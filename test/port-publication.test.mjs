import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { extractPortGuide, guideImagePaths } from "../src/port-readme.mjs";
import { emptySnapshot, loadDiscovery, normalizeSnapshot, saveDiscovery } from "../src/port-snapshot.mjs";

const guide = () => ({ schemaVersion: 1, installation: "Install the theme.", configuration: "Configure it.", compatibility: "Supported application.", links: {} });
const port = (id) => ({ id, name: id, group: "Editors", repositoryName: `living-code-theme/${id}`, repository: `https://github.com/living-code-theme/${id}`, revision: "a".repeat(40), images: [], guideImages: {}, guide: guide(), files: ["theme.conf"], fileUrls: {} });
async function fixture(t) { const dir = await mkdtemp(join(tmpdir(), "living-code-publication-")); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }

test("guide v1 is Markdown content, independent of GitHub tables/dropdowns, with fenced headings and external definitions intact", () => {
  const source = '# Test\n\n## Previews\n<table><tr><td>GitHub only</td></tr></table>\n\n## Installation\n[Settings][settings]\n\n```sh\n## not a heading\n```\n\n## Flavors\n<details><summary>Night</summary>GitHub only</details>\n\n## Configuration\n![Calibration][capture]\n\n## Compatibility\nSupported.\n\n## License\n[settings]: theme.conf\n[capture]: images/example.png "Capture"\n';
  const result = extractPortGuide(source);
  assert.equal(result.schemaVersion, 1);
  assert.match(result.installation, /## not a heading/);
  assert.doesNotMatch(JSON.stringify(result), /GitHub only|<table|<details/);
  assert.deepEqual(result.links.settings, { href: "theme.conf", title: "" });
  assert.deepEqual(guideImagePaths(result), ["images/example.png"]);
});

test("a schema-1 catalog upgrades without adding fallback ports or carrying route tombstones", () => {
  const original = { ...port("test"), readme: "## Installation\nInstall.\n\n## Configuration\nConfigure.\n\n## Compatibility\nSupported.", readmeImages: {} };
  delete original.guide; delete original.guideImages;
  const result = normalizeSnapshot({ schemaVersion: 1, organization: "living-code-theme", ports: [original], migratedSlugs: ["retired", "test"] });
  assert.equal(result.schemaVersion, 2); assert.equal(result.ports.length, 1);
  assert.equal(result.migratedSlugs, undefined); assert.equal(result.ports[0].readme, undefined);
  assert.equal(result.ports[0].guide.installation, "Install.");
});

test("the small index and immutable documents round-trip; only a changed port replaces its document", async (t) => {
  const dir = await fixture(t);
  const snapshot = { ...emptySnapshot(), ports: [port("one"), port("two")] };
  await saveDiscovery(dir, { snapshot, assets: new Map() });
  assert.deepEqual(await loadDiscovery(dir), snapshot);
  const before = JSON.parse(await readFile(join(dir, "data/ports.json")));
  assert.ok(before.ports.every((p) => !p.guide && !p.readme && !p.files));
  await writeFile(join(dir, "data/ports/manual.json"), "keep me");
  snapshot.ports[0].guide.installation = "A reviewed update.";
  await saveDiscovery(dir, { snapshot, assets: new Map() });
  const after = JSON.parse(await readFile(join(dir, "data/ports.json")));
  assert.notEqual(before.ports[0].content, after.ports[0].content);
  assert.equal(before.ports[1].content, after.ports[1].content);
  await assert.rejects(readFile(join(dir, "data", before.ports[0].content)), { code: "ENOENT" });
  assert.equal(await readFile(join(dir, "data/ports/manual.json"), "utf8"), "keep me");
});

test("fingerprints, metadata mismatches and traversal references fail closed before a document is trusted", async (t) => {
  const dir = await fixture(t);
  await saveDiscovery(dir, { snapshot: { ...emptySnapshot(), ports: [port("one")] }, assets: new Map() });
  const indexPath = join(dir, "data/ports.json"), index = JSON.parse(await readFile(indexPath));
  const path = join(dir, "data", index.ports[0].content), original = await readFile(path);
  await writeFile(path, Buffer.concat([original, Buffer.from(" ")]));
  await assert.rejects(loadDiscovery(dir), /fingerprint mismatch/);
  await writeFile(path, original);
  index.ports[0].name = "A mismatch"; await writeFile(indexPath, JSON.stringify(index));
  await assert.rejects(loadDiscovery(dir), /index\/document mismatch/);
  index.ports[0].content = "ports/../../secret.json"; await writeFile(indexPath, JSON.stringify(index));
  await assert.rejects(loadDiscovery(dir), /Invalid port document reference/);
});

test("publication rejects symlinked document targets before writing and does not prune manual files", async (t) => {
  const dir = await fixture(t), snapshot = { ...emptySnapshot(), ports: [port("one")] };
  await saveDiscovery(dir, { snapshot, assets: new Map() });
  const index = await readFile(join(dir, "data/ports.json")), entry = JSON.parse(index).ports[0];
  const outside = join(dir, "outside.json"), path = join(dir, "data", entry.content);
  await writeFile(outside, "not a publication input"); await rm(path); await symlink(outside, path);
  await assert.rejects(saveDiscovery(dir, { snapshot, assets: new Map() }), /symlinked/);
  assert.ok((await readFile(join(dir, "data/ports.json"))).equals(index));
  assert.equal(await readFile(outside, "utf8"), "not a publication input");
  assert.equal((await readdir(join(dir, "public/port-images"))).length, 0);
});
