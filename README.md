<h1 align="center">Living Code</h1>

<p align="center"><b>Calm slate. Living color.</b><br>
A color scheme where the background stays quiet and the code comes alive.<br>
For editors, terminals, browsers and the web.</p>

<p align="center">
<img src="assets/preview-night.png" width="49%" alt="Living Code Night">
<img src="assets/preview-frost.png" width="49%" alt="Living Code Frost">
<img src="assets/preview-paper.png" width="49%" alt="Living Code Paper">
<img src="assets/preview-signal.png" width="49%" alt="Living Code Signal">
</p>

This is the **core** of Living Code: the palette, the color math that resolves it, semantic roles, the `[lc]` brand and
shared tooling. It is agnostic to any app. Each port lives in its own repository in
[living-code-theme](https://github.com/living-code-theme), and [living-code.dev](https://living-code.dev) lists them all.

## Choose a flavor

Every flavor shares the same slate foundation and semantic roles. Night is the default.

| Flavor | Appearance | Syntax and accents |
|---|---|---|
| [Night](#living-code-night) | Dark slate, full palette | Cool structure, green strings, copper numbers and amber warnings. The default. |
| [Frost](#living-code-frost) | Lifted, bluer slate | Lower-chroma accents with green strings and copper numbers. |
| [Paper](#living-code-paper) | Near-white slate | Darker accents with green strings and copper numbers. |
| [Signal](#living-code-signal) | Dark slate, one accent | Minimal variant of Night: teal keywords and tags, everything else neutral. |

## Install

Install the port for your app: find it on [living-code.dev/ports](https://living-code.dev/ports/) or in the
[organization's repositories](https://github.com/orgs/living-code-theme/repositories). Each port's README has its
installation steps. Nobody needs to clone this repository to use the theme.

## Design

- **The ground stays calm.** Backgrounds, panels, selections, punctuation and comments live on one slate ramp, so the eye goes to the code, not the chrome.
- **Cool for structure, warm for data.** <img src="assets/swatches/00a692.svg" width="18" height="18" alt="#00a692"> Teal, aqua and steel mark keywords, functions and types; <img src="assets/swatches/8acb83.svg" width="18" height="18" alt="#8acb83"> moss, <img src="assets/swatches/f0be6d.svg" width="18" height="18" alt="#f0be6d"> amber and <img src="assets/swatches/e18c5f.svg" width="18" height="18" alt="#e18c5f"> copper mark strings, numbers and warnings.
- **Same roles everywhere.** Each port maps the same semantic roles (keyword, string, error, border...), so a theme feels the same in your editor, terminal and browser.
- **Built in OKLCH.** Every palette value is defined in OKLCH; hex and RGB are derived. The build checks 24 text roles for WCAG AA contrast (≥ 4.5:1) against each flavor's background.

## Flavors

### Living Code Night

The default. Dark slate ground, teal structure, green strings and gray comments. Amber warnings and copper numbers keep their warm contrast.

<img src="assets/preview-night.png" width="100%" alt="Living Code Night: editor syntax, terminal output and ANSI palette">

<details open>
<summary>Palette</summary>

**Neutrals**

| | Name | Hex | OKLCH | Used for |
|:-:|---|---|---|---|
| <img src="assets/swatches/020405.svg" width="18" height="18" alt="#020405"> | `crust` | `#020405` | `oklch(0.1 0.01 240)` | sidebars, tab bars, status lines |
| <img src="assets/swatches/05080b.svg" width="18" height="18" alt="#05080b"> | `base` | `#05080b` | `oklch(0.13 0.01 240)` | background |
| <img src="assets/swatches/090e11.svg" width="18" height="18" alt="#090e11"> | `mantle` | `#090e11` | `oklch(0.16 0.01 240)` | floats, cards, popups |
| <img src="assets/swatches/12171a.svg" width="18" height="18" alt="#12171a"> | `surface0` | `#12171a` | `oklch(0.2 0.01 240)` | line highlight, inactive tabs |
| <img src="assets/swatches/1d2226.svg" width="18" height="18" alt="#1d2226"> | `surface1` | `#1d2226` | `oklch(0.25 0.01 240)` | borders, ANSI black |
| <img src="assets/swatches/2d3438.svg" width="18" height="18" alt="#2d3438"> | `surface2` | `#2d3438` | `oklch(0.32 0.012 240)` | selection |
| <img src="assets/swatches/50565b.svg" width="18" height="18" alt="#50565b"> | `overlay` | `#50565b` | `oklch(0.45 0.012 240)` | line numbers, punctuation |
| <img src="assets/swatches/747c80.svg" width="18" height="18" alt="#747c80"> | `comment` | `#747c80` | `oklch(0.58 0.012 235)` | comments, operators |
| <img src="assets/swatches/9ba0a2.svg" width="18" height="18" alt="#9ba0a2"> | `subtext` | `#9ba0a2` | `oklch(0.7023 0.0065 223.49)` | muted text, ANSI white |
| <img src="assets/swatches/c8cfd4.svg" width="18" height="18" alt="#c8cfd4"> | `text2` | `#c8cfd4` | `oklch(0.85 0.01 240)` | properties, parameters |
| <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> | `text` | `#e2e9ee` | `oklch(0.93 0.01 240)` | foreground |

**Accents**

| | Name | Hex | OKLCH | Used for |
|:-:|---|---|---|---|
| <img src="assets/swatches/00a692.svg" width="18" height="18" alt="#00a692"> | `teal` | `#00a692` | `oklch(0.65 0.15 180)` | accent · cursor · borderActive · heading |
| <img src="assets/swatches/52d7c1.svg" width="18" height="18" alt="#52d7c1"> | `mint` | `#52d7c1` | `oklch(0.8 0.12 180)` | hint · keyword · builtin |
| <img src="assets/swatches/9ae0dd.svg" width="18" height="18" alt="#9ae0dd"> | `aqua` | `#9ae0dd` | `oklch(0.86 0.07 192)` | function · link |
| <img src="assets/swatches/80b6d3.svg" width="18" height="18" alt="#80b6d3"> | `steel` | `#80b6d3` | `oklch(0.75 0.07 232)` | info · type · namespace |
| <img src="assets/swatches/f0be6d.svg" width="18" height="18" alt="#f0be6d"> | `amber` | `#f0be6d` | `oklch(0.83 0.115 78)` | lineNumberActive · match · warning · modified · code |
| <img src="assets/swatches/e18c5f.svg" width="18" height="18" alt="#e18c5f"> | `copper` | `#e18c5f` | `oklch(0.72 0.12 48)` | number · constant · escape |
| <img src="assets/swatches/e96560.svg" width="18" height="18" alt="#e96560"> | `flare` | `#e96560` | `oklch(0.67 0.165 25)` | error · removed |
| <img src="assets/swatches/8acb83.svg" width="18" height="18" alt="#8acb83"> | `moss` | `#8acb83` | `oklch(0.78 0.12 142)` | success · added · string |
| <img src="assets/swatches/bf91cd.svg" width="18" height="18" alt="#bf91cd"> | `orchid` | `#bf91cd` | `oklch(0.72 0.1 318)` | regex · decorator · tag |
| <img src="assets/swatches/ddaec3.svg" width="18" height="18" alt="#ddaec3"> | `rose` | `#ddaec3` | `oklch(0.8 0.06 350)` | Available for custom accents |

**ANSI**

| | black | red | green | yellow | blue | magenta | cyan | white |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| normal | <img src="assets/swatches/1d2226.svg" width="18" height="18" alt="#1d2226"> | <img src="assets/swatches/e96560.svg" width="18" height="18" alt="#e96560"> | <img src="assets/swatches/8acb83.svg" width="18" height="18" alt="#8acb83"> | <img src="assets/swatches/f0be6d.svg" width="18" height="18" alt="#f0be6d"> | <img src="assets/swatches/80b6d3.svg" width="18" height="18" alt="#80b6d3"> | <img src="assets/swatches/bf91cd.svg" width="18" height="18" alt="#bf91cd"> | <img src="assets/swatches/00a692.svg" width="18" height="18" alt="#00a692"> | <img src="assets/swatches/9ba0a2.svg" width="18" height="18" alt="#9ba0a2"> |
| bright | <img src="assets/swatches/50565b.svg" width="18" height="18" alt="#50565b"> | <img src="assets/swatches/fa8880.svg" width="18" height="18" alt="#fa8880"> | <img src="assets/swatches/abe2a4.svg" width="18" height="18" alt="#abe2a4"> | <img src="assets/swatches/ffdba5.svg" width="18" height="18" alt="#ffdba5"> | <img src="assets/swatches/a1cfe8.svg" width="18" height="18" alt="#a1cfe8"> | <img src="assets/swatches/d5ade2.svg" width="18" height="18" alt="#d5ade2"> | <img src="assets/swatches/1fc1ab.svg" width="18" height="18" alt="#1fc1ab"> | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> |

</details>

### Living Code Frost

Night on a lifted, bluer slate with a third less chroma. Calmer for long sessions; the warm/cool split survives at low saturation.

<img src="assets/preview-frost.png" width="100%" alt="Living Code Frost: editor syntax, terminal output and ANSI palette">

<details>
<summary>Palette</summary>

**Neutrals**

| | Name | Hex | OKLCH | Used for |
|:-:|---|---|---|---|
| <img src="assets/swatches/050a0f.svg" width="18" height="18" alt="#050a0f"> | `crust` | `#050a0f` | `oklch(0.14 0.015 245)` | sidebars, tab bars, status lines |
| <img src="assets/swatches/0a1016.svg" width="18" height="18" alt="#0a1016"> | `base` | `#0a1016` | `oklch(0.17 0.015 245)` | background |
| <img src="assets/swatches/10171c.svg" width="18" height="18" alt="#10171c"> | `mantle` | `#10171c` | `oklch(0.2 0.015 245)` | floats, cards, popups |
| <img src="assets/swatches/171e24.svg" width="18" height="18" alt="#171e24"> | `surface0` | `#171e24` | `oklch(0.23 0.015 245)` | line highlight, inactive tabs |
| <img src="assets/swatches/232a30.svg" width="18" height="18" alt="#232a30"> | `surface1` | `#232a30` | `oklch(0.28 0.015 245)` | borders, ANSI black |
| <img src="assets/swatches/333c43.svg" width="18" height="18" alt="#333c43"> | `surface2` | `#333c43` | `oklch(0.35 0.018 245)` | selection |
| <img src="assets/swatches/50565b.svg" width="18" height="18" alt="#50565b"> | `overlay` | `#50565b` | `oklch(0.45 0.012 240)` | line numbers, punctuation |
| <img src="assets/swatches/7d8489.svg" width="18" height="18" alt="#7d8489"> | `comment` | `#7d8489` | `oklch(0.61 0.012 235)` | comments, operators |
| <img src="assets/swatches/9ba0a2.svg" width="18" height="18" alt="#9ba0a2"> | `subtext` | `#9ba0a2` | `oklch(0.7023 0.0065 223.49)` | muted text, ANSI white |
| <img src="assets/swatches/c8cfd4.svg" width="18" height="18" alt="#c8cfd4"> | `text2` | `#c8cfd4` | `oklch(0.85 0.01 240)` | properties, parameters |
| <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> | `text` | `#e2e9ee` | `oklch(0.93 0.01 240)` | foreground |

**Accents**

| | Name | Hex | OKLCH | Used for |
|:-:|---|---|---|---|
| <img src="assets/swatches/43a997.svg" width="18" height="18" alt="#43a997"> | `teal` | `#43a997` | `oklch(0.67 0.0975 180)` | accent · cursor · borderActive · heading |
| <img src="assets/swatches/8ad5c6.svg" width="18" height="18" alt="#8ad5c6"> | `mint` | `#8ad5c6` | `oklch(0.82 0.078 180)` | hint · keyword · builtin |
| <img src="assets/swatches/b6e2df.svg" width="18" height="18" alt="#b6e2df"> | `aqua` | `#b6e2df` | `oklch(0.88 0.0455 192)` | function · link |
| <img src="assets/swatches/98bacd.svg" width="18" height="18" alt="#98bacd"> | `steel` | `#98bacd` | `oklch(0.77 0.0455 232)` | info · type · namespace |
| <img src="assets/swatches/e9c897.svg" width="18" height="18" alt="#e9c897"> | `amber` | `#e9c897` | `oklch(0.85 0.0748 78)` | lineNumberActive · match · warning · modified · code |
| <img src="assets/swatches/d49c80.svg" width="18" height="18" alt="#d49c80"> | `copper` | `#d49c80` | `oklch(0.74 0.078 48)` | number · constant · escape |
| <img src="assets/swatches/d68079.svg" width="18" height="18" alt="#d68079"> | `flare` | `#d68079` | `oklch(0.69 0.1073 25)` | error · removed |
| <img src="assets/swatches/a2cb9d.svg" width="18" height="18" alt="#a2cb9d"> | `moss` | `#a2cb9d` | `oklch(0.8 0.078 142)` | success · added · string |
| <img src="assets/swatches/bc9ec6.svg" width="18" height="18" alt="#bc9ec6"> | `orchid` | `#bc9ec6` | `oklch(0.74 0.065 318)` | regex · decorator · tag |
| <img src="assets/swatches/d9bac8.svg" width="18" height="18" alt="#d9bac8"> | `rose` | `#d9bac8` | `oklch(0.82 0.039 350)` | Available for custom accents |

**ANSI**

| | black | red | green | yellow | blue | magenta | cyan | white |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| normal | <img src="assets/swatches/232a30.svg" width="18" height="18" alt="#232a30"> | <img src="assets/swatches/d68079.svg" width="18" height="18" alt="#d68079"> | <img src="assets/swatches/a2cb9d.svg" width="18" height="18" alt="#a2cb9d"> | <img src="assets/swatches/e9c897.svg" width="18" height="18" alt="#e9c897"> | <img src="assets/swatches/98bacd.svg" width="18" height="18" alt="#98bacd"> | <img src="assets/swatches/bc9ec6.svg" width="18" height="18" alt="#bc9ec6"> | <img src="assets/swatches/43a997.svg" width="18" height="18" alt="#43a997"> | <img src="assets/swatches/9ba0a2.svg" width="18" height="18" alt="#9ba0a2"> |
| bright | <img src="assets/swatches/50565b.svg" width="18" height="18" alt="#50565b"> | <img src="assets/swatches/e99e97.svg" width="18" height="18" alt="#e99e97"> | <img src="assets/swatches/bfe3bb.svg" width="18" height="18" alt="#bfe3bb"> | <img src="assets/swatches/fce0b6.svg" width="18" height="18" alt="#fce0b6"> | <img src="assets/swatches/b6d3e3.svg" width="18" height="18" alt="#b6d3e3"> | <img src="assets/swatches/d4b9dc.svg" width="18" height="18" alt="#d4b9dc"> | <img src="assets/swatches/6fbfb0.svg" width="18" height="18" alt="#6fbfb0"> | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> |

</details>

### Living Code Paper

Daylight. Same two temperatures on near-white slate, lightness inverted so every syntax color keeps WCAG AA contrast.

<img src="assets/preview-paper.png" width="100%" alt="Living Code Paper: editor syntax, terminal output and ANSI palette">

<details>
<summary>Palette</summary>

**Neutrals**

| | Name | Hex | OKLCH | Used for |
|:-:|---|---|---|---|
| <img src="assets/swatches/e0e5e9.svg" width="18" height="18" alt="#e0e5e9"> | `crust` | `#e0e5e9` | `oklch(0.92 0.008 240)` | sidebars, tab bars, status lines |
| <img src="assets/swatches/f4f7f9.svg" width="18" height="18" alt="#f4f7f9"> | `base` | `#f4f7f9` | `oklch(0.975 0.004 240)` | background |
| <img src="assets/swatches/ebeff2.svg" width="18" height="18" alt="#ebeff2"> | `mantle` | `#ebeff2` | `oklch(0.95 0.006 240)` | floats, cards, popups |
| <img src="assets/swatches/e3e9ed.svg" width="18" height="18" alt="#e3e9ed"> | `surface0` | `#e3e9ed` | `oklch(0.93 0.008 240)` | line highlight, inactive tabs |
| <img src="assets/swatches/d2d8dd.svg" width="18" height="18" alt="#d2d8dd"> | `surface1` | `#d2d8dd` | `oklch(0.88 0.01 240)` | borders, ANSI black |
| <img src="assets/swatches/c2ccd3.svg" width="18" height="18" alt="#c2ccd3"> | `surface2` | `#c2ccd3` | `oklch(0.84 0.015 240)` | selection |
| <img src="assets/swatches/92999f.svg" width="18" height="18" alt="#92999f"> | `overlay` | `#92999f` | `oklch(0.68 0.012 240)` | line numbers, punctuation |
| <img src="assets/swatches/6b7378.svg" width="18" height="18" alt="#6b7378"> | `comment` | `#6b7378` | `oklch(0.55 0.012 235)` | comments, operators |
| <img src="assets/swatches/50565a.svg" width="18" height="18" alt="#50565a"> | `subtext` | `#50565a` | `oklch(0.45 0.01 240)` | muted text, ANSI white |
| <img src="assets/swatches/2e3437.svg" width="18" height="18" alt="#2e3437"> | `text2` | `#2e3437` | `oklch(0.32 0.01 240)` | properties, parameters |
| <img src="assets/swatches/12171a.svg" width="18" height="18" alt="#12171a"> | `text` | `#12171a` | `oklch(0.2 0.01 240)` | foreground |

**Accents**

| | Name | Hex | OKLCH | Used for |
|:-:|---|---|---|---|
| <img src="assets/swatches/187d6e.svg" width="18" height="18" alt="#187d6e"> | `teal` | `#187d6e` | `oklch(0.53 0.09 180)` | accent · cursor · borderActive · heading |
| <img src="assets/swatches/0f695e.svg" width="18" height="18" alt="#0f695e"> | `mint` | `#0f695e` | `oklch(0.47 0.08 182)` | hint · keyword · builtin |
| <img src="assets/swatches/1f7074.svg" width="18" height="18" alt="#1f7074"> | `aqua` | `#1f7074` | `oklch(0.5 0.075 200)` | function · link |
| <img src="assets/swatches/2b6991.svg" width="18" height="18" alt="#2b6991"> | `steel` | `#2b6991` | `oklch(0.5 0.09 240)` | info · type · namespace |
| <img src="assets/swatches/8f6213.svg" width="18" height="18" alt="#8f6213"> | `amber` | `#8f6213` | `oklch(0.53 0.105 75)` | lineNumberActive · match · warning · modified · code |
| <img src="assets/swatches/a04f27.svg" width="18" height="18" alt="#a04f27"> | `copper` | `#a04f27` | `oklch(0.52 0.12 45)` | number · constant · escape |
| <img src="assets/swatches/a74541.svg" width="18" height="18" alt="#a74541"> | `flare` | `#a74541` | `oklch(0.52 0.13 25)` | error · removed |
| <img src="assets/swatches/3b7a35.svg" width="18" height="18" alt="#3b7a35"> | `moss` | `#3b7a35` | `oklch(0.52 0.12 142)` | success · added · string |
| <img src="assets/swatches/81558e.svg" width="18" height="18" alt="#81558e"> | `orchid` | `#81558e` | `oklch(0.52 0.1 318)` | regex · decorator · tag |
| <img src="assets/swatches/845b6e.svg" width="18" height="18" alt="#845b6e"> | `rose` | `#845b6e` | `oklch(0.52 0.06 350)` | Available for custom accents |

**ANSI**

| | black | red | green | yellow | blue | magenta | cyan | white |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| normal | <img src="assets/swatches/d2d8dd.svg" width="18" height="18" alt="#d2d8dd"> | <img src="assets/swatches/a74541.svg" width="18" height="18" alt="#a74541"> | <img src="assets/swatches/3b7a35.svg" width="18" height="18" alt="#3b7a35"> | <img src="assets/swatches/8f6213.svg" width="18" height="18" alt="#8f6213"> | <img src="assets/swatches/2b6991.svg" width="18" height="18" alt="#2b6991"> | <img src="assets/swatches/81558e.svg" width="18" height="18" alt="#81558e"> | <img src="assets/swatches/187d6e.svg" width="18" height="18" alt="#187d6e"> | <img src="assets/swatches/50565a.svg" width="18" height="18" alt="#50565a"> |
| bright | <img src="assets/swatches/92999f.svg" width="18" height="18" alt="#92999f"> | <img src="assets/swatches/853532.svg" width="18" height="18" alt="#853532"> | <img src="assets/swatches/2d6029.svg" width="18" height="18" alt="#2d6029"> | <img src="assets/swatches/724d0d.svg" width="18" height="18" alt="#724d0d"> | <img src="assets/swatches/1f5272.svg" width="18" height="18" alt="#1f5272"> | <img src="assets/swatches/664371.svg" width="18" height="18" alt="#664371"> | <img src="assets/swatches/116357.svg" width="18" height="18" alt="#116357"> | <img src="assets/swatches/12171a.svg" width="18" height="18" alt="#12171a"> |

</details>

### Living Code Signal

A minimal variant of Night with a single accent. Teal marks keywords, tags and focus; everything else stays on the slate ramp. No warm literals or multicolor diagnostics.

<img src="assets/preview-signal.png" width="100%" alt="Living Code Signal: editor syntax, terminal output and ANSI palette">

Accent names such as `amber`, `copper` and `moss` remain available for port compatibility,
but in Signal they are aliases of teal or neutral colors. Diagnostics are told apart by labels, signs and underlines instead of hue.

<details>
<summary>Palette</summary>

**Neutrals**

| | Name | Hex | OKLCH | Used for |
|:-:|---|---|---|---|
| <img src="assets/swatches/020405.svg" width="18" height="18" alt="#020405"> | `crust` | `#020405` | `oklch(0.1 0.01 240)` | sidebars, tab bars, status lines |
| <img src="assets/swatches/05080b.svg" width="18" height="18" alt="#05080b"> | `base` | `#05080b` | `oklch(0.13 0.01 240)` | background |
| <img src="assets/swatches/090e11.svg" width="18" height="18" alt="#090e11"> | `mantle` | `#090e11` | `oklch(0.16 0.01 240)` | floats, cards, popups |
| <img src="assets/swatches/12171a.svg" width="18" height="18" alt="#12171a"> | `surface0` | `#12171a` | `oklch(0.2 0.01 240)` | line highlight, inactive tabs |
| <img src="assets/swatches/1d2226.svg" width="18" height="18" alt="#1d2226"> | `surface1` | `#1d2226` | `oklch(0.25 0.01 240)` | borders, ANSI black |
| <img src="assets/swatches/2d3438.svg" width="18" height="18" alt="#2d3438"> | `surface2` | `#2d3438` | `oklch(0.32 0.012 240)` | selection |
| <img src="assets/swatches/50565b.svg" width="18" height="18" alt="#50565b"> | `overlay` | `#50565b` | `oklch(0.45 0.012 240)` | line numbers, punctuation |
| <img src="assets/swatches/747c80.svg" width="18" height="18" alt="#747c80"> | `comment` | `#747c80` | `oklch(0.58 0.012 235)` | comments, operators |
| <img src="assets/swatches/9ba0a2.svg" width="18" height="18" alt="#9ba0a2"> | `subtext` | `#9ba0a2` | `oklch(0.7023 0.0065 223.49)` | muted text, ANSI white |
| <img src="assets/swatches/c8cfd4.svg" width="18" height="18" alt="#c8cfd4"> | `text2` | `#c8cfd4` | `oklch(0.85 0.01 240)` | properties, parameters |
| <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> | `text` | `#e2e9ee` | `oklch(0.93 0.01 240)` | foreground |

**Accent**

| | Name | Hex | OKLCH | Used for |
|:-:|---|---|---|---|
| <img src="assets/swatches/00a692.svg" width="18" height="18" alt="#00a692"> | `teal` | `#00a692` | `oklch(0.65 0.15 180)` | accent · cursor · borderActive · match · modified · keyword · builtin · decorator · tag · heading · link |

**ANSI**

| | black | red | green | yellow | blue | magenta | cyan | white |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| normal | <img src="assets/swatches/1d2226.svg" width="18" height="18" alt="#1d2226"> | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> | <img src="assets/swatches/c8cfd4.svg" width="18" height="18" alt="#c8cfd4"> | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> | <img src="assets/swatches/c8cfd4.svg" width="18" height="18" alt="#c8cfd4"> | <img src="assets/swatches/c8cfd4.svg" width="18" height="18" alt="#c8cfd4"> | <img src="assets/swatches/00a692.svg" width="18" height="18" alt="#00a692"> | <img src="assets/swatches/9ba0a2.svg" width="18" height="18" alt="#9ba0a2"> |
| bright | <img src="assets/swatches/50565b.svg" width="18" height="18" alt="#50565b"> | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> | <img src="assets/swatches/00a692.svg" width="18" height="18" alt="#00a692"> | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> |

</details>

### Syntax roles

| Role | Night | Frost | Paper | Signal |
|---|---|---|---|---|
| keyword | <img src="assets/swatches/52d7c1.svg" width="18" height="18" alt="#52d7c1"> `mint` | <img src="assets/swatches/8ad5c6.svg" width="18" height="18" alt="#8ad5c6"> `mint` | <img src="assets/swatches/0f695e.svg" width="18" height="18" alt="#0f695e"> `mint` | <img src="assets/swatches/00a692.svg" width="18" height="18" alt="#00a692"> `teal` |
| function | <img src="assets/swatches/9ae0dd.svg" width="18" height="18" alt="#9ae0dd"> `aqua` | <img src="assets/swatches/b6e2df.svg" width="18" height="18" alt="#b6e2df"> `aqua` | <img src="assets/swatches/1f7074.svg" width="18" height="18" alt="#1f7074"> `aqua` | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> `text` |
| type | <img src="assets/swatches/80b6d3.svg" width="18" height="18" alt="#80b6d3"> `steel` | <img src="assets/swatches/98bacd.svg" width="18" height="18" alt="#98bacd"> `steel` | <img src="assets/swatches/2b6991.svg" width="18" height="18" alt="#2b6991"> `steel` | <img src="assets/swatches/c8cfd4.svg" width="18" height="18" alt="#c8cfd4"> `text2` |
| string | <img src="assets/swatches/8acb83.svg" width="18" height="18" alt="#8acb83"> `moss` | <img src="assets/swatches/a2cb9d.svg" width="18" height="18" alt="#a2cb9d"> `moss` | <img src="assets/swatches/3b7a35.svg" width="18" height="18" alt="#3b7a35"> `moss` | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> `text` |
| number | <img src="assets/swatches/e18c5f.svg" width="18" height="18" alt="#e18c5f"> `copper` | <img src="assets/swatches/d49c80.svg" width="18" height="18" alt="#d49c80"> `copper` | <img src="assets/swatches/a04f27.svg" width="18" height="18" alt="#a04f27"> `copper` | <img src="assets/swatches/e2e9ee.svg" width="18" height="18" alt="#e2e9ee"> `text` |
| decorator | <img src="assets/swatches/bf91cd.svg" width="18" height="18" alt="#bf91cd"> `orchid` | <img src="assets/swatches/bc9ec6.svg" width="18" height="18" alt="#bc9ec6"> `orchid` | <img src="assets/swatches/81558e.svg" width="18" height="18" alt="#81558e"> `orchid` | <img src="assets/swatches/00a692.svg" width="18" height="18" alt="#00a692"> `teal` |
| property | <img src="assets/swatches/c8cfd4.svg" width="18" height="18" alt="#c8cfd4"> `text2` | <img src="assets/swatches/c8cfd4.svg" width="18" height="18" alt="#c8cfd4"> `text2` | <img src="assets/swatches/2e3437.svg" width="18" height="18" alt="#2e3437"> `text2` | <img src="assets/swatches/c8cfd4.svg" width="18" height="18" alt="#c8cfd4"> `text2` |
| operator | <img src="assets/swatches/747c80.svg" width="18" height="18" alt="#747c80"> `comment` | <img src="assets/swatches/7d8489.svg" width="18" height="18" alt="#7d8489"> `comment` | <img src="assets/swatches/6b7378.svg" width="18" height="18" alt="#6b7378"> `comment` | <img src="assets/swatches/747c80.svg" width="18" height="18" alt="#747c80"> `comment` |
| comment | <img src="assets/swatches/747c80.svg" width="18" height="18" alt="#747c80"> `comment` | <img src="assets/swatches/7d8489.svg" width="18" height="18" alt="#7d8489"> `comment` | <img src="assets/swatches/6b7378.svg" width="18" height="18" alt="#6b7378"> `comment` | <img src="assets/swatches/747c80.svg" width="18" height="18" alt="#747c80"> `comment` |

The table shows resolved roles for every flavor. The full role map (UI, diagnostics, markup) is in
[`palette/flavors.mjs`](palette/flavors.mjs): `defaultRoles` plus each flavor's `roles` overrides.

Ports ship every flavor, except browser themes (Firefox and Chrome), which ship Night and Paper only: in a browser's few
theme slots, Frost and Signal look the same as or barely different from Night, and both stores reject duplicate themes.

## Using the palette in something else

Any app can follow the theme: read [`palette.json`](palette.json) (hex, OKLCH, RGB, roles and ANSI for every flavor),
or map these semantic roles onto the app's own color slots:

| Slot | Role | Night |
|---|---|---|
| background / foreground | `bg` / `fg` | `#05080b` / `#e2e9ee` |
| panels, sidebars | `bgDeep`, `bgAlt` | `#020405`, `#090e11` |
| accent, cursor, focus ring | `accent` | `#00a692` |
| selection | `selection` | `#2d3438` |
| borders | `border` / `borderActive` | `#1d2226` / `#00a692` |
| error / warning / info / success | `error` … | `#e96560` `#f0be6d` `#80b6d3` `#8acb83` |

From JavaScript, install [`@living-code/palette`](https://github.com/living-code-theme/palette); for CSS custom
properties, [`@living-code/css`](https://github.com/living-code-theme/css).

## Recolor images

Turn any image, such as a wallpaper, into a Living Code version. Requires [ImageMagick 7](https://imagemagick.org).

```sh
node scripts/recolor.mjs wallpaper.jpg --flavor night --mode lut
```

| Mode | Result |
|---|---|
| `lut` | Starts with the theme's slate ramp. Shadows and muted areas stay neutral; colorful midtones receive the selected flavor's accents over that base. Lightness is fitted to the theme's range. Tune the accent amount with `--color` (default: 0.65). Core accents are teal, mint, aqua, steel, amber and copper; `--accents all` includes the remaining accents. |
| `gradient` | Maps brightness onto dark slate, an accent and light text. Pick the accent with `--accent amber`. |
| `remap` | Posterizes to the exact palette colors. Add `--no-dither` for flat areas. |
| `all` | Writes one file per mode. |

In `lut` mode, `--color 0` uses only the slate ramp; `--color 1` allows stronger accents while still protecting shadows and muted areas.
Unlike `--strength`, lowering `--color` does not bring back the original photo's colors. It controls accent blending, not a fixed percentage of the image's area.
Other controls are `--spread` (hue blending), `--keep-light` (brightness preservation) and `--smooth` (color-noise smoothing).
Use `--flavor signal` for slate and teal only; compatibility names such as `amber` do not add warm hues in Signal.

Output defaults to `<image>-<flavor>-<mode>.png` next to the input. Run with `--help` for every option.

## Report a problem or request a port

| You want to | Where |
|---|---|
| Report wrong colors or a broken install in one app | That app's repository: open its page on [living-code.dev/ports](https://living-code.dev/ports/), then **Report an issue** |
| Ask for Living Code in another app | [Request a port](https://github.com/living-code-theme/core/issues/new?template=port-request.yml) |
| Change a color or role in every app | [Palette or color feedback](https://github.com/living-code-theme/core/issues/new?template=color-feedback.yml) |

## Contributing a port

Each port is its own repository in [living-code-theme](https://github.com/living-code-theme) with a root `port.json`
and a README following the shared template; the website discovers it automatically. See [Port repositories](docs/PORTS.md).

Map roles, never colors: take every color from a semantic role in [`palette.json`](palette.json), so the same kind of
token gets the same color in every app.

## Development

Requires Node 22.22 or newer. There are no runtime dependencies.

| Command | What it does |
|---|---|
| `pnpm build` | Regenerates `palette.json`, this README, swatches, brand SVGs and the landing export from `palette/flavors.mjs`. |
| `pnpm check` | Fails if a generated file is stale or a text role drops below 4.5:1. CI runs it. |
| `pnpm test` | Runs the test suite. |
| `pnpm preview` | Live palette preview with sliders and exports at <http://localhost:4173/preview/>. |
| `pnpm screenshots` | Recaptures `assets/preview-*.png` from the preview with headless Chrome (`CHROME_BIN` overrides `google-chrome`). |
| `pnpm icons:brand` | Rasterizes the brand SVGs to PNG and ICO. See [`assets/brand`](assets/brand/README.md). |

To change a color, edit [`palette/flavors.mjs`](palette/flavors.mjs) and run `pnpm build`. Do not edit generated files directly.

A palette change does not touch any port: each port repository owns its files and updates them in its own pull request.
The website takes the theme from [`exports/landing/`](exports/landing): copy `theme.json` to the landing's
`data/theme.json` and `theme.css` to `src/styles/theme.css`.

## License

[MIT](LICENSE) © Elliot Luque
