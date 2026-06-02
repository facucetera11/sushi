const fs = require("fs");

const file = "frontend/index.html";
let html = fs.readFileSync(file, "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error("No script block found");

let script = scriptMatch[1];
const names = [
  "load", "updateStatus", "renderCat", "openModal", "addFromModal", "updateCart",
  "changeCartQty", "addToCartDirect", "updateCheckoutSummary", "sendWhatsApp"
];

function findFunctionRanges(source, name) {
  const ranges = [];
  const re = new RegExp(`\\n(?:async\\s+)?function\\s+${name}\\s*\\(`, "g");
  let match;
  while ((match = re.exec(source))) {
    const start = match.index + 1;
    const brace = source.indexOf("{", re.lastIndex);
    if (brace < 0) continue;
    let depth = 0;
    let state = "code";
    for (let i = brace; i < source.length; i++) {
      const ch = source[i];
      const next = source[i + 1];
      const prev = source[i - 1];

      if (state === "line") {
        if (ch === "\n") state = "code";
        continue;
      }
      if (state === "block") {
        if (ch === "*" && next === "/") { state = "code"; i++; }
        continue;
      }
      if (state === "single") {
        if (ch === "'" && prev !== "\\") state = "code";
        continue;
      }
      if (state === "double") {
        if (ch === "\"" && prev !== "\\") state = "code";
        continue;
      }
      if (state === "template") {
        if (ch === "`" && prev !== "\\") state = "code";
        continue;
      }

      if (ch === "/" && next === "/") { state = "line"; i++; continue; }
      if (ch === "/" && next === "*") { state = "block"; i++; continue; }
      if (ch === "'") { state = "single"; continue; }
      if (ch === "\"") { state = "double"; continue; }
      if (ch === "`") { state = "template"; continue; }
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          ranges.push({ start, end: i + 1, name });
          break;
        }
      }
    }
  }
  return ranges;
}

const remove = [];
for (const name of names) {
  const ranges = findFunctionRanges(script, name);
  if (ranges.length > 1) remove.push(...ranges.slice(0, -1));
}

remove.sort((a, b) => b.start - a.start);
for (const range of remove) {
  script = script.slice(0, range.start) + script.slice(range.end);
}

html = html.replace(scriptMatch[1], script);
fs.writeFileSync(file, html, "utf8");
console.log(`Removed ${remove.length} duplicate function declarations`);
