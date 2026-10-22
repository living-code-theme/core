// Collect port-owned publication artifacts. No application formats or publishing credentials live here.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const inside = (root, path) => { const part = relative(root, path); return !isAbsolute(part) && part !== ".." && !part.startsWith(`..${sep}`); };
async function regular(root, path, limit = 1024 * 1024) {
  const target = join(root, path), info = await lstat(target);
  assert.ok(info.isFile() && !info.isSymbolicLink() && await realpath(target) === target && info.size > 0 && info.size <= limit, `Missing, empty, symlinked or oversized file: ${target}`);
  return readFile(target);
}

/** Discover only immediate, real directories opting in with publication.json; never follow links. */
export async function publicationDirectories(directory) {
  const root = await realpath(directory), directories = [];
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const path = join(root, entry.name);
    const info = await lstat(join(path, "publication.json")).catch(error => { if (error.code !== "ENOENT") throw error; });
    if (info) directories.push(path); // Invalid opt-ins are reported, not silently skipped.
  }
  return directories;
}
async function inspect(directory) {
  const root = resolve(directory);
  assert.equal(await realpath(root), root, `Select a real directory, not a symlink: ${root}`);
  const pkg = JSON.parse(await regular(root, "package.json"));
  const port = JSON.parse(await regular(root, "port.json", 32 * 1024));
  const bytes = await regular(root, "publication.json", 64 * 1024), publication = JSON.parse(bytes);
  assert.match(port.slug ?? "", /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(pkg.version ?? "", /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.ok(typeof pkg.scripts?.package === "string" && pkg.scripts.package.trim(), "Missing port-owned package command");
  assert.equal(publication.schemaVersion, 1, "Unsupported publication.json version");
  assert.ok(Array.isArray(publication.artifacts) && publication.artifacts.length > 0 && publication.artifacts.length <= 100, "Declare between 1 and 100 artifacts");
  const artifacts = publication.artifacts.map(template => {
    assert.equal(typeof template, "string", "Artifact names must be strings");
    const name = template.replaceAll("{version}", pkg.version);
    assert.ok(/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(name) && !name.includes(".."), `Unsafe artifact name: ${name}`);
    assert.notEqual(name, "SUBMISSION.md", `Reserved artifact name: ${name}`);
    return name;
  });
  assert.equal(new Set(artifacts).size, artifacts.length, "Duplicate artifact name");
  assert.ok(Array.isArray(publication.channels) && publication.channels.length > 0 && publication.channels.length <= 20, "Declare publication channels");
  for (const channel of publication.channels) {
    assert.ok(typeof channel.name === "string" && channel.name.trim() && typeof channel.instructions === "string" && channel.instructions.trim(), "Channel needs name and instructions");
    assert.equal(new URL(channel.url).protocol, "https:", "Channel URLs must use HTTPS");
  }
  return { directory: root, id: port.slug, version: pkg.version, artifacts, channels: publication.channels, metadataHash: hash(bytes) };
}
function packageCommand(directory, signal) {
  return new Promise((done) => {
    const grouped = process.platform !== "win32";
    const child = spawn(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", "package"], {
      cwd: directory, detached: grouped, shell: !grouped, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, INIT_CWD: directory, PWD: directory },
    });
    let output = "", size = 0, failure, killer;
    const kill = (sig) => { if (child.pid) { try { grouped ? process.kill(-child.pid, sig) : child.kill(sig); } catch (error) { if (error.code !== "ESRCH") throw error; } } };
    const stop = (message) => { failure ??= message; kill("SIGTERM"); killer ??= setTimeout(() => kill("SIGKILL"), 1000); };
    const abort = () => stop("Packaging interrupted");
    const timer = setTimeout(() => stop("Packaging exceeded 180 seconds"), 180_000);
    const collect = bytes => { size += bytes.length; output = (output + bytes.toString()).slice(-8192); if (size > 4 * 1024 * 1024) stop("Packaging exceeded output limit"); };
    child.stdout.on("data", collect); child.stderr.on("data", collect);
    child.on("error", error => { failure ??= error.message; });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.on("close", code => {
      clearTimeout(timer); clearTimeout(killer); signal?.removeEventListener("abort", abort);
      if (grouped) kill("SIGKILL");
      done({ passed: !failure && code === 0, output, error: failure ?? `Package command exited ${code}` });
    });
  });
}

/** Read-only plan by default. Apply runs trusted port commands and stages only declared dist files. */
export async function packagePorts(directories, { apply = false, output, signal } = {}) {
  assert.equal(typeof apply, "boolean");
  assert.ok(Array.isArray(directories) && directories.length > 0 && directories.length <= 1000, "Select 1–1000 publication-ready port checkouts");
  const ports = [], seen = new Set();
  for (const directory of directories) {
    try {
      const port = await inspect(directory);
      assert.ok(!seen.has(port.id), `Duplicate port slug: ${port.id}`); seen.add(port.id);
      ports.push({ ...port, status: "planned" });
    } catch (error) { ports.push({ directory: resolve(directory), status: "blocked", error: error.message }); }
  }
  const report = { schemaVersion: 1, apply, ready: ports.every(port => port.status === "planned"), ports };
  if (output) {
    const requested = resolve(output);
    output = join(await realpath(dirname(requested)), basename(requested));
    assert.ok(!ports.some(port => inside(port.directory, output)), "Output must be outside the selected checkouts");
    assert.equal(await lstat(output).catch(error => { if (error.code !== "ENOENT") throw error; }), undefined, "Output already exists; select a new directory");
    report.output = output;
  }
  if (!apply || !report.ready) return report;
  assert.ok(output, "Apply requires --output <new-directory>");
  assert.ok(!signal?.aborted, "Packaging interrupted before apply");
  await mkdir(output); // Exclusive: no old release bundle can be mistaken for this run.
  for (const port of ports) {
    if (signal?.aborted) { port.status = "failed"; port.error = "Packaging interrupted"; continue; }
    try {
      const previous = await Promise.all(port.artifacts.map(name => lstat(join(port.directory, "dist", name), { bigint: true }).catch(error => { if (error.code !== "ENOENT") throw error; })));
      const result = await packageCommand(port.directory, signal);
      assert.ok(result.passed, `${result.error}\n${result.output}`);
      assert.equal(hash(await regular(port.directory, "publication.json", 64 * 1024)), port.metadataHash, "Publication metadata changed during packaging");
      assert.equal(JSON.parse(await regular(port.directory, "package.json")).version, port.version, "Package version changed during packaging");
      const artifacts = [];
      for (const [index, name] of port.artifacts.entries()) {
        const bytes = await regular(port.directory, `dist/${name}`, 128 * 1024 * 1024);
        const current = await lstat(join(port.directory, "dist", name), { bigint: true }), before = previous[index];
        assert.ok(!before || current.ino !== before.ino || current.mtimeNs !== before.mtimeNs || current.ctimeNs !== before.ctimeNs, `Package command left a stale artifact: ${name}`);
        artifacts.push({ name, bytes, sha256: hash(bytes), size: bytes.length });
      }
      const destination = join(output, port.id);
      await mkdir(destination);
      for (const { name, bytes } of artifacts) await writeFile(join(destination, name), bytes, { flag: "wx" });
      await writeFile(join(destination, "SUBMISSION.md"), `# ${port.id} ${port.version}\n\nPrepared locally; nothing has been published. Review identities, versions and credentials before submitting.\n\n${port.channels.map(channel => `## ${channel.name}\n\n${channel.url}\n\n${channel.instructions}\n`).join("\n")}`);
      port.files = artifacts.map(({ bytes, ...artifact }) => artifact);
      port.status = "packaged";
    } catch (error) { port.status = "failed"; port.error = error.message; }
  }
  report.ready = ports.every(port => port.status === "packaged");
  await writeFile(join(output, "manifest.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  await writeFile(join(output, "SHA256SUMS"), ports.flatMap(port => (port.files ?? []).map(file => `${file.sha256}  ${port.id}/${file.name}\n`)).join(""), { flag: "wx" });
  return report;
}
