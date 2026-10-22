# Living Code brand icons

The `[lc]` mark uses the actual **JetBrains Mono 2.304 Bold** glyph outlines. No installed font, remote font request, substitute typeface, gradients or shadows are involved.

- Foreground: Night teal, `#00a692`.
- Background: Night base, `#05080b`.
- Both colors come from `palette/flavors.mjs`, not independent hard-coded design tokens.

## GitHub organization

Upload **`github-avatar.png`** as the organization profile picture.

- 1024 × 1024, sRGB PNG, opaque background.
- Full-bleed square; GitHub supplies its own square/circular mask.
- Visible glyph bounds are centered, with enough clearance for a circular crop.
- `github-avatar.svg` is the resolution-independent master.

`publisher-128.png` is the 128 × 128 sRGB PNG for publisher profiles, rendered from the same master with the same circle-safe padding.

The master has no baked-in rounded corners, so it also works when reused as an app/touch icon with a platform-supplied mask.

## Website

The landing serves these files from its `public/` directory; copy them there after a change:

| File | Purpose |
|---|---|
| `favicon.svg` | Scalable favicon, with tighter spacing for small sizes |
| `favicon.ico` | PNG-backed 16, 32 and 48 px images in one ICO container |
| `favicon-16.png` | Exact 16 × 16 raster |
| `favicon-32.png` | 32 × 32 PNG fallback |
| `favicon-48.png` | Exact 48 × 48 raster |
| `apple-touch-icon.png` | Opaque 180 × 180 touch icon |

The favicon has its own composition: the same unaltered glyph shapes, tighter character spacing, a larger mark relative to the tile, and transparent rounded corners. It is not a downscaled avatar. It intentionally keeps the complete `[lc]` mark at all sizes.

## Regenerate

From the repository root:

```sh
pnpm build
pnpm icons:brand
```

The first command regenerates the SVG masters from `src/brand.mjs`. The second rasterizes them using Chromium in sRGB and creates the ICO container. Set `CHROME_BIN` if the executable is not `google-chrome`.

`raster-sources.json` records source and output hashes. Tests verify that committed raster assets match the current masters, so palette or artwork changes require a deliberate raster refresh.

## Mascot and port identity

Living Code's mascot is the **chameleon**. Use 🦎 as its text-only shorthand: Unicode has no dedicated chameleon emoji. Actual mascot artwork should depict a chameleon, not a generic lizard.

The mascot complements the `[lc]` lettermark; it does not replace it. Port READMEs share a chameleon signature and use a separate, application-specific emoji in their title, owned by each repository's `port.json`. Keep these accents restrained rather than adding an emoji to every section or replacing application logos.

## Font license

Glyph outlines are from JetBrains Mono 2.304 Bold, copyright 2020 The JetBrains Mono Project Authors, licensed under the SIL Open Font License 1.1. See [OFL-JetBrainsMono.txt](OFL-JetBrainsMono.txt).
