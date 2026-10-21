// Synthetic, local-only repositories and object storage. No request can reach a real remote service.
import { createHash } from "node:crypto";
import sharp from "sharp";
import { githubPorts } from "../../scripts/github-ports.mjs";
import { renderPortReadme } from "../../scripts/readme-template.mjs";
import { r2Assets, sha256 } from "../../src/port-assets.mjs";

const groups = ["Editors", "Terminals", "Shells & prompts", "CLI tools", "Browsers", "Libraries", "Apps"];
const flavors = ["night", "frost", "paper", "signal"];
export function scaleFixture({ count = 400, largeImages = false } = {}) {
  const entries = Array.from({ length: count }, (_, index) => {
    const name = `scale-fixture-${String(index).padStart(4, "0")}`;
    return { index, name, full_name: `living-code-theme/${name}`, node_id: `R_fixture_${index}`, default_branch: "main", version: 0 };
  });
  const objects = new Map(), counters = { listing: 0, batches: 0, files: 0, images: 0, head: 0, put: 0, get: 0, maxBatches: 0 };
  const failures = {};
  let inFlight = 0;
  const revision = (entry) => createHash("sha1").update(`synthetic, unpublished fixture:${entry.index}:${entry.version}`).digest("hex");
  const manifest = (entry) => {
    const shipped = entry.index % 8 >= 6 ? ["night", "paper"] : flavors;
    const captured = entry.index % 7 === 0 ? [] : entry.index % 11 === 0 ? shipped.slice(0, 1) : shipped;
    return { schemaVersion: 1, name: `Scale fixture ${entry.index}`, slug: entry.name, emoji: "🧪", group: groups[entry.index % groups.length], description: "Synthetic local acceptance-test fixture. Not an application port, screenshot, or published repository.", quick: "Synthetic local acceptance-test fixture", flavors: shipped, files: ["theme.conf"], images: captured.map((flavor) => ({ flavor, path: `images/${flavor}.png`, alt: "Synthetic calibration raster — not an application screenshot" })) };
  };
  const readme = (entry, meta) => renderPortReadme(meta, {
    installation: `This is a synthetic, unpublished test fixture. Version ${entry.version}.\n\n\`\`\`sh\n# Fixture ${entry.index}, not an installation command\nprintf '%s\\n' fixture-${entry.index}\n\`\`\`\n\nSee the [settings][settings].`,
    configuration: `### Configuration notes\n\n${"A deterministic documentation paragraph for the synthetic scale test. ".repeat([4, 20, 80, 200][entry.index % 4])}\n\n\`\`\`text\n## Not a section boundary inside a fence\n\`\`\`${meta.images.length ? `\n\n![Calibration][calibration]` : ""}`,
    compatibility: "Synthetic fixture only. Exercises Markdown, code fences, reference links and missing/limited-flavor captures.",
    flavorUsage: Object.fromEntries(meta.flavors.map((flavor) => [flavor, `Synthetic ${flavor} fixture; not application activation instructions.`])),
  }) + `\n[settings]: theme.conf "Fixture settings"\n${meta.images.length ? `[calibration]: ${meta.images[0].path}\n` : ""}`;
  async function raster(index, flavor) {
    const width = largeImages ? 1280 : 32, height = largeImages ? 720 : 20, band = largeImages ? 160 : 16;
    const bytes = Buffer.alloc(width * band * 3); let state = index * 397 + flavors.indexOf(flavor) * 7919 + 1;
    for (let i = 0; i < bytes.length; i++) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; bytes[i] = 20 + (state & 63); }
    return sharp({ create: { width, height, channels: 3, background: "#15202b" } }).composite([{ input: bytes, raw: { width, height: band, channels: 3 }, left: 0, top: 0 }]).png().toBuffer();
  }
  async function fetchGitHub(url, options) {
    const path = new URL(url);
    if (!["https://api.github.com", "https://raw.githubusercontent.com"].includes(path.origin) || options.redirect !== "error") throw new Error("Unexpected fixture request");
    if (path.origin === "https://raw.githubusercontent.com" && options.headers.Authorization) throw new Error("API credentials must never reach the public blob CDN");
    if (path.pathname === "/graphql") {
      counters.batches++; inFlight++; counters.maxBatches = Math.max(counters.maxBatches, inFlight);
      await new Promise((resolve) => setImmediate(resolve)); inFlight--;
      if (failures.graphql) return Response.json({ errors: [{ type: "RATE_LIMITED" }] });
      const query = JSON.parse(options.body);
      if (!query.query.startsWith("query PortRevisions(") || /mutation/i.test(query.query)) throw new Error("Only read-only batch queries are permitted");
      return Response.json({ data: { nodes: query.variables.ids.map((id) => {
        const entry = entries.find((e) => e.node_id === id);
        return { id, nameWithOwner: entry.full_name, isEmpty: false, defaultBranchRef: { target: { oid: revision(entry) } } };
      }) } });
    }
    if (path.pathname === "/orgs/living-code-theme/repos") {
      counters.listing++; const page = Number(path.searchParams.get("page"));
      if (failures.listing === page) return new Response(null, { status: 503 });
      const active = entries.filter((entry) => !entry.deleted), batch = active.slice((page - 1) * 100, page * 100);
      return Response.json(batch, { headers: { link: page * 100 < active.length ? '<https://api.github.com/next>; rel="next"' : '<https://api.github.com/previous>; rel="prev"' } });
    }
    const match = /^\/living-code-theme\/(scale-fixture-\d+)\/([a-f0-9]{40})\/(.+)$/.exec(path.pathname);
    if (!match) throw new Error(`Unexpected unbatched fixture request: ${url}`);
    const entry = entries.find((entry) => entry.name === match[1]);
    if (match[2] !== revision(entry)) throw new Error("Content was not pinned to the batched immutable revision");
    counters.files++; const file = decodeURIComponent(match[3]), meta = manifest(entry);
    if (file === "port.json") return entry.optOut ? new Response(null, { status: 404 }) : Response.json(meta);
    if (file === "README.md") return new Response(entry.invalid ? "Unfinished documentation" : readme(entry, meta));
    if (file === "theme.conf") return new Response(`# Synthetic test fixture ${entry.index}`);
    if (file.startsWith("images/")) { counters.images++; return new Response(await raster(entry.index, file.slice(7, -4))); }
    throw new Error(`Unexpected fixture file: ${file}`);
  }
  async function fetchR2(url, options) {
    if (new URL(url).hostname !== `${"0".repeat(32)}.r2.cloudflarestorage.com` || !options.headers.authorization.startsWith("AWS4-HMAC-SHA256 ")) throw new Error("Unsigned or unexpected object-store request");
    const name = new URL(url).pathname.split("/").at(-1), bytes = objects.get(name);
    if (options.method === "HEAD") { counters.head++; return bytes ? new Response(null, { headers: { "content-length": String(bytes.length), "x-amz-meta-sha256": sha256(bytes) } }) : new Response(null, { status: 404 }); }
    if (options.method === "PUT") {
      counters.put++;
      if (failures.upload) return new Response(null, { status: 503 });
      if (`${sha256(options.body)}.webp` !== name || options.headers["x-amz-content-sha256"] !== sha256(options.body)) throw new Error("Object integrity mismatch");
      objects.set(name, options.body); return new Response(null);
    }
    if (options.method === "GET") { counters.get++; return bytes ? new Response(bytes) : new Response(null, { status: 404 }); }
    throw new Error("The fixture must never delete remote objects");
  }
  return {
    entries, objects, counters, failures,
    client: githubPorts({ token: "synthetic-test-token", fetchImpl: fetchGitHub }),
    store: r2Assets({ accountId: "0".repeat(32), bucket: "synthetic-fixtures", accessKeyId: "synthetic-key", secretAccessKey: "synthetic-secret", publicBase: "https://synthetic-assets.invalid/port-images/", fetchImpl: fetchR2 }),
    reset() { for (const key of Object.keys(counters)) counters[key] = 0; },
  };
}
