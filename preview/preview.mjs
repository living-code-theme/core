import { contrast, css } from "../src/color.mjs";
import { ACCENT_ORDER, ANSI_ORDER, NEUTRAL_ORDER, flavorOrder, flavors, resolveAll, resolveFlavor } from "../src/resolve.mjs";
import { exportFiles } from "../src/outputs.mjs";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const initial = params.get("shot") || location.hash.slice(1);
const state = { flavor: flavorOrder.includes(initial) ? initial : "night", file: null };
if (params.has("shot")) document.body.classList.add("shot");

const TEXT = new Set(["comment", "subtext", "text2", "text", "mint", "aqua", "steel", "amber", "copper", "flare", "moss", "orchid", "rose"]);
const CLASS_ROLES = {
  keyword: "keyword", function: "function", string: "string", number: "number", type: "type",
  operator: "punctuation", decorator: "decorator", property: "property", comment: "comment",
};

const adjust = () => ({ chroma: +$("chroma").value, light: +$("light").value, hue: +$("hue").value });

function render() {
  const f = resolveFlavor(state.flavor, adjust());
  const root = document.documentElement.style;
  for (const [n, c] of Object.entries(f.raw)) root.setProperty(`--${n}`, css(c));
  root.setProperty("--accent", css(f.rr("accent")));
  for (const [cls, role] of Object.entries(CLASS_ROLES)) root.setProperty(`--s-${cls}`, css(f.rr(role)));
  root.colorScheme = f.light ? "light" : "dark";

  ANSI_ORDER.forEach((n, i) => {
    root.setProperty(`--a-${n}`, css(f.ansiRaw.normal[i]));
    root.setProperty(`--a-bright${n}`, css(f.ansiRaw.bright[i]));
  });

  const card = (n) => {
    const c = f.colors[n];
    const ratio = contrast(c.oklch, f.raw.base);
    const bad = ratio < 4.5 && TEXT.has(n);
    return `<button class="sw" data-copy="${c.hex}"><div class="chip" style="background:${c.css}"></div>
      <div class="meta"><b>${n}</b>${c.css}<br>${c.hex} · <span class="${bad ? "bad" : ""}">${ratio.toFixed(1)}:1</span>${c.clipped ? ` <span title="hex is gamut-mapped">↓sRGB</span>` : ""}</div></button>`;
  };
  $("neutrals").innerHTML = NEUTRAL_ORDER.map(card).join("");
  $("accents").innerHTML = ACCENT_ORDER.map(card).join("");

  $("ansi").innerHTML = ANSI_ORDER.map((n) => `<div title="${n}" style="background:var(--a-${n})"></div>`).join("");
  $("ansiTable").innerHTML = ANSI_ORDER.map((n) =>
    `<span style="color:var(--a-${n})">${n.padEnd(8)}</span>  <span style="color:var(--a-bright${n})">██████</span>  <span style="background:var(--a-${n});color:var(--base)"> ${n.slice(0, 3)} </span>`).join("\n");
  $("kblocks").innerHTML = ["", "bright"]
    .map((p) => ANSI_ORDER.map((n) => `<span style="background:var(--a-${p}${n})">   </span>`).join("")).join("\n");
  $("kthemeName").textContent = f.slug;
  $("idea").innerHTML = `<b>${f.name}.</b> ${f.description}`;

  const all = resolveAll(adjust());
  const files = exportFiles(all);
  const sel = $("exportFile");
  const prev = state.file;
  sel.innerHTML = files.map((x) => `<option>${x.path}</option>`).join("");
  state.file = files.some((x) => x.path === prev) ? prev : files[0].path;
  sel.value = state.file;
  $("export").value = files.find((x) => x.path === state.file)?.content ?? "";
  state.files = files;

  $("chromaOut").textContent = (+$("chroma").value).toFixed(2) + "×";
  const dl = +$("light").value;
  $("lightOut").textContent = (dl >= 0 ? "+" : "") + dl.toFixed(2);
  $("hueOut").textContent = $("hue").value + "°";
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === state.flavor));
}

$("tabs").innerHTML = flavorOrder.map((k) => `<button data-v="${k}" title="${flavors[k].name}">${k}</button>`).join("");
$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.flavor = b.dataset.v;
  history.replaceState(null, "", "#" + state.flavor);
  render();
});
["chroma", "light", "hue"].forEach((id) => $(id).addEventListener("input", render));
$("exportFile").addEventListener("change", (e) => { state.file = e.target.value; render(); });

const toast = (msg) => {
  $("toast").textContent = msg;
  $("toast").classList.add("on");
  setTimeout(() => $("toast").classList.remove("on"), 1200);
};
$("copy").addEventListener("click", () => { navigator.clipboard?.writeText($("export").value); toast("copied " + state.file); });
$("download").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([$("export").value], { type: "text/plain" }));
  a.download = state.file.split("/").pop();
  a.click();
});
document.addEventListener("click", (e) => {
  const s = e.target.closest("[data-copy]");
  if (s) { navigator.clipboard?.writeText(s.dataset.copy); toast("copied " + s.dataset.copy); }
  const p = e.target.closest("#kitty [data-pane]");
  if (p) document.querySelectorAll("#kitty [data-pane]").forEach((x) => x.classList.toggle("kactive", x === p));
});
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input,textarea,select")) return;
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const i = flavorOrder.indexOf(state.flavor);
  state.flavor = flavorOrder[(i + (e.key === "ArrowRight" ? 1 : flavorOrder.length - 1)) % flavorOrder.length];
  history.replaceState(null, "", "#" + state.flavor);
  render();
});

render();
