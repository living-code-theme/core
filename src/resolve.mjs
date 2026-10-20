import { css, hex, mix, rgb, toGamut } from "./color.mjs";
import { defaultAnsi, defaultRoles, flavors, flavorOrder, roleStyles } from "../palette/flavors.mjs";

export const ANSI_ORDER = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
export const NEUTRAL_ORDER = ["crust", "base", "mantle", "surface0", "surface1", "surface2", "overlay", "comment", "subtext", "text2", "text"];
export const ACCENT_ORDER = ["teal", "mint", "aqua", "steel", "amber", "copper", "flare", "moss", "orchid", "rose"];

export function resolveFlavor(id, adjust = {}) {
  const src = flavors[id];
  const { chroma = 1, light = 0, hue = 0 } = adjust;
  const raw = { ...src.neutrals };
  for (const [n, [L, C, h]] of Object.entries(src.accents)) {
    raw[n] = [Math.min(0.98, Math.max(0.2, L + light)), C * chroma, h + hue];
  }
  const colors = Object.fromEntries(
    Object.entries(raw).map(([n, c]) => {
      const g = toGamut(c);
      return [n, { oklch: c, css: css(c), hex: hex(c), rgb: rgb(c), clipped: g[1] < c[1] - 1e-4 }];
    }),
  );
  const roles = { ...defaultRoles, ...(src.roles || {}) };
  const ansiSpec = { ...defaultAnsi, ...(src.ansi || {}) };
  const pick = (v) => (typeof v === "string" ? raw[v] : v);
  const lift = ([L, C, h]) => [src.light ? L - 0.08 : Math.min(0.92, L + 0.08), C * 0.85, h];
  const normalRaw = ANSI_ORDER.map((n) => pick(ansiSpec[n]));
  const brightRaw = ANSI_ORDER.map((n, i) => (ansiSpec["bright" + n] ? pick(ansiSpec["bright" + n]) : lift(normalRaw[i])));

  const f = {
    id,
    name: src.name,
    slug: `living-code-${id}`,
    light: !!src.light,
    description: src.description,
    raw,
    colors,
    roles,
    styles: roleStyles,
    ansiRaw: { normal: normalRaw, bright: brightRaw },
    ansi: { normal: normalRaw.map(hex), bright: brightRaw.map(hex) },
    c: (name) => colors[name].hex,
    r: (role) => colors[roles[role]].hex,
    rr: (role) => raw[roles[role]],
    mix: (a, b, t) => hex(mix(f.resolve(a), f.resolve(b), t)),
    resolve: (x) => (Array.isArray(x) ? x : raw[x] ?? raw[roles[x]]),
    ansi16: (n) => (n.startsWith("bright") ? f.ansi.bright[ANSI_ORDER.indexOf(n.slice(6))] : f.ansi.normal[ANSI_ORDER.indexOf(n)]),
  };
  return f;
}

export const resolveAll = (adjust) => flavorOrder.map((id) => resolveFlavor(id, adjust));
export { flavors, flavorOrder };
