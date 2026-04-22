import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "../package.json");

const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

pkg.main = "./dist/jararaca-core.cjs.js";
pkg.module = "./dist/jararaca-core.es.js";
pkg.types = "./dist/index.d.ts";
pkg.exports = {
  ".": {
    types: "./dist/index.d.ts",
    import: "./dist/jararaca-core.es.js",
    require: "./dist/jararaca-core.cjs.js",
  },
};

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log("package.json now points to dist");
