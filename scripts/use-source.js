import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "../package.json");

const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

pkg.main = "./lib/main.ts";
pkg.module = "./lib/main.ts";
pkg.types = "./lib/main.ts";
pkg.exports = {
  ".": {
    types: "./lib/main.ts",
    import: "./lib/main.ts",
    require: "./lib/main.ts",
  },
};

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log("package.json now points to source (lib/main.ts)");
