// Explicit local fan-out: ports retain their own palette reader, updater, generator and tests.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, open, readFile, realpath, unlink } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { concurrent } from "./concurrent.mjs";
import { repositoryPath, validateManifest } from "../scripts/port-manifest.mjs";

const INPUTS = ["palette/flavors.mjs", "src/color.mjs", "src/resolve.mjs"];
const EXPORT = "exports/ports/palette.json";
const PIN = "palette/theme.json";
const STEPS = ["palette:update", "build", "check", "test"];
const CONTROL = ["port.json", "package.json", "pnpm-lock.yaml", "scripts/generated.json", "scripts/color.mjs", "scripts/palette.mjs", "scripts/update-palette.mjs", "scripts/generate.mjs", "src/generate.mjs"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cleanEnv = (directory) => ({ ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_") && !["NODE_PATH", "NODE_OPTIONS"].includes(key))), GIT_OPTIONAL_LOCKS: "0", INIT_CWD: directory, PWD: directory });
const git = (directory, ...args) => execFileSync("git", ["-C", directory, ...args], { env: cleanEnv(directory), encoding: "utf8", maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
const paths = (text) => text.split("\0").filter(Boolean);
function unsafe(message) { const error = new Error(message); error.code = "ESAFETY"; throw error; }

async function regular(directory, path, limit = 1024 * 1024) {
  const target = join(directory, path);
  const info = await lstat(target);
  assert.ok(info.isFile() && !info.isSymbolicLink() && info.size <= limit && await realpath(target) === target, `Missing, symlinked or oversized input: ${target}`);
  const bytes = await readFile(target);
  assert.ok(bytes.length <= limit, `Oversized input: ${target}`);
  return bytes;
}
async function checkout(directory) {
  const root = await realpath(directory);
  assert.equal(await realpath(git(root, "rev-parse", "--show-toplevel")), root, `Select a repository root: ${root}`);
  return root;
}
async function coreState(directory, revision) {
  const root = await checkout(directory);
  const head = git(root, "rev-parse", "HEAD");
  assert.match(head, /^[a-f0-9]{40}$/);
  if (revision !== undefined) assert.equal(head, revision, "Core HEAD differs from the selected revision");
  const bytes = await regular(root, EXPORT);
  assert.equal(hash(bytes), hash(execFileSync("git", ["-C", root, "show", `${head}:${EXPORT}`], { env: cleanEnv(root) })), "Commit the generated core export before a batch rollout");
  const snapshot = JSON.parse(bytes);
  assert.equal(snapshot.schemaVersion, 1, "Unsupported core palette export");
  assert.equal(snapshot.source?.repository, "https://github.com/living-code-theme/core");
  assert.deepEqual(Object.keys(snapshot.source.inputs).sort(), [...INPUTS].sort());
  const { source, ...data } = snapshot;
  assert.equal(hash(JSON.stringify(data)), source.sha256, "Core palette fingerprint mismatch");
  for (const input of INPUTS) {
    const committed = execFileSync("git", ["-C", root, "show", `${head}:${input}`], { env: cleanEnv(root) });
    assert.equal(hash(committed), source.inputs[input], `Core export is stale for ${input}`);
    assert.equal(hash(await regular(root, input)), source.inputs[input], `Core has uncommitted palette input: ${input}`);
  }
  return { directory: root, revision: head, sha256: source.sha256, exportHash: hash(bytes), snapshot };
}
async function assertCore(core) {
  try {
    assert.equal(git(core.directory, "rev-parse", "HEAD"), core.revision);
    assert.equal(hash(await regular(core.directory, EXPORT)), core.exportHash);
    for (const path of INPUTS) assert.equal(hash(await regular(core.directory, path)), core.snapshot.source.inputs[path]);
  } catch { unsafe("Core changed during the batch; remaining ports were not started"); }
}
function managedPath(path) {
  repositoryPath(path);
  assert.ok(!CONTROL.includes(path) && path !== PIN && !/^(?:\.github|images|test|node_modules|\.git)\//.test(path) && !/(?:^|\/)(?:package\.json|port\.json|pnpm-lock\.yaml|LICENSE[^/]*|NOTICE[^/]*|\.npmrc|\.pnpmfile\.[^/]+)$/.test(path) && !/\.md$/i.test(path), `Protected generated path: ${path}`);
  return path;
}
async function inspect(directory, core) {
  const root = await checkout(directory);
  assert.notEqual(root, core.directory, "Core is not a port checkout");
  assert.equal(git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"), "", "Dirty port worktree; review and commit tracked, staged and untracked changes first");
  const manifest = validateManifest(JSON.parse(await regular(root, "port.json", 32 * 1024)), basename(root));
  const pkg = JSON.parse(await regular(root, "package.json", 128 * 1024));
  for (const step of STEPS) assert.ok(typeof pkg.scripts?.[step] === "string" && pkg.scripts[step].trim(), `Missing port-owned pnpm ${step} command`);
  const generated = JSON.parse(await regular(root, "scripts/generated.json", 64 * 1024));
  assert.ok(Array.isArray(generated) && generated.length > 0 && generated.length <= 512 && new Set(generated).size === generated.length, "Invalid generated-file allowlist");
  const allowed = [PIN, ...generated.map(managedPath)];
  for (const path of [...CONTROL, ...allowed]) {
    await regular(root, path, path === PIN ? 1024 * 1024 : 2 * 1024 * 1024);
    git(root, "ls-files", "--error-unmatch", "--", path);
  }
  const pin = JSON.parse(await regular(root, PIN));
  assert.equal(pin.schemaVersion, 1, "Unsupported pinned palette");
  const { source, ...data } = pin;
  assert.match(source?.revision ?? "", /^[a-f0-9]{40}$/, "Port must have a committed palette pin");
  assert.equal(hash(JSON.stringify(data)), source.sha256, "Port palette fingerprint mismatch");
  assert.equal(hash(await regular(root, "scripts/color.mjs")), core.snapshot.source.inputs["src/color.mjs"], "Color math changed: review/adopt math and palette together in this port before batching");
  if (Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies }).length) {
    const modules = await lstat(join(root, "node_modules")).catch(() => null);
    assert.ok(modules?.isDirectory() && !modules.isSymbolicLink(), "Install this port's dependencies with pnpm install --frozen-lockfile before applying");
  }
  return { directory: root, id: manifest.slug, head: git(root, "rev-parse", "HEAD"), allowed, lock: join(await realpath(git(root, "rev-parse", "--absolute-git-dir")), "living-code-palette.lock") };
}
async function acquire(path) {
  const file = await open(path, "wx", 0o600).catch((error) => { if (error.code === "EEXIST") throw new Error(`Another palette batch holds ${path}; check its PID before removing a stale lock`); throw error; });
  const identity = await file.stat();
  const release = async () => {
    await file.close();
    const current = await lstat(path).catch((error) => { if (error.code !== "ENOENT") throw error; return null; });
    if (current?.ino === identity.ino && current.dev === identity.dev) await unlink(path);
  };
  try { await file.writeFile(`${process.pid}\n`); } catch (error) { await release(); throw error; }
  return release;
}
async function changed(port) {
  const files = [...paths(git(port.directory, "diff", "--no-renames", "--name-only", "-z", "HEAD", "--")), ...paths(git(port.directory, "ls-files", "--others", "--exclude-standard", "-z"))];
  return [...new Set(files)].sort();
}
async function verify(port, core, adopted) {
  if (git(port.directory, "rev-parse", "HEAD") !== port.head || git(port.directory, "diff", "--cached", "--name-only", "-z")) unsafe(`Port HEAD or index changed unexpectedly: ${port.directory}`);
  const files = await changed(port);
  if (files.some((path) => !port.allowed.includes(path))) unsafe(`Port command changed files outside its palette/generated allowlist: ${files.filter((path) => !port.allowed.includes(path)).join(", ")}`);
  for (const path of port.allowed) await regular(port.directory, path, 2 * 1024 * 1024);
  if (adopted) {
    const pin = JSON.parse(await regular(port.directory, PIN));
    assert.deepEqual(pin, { ...core.snapshot, source: { ...core.snapshot.source, revision: core.revision } }, "Port updater did not adopt the selected core palette exactly");
  }
  return files;
}

// POSIX process groups ensure timeout/cancellation cannot leave a generator writing after locks are released.
function command(directory, step, core, signal) {
  return new Promise((resolve) => {
    const child = spawn("pnpm", ["run", step, ...(step === "palette:update" ? [core.directory] : [])], { cwd: directory, env: cleanEnv(directory), detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", size = 0, failure, killTimer;
    const kill = () => { if (child.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; } } };
    const stop = (message) => {
      failure ??= message;
      if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; } }
      killTimer ??= setTimeout(kill, 1500);
    };
    const abort = () => stop("Batch interrupted");
    const timer = setTimeout(() => stop("Port command exceeded its 180-second timeout"), 180_000);
    const collect = (bytes) => { size += bytes.length; output = (output + bytes.toString()).slice(-8192); if (size > 4 * 1024 * 1024) stop("Port command exceeded its 4 MiB output budget"); };
    child.stdout.on("data", collect); child.stderr.on("data", collect);
    child.on("error", (error) => { failure ??= error.message; });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.on("close", (code, termination) => {
      clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener("abort", abort); kill();
      resolve({ name: step, status: !failure && code === 0 ? "passed" : "failed", code, ...(failure || code !== 0 ? { error: failure ?? `Exited ${termination ?? code}`, output } : {}) });
    });
  });
}

/** Plan by default. Apply preflights the entire selection under locks, then calls only port-owned commands. */
export async function batchPaletteUpdate(coreDirectory, directories, { apply = false, concurrency = 2, revision, signal } = {}) {
  assert.equal(typeof apply, "boolean", "Apply must be an explicit boolean");
  assert.ok(Array.isArray(directories) && directories.length > 0 && directories.length <= 1000, "Select between 1 and 1000 port checkouts");
  assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 4, "Batch concurrency must be between 1 and 4");
  if (revision !== undefined) assert.match(revision, /^[a-f0-9]{40}$/, "Select a full immutable core revision");
  if (apply) assert.notEqual(process.platform, "win32", "Apply requires POSIX process groups; use Linux, macOS or WSL");
  const core = await coreState(coreDirectory, revision);
  const results = await concurrent(directories, 4, async (directory) => {
    try { return { ...await inspect(directory, core), status: "planned" }; }
    catch (error) { return { directory: resolve(directory), status: "blocked", error: error.message }; }
  });
  const seen = new Set();
  for (const port of results) if (port.status === "planned") {
    if (seen.has(port.directory)) { port.status = "blocked"; port.error = "Duplicate checkout selection"; }
    seen.add(port.directory);
  }
  const report = { core: { directory: core.directory, revision: core.revision, sha256: core.sha256 }, apply, ready: results.every((p) => p.status === "planned"), ports: results.map(({ directory, id, status, error }) => ({ directory, ...(id ? { id } : {}), status, ...(error ? { error } : {}) })) };
  if (!apply || !report.ready) return report;
  const releases = [];
  try {
    for (const port of [...results].sort((a, b) => a.directory.localeCompare(b.directory))) releases.push(await acquire(port.lock));
    await assertCore(core);
    // Lock acquisition can take time: revalidate every checkout before any port command runs.
    for (const port of results) {
      const current = await inspect(port.directory, core);
      assert.equal(current.head, port.head, "Port HEAD changed during preflight");
      assert.deepEqual(current.allowed, port.allowed, "Port allowlist changed during preflight");
    }
    if (signal?.aborted) unsafe("Batch interrupted before apply");
    let stopped = false;
    report.ports = await concurrent(results, concurrency, async (port) => {
      const result = { directory: port.directory, id: port.id, status: "failed", steps: [], changed: [] };
      if (stopped || signal?.aborted) return { ...result, status: "skipped", error: "Batch interrupted or stopped after an unsafe change" };
      try {
        for (const step of STEPS) {
          if (signal?.aborted || stopped) unsafe("Batch interrupted or stopped after an unsafe change");
          await assertCore(core);
          const outcome = await command(port.directory, step, core, signal);
          result.steps.push(outcome);
          result.changed = await verify(port, core, outcome.status === "passed" || step !== "palette:update");
          if (outcome.status !== "passed") { result.error = `${step}: ${outcome.error}`; return result; }
        }
        await assertCore(core);
        result.status = result.changed.length ? "updated" : "unchanged";
      } catch (error) {
        result.error = error.message;
        stopped = true; // Unexpected writes/state changes are safety failures, not ordinary test failures.
        result.changed = await changed(port).catch(() => []);
      }
      return result;
    });
  } catch (error) {
    report.ready = false;
    report.error = error.message;
    report.ports = report.ports.map((port) => ({ ...port, status: "blocked", error: error.message }));
  } finally { for (const release of releases.reverse()) await release(); }
  return report;
}
