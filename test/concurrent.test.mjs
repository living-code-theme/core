import assert from "node:assert/strict";
import test from "node:test";
import { concurrent } from "../src/concurrent.mjs";

test("bounded asynchronous work returns input order rather than completion order", async () => {
  let active = 0, maximum = 0;
  const result = await concurrent([4, 3, 2, 1], 2, async (value) => {
    active++; maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, value)); active--; return value * 2;
  });
  assert.deepEqual(result, [8, 6, 4, 2]); assert.equal(maximum, 2);
});

test("a failure drains already-started work and never starts the remaining queue", async () => {
  const started = [], finished = [];
  await assert.rejects(concurrent([0, 1, 2, 3], 2, async (value) => {
    started.push(value);
    if (value === 0) throw new Error("stop");
    await new Promise((resolve) => setTimeout(resolve, 5)); finished.push(value);
  }), /stop/);
  assert.deepEqual(started, [0, 1]); assert.deepEqual(finished, [1]);
  await assert.rejects(concurrent([], 0, () => {}), /Concurrency/);
});
