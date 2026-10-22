/**
 * Скачивает кураторские списки с GitHub в data/ (bundled fallback).
 * Нужен перед Community-релизом после правок в text-autofix-curated.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

const FILES = [
  "ty-vy-curated.txt",
  "yo-curated.txt",
];

const BASE =
  "https://raw.githubusercontent.com/butsena/text-autofix-curated/main";

async function main() {
  for (const name of FILES) {
    const url = `${BASE}/${name}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const text = await res.text();
    if (/^\s*<!DOCTYPE html/i.test(text) || /^\s*<html/i.test(text)) {
      throw new Error(`Got HTML instead of text for ${url}`);
    }
    const out = path.join(dataDir, name);
    fs.writeFileSync(out, text.endsWith("\n") ? text : `${text}\n`);
    console.log(`[sync:curated-lists] ${name} ← ${url}`);
  }
}

main().catch((err) => {
  console.error("[sync:curated-lists]", err.message || err);
  process.exit(1);
});
