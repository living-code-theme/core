// Content-addressed capture storage. Local publication and optional Cloudflare R2 share the same integrity contract.
import { createHash, createHmac } from "node:crypto";
import { lstat, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const ASSET_BYTES = 2 * 1024 * 1024;
export const ASSET_NAME = /^[a-f0-9]{64}\.webp$/;
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function assetBase(value = "/port-images/") {
  if (value === "/port-images/") return value;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/") || !/^\/[a-zA-Z0-9_./-]*$/.test(url.pathname) || url.href !== value) throw new Error("Asset base must be a canonical HTTPS directory URL without credentials, query or fragment");
  return value;
}
export function assetName(src, base = "/port-images/") {
  for (const prefix of new Set([assetBase(base), "/port-images/"])) {
    const name = typeof src === "string" && src.startsWith(prefix) ? src.slice(prefix.length) : "";
    if (ASSET_NAME.test(name)) return name;
  }
  throw new Error("Invalid cached image reference");
}
export function checkAsset(name, bytes) {
  if (!ASSET_NAME.test(name)) throw new Error("Invalid generated asset name");
  if (bytes.length > ASSET_BYTES) throw new Error(`Cached image exceeds ${ASSET_BYTES} bytes: ${name}`);
  if (`${sha256(bytes)}.webp` !== name) {
    const error = new Error(`Cached image fingerprint mismatch: ${name}`);
    error.code = "EINTEGRITY";
    throw error;
  }
  return bytes.length;
}

export function localAssets(directory) {
  return {
    base: "/port-images/",
    async inspect(name) {
      if (!ASSET_NAME.test(name)) throw new Error("Invalid generated asset name");
      const path = join(directory, name);
      const info = await lstat(path).catch((error) => { if (error.code !== "ENOENT") throw error; return null; });
      if (!info) return null;
      if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Cached asset must be a regular file: ${name}`);
      if (info.size > ASSET_BYTES) throw new Error(`Cached image exceeds ${ASSET_BYTES} bytes: ${name}`);
      return { size: checkAsset(name, await readFile(path)) };
    },
    async put(name, bytes) {
      checkAsset(name, bytes);
      const temporary = join(directory, `${name}.${process.pid}.tmp`);
      await writeFile(temporary, bytes, { flag: "wx" });
      await rename(temporary, join(directory, name));
    },
    async prune(keep) {
      let removed = 0;
      for (const name of await readdir(directory)) if (ASSET_NAME.test(name) && !keep.has(name) && (await lstat(join(directory, name))).isFile()) {
        await unlink(join(directory, name));
        removed++;
      }
      return removed;
    },
  };
}

/** Explicitly configured only. No bucket creation, remote deletion, GitHub credentials or arbitrary upload hosts. */
export function r2Assets({ accountId, bucket, accessKeyId, secretAccessKey, publicBase, fetchImpl = fetch, now = () => new Date() }) {
  if (!/^[a-f0-9]{32}$/.test(accountId ?? "") || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket ?? "") || !accessKeyId || !secretAccessKey) throw new Error("Configure R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY");
  const base = assetBase(publicBase);
  if (!base.startsWith("https://")) throw new Error("R2_PUBLIC_URL must be an HTTPS directory URL");
  const prefix = new URL(base).pathname.slice(1);
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const hmac = (key, value) => createHmac("sha256", key).update(value).digest();
  async function request(method, name, bytes) {
    if (!ASSET_NAME.test(name)) throw new Error("Invalid generated asset name");
    const date = now().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const day = date.slice(0, 8), scope = `${day}/auto/s3/aws4_request`;
    const bodyHash = sha256(bytes ?? "");
    const path = `/${bucket}/${prefix}${name}`;
    const headers = {
      host, "x-amz-date": date, "x-amz-content-sha256": bodyHash,
      ...(method === "PUT" ? { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", "x-amz-meta-sha256": name.slice(0, 64) } : {}),
    };
    const keys = Object.keys(headers).sort();
    const canonical = `${method}\n${path}\n\n${keys.map((key) => `${key}:${headers[key]}\n`).join("")}\n${keys.join(";")}\n${bodyHash}`;
    const signing = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), "auto"), "s3"), "aws4_request");
    const signature = hmac(signing, `AWS4-HMAC-SHA256\n${date}\n${scope}\n${sha256(canonical)}`).toString("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${keys.join(";")}, Signature=${signature}`;
    const response = await fetchImpl(`https://${host}${path}`, { method, headers, ...(bytes ? { body: bytes } : {}), redirect: "error", signal: AbortSignal.timeout(20_000) });
    if (response.status === 404 && method !== "PUT") return null;
    if (!response.ok) throw new Error(`R2 ${method} failed (${response.status}): ${name}`);
    return response;
  }
  return {
    base, immutable: true,
    async inspect(name) {
      const head = await request("HEAD", name);
      if (!head) return null;
      const size = Number(head.headers.get("content-length"));
      if (size > ASSET_BYTES) throw new Error(`Cached image exceeds ${ASSET_BYTES} bytes: ${name}`);
      if (Number.isSafeInteger(size) && size > 0 && head.headers.get("x-amz-meta-sha256") === name.slice(0, 64)) return { size };
      // Older objects without integrity metadata are bounded and verified, never accepted on ETag alone.
      const response = await request("GET", name);
      if (!response) return null;
      const chunks = []; let length = 0;
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > ASSET_BYTES) throw new Error(`Cached image exceeds ${ASSET_BYTES} bytes: ${name}`);
        chunks.push(chunk);
      }
      return { size: checkAsset(name, Buffer.concat(chunks)) };
    },
    async put(name, bytes) { checkAsset(name, bytes); await request("PUT", name, bytes); },
    // Old deployments may still reference these immutable URLs. Remote retention is a separate, reviewed operation.
  };
}
