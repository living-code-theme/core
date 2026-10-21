import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const env = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
export const git = (directory, ...args) => execFileSync("git", ["-C", directory, ...args], { env: env(), encoding: "utf8" }).trim();
async function commit(directory) {
  git(directory, "init", "--initial-branch=main");
  git(directory, "config", "user.name", "Palette batch test"); git(directory, "config", "user.email", "batch@example.test");
  git(directory, "config", "commit.gpgsign", "false"); git(directory, "config", "core.hooksPath", "/dev/null");
  git(directory, "add", "."); git(directory, "commit", "-m", "fixture");
}
const script = `import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
const step=process.argv[2],cfg=JSON.parse(readFileSync('fixture.json'));
assert.equal(process.env.INIT_CWD,process.cwd());
// pnpm may add its own module paths; inherited host injection must still be absent.
assert.ok(!process.env.NODE_PATH?.includes('/this-must-not-be-used'));
assert.ok(!process.env.NODE_OPTIONS?.includes('/this-must-not-be-imported.mjs'));
assert.deepEqual(Object.keys(process.env).filter(k=>k.startsWith('GIT_')&&k!=='GIT_OPTIONAL_LOCKS'),[]);
appendFileSync('.git/events',step+'\\n');
if(step==='palette:update'){
 const core=process.argv[3],data=JSON.parse(readFileSync(core+'/exports/ports/palette.json'));
 data.source.revision=execFileSync('git',['-C',core,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 writeFileSync('palette/theme.json',JSON.stringify(data,null,2)+'\\n');
 if(cfg.outside)writeFileSync('README.md','unexpected edit');
 if(cfg.changeCore)writeFileSync(core+'/palette/flavors.mjs','// unexpected concurrent palette edit\\n');
}
const pin=JSON.parse(readFileSync('palette/theme.json'));
if(step==='build')writeFileSync('theme.conf',pin.source.revision+'\\n');
if(step==='check')assert.equal(readFileSync('theme.conf','utf8'),pin.source.revision+'\\n');
if(cfg.fail===step){console.error('intentional test failure');process.exit(7)}
if(cfg.flood===step)process.stdout.write('x'.repeat(5*1024*1024));
if(cfg.hang===step){
 spawn(process.execPath,['-e',"setTimeout(()=>require('node:fs').writeFileSync('.git/late-write','bad'),1200)"],{stdio:'ignore'});
 setTimeout(()=>{},60000);
}
`;
export async function batchFixture(t, configurations = [{}, {}]) {
  const directory = await mkdtemp(join(tmpdir(), "living-code-palette-batch-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const core = join(directory, "core"); await mkdir(core);
  for (const path of ["palette/flavors.mjs", "src/color.mjs", "src/resolve.mjs", "exports/ports/palette.json"]) {
    await mkdir(join(core, path, ".."), { recursive: true }); await cp(join(root, path), join(core, path));
  }
  await commit(core);
  const exported = JSON.parse(await readFile(join(core, "exports/ports/palette.json")));
  const ports = [];
  for (const [i, cfg] of configurations.entries()) {
    const port = join(directory, `port-${i}`); ports.push(port);
    await mkdir(join(port, "scripts"), { recursive: true }); await mkdir(join(port, "src")); await mkdir(join(port, "palette"));
    await writeFile(join(port, "package.json"), JSON.stringify({ name: `batch-fixture-${i}`, private: true, type: "module", scripts: Object.fromEntries(["palette:update", "build", "check", "test"].map(s => [s, `node scripts/run.mjs ${s}`])) }));
    await writeFile(join(port, "port.json"), JSON.stringify({ schemaVersion: 1, name: `Port ${i}`, group: "Editors", flavors: ["night"], images: [] }));
    await writeFile(join(port, "fixture.json"), JSON.stringify(cfg));
    await writeFile(join(port, "scripts/run.mjs"), script);
    await writeFile(join(port, "scripts/color.mjs"), await readFile(join(core, "src/color.mjs")));
    await writeFile(join(port, "scripts/generated.json"), JSON.stringify(["theme.conf"]));
    for (const path of ["scripts/palette.mjs", "scripts/update-palette.mjs", "scripts/generate.mjs", "src/generate.mjs"]) await writeFile(join(port, path), "// Fixture-owned maintenance code.\n");
    await writeFile(join(port, "palette/theme.json"), JSON.stringify({ ...exported, source: { ...exported.source, revision: "a".repeat(40) } }, null, 2) + "\n");
    await writeFile(join(port, "theme.conf"), "a".repeat(40) + "\n");
    await writeFile(join(port, "README.md"), "Port-owned documentation\n");
    await writeFile(join(port, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    await commit(port);
  }
  return { directory, core, ports, revision: git(core, "rev-parse", "HEAD"), events: (port) => readFile(join(port, ".git/events"), "utf8").catch(() => "") };
}
