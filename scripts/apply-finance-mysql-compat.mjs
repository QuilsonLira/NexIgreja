import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const financePath = path.join(process.cwd(), "lib", "server", "finance.ts");
let source = await readFile(financePath, "utf8");

// MySQL does not allow an aggregate SELECT alias to be referenced inside
// another expression in ORDER BY (ER_ILLEGAL_REFERENCE / group function).
// SQLite accepts this form, so normalize only the problematic ordering while
// preserving the same business rule: next open installment first, otherwise
// fall back to the obligation creation date.
const sqliteOrder = "GROUP BY o.id ORDER BY COALESCE(next_due_on,o.created_at)";
const mysqlSafeOrder = "GROUP BY o.id ORDER BY COALESCE(MIN(CASE WHEN i.status='ABERTA' THEN i.due_on END),o.created_at)";

if (source.includes(sqliteOrder)) {
  source = source.replace(sqliteOrder, mysqlSafeOrder);
  await writeFile(financePath, source, "utf8");
  console.log("Finance MySQL compatibility patch applied: next_due_on ordering");
} else if (source.includes(mysqlSafeOrder)) {
  console.log("Finance MySQL compatibility patch already applied");
} else {
  throw new Error("finance.ts next_due_on ORDER BY anchor not found");
}
