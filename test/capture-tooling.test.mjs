import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("vendored capture contract: integrity, freshness, native 2× dimensions, containment and credential isolation", t => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const result = spawnSync("python3", ["test/capture_tooling_test.py", "-v"], {
    cwd: root, encoding: "utf8", timeout: 30_000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (result.error?.code === "ENOENT") {
    t.skip("Optional native-capture tooling tests need Python 3; palette generation itself uses Node only.");
    return;
  }
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  assert.match(result.stderr, /Ran 7 tests/);
});
