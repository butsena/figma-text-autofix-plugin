import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiDir = path.join(root, "src/ui");
const outHtml = path.join(uiDir, "ui.figma.html");

const js = await esbuild.build({
  entryPoints: [path.join(uiDir, "ui.ts")],
  bundle: true,
  format: "iife",
  target: "es2017",
  write: false,
  logLevel: "silent",
});

const css = fs.readFileSync(path.join(uiDir, "ui.css"), "utf8");
const bundleJs = js.outputFiles[0].text;

const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Text Autofix</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
${bundleJs}
    </script>
  </body>
</html>
`;

fs.writeFileSync(outHtml, html);
console.log("[build-ui-html] wrote", path.relative(root, outHtml));
