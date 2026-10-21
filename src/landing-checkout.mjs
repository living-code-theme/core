// Maintainer commands receive a checkout explicitly; core never assumes a sibling repository.
import { spawnSync } from "node:child_process";
import { cp, lstat, readFile, realpath } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export async function landingCheckout(directory) {
  if (!directory) throw new Error("Specify the website checkout with --landing <directory>");
  const root = await realpath(directory);
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (!pkg.dependencies?.astro || pkg.scripts?.build !== "astro build") throw new Error(`Not an Astro landing checkout: ${root}`);
  return root;
}

/** Copy only committed build inputs, not credentials, symlinks, dependencies or caches. */
export async function copyLanding(source, directory) {
  const excluded = new Set(["node_modules", "dist", ".astro", ".git", ".wrangler", ".port-discovery.lock"]);
  await cp(source, directory, { recursive: true, filter: async (path) => {
    const parts = relative(source, path).split(sep);
    if (parts.some((part) => excluded.has(part) || part.startsWith(".env") || part.startsWith(".dev.vars"))) return false;
    if ((await lstat(path)).isSymbolicLink()) throw new Error(`Landing inputs cannot depend on symlinks: ${path}`);
    return true;
  } });
}

export function runLanding(directory, args, { ci = false } = {}) {
  const env = { ...process.env, ...(ci ? { CI: "true" } : {}), INIT_CWD: directory, PWD: directory };
  delete env.NODE_PATH;
  const child = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
    cwd: directory, env, stdio: "inherit", shell: process.platform === "win32",
  });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`Landing ${args[0]} failed (${child.signal ?? child.status})`);
}
