import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { paletteSnapshot } from "../src/palette-snapshot.mjs";
import { resolveAll } from "../src/resolve.mjs";

test("the portable palette retains the resolved data needed by independent generators", () => {
  const flavors = resolveAll();
  const snapshot = paletteSnapshot(flavors);
  assert.deepEqual(snapshot.flavors, JSON.parse(JSON.stringify(flavors)));
  assert.deepEqual(snapshot.ansiOrder, ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"]);
  const { source, ...data } = snapshot;
  assert.equal(source.repository, "https://github.com/living-code-theme/core");
  assert.equal(source.sha256, createHash("sha256").update(JSON.stringify(data)).digest("hex"));
  for (const [path, hash] of Object.entries(source.inputs)) {
    assert.equal(hash, createHash("sha256").update(readFileSync(new URL(`../${path}`, import.meta.url))).digest("hex"));
  }
  assert.deepEqual(JSON.parse(readFileSync(new URL("../exports/ports/palette.json", import.meta.url))), snapshot);
});
