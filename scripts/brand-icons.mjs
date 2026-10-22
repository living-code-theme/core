#!/usr/bin/env node
// Rasterize the brand SVGs with Chromium: authentic font outlines, sRGB, transparent favicon corners.
// No font installation is needed. Run pnpm build first; the committed outputs need no browser afterwards.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const targets = [
  { source: "assets/brand/github-avatar.svg", size: 1024, path: "assets/brand/github-avatar.png" },
  { source: "assets/brand/github-avatar.svg", size: 180, path: "assets/brand/apple-touch-icon.png" },
  { source: "assets/brand/github-avatar.svg", size: 128, path: "assets/brand/publisher-128.png" },
  ...[16, 32, 48].map((size) => ({ source: "assets/brand/favicon.svg", size, path: `assets/brand/favicon-${size}.png` })),
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function icoFromPngs(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, bytes }, i) => {
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error("ICO sizes must be between 1 and 256 pixels");
    const index = 6 + i * 16;
    header[index] = header[index + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, index + 4);
    header.writeUInt16LE(32, index + 6);
    header.writeUInt32LE(bytes.length, index + 8);
    header.writeUInt32LE(offset, index + 12);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...images.map(({ bytes }) => bytes)]);
}

async function generate() {
  const browser = process.env.CHROME_BIN || "google-chrome";
  const jobs = await Promise.all(targets.map(async (target) => ({ ...target, svg: (await readFile(join(root, target.source))).toString("base64") })));
  const html = `<!doctype html><meta charset="utf-8"><script>
Promise.all(${JSON.stringify(jobs)}.map(job => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = job.size;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, job.size, job.size);
    resolve({ path: job.path, png: canvas.toDataURL('image/png').split(',')[1] });
  };
  image.onerror = reject;
  image.src = 'data:image/svg+xml;base64,' + job.svg;
}))).then(images => document.body.textContent = 'BRAND:' + JSON.stringify(images));
</script><body></body>`;
  const temporary = await mkdtemp(join(tmpdir(), "living-code-brand-"));
  try {
    const page = join(temporary, "icons.html");
    await writeFile(page, html);
    const result = spawnSync(browser, [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking",
      `--user-data-dir=${join(temporary, "profile")}`, "--force-color-profile=srgb",
      "--virtual-time-budget=2000", "--dump-dom", pathToFileURL(page).href,
    ], { encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    if (result.error?.code === "ENOENT") throw new Error(`Cannot find ${browser}. Set CHROME_BIN to a Chromium executable.`);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Chromium failed: ${result.stderr}`);
    const encoded = result.stdout.match(/<body>BRAND:(\[[\s\S]*?\])<\/body>/)?.[1];
    if (!encoded) throw new Error("Chromium did not render the brand assets");
    const rendered = JSON.parse(encoded);
    const outputs = new Map(rendered.map(({ path, png }) => [path, Buffer.from(png, "base64")]));
    outputs.set("assets/brand/favicon.ico", icoFromPngs([16, 32, 48].map((size) => ({ size, bytes: outputs.get(`assets/brand/favicon-${size}.png`) }))));
    const sources = [...new Set(targets.map((target) => target.source))];
    const manifest = {
      schemaVersion: 1,
      sources: Object.fromEntries(await Promise.all(sources.map(async (source) => [source, hash(await readFile(join(root, source)))]))),
      outputs: Object.fromEntries([...outputs].map(([path, bytes]) => [path, hash(bytes)])),
    };
    for (const [path, bytes] of outputs) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), bytes);
      console.log(`wrote ${path}`);
    }
    await writeFile(join(root, "assets/brand/raster-sources.json"), JSON.stringify(manifest, null, 2) + "\n");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await generate();
