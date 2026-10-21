import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { discoverPorts } from "../../scripts/sync-ports.mjs";
import { emptySnapshot, loadDiscovery, saveDiscovery } from "../../src/port-snapshot.mjs";
import { scaleFixture } from "./port-scale.mjs";

const documents = async (directory) => (await readdir(join(directory, "data/ports"))).filter((name) => /\.[a-f0-9]{64}\.json$/.test(name)).sort();
const timed = async (run) => { const start = performance.now(); const result = await run(); return { result, ms: performance.now() - start }; };

export async function exerciseScale(directory, { largeImages = false } = {}) {
  const fixture = scaleFixture({ largeImages });
  const { client, store, counters, entries, failures } = fixture;
  const cold = await timed(async () => {
    const result = await discoverPorts(client, emptySnapshot());
    assert.equal(result.snapshot.ports.length, 400); assert.deepEqual(result.warnings, []);
    await saveDiscovery(directory, result, { assetStore: store });
    return result.snapshot;
  });
  const coldRequests = { ...counters }, firstDocuments = await documents(directory);
  assert.equal(firstDocuments.length, 400);
  assert.equal(counters.listing, 4); assert.equal(counters.batches, 4); assert.ok(counters.maxBatches <= 2);
  const indexPath = join(directory, "data/ports.json"), firstIndex = await readFile(indexPath, "utf8");
  assert.ok(Buffer.byteLength(firstIndex) < 1024 * 1024, "the metadata index stays below 1 MiB for this representative fixture");
  assert.ok(JSON.parse(firstIndex).ports.every((p) => !p.readme && !p.guide && !p.files));
  const firstTime = (await stat(indexPath)).mtimeMs;
  fixture.reset();
  const unchanged = await timed(async () => {
    const previous = await loadDiscovery(directory);
    const result = await discoverPorts(client, previous);
    assert.equal(result.assets.size, 0);
    assert.equal(await saveDiscovery(directory, result, { assetStore: store }), false);
  });
  assert.deepEqual({ listing: counters.listing, batches: counters.batches, files: counters.files, head: counters.head, put: counters.put }, { listing: 4, batches: 4, files: 0, head: 0, put: 0 });
  assert.equal((await stat(indexPath)).mtimeMs, firstTime);
  assert.deepEqual(await documents(directory), firstDocuments);
  const unchangedRequests = { ...counters };

  for (const index of [1, 2, 3, 4]) entries[index].version++;
  entries[4].invalid = true;
  fixture.reset();
  const updated = await timed(async () => {
    const previous = await loadDiscovery(directory);
    const result = await discoverPorts(client, previous);
    assert.equal(result.warnings.length, 1); assert.match(result.warnings[0], /keeping last working/);
    assert.equal(result.snapshot.ports.find((p) => p.id === entries[4].name).revision, previous.ports.find((p) => p.id === entries[4].name).revision);
    assert.ok(counters.files < 30, "fetch only the four changed repositories, not the other 396");
    await saveDiscovery(directory, result, { assetStore: store });
  });
  const nextDocuments = await documents(directory);
  assert.equal(nextDocuments.filter((name) => !firstDocuments.includes(name)).length, 3);
  assert.equal(firstDocuments.filter((name) => !nextDocuments.includes(name)).length, 3);
  const updateRequests = { ...counters };

  entries[10].optOut = true; entries[10].version++; entries[20].deleted = true;
  const removal = await discoverPorts(client, await loadDiscovery(directory));
  assert.equal(removal.snapshot.ports.length, 398);
  await saveDiscovery(directory, removal, { assetStore: store });
  assert.equal((await documents(directory)).length, 398);
  const accepted = await readFile(indexPath, "utf8");
  failures.graphql = true;
  await assert.rejects(discoverPorts(client, await loadDiscovery(directory)), /GitHub 429/);
  failures.graphql = false; failures.listing = 2;
  await assert.rejects(discoverPorts(client, await loadDiscovery(directory)), /GitHub 503/);
  assert.equal(await readFile(indexPath, "utf8"), accepted, "failed inventory checks cannot publish removals");

  // Restore the complete 400-port state for the independent build/browser acceptance check.
  failures.listing = undefined; entries[10].optOut = false; entries[10].version++; entries[20].deleted = false; entries[4].invalid = false;
  await saveDiscovery(directory, await discoverPorts(client, await loadDiscovery(directory)), { assetStore: store });
  const finalIndex = JSON.parse(await readFile(indexPath, "utf8"));
  return {
    ports: 400, syntheticUnpublishedFixture: true,
    cold: { ms: cold.ms, requests: coldRequests }, unchanged: { ms: unchanged.ms, requests: unchangedRequests },
    changed: { ms: updated.ms, requests: updateRequests, replacedDocuments: 3, retainedInvalidUpdates: 1 },
    removalsAndGlobalFailuresVerified: true,
    catalogBytes: Buffer.byteLength(JSON.stringify(finalIndex, null, 2) + "\n"),
    captureCount: Object.keys(finalIndex.assets.files).length,
    captureBytes: Object.values(finalIndex.assets.files).reduce((sum, size) => sum + size, 0),
    documentBytes: (await Promise.all((await documents(directory)).map(async (name) => (await stat(join(directory, "data/ports", name))).size))).reduce((sum, size) => sum + size, 0),
    discoveryPeakRssBytes: process.resourceUsage().maxRSS * 1024,
  };
}
