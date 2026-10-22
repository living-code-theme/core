#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { packagePorts, publicationDirectories } from "../src/port-packaging.mjs";

const usage = `Usage (from core):
  pnpm package:ports --ports-root ..                           # read-only plan
  pnpm package:ports --ports-root .. --output ../packages --apply
  pnpm package:ports ../vscode ../pi --output /tmp/packages --apply
Options: --ports-root <directory> OR explicit checkout paths; --output <new-directory>; --apply; --json; --help
Discovers publication.json opt-ins, delegates to each port's pnpm package, and stages artifacts/checksums/instructions.
No publishing, signing, tags, commits, pushes, palette adoption or screenshot capture. Review local port scripts first.
`;
async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    "ports-root": { type: "string" }, output: { type: "string" }, apply: { type: "boolean" }, json: { type: "boolean" }, help: { type: "boolean" },
  } });
  if (values.help) { console.log(usage); return; }
  if (values["ports-root"] && positionals.length) throw new Error("Choose --ports-root OR explicit checkout paths");
  const directories = values["ports-root"] ? await publicationDirectories(values["ports-root"]) : positionals.map(path => resolve(path));
  const controller = new AbortController(), abort = () => controller.abort();
  process.once("SIGINT", abort); process.once("SIGTERM", abort);
  try {
    const report = await packagePorts(directories, { apply: values.apply ?? false, output: values.output, signal: controller.signal });
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else {
      for (const port of report.ports) console.log(`${port.status.padEnd(9)} ${port.id ?? port.directory}${port.error ? `: ${port.error}` : ""}`);
      console.log(report.apply ? `Bundle: ${report.output ?? "not created"}. Nothing published.` : "Read-only plan. Use --output <new-directory> --apply to package locally.");
    }
    process.exitCode = controller.signal.aborted ? 130 : report.ready ? 0 : 1;
  } finally { process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
