// Port-agnostic outputs of the palette: data any language can read, and CSS custom properties.
// Ports own their own formats; these are the shared reference values they follow.

const kebab = (s) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

/** Hex, OKLCH, RGB, semantic roles and ANSI for every flavor. Same shape as @living-code/palette. */
export function paletteData(flavors) {
  return Object.fromEntries(flavors.map((f) => [f.id, {
    name: f.name,
    light: f.light,
    colors: Object.fromEntries(Object.entries(f.colors).map(([n, c]) => [n, { hex: c.hex, oklch: c.css, rgb: c.rgb }])),
    roles: f.roles,
    ansi: f.ansi,
  }]));
}

export const paletteJson = (flavors) => JSON.stringify(paletteData(flavors), null, 2) + "\n";

// A role named like a palette color (the comment role is the comment color) is already declared by the palette.
// Declaring it again as var(--lc-comment) would make the variable refer to itself, which CSS treats as invalid.
const block = (f, sel) => `${sel} {
  color-scheme: ${f.light ? "light" : "dark"};
${Object.entries(f.colors).map(([n, c]) => `  --lc-${kebab(n)}: ${c.css};`).join("\n")}

${Object.entries(f.roles).filter(([role]) => !(role in f.colors)).map(([role, n]) => `  --lc-${kebab(role)}: var(--lc-${kebab(n)});`).join("\n")}
}`;

/** Every flavor as `--lc-*` custom properties, selected with data-theme; the first flavor is the default. */
export function themeCss(flavors) {
  const [first] = flavors;
  return `${block(first, `:root,\n[data-theme="${first.slug}"]`)}

${flavors.slice(1).map((f) => block(f, `[data-theme="${f.slug}"]`)).join("\n\n")}

${block(first, `[data-theme="living-code-auto"]`)}

@media (prefers-color-scheme: light) {
${block(flavors.find((f) => f.light), `  [data-theme="living-code-auto"]`).replace(/\n/g, "\n  ")}
}
`;
}

/** Files offered by the live preview's export panel (they follow its sliders). */
export const exportFiles = (flavors) => [
  { path: "palette.json", content: paletteJson(flavors) },
  { path: "living-code.css", content: themeCss(flavors) },
];
