import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
function db() {
  const d = new DatabaseSync(":memory:");
  d.exec(
    "PRAGMA foreign_keys=ON;CREATE TABLE tenants(id INTEGER PRIMARY KEY);CREATE TABLE organizational_units(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL,type TEXT NOT NULL,parent_id INTEGER,archived_at TEXT);CREATE TABLE organizational_functions(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL);CREATE TABLE auth_users(id INTEGER PRIMARY KEY);CREATE TABLE tenant_memberships(id INTEGER PRIMARY KEY,scope TEXT NOT NULL,status TEXT NOT NULL,archived_at TEXT);CREATE TABLE membership_permissions(membership_id INTEGER NOT NULL,permission TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(membership_id,permission));CREATE TABLE user_permissions(user_id INTEGER NOT NULL,permission TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,permission));CREATE TABLE platform_owners(singleton_id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL);INSERT INTO tenants VALUES(1),(2);INSERT INTO organizational_units VALUES(10,1,'MATRIZ',1,NULL),(20,1,'FILIAL',10,NULL),(11,2,'MATRIZ',2,NULL),(21,2,'FILIAL',11,NULL);INSERT INTO organizational_functions VALUES(30,1),(31,2);INSERT INTO auth_users VALUES(1);INSERT INTO tenant_memberships VALUES(1,'CONVENCAO','ATIVO',NULL);INSERT INTO platform_owners VALUES(1,1);",
  );
  const sql = readFileSync(
    new URL("../drizzle/0015_people_members.sql", import.meta.url),
    "utf8",
  );
  d.exec("BEGIN");
  try {
    for (const s of sql
      .split("--> statement-breakpoint")
      .map((x) => x.trim())
      .filter(Boolean))
      d.exec(s);
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
  return d;
}
const person = (id, tenant, number, cpf, matrix, branch = "NULL") =>
  `INSERT INTO people(id,tenant_id,member_number,full_name,status,cpf,children_count,matrix_id,branch_id,created_by_user_id,created_at,updated_at) VALUES(${id},${tenant},${number},'Pessoa ${id}','MEMBRO_ATIVO',${cpf ? `'${cpf}'` : "NULL"},0,${matrix},${branch},1,'x','x')`;
test("migration cria domínio separado de usuários e rollback é reversível", () => {
  const d = db();
  for (const name of [
    "people",
    "member_sequences",
    "person_functions",
    "person_history",
    "person_relationships",
    "member_photos",
  ])
    assert.ok(
      d
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
        .get(name),
    );
  d.exec(
    readFileSync(
      new URL(
        "../database/rollback/0015_people_members.down.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(
    d
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='people'",
      )
      .get(),
    undefined,
  );
  assert.equal(d.prepare("SELECT COUNT(*) n FROM auth_users").get().n, 1);
});
test("mesmo CPF e código são permitidos em tenants diferentes, mas não no mesmo", () => {
  const d = db();
  d.exec(person(1, 1, 1, "52998224725", 10, 20));
  d.exec(person(2, 2, 1, "52998224725", 11, 21));
  assert.throws(() => d.exec(person(3, 1, 2, "52998224725", 10, 20)), /UNIQUE/);
  assert.throws(() => d.exec(person(4, 1, 1, null, 10, 20)), /UNIQUE/);
});
test("chaves compostas impedem Matriz, Filial, função e cônjuge de outro tenant", () => {
  const d = db();
  d.exec(person(1, 1, 1, null, 10, 20));
  d.exec(person(2, 2, 1, null, 11, 21));
  assert.throws(() => d.exec(person(3, 1, 2, null, 11, 21)), /FOREIGN KEY/);
  assert.throws(() => d.exec(person(3, 1, 2, null, 10, 21)), /FOREIGN KEY/);
  assert.throws(() => d.exec("UPDATE people SET primary_function_id=31 WHERE id=1"), /FOREIGN KEY/);
  assert.throws(() => d.exec("UPDATE people SET spouse_person_id=2 WHERE id=1"), /FOREIGN KEY/);
});
test("sequência de código permanece independente por tenant", () => {
  const d = db();
  const next = (t) =>
    d
      .prepare(
        "INSERT INTO member_sequences(tenant_id,last_number,updated_at) VALUES (?,1,'x') ON CONFLICT(tenant_id) DO UPDATE SET last_number=last_number+1 RETURNING last_number",
      )
      .get(t).last_number;
  assert.equal(next(1), 1);
  assert.equal(next(1), 2);
  assert.equal(next(2), 1);
});
test("migration concede o módulo aos administradores máximos existentes", () => {
  const d = db();
  assert.equal(
    d
      .prepare(
        "SELECT COUNT(*) n FROM membership_permissions WHERE membership_id=1 AND permission LIKE 'MEMBROS_%'",
      )
      .get().n,
    9,
  );
  assert.equal(
    d
      .prepare(
        "SELECT COUNT(*) n FROM user_permissions WHERE user_id=1 AND permission LIKE 'MEMBROS_%'",
      )
      .get().n,
    9,
  );
});
