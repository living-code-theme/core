// Versioned publication: a small index plus immutable, independently updated port documents.
import assert from "node:assert/strict";
import { lstat, mkdir, open, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { assetBase, assetName, ASSET_BYTES, ASSET_NAME, checkAsset, localAssets, sha256 } from "./port-assets.mjs";
import { concurrent } from "./concurrent.mjs";
import { extractPortGuide, guideImagePaths } from "./port-readme.mjs";

export const ORGANIZATION = "living-code-theme";
export const emptySnapshot = () => ({ schemaVersion: 2, organization: ORGANIZATION, assets: { base: "/port-images/", files: {} }, ports: [] });
export const SNAPSHOT_LIMITS = Object.freeze({
  ports: 1000, catalogBytes: 2 * 1024 * 1024, documentBytes: 512 * 1024,
  totalDocumentBytes: 128 * 1024 * 1024, readmeBytes: 64 * 1024,
  assetBytes: ASSET_BYTES, portAssetBytes: 8 * 1024 * 1024, totalAssetBytes: 512 * 1024 * 1024,
});
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const documentName = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.([a-f0-9]{64})\.json$/;
const missing = (error) => { if (error.code !== "ENOENT") throw error; return null; };
const serialize = (value) => JSON.stringify(value, null, 2) + "\n";
const indexKeys = ["id", "name", "group", "description", "homepage", "quick", "aliases", "icon", "emoji", "flavors", "images", "repository", "repositoryName", "revision", "readmeUrl"];
const summary = (port) => Object.fromEntries(indexKeys.filter((key) => Object.hasOwn(port, key)).map((key) => [key, port[key]]));

export function validateGuide(guide) {
  if (guide?.schemaVersion !== 1 || !["installation", "configuration", "compatibility"].every((key) => typeof guide[key] === "string") || !guide.links || typeof guide.links !== "object" || Array.isArray(guide.links)) throw new Error("Unsupported published guide schema");
  for (const link of Object.values(guide.links)) if (!link || typeof link.href !== "string" || typeof link.title !== "string") throw new Error("Invalid published guide reference");
  if (Buffer.byteLength(serialize(guide)) > 2 * SNAPSHOT_LIMITS.readmeBytes) throw new Error(`Guide exceeds ${2 * SNAPSHOT_LIMITS.readmeBytes} serialized bytes`);
  return guide;
}

/** Read compatibility is format-only: never merge a fallback catalog or invent a port. */
export function normalizeSnapshot(snapshot) {
  if (snapshot?.schemaVersion === 1 && Array.isArray(snapshot.ports)) {
    return {
      ...emptySnapshot(), organization: snapshot.organization,
      ports: snapshot.ports.map(({ readme, readmeImages = {}, ...port }) => {
        const guide = extractPortGuide(readme);
        const paths = new Set(guideImagePaths(guide));
        return { ...port, guide, guideImages: Object.fromEntries(Object.entries(readmeImages).filter(([path]) => paths.has(path))) };
      }),
    };
  }
  if (snapshot?.schemaVersion !== 2 || !Array.isArray(snapshot.ports) || !snapshot.assets || !snapshot.assets.files || typeof snapshot.assets.files !== "object" || Array.isArray(snapshot.assets.files)) throw new Error("Unsupported port snapshot schema");
  assetBase(snapshot.assets.base);
  return snapshot;
}

export function referencedAssets(snapshot) {
  const base = assetBase(snapshot.assets?.base);
  const names = new Set();
  for (const port of snapshot.ports) for (const image of [...port.images, ...Object.values(port.guideImages ?? {})]) {
    names.add(assetName(image.src, base));
  }
  return names;
}

export function assertPortBudget(port, assets = { base: "/port-images/" }) {
  if (!slug.test(port.id) || port.id.length > 64) throw new Error("Invalid published port slug");
  validateGuide(port.guide);
  if (referencedAssets({ assets, ports: [port] }).size > 24) throw new Error(`Too many cached images: ${port.id}`);
  const document = serialize({ schemaVersion: 1, port });
  if (Buffer.byteLength(document) > SNAPSHOT_LIMITS.documentBytes) throw new Error(`Port document exceeds ${SNAPSHOT_LIMITS.documentBytes} bytes: ${port.id}`);
  return document;
}

function publication(snapshot, sizes = snapshot.assets.files) {
  if (snapshot.ports.length > SNAPSHOT_LIMITS.ports) throw new Error(`Catalog exceeds ${SNAPSHOT_LIMITS.ports} ports; review its capacity before expanding it`);
  if (new Set(snapshot.ports.map((p) => p.id)).size !== snapshot.ports.length) throw new Error("Duplicate slug in published snapshot");
  const documents = new Map(); let totalBytes = 0;
  const ports = snapshot.ports.map((port) => {
    const content = assertPortBudget(port, snapshot.assets);
    totalBytes += Buffer.byteLength(content);
    const path = `${port.id}.${sha256(content)}.json`;
    documents.set(path, content);
    return { ...summary(port), content: `ports/${path}` };
  });
  if (totalBytes > SNAPSHOT_LIMITS.totalDocumentBytes) throw new Error("Port document budget exceeded; previous snapshot retained");
  const files = Object.fromEntries([...referencedAssets(snapshot)].sort().filter((name) => Object.hasOwn(sizes, name)).map((name) => [name, sizes[name]]));
  const index = { schemaVersion: 2, organization: snapshot.organization, assets: { base: assetBase(snapshot.assets.base), files }, ports };
  const content = serialize(index);
  if (Buffer.byteLength(content) > SNAPSHOT_LIMITS.catalogBytes) throw new Error(`Catalog exceeds ${SNAPSHOT_LIMITS.catalogBytes} bytes; previous snapshot retained`);
  return { index, content, documents };
}
export const assertSnapshotBudget = (snapshot) => publication(snapshot).content;

async function readRegular(path, limit) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > limit) throw new Error(`Missing, symlinked or oversized publication input: ${path}`);
  const bytes = await readFile(path);
  if (bytes.length > limit) throw new Error(`Oversized publication input: ${path}`);
  return bytes;
}

export async function loadDiscovery(directory) {
  const bytes = await readRegular(join(directory, "data/ports.json"), SNAPSHOT_LIMITS.totalDocumentBytes).catch(missing);
  if (!bytes) return emptySnapshot();
  const index = JSON.parse(bytes);
  if (index.schemaVersion === 1) return normalizeSnapshot(index);
  if (index.schemaVersion !== 2 || !Array.isArray(index.ports) || index.ports.length > SNAPSHOT_LIMITS.ports || bytes.length > SNAPSHOT_LIMITS.catalogBytes) throw new Error("Unsupported or oversized port index");
  const root = join(directory, "data/ports");
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Port documents directory must not be a symlink");
  const ports = await concurrent(index.ports, 8, async (entry) => {
    const name = entry.content?.startsWith("ports/") ? entry.content.slice(6) : "";
    const match = documentName.exec(name);
    if (!match || match[1] !== entry.id) throw new Error("Invalid port document reference");
    const bytes = await readRegular(join(root, name), SNAPSHOT_LIMITS.documentBytes);
    if (sha256(bytes) !== match[2]) throw new Error(`Port document fingerprint mismatch: ${entry.id}`);
    const body = JSON.parse(bytes);
    if (body.schemaVersion !== 1) throw new Error("Unsupported port document schema");
    const { content, ...meta } = entry;
    assert.deepEqual(summary(body.port), meta, "Port index/document mismatch");
    return body.port;
  });
  const snapshot = normalizeSnapshot({ ...index, ports });
  assertSnapshotBudget(snapshot);
  return snapshot;
}

async function ownedDirectory(base, parts) {
  let directory = base;
  for (const part of parts) {
    directory = join(directory, part);
    await mkdir(directory).catch((error) => { if (error.code !== "EEXIST") throw error; });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Cache directory must not be a symlink: ${directory}`);
  }
  return directory;
}
async function atomicWrite(path, content) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, content, { flag: "wx" });
  await rename(temporary, path);
}

/** Immutable documents/assets first; the small index is the single publication pointer, replaced last. */
export async function saveDiscovery(directory, result, { assetStore, preview = false } = {}) {
  const path = join(directory, ".port-discovery.lock");
  const lock = await open(path, "wx").catch((error) => {
    if (error.code === "EEXIST") throw new Error(`Another discovery write holds ${path}; retry, or remove a stale lock only after checking its process`);
    throw error;
  });
  try {
    await lock.writeFile(`${process.pid}\n`);
    return await persistDiscovery(directory, result, assetStore, preview);
  } finally { await lock.close(); await unlink(path).catch(missing); }
}

async function persistDiscovery(directory, { snapshot: input, assets }, providedStore, preview) {
  let snapshot = normalizeSnapshot(input);
  assertSnapshotBudget(snapshot);
  for (const [name, bytes] of assets) checkAsset(name, bytes);
  const base = resolve(directory);
  const data = await ownedDirectory(base, ["data"]);
  const documents = await ownedDirectory(base, ["data", "ports"]);
  const cache = await ownedDirectory(base, ["public", "port-images"]);
  const local = localAssets(cache);
  const previous = await readRegular(join(data, "ports.json"), SNAPSHOT_LIMITS.totalDocumentBytes).then((b) => JSON.parse(b)).catch(missing);
  let store = providedStore ?? local;
  const localNames = new Set(snapshot.ports.flatMap((p) => [...p.images, ...Object.values(p.guideImages)]).filter((image) => image.src.startsWith("/port-images/")).map((image) => assetName(image.src)));
  if (preview && snapshot.assets.base !== local.base) {
    if (providedStore) throw new Error("Local previews must not publish external assets");
    store = { base: snapshot.assets.base, put: local.put, async inspect(name) {
      if (localNames.has(name)) return local.inspect(name);
      const size = previous?.assets?.files?.[name];
      if (!Number.isSafeInteger(size) || size <= 0 || size > ASSET_BYTES) throw new Error("Preview requires previously published immutable asset metadata");
      return { size };
    } };
  } else if (!providedStore && snapshot.assets.base !== store.base) throw new Error("Configure the catalog's external asset store before synchronizing it");
  if (!preview && (store.base !== snapshot.assets.base || (store.base !== local.base && localNames.size))) {
    const before = snapshot.assets.base;
    const image = (value) => ({ ...value, src: store.base + assetName(value.src, before) });
    snapshot = { ...snapshot, assets: { base: assetBase(store.base), files: {} }, ports: snapshot.ports.map((p) => ({ ...p, images: p.images.map(image), guideImages: Object.fromEntries(Object.entries(p.guideImages).map(([path, value]) => [path, image(value)])) })) };
  }
  const names = referencedAssets(snapshot);
  const prepared = await concurrent([...names], 8, async (name) => {
    const incoming = assets.get(name);
    // R2 keys are immutable and were verified at publication. Unchanged objects need no network requests per poll.
    const known = previous?.schemaVersion === 2 && previous.assets?.base === store.base && previous.assets.files?.[name];
    if (store.immutable && !incoming && Number.isSafeInteger(known) && known > 0 && known <= ASSET_BYTES) return { name, size: known };
    let current;
    try { current = await store.inspect(name); }
    catch (error) { if (!incoming || error.code !== "EINTEGRITY") throw error; }
    if (current && !incoming) return { name, size: current.size };
    if (current && incoming && current.size === incoming.length) return { name, size: current.size };
    const bytes = incoming ?? await readRegular(join(cache, name), ASSET_BYTES).catch(missing);
    if (!bytes) throw new Error(`Missing retained image: ${name}; run discovery with --refresh`);
    return { name, size: checkAsset(name, bytes), bytes };
  });
  const sizes = Object.fromEntries(prepared.map(({ name, size }) => [name, size]));
  for (const port of snapshot.ports) if ([...referencedAssets({ assets: snapshot.assets, ports: [port] })].reduce((sum, name) => sum + sizes[name], 0) > SNAPSHOT_LIMITS.portAssetBytes) throw new Error(`Port images exceed ${SNAPSHOT_LIMITS.portAssetBytes} bytes: ${port.id}`);
  if (Object.values(sizes).reduce((sum, size) => sum + size, 0) > SNAPSHOT_LIMITS.totalAssetBytes) throw new Error(`Retained images exceed ${SNAPSHOT_LIMITS.totalAssetBytes} bytes; previous snapshot retained`);
  const output = publication(snapshot, sizes);
  const writes = [];
  for (const [name, content] of output.documents) {
    const path = join(documents, name);
    const current = await readRegular(path, SNAPSHOT_LIMITS.documentBytes).catch(missing);
    if (!current?.equals(Buffer.from(content))) writes.push({ path, content });
  }
  let changed = false;
  await concurrent(prepared.filter((p) => p.bytes), 4, async ({ name, bytes }) => { await store.put(name, bytes); changed = true; });
  for (const { path, content } of writes) { await atomicWrite(path, content); changed = true; }
  const path = join(data, "ports.json");
  if (await readFile(path, "utf8").catch(missing) !== output.content) { await atomicWrite(path, output.content); changed = true; }
  // Prune only our obsolete immutable documents after the index commits; never remove manual files or symlinks.
  for (const name of await readdir(documents)) if (documentName.test(name) && !output.documents.has(name) && (await lstat(join(documents, name))).isFile()) {
    await unlink(join(documents, name)); changed = true;
  }
  if (store.base === local.base) { if (await local.prune(names)) changed = true; }
  else if (await local.prune(preview ? localNames : new Set())) changed = true;
  return changed;
}
