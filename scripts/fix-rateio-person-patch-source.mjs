import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.join(process.cwd(), "scripts", "apply-rateio-person-patch.mjs");
const before = await readFile(target, "utf8");
const tick = String.fromCharCode(96);
const broken = `{item.cpf?${tick} · CPF \${String(item.cpf)}${tick}:""}`;
const fixed = `{item.cpf ? " · CPF " + String(item.cpf) : ""}`;
const after = before.includes(broken) ? before.replace(broken, fixed) : before;

if (after !== before) {
  await writeFile(target, after, "utf8");
  console.log("Rateio person patch source syntax: repaired");
} else if (before.includes(fixed)) {
  console.log("Rateio person patch source syntax: already repaired");
} else {
  throw new Error("Rateio person patch syntax anchor not found");
}
