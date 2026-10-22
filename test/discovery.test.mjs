import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { discoverPorts, emptySnapshot, saveDiscovery } from "../scripts/sync-ports.mjs";
import { githubPorts, GitHubError } from "../scripts/github-ports.mjs";
import { repositoryPath, validateManifest } from "../scripts/port-manifest.mjs";
import { renderPortReadme } from "../scripts/readme-template.mjs";
import { assertSnapshotBudget, loadDiscovery, referencedAssets, SNAPSHOT_LIMITS } from "../src/port-snapshot.mjs";

const SHA = "a".repeat(40);
const screenshot = await sharp({ create: { width: 16, height: 10, channels: 3, background: "#15202b" } }).png().toBuffer();
const manifest = (overrides = {}) => ({ schemaVersion: 1, name: "Neovim", slug: "neovim", group: "Editors", emoji: "📝", flavors: ["night", "frost", "paper", "signal"], images: [{ flavor: "night", path: "images/night.png", alt: "Test fixture screenshot" }], ...overrides });
const fixtureReadme = (meta, configuration = "Configure the application after installation.") => renderPortReadme(meta, {
  installation: "```lua\nrequire('living-code').setup()\n```", configuration, compatibility: "Use an application with color theme support.",
  flavorUsage: Object.fromEntries(meta.flavors.map((id) => [id, `Select ${id} in the application settings.`])),
});
const entry = (name = "nvim", overrides = {}) => {
  const e = {
    repo: { name, full_name: `living-code-theme/${name}`, default_branch: "trunk", private: false, archived: false },
    manifest: manifest(), files: { "images/night.png": screenshot }, ...overrides,
  };
  if (!Object.hasOwn(overrides, "readme")) e.readme = fixtureReadme(e.manifest ?? manifest());
  return e;
};
function clientFor(entries) {
  const reads = [];
  return {
    reads,
    repositories: async () => entries.map((e) => e.repo),
    revision: async (repo) => {
      const e = entries.find((e) => e.repo.full_name === repo.full_name);
      if (e.error) throw e.error;
      return e.revision ?? SHA;
    },
    file: async (repo, sha, path) => {
      reads.push({ repository: repo.full_name, sha, path });
      const e = entries.find((e) => e.repo.full_name === repo.full_name);
      if (path === "port.json") return e.manifest === null ? null : Buffer.from(JSON.stringify(e.manifest));
      if (path === "README.md") return e.readme === null ? null : Buffer.from(e.readme);
      return e.files[path] ?? null;
    },
  };
}

const initial = async () => (await discoverPorts(clientFor([entry()]))).snapshot;

test("manifest schema allows new groups and defaults the slug to the repo name", () => {
  assert.equal(validateManifest(manifest({ slug: undefined, group: "Music players" }), "foobar").slug, "foobar");
  assert.equal(validateManifest(manifest({ images: [] }), "nvim").images.length, 0);
});

test("port emojis are single Unicode graphemes, including variation selectors, modifiers, joined emoji and symbols like π", () => {
  for (const emoji of ["📝", "🐈", "❄️", "👩🏽‍💻", "🇫🇷", "1️⃣", "π", "λ", "∑"]) assert.equal(validateManifest(manifest({ emoji }), "nvim").emoji, emoji);
  for (const emoji of ["", "nvim", "7", "a", "<", "π π", "ππ", "📝🐈", " 📝", "📝 editor", "<script>", "📝\n"]) assert.throws(() => validateManifest(manifest({ emoji }), "nvim"), /emoji/);
  assert.equal(validateManifest(manifest({ emoji: undefined }), "nvim").emoji, undefined, "older manifests remain compatible");
});

test("manifest rejects unknown fields, versions, unsafe paths, duplicate/unshipped flavors and bad URLs", () => {
  for (const change of [
    { schemaVersion: 2 }, { unknown: true }, { description: "Too short" }, { quick: " " }, { group: "  " }, { name: " " }, { slug: "../nvim" }, { slug: "index" },
    { flavors: ["night", "night"] }, { flavors: ["unknown"] }, { homepage: "javascript:alert(1)" }, { homepage: "https://user:pass@example.com" },
    { images: [{ flavor: "night", path: "../secret.png", alt: "x" }] },
    { images: [{ flavor: "night", path: "images/x.svg", alt: "x" }] },
    { files: ["a/../../b"] }, { images: [manifest().images[0], manifest().images[0]] },
    { flavors: ["paper"] },
  ]) assert.throws(() => validateManifest(manifest(change), "nvim"), undefined, JSON.stringify(change));
  for (const path of ["/tmp/a", "a//b", "a/./b", "a/../b", "a%2fb", "a\\b", "https://example.com/x", "a\u0000b"]) assert.throws(() => repositoryPath(path));
});

test("a new repo is discovered without a central registration; README, metadata and images share a commit", async () => {
  const client = clientFor([entry()]);
  const { snapshot, assets, warnings } = await discoverPorts(client);
  assert.equal(warnings.length, 0);
  assert.equal(snapshot.ports.length, 1);
  const port = snapshot.ports[0];
  assert.equal(port.repository, "https://github.com/living-code-theme/nvim");
  assert.equal(port.id, "neovim");
  assert.equal(port.emoji, "📝");
  assert.ok(port.guide.installation.includes("require('living-code')"));
  assert.deepEqual(port.aliases, ["nvim"]);
  assert.match(port.images[0].src, /^\/port-images\/[a-f0-9]{64}\.webp$/);
  assert.equal(port.images[0].width, 16);
  assert.equal(port.images[0].height, 10);
  assert.equal(assets.size, 1, "README and gallery share a cached image");
  assert.deepEqual(new Set(client.reads.map((r) => r.sha)), new Set([SHA]));
  assert.equal(snapshot.migratedSlugs, undefined, "publication carries no growing migration history");
});

test("adding a different port and group extends the snapshot without a code change", async () => {
  const second = entry("music", { manifest: manifest({ slug: "music", name: "Music", group: "Music players", flavors: ["night"] }) });
  const { snapshot } = await discoverPorts(clientFor([entry(), second]));
  assert.deepEqual(snapshot.ports.map((p) => p.id), ["neovim", "music"]);
  assert.deepEqual(snapshot.ports.map((p) => p.group), ["Editors", "Music players"]);
});

test("README-only local images, including raw HTML images, are downloaded from the same repository", async () => {
  const e = entry("nvim", { readme: fixtureReadme(manifest(), '![Extra](images/extra.png)\n<img src="./images/html.png">\n![Badge](https://example.com/badge.svg)') });
  e.files["images/extra.png"] = screenshot;
  e.files["images/html.png"] = screenshot;
  const client = clientFor([e]);
  const { snapshot } = await discoverPorts(client);
  assert.equal(Object.keys(snapshot.ports[0].guideImages).length, 2);
  assert.ok(client.reads.some((r) => r.path === "images/html.png"));
  assert.ok(client.reads.every((r) => !r.path.startsWith("https:")));
});

test("missing manifests are opt-out; incomplete new repositories are reported but not listed", async () => {
  for (const e of [entry("nvim", { manifest: null }), entry("nvim", { readme: null }), entry("nvim", { readme: " " }), entry("nvim", { files: {} })]) {
    const { snapshot } = await discoverPorts(clientFor([e]));
    assert.equal(snapshot.ports.length, 0);
  }
});

test("nonstandard or unfinished READMEs cannot enter a snapshot; bad updates keep the accepted template", async () => {
  const previous = await initial();
  for (const readme of ["# A different README", renderPortReadme(manifest()), fixtureReadme(manifest()).replace('data-lc-flavor="frost"', 'data-lc-flavor="night"')]) {
    const rejected = await discoverPorts(clientFor([entry("nvim", { readme })]));
    assert.equal(rejected.snapshot.ports.length, 0);
    assert.match(rejected.warnings[0], /README/);
    const retained = await discoverPorts(clientFor([entry("nvim", { readme })]), previous, { refresh: true });
    assert.deepEqual(retained.snapshot.ports, previous.ports);
    assert.match(retained.warnings[0], /keeping last working/);
  }
});

test("missing listed files and corrupt images cannot enter a snapshot", async () => {
  for (const e of [entry("nvim", { manifest: manifest({ files: ["colors/missing.lua"] }) }), entry("nvim", { files: { "images/night.png": Buffer.from("not an image") } })]) {
    const result = await discoverPorts(clientFor([e]));
    assert.equal(result.snapshot.ports.length, 0);
    assert.equal(result.warnings.length, 1);
  }
});

test("invalid updates and transient repository failures keep the last working version", async () => {
  const previous = await initial();
  for (const e of [entry("nvim", { manifest: manifest({ schemaVersion: 99 }) }), entry("nvim", { readme: null }), entry("nvim", { error: new Error("timeout") }), entry("nvim", { manifest: manifest({ slug: "changed" }) })]) {
    const result = await discoverPorts(clientFor([e]), previous, { refresh: true });
    assert.deepEqual(result.snapshot.ports, previous.ports);
    assert.match(result.warnings[0], /keeping last working/);
  }
});

test("a complete listing removes archived, deleted or deliberately opted-out ports without resurrecting legacy content", async () => {
  const previous = await initial();
  const archived = entry(); archived.repo.archived = true;
  for (const entries of [[], [archived], [entry("nvim", { manifest: null })]]) {
    const { snapshot } = await discoverPorts(clientFor(entries), previous, { refresh: true });
    assert.equal(snapshot.ports.length, 0);
    assert.equal(snapshot.migratedSlugs, undefined, "removed routes do not accumulate in the index");
  }
});

test("partial listings and global authorization/rate-limit errors abort rather than replacing the snapshot", async () => {
  const previous = await initial();
  const unavailable = clientFor([]); unavailable.repositories = async () => { throw new Error("listing interrupted"); };
  await assert.rejects(discoverPorts(unavailable, previous), /listing interrupted/);
  for (const status of [401, 403, 429]) await assert.rejects(discoverPorts(clientFor([entry("nvim", { error: new GitHubError(status, "/repos/x") })]), previous), new RegExp(String(status)));
});

test("duplicate slugs list neither newcomer; an existing owner keeps its previous version", async () => {
  const duplicate = entry("duplicate");
  const result = await discoverPorts(clientFor([entry(), duplicate]));
  assert.equal(result.snapshot.ports.length, 0);
  assert.match(result.warnings[0], /Duplicate slug/);
  const previous = await initial();
  const update = entry("nvim", { readme: "New unaccepted documentation" });
  const retry = await discoverPorts(clientFor([update, duplicate]), previous);
  assert.deepEqual(retry.snapshot.ports, previous.ports);
});

test("discovery is deterministic", async () => {
  const first = await discoverPorts(clientFor([entry()]));
  const second = await discoverPorts(clientFor([entry()]), first.snapshot);
  assert.deepEqual(second.snapshot, first.snapshot);
});

test("persistence is idempotent, content-addressed and leaves the previous snapshot untouched after failure", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "living-code-discovery-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const result = await discoverPorts(clientFor([entry()]));
  assert.equal(await saveDiscovery(dir, result), true);
  const path = join(dir, "data/ports.json");
  const before = await stat(path);
  assert.equal(await saveDiscovery(dir, result), false);
  assert.equal((await stat(path)).mtimeMs, before.mtimeMs);
  const bytes = await readFile(join(dir, "public", result.snapshot.ports[0].images[0].src));
  assert.equal((await sharp(bytes).metadata()).format, "webp");
  await assert.rejects(saveDiscovery(dir, { snapshot: emptySnapshot(), assets: new Map([["../../escape", screenshot]]) }), /Invalid generated/);
  assert.deepEqual(await loadDiscovery(dir), result.snapshot);
  const index = JSON.parse(await readFile(path));
  assert.equal(index.schemaVersion, 2);
  assert.equal(index.ports[0].guide, undefined);
  assert.match(index.ports[0].content, /^ports\/neovim\.[a-f0-9]{64}\.json$/);
});

test("unchanged commits reuse local content; refresh explicitly revalidates and redownloads it", async () => {
  const previous = await initial();
  const cached = clientFor([entry()]);
  assert.deepEqual((await discoverPorts(cached, previous)).snapshot, previous);
  assert.equal(cached.reads.length, 0);
  const refreshed = clientFor([entry()]);
  assert.deepEqual((await discoverPorts(refreshed, previous, { refresh: true })).snapshot, previous);
  assert.ok(refreshed.reads.some((read) => read.path === "images/night.png"));
});

test("GitHub adapter paginates, pins non-main branches, and uses public immutable blobs without forwarding its token", async () => {
  const requests = [];
  const adapter = githubPorts({ token: "test-token", fetchImpl: async (url, options) => {
    requests.push({ url, options });
    if (new URL(url).searchParams.get("page") === "1") return Response.json(Array.from({ length: 100 }, (_, i) => ({ name: `repo${i}` })));
    if (new URL(url).searchParams.get("page") === "2") return Response.json([{ name: "last" }]);
    if (url.includes("/commits/")) return Response.json({ sha: SHA });
    return new Response(screenshot);
  } });
  assert.equal((await adapter.repositories("living-code-theme")).length, 101);
  const repo = entry().repo;
  assert.equal(await adapter.revision(repo), SHA);
  assert.ok((await adapter.file(repo, SHA, "images/a b.png", 10000)).equals(screenshot));
  assert.ok(requests.some((r) => r.url.endsWith("/commits/trunk")));
  const raw = requests.at(-1);
  assert.equal(raw.url, `https://raw.githubusercontent.com/living-code-theme/nvim/${SHA}/images/a%20b.png`);
  assert.equal(raw.options.headers.Accept, "application/octet-stream");
  assert.equal(raw.options.redirect, "error");
  assert.equal(raw.options.headers.Authorization, undefined);
  assert.ok(requests.filter((r) => r.url.startsWith("https://api.github.com/")).every((r) => r.options.headers.Authorization === "Bearer test-token"));
});

test("GitHub adapter distinguishes a missing manifest from server errors and bounds response size", async () => {
  const repo = entry().repo;
  const missing = githubPorts({ fetchImpl: async () => new Response(null, { status: 404 }) });
  assert.equal(await missing.file(repo, SHA, "port.json", 100), null);
  const failed = githubPorts({ fetchImpl: async () => new Response(null, { status: 503 }) });
  await assert.rejects(failed.file(repo, SHA, "port.json", 100), /GitHub 503/);
  const big = githubPorts({ fetchImpl: async () => new Response("x".repeat(1000)) });
  await assert.rejects(big.file(repo, SHA, "port.json", 100), /exceeds/);
});

test("image updates replace current captures instead of accumulating history", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "living-code-cache-lifecycle-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let result = await discoverPorts(clientFor([entry()]));
  await saveDiscovery(dir, result);
  const cache = join(dir, "public/port-images");
  await writeFile(join(cache, ".gitkeep"), "");
  await writeFile(join(cache, "manual.webp"), "not generated");
  const target = join(dir, "outside.txt");
  await writeFile(target, "keep me");
  await symlink(target, join(cache, `${"f".repeat(64)}.webp`));
  for (let i = 1; i <= 4; i++) {
    const image = await sharp({ create: { width: 16, height: 10, channels: 3, background: `rgb(${i * 30},32,43)` } }).png().toBuffer();
    result = await discoverPorts(clientFor([entry("nvim", { revision: String(i).repeat(40), files: { "images/night.png": image } })]), result.snapshot);
    assert.equal(await saveDiscovery(dir, result), true);
    const managed = (await readdir(cache)).filter((name) => referencedAssets(result.snapshot).has(name));
    assert.equal(managed.length, 1);
    assert.equal((await readdir(cache)).length, 4, "one current capture, two manual files and an untouched symlink");
  }
  assert.equal(await readFile(target, "utf8"), "keep me");
  assert.equal(await readFile(join(cache, "manual.webp"), "utf8"), "not generated");
  assert.equal(await saveDiscovery(dir, result), false);
});

test("shared captures and fallback ports survive pruning; an opted-out port leaves no orphan captures", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "living-code-cache-sharing-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const other = entry("other", { manifest: manifest({ name: "Other", slug: "other" }) });
  const first = await discoverPorts(clientFor([entry(), other]));
  await saveDiscovery(dir, first);
  const fallback = await discoverPorts(clientFor([entry("nvim", { manifest: null }), { ...other, error: new Error("timeout") }]), first.snapshot, { refresh: true });
  await saveDiscovery(dir, fallback);
  assert.equal(fallback.snapshot.ports.length, 1);
  assert.equal((await readdir(join(dir, "public/port-images"))).length, 1);
  const removed = await discoverPorts(clientFor([]), fallback.snapshot);
  await saveDiscovery(dir, removed);
  assert.equal(removed.snapshot.migratedSlugs, undefined);
  assert.deepEqual(await readdir(join(dir, "public/port-images")), []);
});

test("oversized README updates retain the last working port, and catalog/count budgets fail closed", async () => {
  const first = await initial();
  const readme = fixtureReadme(manifest(), "x".repeat(SNAPSHOT_LIMITS.readmeBytes));
  const retry = await discoverPorts(clientFor([entry("nvim", { readme })]), first, { refresh: true });
  assert.deepEqual(retry.snapshot.ports, first.ports);
  assert.match(retry.warnings[0], /README exceeds/);
  assert.throws(() => assertSnapshotBudget({ ...first, ports: Array(SNAPSHOT_LIMITS.ports + 1).fill(first.ports[0]) }), /exceeds 1000 ports/);
  const ports = Array.from({ length: 100 }, (_, i) => ({ ...first.ports[0], id: `app-${i}`, quick: "x".repeat(32 * 1024) }));
  assert.throws(() => assertSnapshotBudget({ ...first, ports }), /Catalog exceeds/);
});

test("invalid cache references, oversized catalogs and missing retained assets cannot replace a saved snapshot", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "living-code-cache-failure-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const first = await discoverPorts(clientFor([entry()]));
  await saveDiscovery(dir, first);
  const before = await readFile(join(dir, "data/ports.json"), "utf8");
  const bad = structuredClone(first.snapshot);
  bad.ports[0].images[0].src = "/port-images/../../escape.webp";
  await assert.rejects(saveDiscovery(dir, { snapshot: bad, assets: new Map() }), /Invalid cached image/);
  const large = structuredClone(first.snapshot);
  large.ports[0].guide.installation = "x".repeat(2 * SNAPSHOT_LIMITS.readmeBytes + 1);
  await assert.rejects(saveDiscovery(dir, { snapshot: large, assets: new Map() }), /Guide exceeds/);
  const absent = structuredClone(first.snapshot);
  const name = `${"b".repeat(64)}.webp`;
  absent.ports[0].images[0].src = `/port-images/${name}`;
  await assert.rejects(saveDiscovery(dir, { snapshot: absent, assets: new Map() }), /Missing retained image/);
  assert.equal(await readFile(join(dir, "data/ports.json"), "utf8"), before);
  assert.equal((await readdir(join(dir, "public/port-images"))).length, 1);
});

test("a symlinked image-cache directory is never followed for cleanup", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "living-code-cache-symlink-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "public"));
  await mkdir(join(dir, "external"));
  const name = `${"c".repeat(64)}.webp`;
  await writeFile(join(dir, "external", name), "keep me");
  await symlink(join(dir, "external"), join(dir, "public/port-images"));
  await assert.rejects(saveDiscovery(dir, { snapshot: emptySnapshot(), assets: new Map() }), /must not be a symlink/);
  assert.equal(await readFile(join(dir, "external", name), "utf8"), "keep me");
});

test("repository pagination has a hard bound, rather than allowing an endless full-page response", async () => {
  let pages = 0;
  const adapter = githubPorts({ fetchImpl: async () => { pages++; return Response.json(Array.from({ length: 100 }, (_, i) => ({ name: `repo-${i}` }))); } });
  await assert.rejects(adapter.repositories("living-code-theme"), /listing exceeds 2000/);
  assert.equal(pages, 21);
});
