#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = +(process.argv[2] || process.env.PORT || 4173);
const types = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  if (path === "/") { res.writeHead(302, { location: "/preview/" }); return res.end(); }
  let file = join(root, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    res.writeHead(200, { "content-type": types[extname(file)] || "text/plain; charset=utf-8", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("not found");
  }
});
server.listen(port, () => console.log(`Living Code preview → http://localhost:${server.address().port}/preview/`));
