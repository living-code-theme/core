#!/usr/bin/env node
// Verify a landing checkout without core or any sibling repository beside it.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { copyLanding, landingCheckout, runLanding } from "../src/landing-checkout.mjs";

const { values } = parseArgs({ options: { landing: { type: "string" }, keep: { type: "boolean" } } });
const source = await landingCheckout(values.landing);
const temporary = await mkdtemp(join(tmpdir(), "living-code-landing-"));
const directory = join(temporary, "landing");
const run = (args) => {
  console.log(`\nStandalone: pnpm ${args.join(" ")}`);
  runLanding(directory, args, { ci: true });
};

try {
  await copyLanding(source, directory);
  console.log(`Isolated checkout: ${directory}`);
  run(["install", "--frozen-lockfile", "--prefer-offline"]);
  run(["build"]);
  run(["test"]);
  console.log("\nVerified: landing installs, builds and tests without core or any sibling repository.");
} finally {
  if (values.keep) console.log(`Kept isolated checkout: ${directory}`);
  else await rm(temporary, { recursive: true, force: true });
}
