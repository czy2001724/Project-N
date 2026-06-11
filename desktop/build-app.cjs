/* Assembles desktop/app/ from the web game in ../test:
   - bundles src/main.js (+ three) into one classic IIFE script (no ES modules,
     no CDN) so it runs offline inside Electron via file://
   - embeds the AK OBJ + textures as window.__PN_AK_ASSETS__ (no fetch)
   - rewrites index.html to drop the importmap/module-script and load the bundle
   Run by the CI workflow before electron-builder. */
const path = require("path");
const fs = require("fs");

const NM = process.env.PN_NM || path.join(__dirname, "node_modules");
const esbuild = require(path.join(NM, "esbuild"));

const GAME = path.join(__dirname, "..", "test");
const APP = path.join(__dirname, "app");
const SRC = path.join(__dirname, ".srcbuild");

fs.rmSync(APP, { recursive: true, force: true });
fs.rmSync(SRC, { recursive: true, force: true });
fs.mkdirSync(APP, { recursive: true });
fs.mkdirSync(SRC, { recursive: true });

// 1) copy src, strip the ?v=DEV cache-bust query so esbuild can resolve imports
for (const f of fs.readdirSync(path.join(GAME, "src"))) {
  const s = fs.readFileSync(path.join(GAME, "src", f), "utf8").replace(/\?v=[A-Za-z0-9]+/g, "");
  fs.writeFileSync(path.join(SRC, f), s);
}

// 2) bundle to a single classic script with three inlined
esbuild.buildSync({
  entryPoints: [path.join(SRC, "main.js")],
  bundle: true,
  format: "iife",
  outfile: path.join(APP, "app.bundle.js"),
  legalComments: "none",
  nodePaths: [NM],
});

// 3) embed the AK assets (OBJ string + texture data URIs)
const AK = path.join(GAME, "assets", "ak");
const TEX = ["view_glove.png", "view_skin.png", "view_finger.png", "QS_AK1.png", "QS_AK2.png", "QS_AK3.png", "QS_AK4.png", "QS_AK5.png"];
const obj = fs.readFileSync(path.join(AK, "v_ak47.obj"), "utf8");
const tex = {};
for (const t of TEX) tex[t] = "data:image/png;base64," + fs.readFileSync(path.join(AK, t)).toString("base64");
fs.writeFileSync(path.join(APP, "embedded-assets.js"), "window.__PN_AK_ASSETS__ = " + JSON.stringify({ obj, tex }) + ";\n");

// 4) styles + index.html (classic scripts instead of importmap/module)
fs.copyFileSync(path.join(GAME, "styles.css"), path.join(APP, "styles.css"));
let html = fs.readFileSync(path.join(GAME, "index.html"), "utf8");
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, "");
html = html.replace(
  /<script type="module"[^>]*><\/script>/,
  '<script src="./embedded-assets.js"></script>\n    <script src="./app.bundle.js"></script>'
);
fs.writeFileSync(path.join(APP, "index.html"), html);

fs.rmSync(SRC, { recursive: true, force: true });
console.log("desktop/app built ok");
