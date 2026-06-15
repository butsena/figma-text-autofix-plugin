/**
 * Собирает yo-map.json из yobase (Ёditor / Евгений Миньковский, 2003):
 * - yo-sure.txt — слова, где ё обязательна
 * - yo-unsure.txt — омонимы / неоднозначные формы (исключаем)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

function readLines(fileName) {
  return fs
    .readFileSync(path.join(dataDir, fileName), "utf8")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toEForm(word) {
  return word.replace(/ё/g, "е").replace(/Ё/g, "Е");
}

const sure = readLines("yo-sure.txt");
const unsure = new Set(readLines("yo-unsure.txt"));
const blockedWrong = new Set([...unsure].map(toEForm));

const map = {};
let skippedBlocked = 0;

for (const right of sure) {
  if (unsure.has(right)) continue;
  const wrong = toEForm(right);
  if (wrong === right || blockedWrong.has(wrong)) {
    if (blockedWrong.has(wrong)) skippedBlocked += 1;
    continue;
  }
  map[wrong] = right;
}

const outPath = path.join(dataDir, "yo-map.json");
fs.writeFileSync(outPath, JSON.stringify(map));

console.log(
  `[build-yo-map] ${Object.keys(map).length} пар «е→ё», пропущено омонимов: ${skippedBlocked}`,
);
