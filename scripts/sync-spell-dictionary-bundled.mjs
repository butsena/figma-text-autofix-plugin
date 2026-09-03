/**
 * Синхронизирует bundled fallback орфографического словаря в data/hunspell/
 * для офлайн-запуска и публикации в text-autofix-spelling.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "hunspell");
const pkgDir = path.join(root, "node_modules", "dictionary-ru");

function copyIfExists(from: string, to: string): boolean {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

if (!copyIfExists(path.join(pkgDir, "index.aff"), path.join(outDir, "ru_RU.aff"))) {
  console.error("[sync-spell-dictionary] dictionary-ru not found — run npm install");
  process.exit(1);
}
copyIfExists(path.join(pkgDir, "index.dic"), path.join(outDir, "ru_RU.dic"));

for (const name of ["spell-supplement.txt", "spell-whitelist.txt"]) {
  const from = path.join(root, "data", "hunspell", name);
  if (!fs.existsSync(from)) {
    console.warn(`[sync-spell-dictionary] missing ${from}`);
  }
}

const dicHead = fs.readFileSync(path.join(outDir, "ru_RU.dic"), "utf8").split("\n", 1)[0].trim();
console.log(`[sync-spell-dictionary] wrote data/hunspell/ru_RU.* (${dicHead} entries)`);
