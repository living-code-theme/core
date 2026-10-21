import { SNAPSHOT_LIMITS } from "../src/port-snapshot.mjs";
import { concurrent } from "../src/concurrent.mjs";
const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
export const LIMITS = { manifest: 32 * 1024, readme: SNAPSHOT_LIMITS.readmeBytes, image: 10 * 1024 * 1024, listing: 4 * 1024 * 1024, repositories: 2000 };
const REVISION_QUERY = "query PortRevisions($ids: [ID!]!) { nodes(ids: $ids) { ... on Repository { id nameWithOwner isEmpty defaultBranchRef { target { oid } } } } }";

export class GitHubError extends Error {
  constructor(status, path) { super(`GitHub ${status}: ${path}`); this.status = status; }
}
async function limitedBody(response, limit) {
  if (Number(response.headers.get("content-length")) > limit) throw new Error(`Response exceeds ${limit} bytes`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error(`Response exceeds ${limit} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Read-only GitHub queries. Neither GitHub tokens nor R2 credentials follow repository-supplied URLs. */
export function githubPorts({ token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN, fetchImpl = fetch } = {}) {
  const heads = new Map();
  async function request(path, { raw = false, limit = LIMITS.listing, missing = false, json, details = false, publicRaw = false } = {}) {
    const response = await fetchImpl(`${publicRaw ? RAW : API}${path}`, {
      method: json ? "POST" : "GET",
      headers: {
        Accept: publicRaw ? "application/octet-stream" : "application/vnd.github+json",
        ...(!publicRaw ? { "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) } : {}),
        "User-Agent": "living-code-port-discovery", ...(json ? { "Content-Type": "application/json" } : {}),
      },
      ...(json ? { body: JSON.stringify(json) } : {}), signal: AbortSignal.timeout(20_000), redirect: "error",
    });
    if (missing && response.status === 404) return null;
    if (!response.ok) throw new GitHubError(response.status, path);
    const bytes = await limitedBody(response, limit);
    const data = raw ? bytes : JSON.parse(bytes.toString("utf8"));
    if (json && data.errors?.length) {
      const types = data.errors.map((error) => error.type);
      throw new GitHubError(types.includes("RATE_LIMITED") ? 429 : types.includes("FORBIDDEN") ? 403 : 502, path);
    }
    return details ? { data, link: response.headers.get("link") } : data;
  }
  return {
    async repositories(org) {
      heads.clear();
      const result = [];
      for (let page = 1; ; page++) {
        if (page > Math.ceil(LIMITS.repositories / 100) + 1) throw new Error("GitHub repository pagination exceeds its request budget");
        const { data: batch, link } = await request(`/orgs/${org}/repos?type=public&sort=full_name&direction=asc&per_page=100&page=${page}`, { details: true });
        if (!Array.isArray(batch)) throw new Error("GitHub returned an invalid repository listing");
        result.push(...batch);
        if (result.length > LIMITS.repositories) throw new Error(`Repository listing exceeds ${LIMITS.repositories} entries; discovery aborted`);
        const next = link?.includes('rel="next"');
        if (next && !batch.length) throw new Error("GitHub returned incomplete repository pagination");
        if (link !== null ? !next : batch.length < 100) return result;
      }
    },
    async revisions(repositories) {
      heads.clear();
      if (!token) {
        if (repositories.length > 20) throw new Error("Set GH_TOKEN for authenticated, batched revision discovery at this catalog size");
        return; // Small, anonymous maintenance runs retain the public REST adapter.
      }
      const batches = [];
      for (let i = 0; i < repositories.length; i += 100) batches.push(repositories.slice(i, i + 100));
      const results = await concurrent(batches, 2, async (batch) => {
        if (batch.some((repo) => typeof repo.node_id !== "string" || !repo.node_id)) throw new Error("GitHub listing is missing repository node IDs");
        const result = await request("/graphql", { json: { query: REVISION_QUERY, variables: { ids: batch.map((repo) => repo.node_id) } } });
        if (!Array.isArray(result.data?.nodes) || result.data.nodes.length !== batch.length) throw new Error("GitHub returned incomplete batched revision data");
        return batch.map((repo, index) => {
          const node = result.data.nodes[index];
          if (!node || node.id !== repo.node_id || node.nameWithOwner?.toLowerCase() !== repo.full_name.toLowerCase()) throw new Error("GitHub returned an unexpected repository revision");
          const revision = node.defaultBranchRef?.target?.oid;
          if (node.isEmpty !== true && !/^[a-f0-9]{40}$/.test(revision ?? "")) throw new Error("GitHub returned an invalid commit SHA");
          return [repo.full_name.toLowerCase(), node.isEmpty ? null : revision];
        });
      });
      for (const batch of results) for (const [name, revision] of batch) heads.set(name, revision);
    },
    async revision(repo) {
      if (heads.has(repo.full_name.toLowerCase())) return heads.get(repo.full_name.toLowerCase());
      const commit = await request(`/repos/${repo.full_name}/commits/${encodeURIComponent(repo.default_branch)}`);
      if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error("GitHub returned an invalid commit SHA");
      return commit.sha;
    },
    file(repo, revision, path, limit) {
      if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo.full_name) || !/^[a-f0-9]{40}$/.test(revision) || path.split("/").some((part) => !part || part === "." || part === ".." || /[\\\\\u0000-\u001f]/.test(part))) throw new Error("Invalid immutable public file reference");
      // Public immutable blobs do not consume the Actions token's 1,000-request/hour REST allowance.
      // This fixed GitHub CDN origin NEVER receives the API token, and redirects are rejected.
      return request(`/${repo.full_name}/${revision}/${path.split("/").map(encodeURIComponent).join("/")}`, { publicRaw: true, raw: true, missing: true, limit });
    },
  };
}
