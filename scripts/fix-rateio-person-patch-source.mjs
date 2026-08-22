import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.join(process.cwd(), "scripts", "apply-rateio-person-patch.mjs");
const before = await readFile(target, "utf8");
const tick = String.fromCharCode(96);
let after = before;

const brokenCpf = `{item.cpf?${tick} · CPF \${String(item.cpf)}${tick}:""}`;
const fixedCpf = `{item.cpf ? " · CPF " + String(item.cpf) : ""}`;
if (after.includes(brokenCpf)) after = after.replace(brokenCpf, fixedCpf);

const workspaceBefore = "preview=await decoratePersonAllocationPreview({tenantId:ctx.session.user.tenantId,periodId:Number(period.id),ruless:periodRules.results as Array<Record<string,unknown>>,preview});";
const workspaceAfter = "preview=await decoratePersonAllocationPreview({tenantId:ctx.session.user.tenantId,periodId:Number(period.id),ruless:periodRules.results as Array<Record<string,unknown>>,preview}) as any;";
if (after.includes(workspaceBefore)) after = after.replace(workspaceBefore, workspaceAfter);

const closeBefore = "preview=await decoratePersonAllocationPreview({tenantId:ctx.session.user.tenantId,periodId:period.id,ruless:rules.results,preview});if(!preview.valid)";
const closeAfter = "preview=await decoratePersonAllocationPreview({tenantId:ctx.session.user.tenantId,periodId:period.id,ruless:rules.results,preview}) as any;if(!preview.valid)";
if (after.includes(closeBefore)) after = after.replace(closeBefore, closeAfter);

if (after !== before) {
  await writeFile(target, after, "utf8");
  console.log("Rateio person patch source: repaired and type-safe integration applied");
} else if (before.includes(fixedCpf) && before.includes(workspaceAfter) && before.includes(closeAfter)) {
  console.log("Rateio person patch source: already repaired");
} else {
  throw new Error("Rateio person patch repair anchors not found");
}
