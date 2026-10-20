import assert from "node:assert/strict";
import test from "node:test";
import { ACCENT_ORDER, NEUTRAL_ORDER, resolveFlavor } from "../src/resolve.mjs";

const signal = resolveFlavor("signal");
const night = resolveFlavor("night");
const allowed = new Set([...NEUTRAL_ORDER.map((name) => signal.c(name)), signal.c("teal")]);

test("Night uses green strings, gray comments and amber warnings", () => {
  assert.equal(night.roles.string, "moss");
  assert.equal(night.r("string"), night.c("moss"));
  assert.equal(night.roles.comment, "comment");
  assert.equal(night.r("comment"), night.c("comment"));
  assert.equal(night.roles.warning, "amber");
  assert.equal(night.r("warning"), night.c("amber"));
  assert.equal(night.r("operator"), night.c("comment"));
  for (const id of ["signal", "frost", "paper"]) {
    assert.equal(resolveFlavor(id).roles.comment, "comment", id);
  }
});

test("Every full-palette flavor uses green strings like Night", () => {
  for (const id of ["night", "frost", "paper"]) {
    const flavor = resolveFlavor(id);
    assert.equal(flavor.roles.string, "moss", id);
    assert.equal(flavor.r("string"), flavor.c("moss"), id);
  }
});

test("Signal preserves the existing neutral ramp and teal accent", () => {
  for (const name of [...NEUTRAL_ORDER, "teal"]) {
    assert.deepEqual(signal.colors[name], night.colors[name], name);
  }
});

test("Signal palette aliases and semantic roles use only teal or existing neutrals", () => {
  for (const name of ACCENT_ORDER) {
    assert.ok(allowed.has(signal.c(name)), name);
  }
  for (const role of Object.keys(signal.roles)) {
    assert.ok(allowed.has(signal.r(role)), role);
  }
  for (const role of ["keyword", "builtin", "decorator", "tag", "link", "accent", "cursor", "match", "modified"]) {
    assert.equal(signal.r(role), signal.c("teal"), role);
  }
  for (const role of ["function", "string", "number", "constant", "escape", "regex", "code"]) {
    assert.equal(signal.r(role), signal.r("fg"), role);
  }
});

test("Signal normal and bright ANSI colors use only teal or existing neutrals", () => {
  for (const color of [...signal.ansi.normal, ...signal.ansi.bright]) {
    assert.ok(allowed.has(color), color);
  }
  assert.equal(signal.ansi16("cyan"), signal.c("teal"));
  assert.equal(signal.ansi16("brightcyan"), signal.c("teal"));
});
