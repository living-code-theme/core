import assert from "node:assert/strict";
import test from "node:test";
import { githubPorts } from "../scripts/github-ports.mjs";
const repo = { name: "test", full_name: "living-code-theme/test", node_id: "R_test", default_branch: "main" };

test("batch results must resolve the requested repository, owner and immutable commit exactly", async () => {
  for (const node of [null, { id: "other" }, { id: repo.node_id, nameWithOwner: "another-owner/test", defaultBranchRef: { target: { oid: "a".repeat(40) } } }, { id: repo.node_id, nameWithOwner: repo.full_name, defaultBranchRef: { target: { oid: "main" } } }]) {
    const adapter = githubPorts({ token: "test", fetchImpl: async () => Response.json({ data: { nodes: [node] } }) });
    await assert.rejects(adapter.revisions([repo]), /unexpected repository|invalid commit/);
  }
});

test("GraphQL partial errors abort batching without silently falling back to hundreds of REST requests", async () => {
  let calls = 0;
  const adapter = githubPorts({ token: "test", fetchImpl: async (url, options) => {
    calls++; assert.equal(url, "https://api.github.com/graphql"); assert.equal(options.method, "POST");
    return Response.json({ data: { nodes: [] }, errors: [{ type: "RATE_LIMITED" }] });
  } });
  await assert.rejects(adapter.revisions([repo]), /GitHub 429/); assert.equal(calls, 1);
});

test("short pages still follow the authoritative next link; empty pages with next abort", async () => {
  let calls = 0;
  const adapter = githubPorts({ token: "test", fetchImpl: async () => {
    calls++;
    return Response.json([repo], calls === 1 ? { headers: { link: '<https://api.github.com/next>; rel="next"' } } : {});
  } });
  assert.equal((await adapter.repositories("living-code-theme")).length, 2);
  assert.equal(calls, 2);
  const incomplete = githubPorts({ token: "test", fetchImpl: async () => Response.json([], { headers: { link: '<https://api.github.com/next>; rel="next"' } }) });
  await assert.rejects(incomplete.repositories("living-code-theme"), /incomplete repository pagination/);
});

test("public file downloads require a pinned revision and contained paths before making any request", () => {
  const adapter = githubPorts({ token: "test", fetchImpl: async () => assert.fail("invalid file references must not fetch") });
  assert.throws(() => adapter.file(repo, "main", "README.md"), /immutable public file reference/);
  for (const path of ["../README.md", "/README.md", "images/../README.md", "images\\capture.webp", "images/" + String.fromCharCode(0) + ".webp"]) {
    assert.throws(() => adapter.file(repo, "a".repeat(40), path), /immutable public file reference/);
  }
});

test("empty repositories are explicit; large anonymous discovery fails before per-repository request storms", async () => {
  const adapter = githubPorts({ token: "test", fetchImpl: async () => Response.json({ data: { nodes: [{ id: repo.node_id, nameWithOwner: repo.full_name, isEmpty: true, defaultBranchRef: null }] } }) });
  await adapter.revisions([repo]); assert.equal(await adapter.revision(repo), null);
  const anonymous = githubPorts({ token: "", fetchImpl: async () => assert.fail("no anonymous request storm") });
  await assert.rejects(anonymous.revisions(Array(400).fill(repo)), /Set GH_TOKEN/);
});
