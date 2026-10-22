import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const meta = JSON.parse(await readFile(join(root, "port.json"), "utf8"));
const guide = await readFile(join(root, "README.md"), "utf8");
const installation = guide.split("## Installation\n")[1].split("\n## Flavors")[0];

test("every shipped flavor has a current, integrity-checked 2560×1600 native screenshot", async () => {
  const result = spawnSync("python3", ["scripts/capture.py", "--check"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  assert.deepEqual(meta.images.map(image => image.flavor), meta.flavors);
  for (const image of meta.images) {
    const bytes = await readFile(join(root, image.path));
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [2560, 1600], image.path);
  }
  assert.doesNotMatch(guide, /screenshots have not been captured|capture is not available/);
});

test("installation selects a flavor and downloads native files without cloning", () => {
  assert.match(installation, /flavor=night/);
  assert.match(installation, /curl -fsSL --create-dirs/);
  assert.ok(installation.includes(`https://raw.githubusercontent.com/living-code-theme/${meta.slug}/main/`));
  assert.doesNotMatch(installation, /git clone|\bcd \S|cp themes\/|pnpm install/);
});

test("the documented download block installs each flavor to its native destination and preserves existing configs", async t => {
  const sandbox = await mkdtemp(join(tmpdir(), "living-code-install-"));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const home = join(sandbox, "home with spaces"), bin = join(sandbox, "bin");
  await mkdir(home); await mkdir(bin);
  const variables = { home, config: join(home, "xdg config"), data: join(home, "xdg data"),
    agent: join(home, "pi agent"), claude: join(home, "claude config"), codex: join(home, "codex home") };
  variables.crush = join(variables.config, "crush");
  variables.herdr = join(variables.config, "herdr");
  variables.docker = join(variables.config, "lazydocker");
  variables.rio = join(variables.config, "rio");
  const log = join(sandbox, "downloads.jsonl");
  // Stub only the transport and process launch. The shell executes the README's exact command block.
  await writeFile(join(bin, "curl"), `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2), option = args.findIndex(x => x === '-o');
if (option < 0) throw new Error('curl must name its destination');
const url = new URL(args.at(-1));
const prefix = '/living-code-theme/' + process.env.PORT_SLUG + '/main/';
if (url.origin !== 'https://raw.githubusercontent.com' || !url.pathname.startsWith(prefix)) throw new Error('Wrong download repository');
const source = url.pathname.slice(prefix.length), manifest = JSON.parse(fs.readFileSync(path.join(process.env.PORT_ROOT, 'port.json')));
if (!manifest.files.includes(source)) throw new Error('README requests a nonexistent native file: ' + source);
const target = args[option + 1];
if (!path.resolve(target).startsWith(process.env.HOME + path.sep)) throw new Error('Install escaped temporary home');
fs.mkdirSync(path.dirname(target), {recursive:true});
fs.copyFileSync(path.join(process.env.PORT_ROOT, source), target);
fs.appendFileSync(process.env.INSTALL_LOG, JSON.stringify({source, destination:target}) + '\\n');
`, { mode: 0o755 });
  for (const command of ["aider", "btm", "gitui", "codex", "pi", "posting", "nu"]) {
    await writeFile(join(bin, command), '#!/bin/sh\n' + (command === "nu" ? 'printf "%s\\n" "$XDG_CONFIG_HOME/nushell"\n' : command === "posting" ? 'if [ "$1" = locate ]; then printf "Themes directory:\\n%s\\n" "$XDG_DATA_HOME/posting/themes"; fi\n' : 'exit 0\n'), { mode: 0o755 });
  }
  const existing = [join(variables.claude, "settings.json"), join(variables.codex, "config.toml"),
    join(variables.herdr, "config.toml"), join(variables.docker, "config.yml"), join(home, ".aider.conf.yml"),
    join(home, ".gemini/settings.json"), join(variables.config, "bottom/bottom.toml"),
    join(variables.config, "opencode/tui.json"), join(variables.rio, "config.toml")];
  for (const file of existing) { await mkdir(dirname(file), { recursive: true }); await writeFile(file, "preserve existing user settings\n"); }
  const env = { PATH: bin + ":" + process.env.PATH, HOME: home, XDG_CONFIG_HOME: variables.config,
    XDG_DATA_HOME: variables.data, PI_CODING_AGENT_DIR: variables.agent, CLAUDE_CONFIG_DIR: variables.claude,
    CODEX_HOME: variables.codex, CRUSH_GLOBAL_CONFIG: variables.crush,
    HERDR_CONFIG_PATH: join(variables.herdr, "config.toml"), CONFIG_DIR: variables.docker, RIO_CONFIG_HOME: variables.rio,
    PORT_SLUG: meta.slug, PORT_ROOT: root, INSTALL_LOG: log };
  const recipe = JSON.parse(await readFile(join(root, "capture/install.json"), "utf8"));
  const block = installation.match(/```sh\n([\s\S]*?)\n```/)?.[1];
  assert.ok(block, "provide a copyable shell download block");
  for (const flavor of meta.flavors) {
    await writeFile(log, "");
    execFileSync("sh", ["-eu", "-c", block.replace("flavor=night", `flavor=${flavor}`)], { env, stdio: "pipe" });
    const actual = (await readFile(log, "utf8")).trim().split("\n").map(line => JSON.parse(line));
    const expand = text => text.replace(/\{(\w+)\}/g, (_, key) => key === "flavor" ? flavor : variables[key] ?? `{${key}}`);
    assert.deepEqual(actual, recipe.downloads.map(item => ({ source: expand(item.source), destination: expand(item.destination) })));
    for (const item of actual) assert.deepEqual(await readFile(item.destination), await readFile(join(root, item.source)));
    for (const file of existing) assert.equal(await readFile(file, "utf8"), "preserve existing user settings\n");
  }
});
