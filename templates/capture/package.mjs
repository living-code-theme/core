// Package verified committed payloads and previews. Never rebuild or capture as a release side effect.
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { check } from "./check.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const { manifest, pkg } = await check();
execFileSync("python3", ["scripts/capture.py", "--check"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, ["--test", "test/format.test.mjs"], { cwd: root, stdio: "inherit" });
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
const output = `dist/living-code-${manifest.slug}-${pkg.version}.tar.gz`;
execFileSync("tar", ["-czf", output, "--", "README.md", "LICENSE", "port.json", ...manifest.files,
  ...manifest.images.map(image => image.path), "images/capture.json"], { cwd: root, stdio: "inherit" });
console.log(output);
