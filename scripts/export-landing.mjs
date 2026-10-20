#!/usr/bin/env node
// Deliver generated, reviewable inputs. Discovery and legacy content are never overwritten.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { landingCheckout } from "../src/landing-checkout.mjs";

const files = [
  ["theme.json", "data/theme.json"],
  ["theme.css", "src/styles/theme.css"],
  ["port.schema.json", "public/port.schema.json"],
];

export async function exportLanding(directory) {
  const root = await landingCheckout(directory);
  // Read all inputs before writing anything; a missing core build must not partially update the site.
  const inputs = await Promise.all(files.map(async ([source, target]) => ({
    target: join(root, target), bytes: await readFile(new URL(`../exports/landing/${source}`, import.meta.url)),
  })));
  for (const { target, bytes } of inputs) {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { landing: { type: "string" } } });
  await exportLanding(values.landing);
  console.log("Exported theme JSON, CSS and port schema. Review and commit the updated landing inputs.");
}
