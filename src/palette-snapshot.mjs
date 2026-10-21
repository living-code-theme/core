// A port-agnostic, resolved palette export. Ports pin this data, not a sibling checkout.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ANSI_ORDER } from "./resolve.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const inputs = ["palette/flavors.mjs", "src/color.mjs", "src/resolve.mjs"];

export function paletteSnapshot(flavors) {
  const data = JSON.parse(JSON.stringify({ schemaVersion: 1, ansiOrder: ANSI_ORDER, flavors }));
  return {
    ...data,
    source: {
      repository: "https://github.com/living-code-theme/core",
      inputs: Object.fromEntries(inputs.map((path) => [path, sha256(readFileSync(new URL(`../${path}`, import.meta.url)))])),
      sha256: sha256(JSON.stringify(data)),
    },
  };
}

export const paletteSnapshotJson = (flavors) => JSON.stringify(paletteSnapshot(flavors), null, 2) + "\n";
