import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { contrast, css } from "../src/color.mjs";
import * as palette from "../src/resolve.mjs";
import { exportFiles } from "../src/outputs.mjs";

const source = await readFile(new URL("../preview/preview.mjs", import.meta.url), "utf8");
const html = await readFile(new URL("../preview/index.html", import.meta.url), "utf8");

for (const flavor of palette.flavorOrder) {
  test(`${flavor}: preview renders semantic string and comment colors without changing the neutral swatch`, () => {
    const properties = new Map();
    const elements = new Map();
    const document = {
      documentElement: { style: { setProperty: (key, value) => properties.set(key, value) } },
      body: { classList: { add() {} } },
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { value: "0", addEventListener() {} });
        return elements.get(id);
      },
      querySelectorAll: () => [],
      addEventListener() {},
    };
    document.getElementById("chroma").value = "1";
    // Execute the browser entry point with its real imports and a minimal DOM.
    runInNewContext(source.replace(/^import .*;$/gm, ""), {
      ...palette, contrast, css, exportFiles, document, URLSearchParams,
      location: { search: "", hash: `#${flavor}` },
    });

    const f = palette.resolveFlavor(flavor);
    assert.equal(properties.get("--s-comment"), css(f.rr("comment")));
    assert.equal(properties.get("--s-string"), css(f.rr("string")));
    assert.equal(properties.get("--comment"), css(f.raw.comment));
    assert.match(html, /\.c\s*\{\s*color:\s*var\(--s-comment\)/);
    assert.match(html, /\.s\s*\{\s*color:\s*var\(--s-string\)/);
    if (flavor === "night") {
      assert.equal(properties.get("--s-comment"), css(f.raw.comment));
      assert.equal(properties.get("--s-string"), css(f.raw.moss));
      assert.equal(properties.get("--a-yellow"), css(f.raw.amber));
    }
  });
}
