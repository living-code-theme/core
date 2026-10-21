import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { exerciseScale } from "./fixtures/scale-acceptance.mjs";

test("400 ports: cold/unchanged/changed/invalid/removed/global-failure acceptance through the real adapters", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "living-code-scale-unit-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const report = await exerciseScale(directory);
  assert.equal(report.ports, 400);
  assert.equal(report.unchanged.requests.files, 0);
  assert.equal(report.unchanged.requests.head, 0);
  assert.equal(report.unchanged.requests.put, 0);
  assert.equal(report.changed.replacedDocuments, 3);
  assert.ok(report.captureCount > 1000);
});
