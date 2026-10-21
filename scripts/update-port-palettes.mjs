#!/usr/bin/env node
import { lstat, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { batchPaletteUpdate } from "../src/port-palette-batch.mjs";

const usage = `Usage (from core):
  pnpm palette:update:ports ../kitty ../nvim                  # read-only plan
  pnpm palette:update:ports --ports-root ..                   # immediate real directories with port.json
  pnpm palette:update:ports --ports-root .. --apply            # update/build/check/test clean checkouts
Options: --core <checkout> --revision <full-sha> --concurrency <1-4> --json --help
No install, commit, push, release or screenshot capture is performed. Apply requires Linux, macOS or WSL.
`;
async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    core: { type: "string", default: fileURLToPath(new URL("../", import.meta.url)) },
    "ports-root": { type: "string" }, revision: { type: "string" }, concurrency: { type: "string", default: "2" },
    apply: { type: "boolean" }, json: { type: "boolean" }, help: { type: "boolean" },
  } });
  if (values.help) { console.log(usage); return; }
  if (values["ports-root"] && positionals.length) throw new Error("Choose explicit checkouts OR --ports-root, not both");
  const directories = positionals.map((path) => resolve(path));
  if (values["ports-root"]) {
    const root = resolve(values["ports-root"]);
    for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue; // No recursive scan, symlink following or central application registry.
      const path = join(root, entry.name);
      const manifest = await lstat(join(path, "port.json")).catch((error) => { if (error.code !== "ENOENT") throw error; return null; });
      if (manifest) directories.push(path);
    }
  }
  if (!directories.length) throw new Error(`No port checkouts selected.\n${usage}`);
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort); process.once("SIGTERM", abort);
  try {
    const report = await batchPaletteUpdate(values.core, directories, { apply: values.apply ?? false, revision: values.revision, concurrency: Number(values.concurrency), signal: controller.signal });
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`${values.apply ? "Apply" : "Plan"}: core ${report.core.revision}`);
      for (const port of report.ports) {
        console.log(`${port.status.padEnd(9)} ${port.directory}${port.changed ? ` (${port.changed.length} changed files)` : ""}`);
        if (port.error) console.error(`  ${port.error}`);
        for (const step of port.steps ?? []) if (step.status === "failed" && step.output) console.error(step.output);
      }
      if (report.error) console.error(report.error);
      console.log(values.apply ? "No commits or pushes made. Review each checkout's diff; failed operations keep their partial changes." : "Read-only plan. Use --apply only after reviewing the selection and resolving blocked checkouts.");
    }
    process.exitCode = controller.signal.aborted ? 130 : !report.ready || report.ports.some((port) => ["blocked", "failed", "skipped"].includes(port.status)) ? 1 : 0;
  } finally { process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
