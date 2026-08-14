import fs from "node:fs";

/** Classic retro long-shadow: 5 solid bands, 1px steps (CodePen-style). */
function makeStepped(c1, c2, c3, c4, c5) {
  const parts = [`0px 0px ${c1}`];
  for (let i = 1; i <= 20; i++) parts.push(`-${i}px ${i}px ${c1}`);
  for (let i = 21; i <= 40; i++) parts.push(`-${i}px ${i}px ${c2}`);
  for (let i = 41; i <= 60; i++) parts.push(`-${i}px ${i}px ${c3}`);
  for (let i = 61; i <= 80; i++) parts.push(`-${i}px ${i}px ${c4}`);
  for (let i = 81; i <= 100; i++) parts.push(`-${i}px ${i}px ${c5}`);
  return parts.join(", ");
}

function cycleFrames(cols) {
  // Rotate which band sits nearest the glyph — discrete steps, not a blend.
  return [0, 1, 2, 3, 4, 0].map((start) => {
    const out = [];
    for (let i = 0; i < 5; i++) out.push(cols[(start + i) % 5]);
    return out;
  });
}

function kf(name, cols) {
  const frames = cycleFrames(cols);
  const pct = [0, 20, 40, 60, 80, 100];
  let out = `@keyframes ${name}{\n`;
  pct.forEach((p, i) => {
    out += `  ${p}%{text-shadow:${makeStepped(...frames[i])};}\n`;
  });
  out += "}\n";
  return out;
}

// Light: charcoal steps on warm paper (matches reference look)
const light = ["#1a1a1b", "#2a2a2b", "#3a3a3b", "#4a4a4b", "#5a5a5b"];
// Dark: navy steps that read on #0a101c (same black as app dark theme)
const dark = ["#15284a", "#1e3a5f", "#2a4a73", "#365a87", "#456a9b"];

const css = kf("animateShadowLight", light) + kf("animateShadowDark", dark);
fs.writeFileSync(new URL("../public/boot/long-shadow.css", import.meta.url), css);
console.log("ok", css.length);
