import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { emptySnapshot, saveDiscovery } from "../scripts/sync-ports.mjs";
import { SNAPSHOT_LIMITS } from "../src/port-snapshot.mjs";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "living-code-cache-capacity-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await saveDiscovery(directory, { snapshot: emptySnapshot(), assets: new Map() });
  return directory;
}
function result(count, size, perPort) {
  const assets = new Map(), ports = [];
  for (let i = 0; i < count; i++) {
    const bytes = Buffer.alloc(size, i);
    const name = `${createHash("sha256").update(bytes).digest("hex")}.webp`;
    assets.set(name, bytes);
    const index = Math.floor(i / perPort);
    ports[index] ??= { id: `app-${index}`, guide: { schemaVersion: 1, installation: "Installation instructions", configuration: "", compatibility: "", links: {} }, images: [], guideImages: {} };
    ports[index].images.push({ src: `/port-images/${name}` });
  }
  return { snapshot: { ...emptySnapshot(), ports }, assets };
}
async function untouched(directory) {
  assert.deepEqual(JSON.parse(await readFile(join(directory, "data/ports.json"))), emptySnapshot());
  assert.deepEqual(await readdir(join(directory, "public/port-images")), []);
  await assert.rejects(stat(join(directory, ".port-discovery.lock")), { code: "ENOENT" });
}

test("optimized image and per-port image budgets are preflighted before any asset or catalog writes", async (t) => {
  const directory = await fixture(t);
  await assert.rejects(saveDiscovery(directory, result(1, SNAPSHOT_LIMITS.assetBytes + 1, 1)), /Cached image exceeds/);
  await untouched(directory);
  await assert.rejects(saveDiscovery(directory, result(5, SNAPSHOT_LIMITS.assetBytes, 5)), /Port images exceed/);
  await untouched(directory);
});

test("the retained image budget bounds aggregate storage even when every port is individually valid", async (t) => {
  const directory = await fixture(t);
  // Model a full store through its metadata interface, without allocating half a GiB in the test runner.
  const count = SNAPSHOT_LIMITS.totalAssetBytes / SNAPSHOT_LIMITS.assetBytes + 1;
  const snapshot = emptySnapshot();
  for (let i = 0; i < count; i++) {
    const port = snapshot.ports[Math.floor(i / 4)] ??= { id: `app-${Math.floor(i / 4)}`, guide: { schemaVersion: 1, installation: "Install", configuration: "", compatibility: "", links: {} }, images: [], guideImages: {} };
    port.images.push({ src: `/port-images/${createHash("sha256").update(String(i)).digest("hex")}.webp` });
  }
  const assetStore = { base: "/port-images/", inspect: async () => ({ size: SNAPSHOT_LIMITS.assetBytes }), put: async () => assert.fail("no writes before capacity validation") };
  await assert.rejects(saveDiscovery(directory, { snapshot, assets: new Map() }, { assetStore }), /Retained images exceed/);
  await untouched(directory);
});

test("a held writer lock is not stolen or removed, and protects publication and pruning together", async (t) => {
  const directory = await fixture(t);
  const path = join(directory, ".port-discovery.lock");
  await writeFile(path, "another writer\n");
  await assert.rejects(saveDiscovery(directory, { snapshot: emptySnapshot(), assets: new Map() }), /Another discovery write/);
  assert.equal(await readFile(path, "utf8"), "another writer\n");
  await rm(path);
  assert.equal(await saveDiscovery(directory, { snapshot: emptySnapshot(), assets: new Map() }), false);
  await untouched(directory);
});

test("cached fingerprints are verified; refreshed content can repair a corrupt retained capture", async (t) => {
  const directory = await fixture(t);
  const valid = result(1, 128, 1);
  await saveDiscovery(directory, valid);
  const [name] = valid.assets.keys();
  const path = join(directory, "public/port-images", name);
  await writeFile(path, "corrupt capture\n");
  await assert.rejects(saveDiscovery(directory, { snapshot: valid.snapshot, assets: new Map() }), /fingerprint mismatch/);
  assert.equal(await saveDiscovery(directory, valid), true);
  assert.ok((await readFile(path)).equals(valid.assets.get(name)));
});
