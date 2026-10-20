// Core → landing export. The landing commits these files and never imports core modules at build time.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { contrast } from "./color.mjs";
import { GLYPHS } from "./glyphs.mjs";
import { themeCss } from "./outputs.mjs";
import { ACCENT_ORDER, ANSI_ORDER, NEUTRAL_ORDER } from "./resolve.mjs";

export const REPOSITORY = "https://github.com/living-code-theme/core";
export const SLOGAN = "Calm slate. Living color.";
// Roles drawn as text on the background; each must reach WCAG AA (4.5:1) in every flavor.
export const TEXT_ROLES = ["fg", "fgAlt", "fgMuted", "fgSubtle", "keyword", "function", "string", "number", "constant", "type", "decorator", "tag", "property", "parameter", "comment", "operator", "error", "warning", "info", "hint", "success", "link", "heading", "lineNumberActive"];
export const MINIMUM_CONTRAST = 4.5;

const anchor = (heading) => heading.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

/** Deterministic, reviewable snapshot of the resolved theme plus the matching CSS. */
export function landingFiles(flavors, { readme }) {
  const css = themeCss(flavors);
  const theme = {
    schemaVersion: 1,
    slogan: SLOGAN,
    accentOrder: ACCENT_ORDER, ansiOrder: ANSI_ORDER, neutralOrder: NEUTRAL_ORDER,
    minimumContrast: MINIMUM_CONTRAST, textRoles: TEXT_ROLES,
    documentationAnchors: [...new Set([...readme.matchAll(/^#+ (.+)$/gm)].map(([, heading]) => anchor(heading)))],
    glyphs: GLYPHS,
    flavors: flavors.map((f) => ({
      ...f,
      contrastToBase: Object.fromEntries(Object.keys(f.colors).map((name) => [name, contrast(f.raw[name], f.raw.base)])),
    })),
  };
  // Functions are deliberately absent from JSON. The consumer adds only its small color accessors.
  const snapshot = JSON.parse(JSON.stringify(theme));
  snapshot.source = {
    repository: REPOSITORY,
    sha256: createHash("sha256").update(JSON.stringify(snapshot)).update(css).digest("hex"),
  };
  return [
    { path: "exports/landing/theme.json", content: JSON.stringify(snapshot, null, 2) + "\n" },
    { path: "exports/landing/theme.css", content: css },
    { path: "exports/landing/port.schema.json", content: readFileSync(new URL("../schemas/port.schema.json", import.meta.url), "utf8") },
  ];
}
