#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";
import sharp from "sharp";
import { githubPorts, LIMITS } from "./github-ports.mjs";
import { FLAVORS, repositoryPath, validateManifest } from "./port-manifest.mjs";
import { extractPortGuide, guideImagePaths, validateReadmeTemplate } from "../src/port-readme.mjs";
import { concurrent } from "../src/concurrent.mjs";
import { r2Assets } from "../src/port-assets.mjs";
import { landingCheckout } from "../src/landing-checkout.mjs";
import { assertPortBudget, assertSnapshotBudget, emptySnapshot, loadDiscovery, normalizeSnapshot, ORGANIZATION, referencedAssets, saveDiscovery, SNAPSHOT_LIMITS } from "../src/port-snapshot.mjs";
export { emptySnapshot, loadDiscovery, ORGANIZATION, saveDiscovery } from "../src/port-snapshot.mjs";
const text = (bytes) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");

async function portAtRevision(client, repo, previous, refresh, assetBase) {
  const revision = await client.revision(repo);
  if (revision === null) return null; // An explicitly empty repository has no port to publish.
  if (!refresh && previous?.revision === revision) return { port: previous, assets: new Map() };
  const descriptor = await client.file(repo, revision, "port.json", LIMITS.manifest);
  if (descriptor === null) return null; // Removing port.json is an explicit opt-out.
  const meta = validateManifest(JSON.parse(text(descriptor)), repo.name);
  if (previous && previous.id !== meta.slug) throw new Error("Changing a published slug requires an explicit route migration");
  const source = await client.file(repo, revision, "README.md", LIMITS.readme);
  if (!source || !text(source).trim()) throw new Error("A non-empty root README.md is required");
  const readme = text(source);
  if (source.length > LIMITS.readme) throw new Error(`README exceeds ${LIMITS.readme} bytes`);
  validateReadmeTemplate(readme, meta);
  const guide = extractPortGuide(readme);
  const guidePaths = guideImagePaths(guide);
  const paths = new Set([...meta.images.map((i) => i.path), ...guidePaths.filter((p) => /\.(png|jpe?g|webp)$/i.test(p))]);
  if (paths.size > 24) throw new Error("At most 24 local README and gallery images are allowed");
  const assets = new Map();
  const images = {};
  for (const path of paths) {
    repositoryPath(path);
    const bytes = await client.file(repo, revision, path, LIMITS.image);
    if (!bytes) throw new Error(`Missing image: ${path}`);
    const input = sharp(bytes, { limitInputPixels: 20_000_000, animated: false });
    const metadata = await input.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format) || !metadata.width || !metadata.height || metadata.width > 16_384 || metadata.height > 16_384) throw new Error(`Invalid or oversized raster image: ${path}`);
    // Decode before accepting the update. Corrupt images cannot break a later Astro build.
    const { data, info } = await input.rotate().resize({ width: 2560, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    const name = `${digest(data)}.webp`;
    if (data.length > SNAPSHOT_LIMITS.assetBytes) throw new Error(`Optimized image exceeds ${SNAPSHOT_LIMITS.assetBytes} bytes: ${path}`);
    assets.set(name, data);
    if ([...assets.values()].reduce((sum, bytes) => sum + bytes.length, 0) > SNAPSHOT_LIMITS.portAssetBytes) throw new Error(`Port images exceed ${SNAPSHOT_LIMITS.portAssetBytes} bytes`);
    images[path] = { src: `${assetBase}${name}`, width: info.width, height: info.height };
  }
  const files = meta.files ?? [];
  for (const path of files) {
    if (await client.file(repo, revision, path, 1024 * 1024) === null) throw new Error(`Missing listed file: ${path}`);
  }
  return {
    port: {
      id: meta.slug, name: meta.name, group: meta.group.trim(),
      description: meta.description ?? `Living Code color scheme for ${meta.name}. Installation instructions and real application screenshots.`,
      homepage: meta.homepage ?? null, quick: meta.quick ?? "See README installation instructions",
      aliases: [...new Set([repo.name, ...(meta.aliases ?? [])])], icon: meta.icon ?? null, emoji: meta.emoji ?? null,
      flavors: FLAVORS.filter((flavor) => meta.flavors.includes(flavor)), files, guide,
      repository: `https://github.com/${repo.full_name}`, repositoryName: repo.full_name,
      revision, readmeUrl: `https://github.com/${repo.full_name}/blob/${revision}/README.md`,
      fileUrls: Object.fromEntries(files.map((path) => [path, `https://github.com/${repo.full_name}/blob/${revision}/${encodePath(path)}`])),
      images: meta.images.map((image) => ({ flavor: image.flavor, alt: image.alt, ...images[image.path] })),
      guideImages: Object.fromEntries(guidePaths.filter((path) => images[path]).map((path) => [path, images[path]])),
    }, assets,
  };
}

/** All-or-nothing discovery of each port. A complete listing is required before any removals. */
export async function discoverPorts(client, previous = emptySnapshot(), { organization = ORGANIZATION, refresh = false, concurrency = 4, assetBase } = {}) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(organization)) throw new Error("Invalid organization");
  previous = normalizeSnapshot(previous);
  if (previous.organization !== organization) throw new Error("Unsupported or mismatched previous snapshot");
  // Listing and batched heads must be complete before any removals or changed content are accepted.
  const repositories = await client.repositories(organization);
  if (repositories.length > LIMITS.repositories) throw new Error(`Repository listing exceeds ${LIMITS.repositories} entries; discovery aborted`);
  const active = repositories.filter((repo) => !repo.private && !repo.archived && !repo.disabled);
  const names = new Set();
  for (const repo of active) {
    if (!repo.full_name || repo.full_name.toLowerCase() !== `${organization}/${repo.name}`.toLowerCase() || !/^[A-Za-z0-9_.-]+$/.test(repo.name) || names.has(repo.full_name.toLowerCase())) throw new Error("Unexpected or duplicate repository in GitHub listing");
    names.add(repo.full_name.toLowerCase());
  }
  await client.revisions?.(active);
  const previousByRepo = new Map(previous.ports.map((p) => [p.repositoryName.toLowerCase(), p]));
  const candidates = [], warnings = [], assets = new Map(), stagedAssets = new Map();
  let preparedImageBytes = 0, documentBytes = 0, candidateCount = 0;
  const updates = await concurrent(active, concurrency, async (repo) => {
    const old = previousByRepo.get(repo.full_name.toLowerCase());
    let candidate, warning, bytes = 0;
    try {
      candidate = await portAtRevision(client, repo, old, refresh, assetBase ?? previous.assets.base);
      if (candidate) bytes = Buffer.byteLength(assertPortBudget(candidate.port, previous.assets));
    } catch (error) {
      if ([401, 403, 429].includes(error.status)) throw error;
      warning = `${repo.full_name}: ${error.message}${old ? "; keeping last working snapshot" : "; not listed"}`;
      if (old) { candidate = { port: old, assets: new Map() }; bytes = Buffer.byteLength(assertPortBudget(old, previous.assets)); }
      else candidate = undefined;
    }
    if (candidate) {
      documentBytes += bytes;
      if (++candidateCount > SNAPSHOT_LIMITS.ports || documentBytes > SNAPSHOT_LIMITS.totalDocumentBytes) throw new Error("Discovery document budget exceeded; previous snapshot retained");
      for (const [name, bytes] of candidate.assets) {
        if (stagedAssets.has(name)) candidate.assets.set(name, stagedAssets.get(name));
        else { stagedAssets.set(name, bytes); preparedImageBytes += bytes.length; }
      }
      if (preparedImageBytes > SNAPSHOT_LIMITS.totalAssetBytes) throw new Error("Discovery image budget exceeded; previous snapshot retained");
    }
    return { candidate, warning };
  });
  for (const { candidate, warning } of updates) {
    if (candidate) candidates.push(candidate);
    if (warning) warnings.push(warning);
  }
  const bySlug = new Map();
  for (const candidate of candidates) {
    const list = bySlug.get(candidate.port.id) ?? [];
    list.push(candidate);
    bySlug.set(candidate.port.id, list);
  }
  const ports = [];
  for (const [slug, matches] of bySlug) {
    if (matches.length > 1) {
      warnings.push(`Duplicate slug ${slug}: ${matches.map((m) => m.port.repositoryName).join(", ")}; no conflicting updates accepted`);
      const old = previous.ports.find((p) => p.id === slug);
      if (old) ports.push(old);
      continue;
    }
    ports.push(matches[0].port);
    for (const [name, bytes] of matches[0].assets) assets.set(name, bytes);
  }
  ports.sort((a, b) => a.group.localeCompare(b.group, "en") || a.id.localeCompare(b.id, "en"));
  const snapshot = {
    schemaVersion: 2, organization, ports,
    assets: { base: previous.assets.base, files: { ...previous.assets.files, ...Object.fromEntries([...assets].map(([name, bytes]) => [name, bytes.length])) } },
  };
  const retained = referencedAssets(snapshot);
  snapshot.assets.files = Object.fromEntries(Object.entries(snapshot.assets.files).filter(([name]) => retained.has(name)));
  assertSnapshotBudget(snapshot);
  return { snapshot, assets, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: {
    landing: { type: "string" }, "dry-run": { type: "boolean" }, refresh: { type: "boolean" }, r2: { type: "boolean" },
  } });
  const directory = await landingCheckout(values.landing);
  const previous = await loadDiscovery(directory);
  const assetStore = values.r2 ? r2Assets({ accountId: process.env.R2_ACCOUNT_ID, bucket: process.env.R2_BUCKET, accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY, publicBase: process.env.R2_PUBLIC_URL }) : undefined;
  const result = await discoverPorts(githubPorts(), previous, { refresh: values.refresh });
  for (const warning of result.warnings) console.warn(warning);
  const format = values["dry-run"] ? await readFile(join(directory, "data/ports.json"), "utf8").then((s) => JSON.parse(s).schemaVersion).catch((e) => { if (e.code !== "ENOENT") throw e; return 0; }) : 2;
  const changed = values["dry-run"] ? format !== 2 || (assetStore && assetStore.base !== previous.assets.base) || !isDeepStrictEqual(previous, result.snapshot) : await saveDiscovery(directory, result, { assetStore });
  console.log(`${result.snapshot.ports.length} discovered ports; ${result.warnings.length} warnings; ${changed ? "catalog/cache changed" : "no changes"}${values["dry-run"] ? " (dry run)" : ""}`);
}
