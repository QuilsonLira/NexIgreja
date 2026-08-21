import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const ddlDir = path.join(root, "drizzle-mysql");
const metaDir = path.join(ddlDir, "meta");
const mapPath = path.join(root, "database", "mysql", "generated-identifier-map.json");

function shortName(name) {
  const digest = createHash("sha256").update(name).digest("hex").slice(0, 14);
  const prefixLength = 64 - digest.length - 1;
  return `${name.slice(0, prefixLength)}_${digest}`;
}

const sqlFiles = (await readdir(ddlDir))
  .filter((name) => name.endsWith(".sql"))
  .sort();
if (sqlFiles.length === 0) throw new Error("No generated MySQL SQL files found");

const mappings = new Map();
for (const fileName of sqlFiles) {
  const content = await readFile(path.join(ddlDir, fileName), "utf8");
  const patterns = [
    /CONSTRAINT\s+`([^`]+)`/gi,
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+`([^`]+)`/gi,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const name = match[1];
      if (name.length <= 64) continue;
      if (!mappings.has(name)) mappings.set(name, shortName(name));
    }
  }
}

if (mappings.size === 0) {
  console.log("No MySQL identifiers required shortening.");
} else {
  const filesToRewrite = [];
  for (const fileName of sqlFiles) filesToRewrite.push(path.join(ddlDir, fileName));
  try {
    for (const fileName of await readdir(metaDir)) {
      if (fileName.endsWith(".json")) filesToRewrite.push(path.join(metaDir, fileName));
    }
  } catch {
    // Drizzle metadata may not exist in early validation steps.
  }

  for (const filePath of filesToRewrite) {
    let content = await readFile(filePath, "utf8");
    for (const [original, replacement] of mappings) {
      content = content.split(original).join(replacement);
    }
    await writeFile(filePath, content, "utf8");
  }
}

await mkdir(path.dirname(mapPath), { recursive: true });
const serializable = Object.fromEntries([...mappings.entries()].sort(([a], [b]) => a.localeCompare(b)));
await writeFile(mapPath, `${JSON.stringify(serializable, null, 2)}\n`, "utf8");

for (const [original, replacement] of mappings) {
  console.log(`SHORTEN ${original} -> ${replacement}`);
}
console.log(`MYSQL_IDENTIFIER_NORMALIZATION_OK count=${mappings.size}`);
