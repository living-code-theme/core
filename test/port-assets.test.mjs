import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { assetBase, r2Assets, sha256 } from "../src/port-assets.mjs";
import { emptySnapshot, loadDiscovery, saveDiscovery } from "../src/port-snapshot.mjs";
import { discoverPorts } from "../scripts/sync-ports.mjs";
import { localPortSnapshot } from "../scripts/preview-port.mjs";
import { renderPortReadme } from "../scripts/readme-template.mjs";
import { scaleFixture } from "./fixtures/port-scale.mjs";

async function fixture(t) { const dir = await mkdtemp(join(tmpdir(), "living-code-asset-store-")); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }

test("external storage is explicit, HTTPS-only and cannot send credentials to repository-selected hosts", () => {
  for (const value of ["http://example.com/", "https://user:secret@example.com/", "https://example.com/?token=x", "https://example.com/no-slash"]) assert.throws(() => assetBase(value));
  assert.throws(() => r2Assets({}), /Configure R2/);
  assert.equal(assetBase("https://assets.example.com/port-images/"), "https://assets.example.com/port-images/");
});

test("R2 requests use scoped AWS4 signatures, bounded integrity checks and no redirects", async () => {
  const bytes = Buffer.from("verified immutable content"), name = `${sha256(bytes)}.webp`, calls = [];
  const store = r2Assets({ accountId: "0".repeat(32), bucket: "captures", accessKeyId: "test-key", secretAccessKey: "test-secret", publicBase: "https://assets.example.com/port-images/", now: () => new Date("2026-01-02T03:04:05.000Z"), fetchImpl: async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.redirect, "error");
    assert.match(options.headers.authorization, /^AWS4-HMAC-SHA256 Credential=test-key\/20260102\/auto\/s3\/aws4_request, SignedHeaders=.+, Signature=[a-f0-9]{64}$/);
    assert.equal(options.headers["x-amz-date"], "20260102T030405Z");
    return options.method === "HEAD" ? new Response(null) : new Response(bytes);
  } });
  assert.deepEqual(await store.inspect(name), { size: bytes.length }, "a legacy object without checksum metadata is downloaded and hashed");
  assert.deepEqual(calls.map((call) => call.options.method), ["HEAD", "GET"]);
  await store.put(name, bytes);
  assert.equal(calls.at(-1).options.headers["x-amz-meta-sha256"], name.slice(0, 64));
  assert.equal(calls.at(-1).options.headers["x-amz-content-sha256"], sha256(bytes));
  assert.ok(calls.every((call) => call.url === `https://${"0".repeat(32)}.r2.cloudflarestorage.com/captures/port-images/${name}`));
  await assert.rejects(store.put(name, Buffer.from("wrong")), /fingerprint mismatch/);
});

test("failed uploads preserve the old index and captures; successful migration keeps new capture bytes out of Git", async (t) => {
  const dir = await fixture(t), remote = scaleFixture({ count: 2 });
  const initial = await discoverPorts(remote.client);
  await saveDiscovery(dir, initial);
  const before = await readFile(join(dir, "data/ports.json"));
  const count = (await readdir(join(dir, "public/port-images"))).length;
  assert.ok(count > 0);
  remote.failures.upload = true;
  await assert.rejects(saveDiscovery(dir, { snapshot: await loadDiscovery(dir), assets: new Map() }, { assetStore: remote.store }), /R2 PUT failed/);
  assert.ok((await readFile(join(dir, "data/ports.json"))).equals(before));
  assert.equal((await readdir(join(dir, "public/port-images"))).length, count);
  remote.failures.upload = false;
  await saveDiscovery(dir, { snapshot: await loadDiscovery(dir), assets: new Map() }, { assetStore: remote.store });
  const migrated = await loadDiscovery(dir);
  assert.equal(migrated.assets.base, remote.store.base);
  assert.equal((await readdir(join(dir, "public/port-images"))).length, 0);
  assert.equal(remote.objects.size, count);
  remote.reset();
  assert.equal(await saveDiscovery(dir, { snapshot: migrated, assets: new Map() }, { assetStore: remote.store }), false);
  assert.equal(remote.counters.head + remote.counters.get + remote.counters.put, 0, "immutable previously published objects require no poll traffic");
  await saveDiscovery(dir, { snapshot: emptySnapshot(), assets: new Map() }, { assetStore: remote.store });
  assert.equal(remote.objects.size, count, "do not break old deployments by deleting their immutable URLs");
});

test("a local preview over an external catalog freezes only its own new captures and never uploads or fetches existing remote assets", async (t) => {
  const dir = await fixture(t), remote = scaleFixture({ count: 3 });
  await saveDiscovery(dir, await discoverPorts(remote.client), { assetStore: remote.store });
  const source = await readFile(join(dir, "data/ports.json"));
  const preview = join(dir, "preview"); await mkdir(preview); await cp(join(dir, "data"), join(preview, "data"), { recursive: true });
  const name = remote.entries[1].name, draft = join(dir, "draft", name); await mkdir(join(draft, "images"), { recursive: true });
  const manifest = { schemaVersion: 1, name: "Draft", slug: name, emoji: "🧪", group: "Editors", flavors: ["night"], images: [{ flavor: "night", path: "images/night.png", alt: "Synthetic preview fixture" }], files: ["theme.conf"] };
  await writeFile(join(draft, "port.json"), JSON.stringify(manifest));
  await writeFile(join(draft, "theme.conf"), "a local draft");
  await writeFile(join(draft, "README.md"), renderPortReadme(manifest, { installation: "Install the local draft.", configuration: "Configure.", compatibility: "Synthetic.", flavorUsage: { night: "Select Night." } }));
  await writeFile(join(draft, "images/night.png"), await sharp({ create: { width: 16, height: 10, channels: 3, background: "#00a692" } }).png().toBuffer());
  remote.reset();
  const result = await localPortSnapshot(draft, await loadDiscovery(dir));
  await saveDiscovery(preview, result, { preview: true });
  const saved = await loadDiscovery(preview);
  assert.ok(saved.ports.find((p) => p.id === name).images.every((image) => image.src.startsWith("/port-images/")));
  assert.ok(saved.ports.find((p) => p.id === remote.entries[2].name).images.every((image) => image.src.startsWith(remote.store.base)));
  assert.equal(remote.counters.head + remote.counters.get + remote.counters.put + remote.counters.files, 0);
  assert.equal((await readdir(join(preview, "public/port-images"))).length, 1);
  assert.ok((await readFile(join(dir, "data/ports.json"))).equals(source));
});
