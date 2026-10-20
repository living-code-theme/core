#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { flavorOrder } from "../src/resolve.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const browser = process.env.CHROME_BIN || "google-chrome";
const tmp = await mkdtemp(join(tmpdir(), "living-code-screenshots-"));
const server = spawn(process.execPath, [join(root, "scripts/serve.mjs"), "0"], { stdio: ["ignore", "pipe", "pipe"] });

try {
  const url = await new Promise((resolve, reject) => {
    let output = "", errors = "";
    const timer = setTimeout(() => reject(new Error("Preview server did not start within 10 seconds")), 10000);
    const finish = (fn, value) => { clearTimeout(timer); fn(value); };
    server.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/localhost:\d+\/preview\//);
      if (match) finish(resolve, match[0]);
    });
    server.stderr.on("data", (chunk) => { errors += chunk; });
    server.on("error", (error) => finish(reject, error));
    server.on("exit", (code) => finish(reject, new Error(`Preview server exited (${code}): ${errors}`)));
  });

  for (const id of flavorOrder) {
    const path = join(tmp, `preview-${id}.png`);
    const result = spawnSync(browser, [
      "--headless", "--no-sandbox", "--disable-gpu", "--disable-background-networking",
      "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
      `--user-data-dir=${join(tmp, `profile-${id}`)}`,
      "--window-size=1280,720", "--force-device-scale-factor=1", "--force-color-profile=srgb",
      "--virtual-time-budget=2000", `--screenshot=${path}`, "--dump-dom", `${url}?shot=${id}`,
    ], { encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    if (result.error?.code === "ENOENT") throw new Error(`Cannot find ${browser}. Install Chrome/Chromium or set CHROME_BIN.`);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Chrome failed for ${id}: ${result.stderr}`);
    if (!result.stdout.includes(`<span id="kthemeName">living-code-${id}</span>`)) {
      throw new Error(`The ${id} preview did not finish rendering; existing images have not been replaced.`);
    }
    const png = await readFile(path);
    if (png.toString("hex", 0, 8) !== "89504e470d0a1a0a" || png.readUInt32BE(16) !== 1280 || png.readUInt32BE(20) !== 720) {
      throw new Error(`Unexpected screenshot format or dimensions for ${id}`);
    }
  }

  for (const id of flavorOrder) {
    const name = `preview-${id}.png`;
    await copyFile(join(tmp, name), join(root, "assets", name));
    console.log(`wrote assets/${name}`);
  }
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
} finally {
  server.kill();
  await rm(tmp, { recursive: true, force: true });
}
