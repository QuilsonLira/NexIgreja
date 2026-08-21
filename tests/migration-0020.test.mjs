import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function apply(db, name) {
  for (const sql of readFileSync(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8")
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) db.exec(sql);
}

function fixture({ migrate = true } = {}) {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE tenants(id INTEGER PRIMARY KEY);
    CREATE TABLE organizational_units(id INTEGER PRIMARY KEY,tenant_id INTEGER,type TEXT,name TEXT,parent_id INTEGER,status TEXT,archived_at TEXT,UNIQUE(id,tenant_id));
    CREATE TABLE organizational_functions(id INTEGER PRIMARY KEY,tenant_id INTEGER,name TEXT,status TEXT,UNIQUE(id,tenant_id));
    CREATE TABLE auth_users(id INTEGER PRIMARY KEY,status TEXT,archived_at TEXT);
    CREATE TABLE tenant_memberships(id INTEGER PRIMARY KEY,user_id INTEGER,tenant_id INTEGER,display_name TEXT,role_name TEXT,scope TEXT,scope_unit_id INTEGER,status TEXT,archived_at TEXT,UNIQUE(id,tenant_id));
    CREATE TABLE membership_permissions(membership_id INTEGER,permission TEXT,created_at TEXT,PRIMARY KEY(membership_id,permission));
    CREATE TABLE user_permissions(user_id INTEGER,permission TEXT,created_at TEXT,PRIMARY KEY(user_id,permission));
    CREATE TABLE platform_owners(singleton_id INTEGER PRIMARY KEY,user_id INTEGER);
    CREATE TABLE people(id INTEGER PRIMARY KEY,tenant_id INTEGER,full_name TEXT,birth_date TEXT,sex TEXT,cpf TEXT,phone TEXT,whatsapp TEXT,linked_auth_user_id INTEGER,UNIQUE(id,tenant_id));
    CREATE TABLE help_articles(id INTEGER PRIMARY KEY,tenant_id INTEGER,slug TEXT,title TEXT,summary TEXT,content TEXT,category TEXT,display_order INTEGER,target_profiles TEXT,required_permission TEXT,related_route TEXT,published INTEGER,is_new_feature INTEGER,released_at TEXT,version TEXT,created_by_user_id INTEGER,published_at TEXT,created_at TEXT,updated_at TEXT,UNIQUE(tenant_id,slug));
    CREATE TABLE help_article_reads(user_id INTEGER,article_id INTEGER,viewed_at TEXT,PRIMARY KEY(user_id,article_id));
    INSERT INTO tenants VALUES(1),(2);
    INSERT INTO organizational_units VALUES(10,1,'CONVENCAO','Convenção A',NULL,'ATIVO',NULL),(20,1,'MATRIZ','Matriz A',10,'ATIVO',NULL),(30,1,'FILIAL','Filial A',20,'ATIVO',NULL),(110,2,'CONVENCAO','Convenção B',NULL,'ATIVO',NULL),(120,2,'MATRIZ','Matriz B',110,'ATIVO',NULL);
    INSERT INTO organizational_functions VALUES(80,1,'Pastor','ATIVO'),(180,2,'Pastor','ATIVO');
    INSERT INTO auth_users VALUES(1,'ATIVO',NULL),(2,'ATIVO',NULL);
    INSERT INTO tenant_memberships VALUES(1,1,1,'Admin A','Administrador da Convenção','CONVENCAO',10,'ATIVO',NULL),(2,2,2,'Admin B','Administrador da Convenção','CONVENCAO',110,'ATIVO',NULL);
    INSERT INTO people VALUES(1001,1,'Pessoa A','1990-01-01','FEMININO','11111111111','1111','1111',1),(2001,2,'Pessoa B',NULL,NULL,NULL,NULL,NULL,2);
    INSERT INTO platform_owners VALUES(1,1);`);
  apply(db, "0019_departments_ebd");
  if (migrate) apply(db, "0020_ebd_students_secretary");
  return db;
}

function legacyEbd(db) {
  db.exec(`INSERT INTO departments(id,tenant_id,name,type,unit_id,convention_id,matrix_id,status,enabled_features,absence_alert_threshold,created_by_user_id,created_at,updated_at) VALUES(5001,1,'EBD','ESCOLA_BIBLICA',20,10,20,'ATIVO','["EBD"]',3,1,'2026-08-11','2026-08-11');
    INSERT INTO ebd_classes VALUES(6001,1,5001,'Adultos',NULL,NULL,NULL,'ATIVO','2026-08-11','2026-08-11');
    INSERT INTO ebd_enrollments VALUES(7001,1,5001,6001,1001,'2026-01-01','ATIVO',NULL,'histórico','2026-01-01','2026-01-01');
    INSERT INTO ebd_meetings VALUES(8001,1,5001,'2026-08-09',NULL,NULL,'FINALIZADO',1,1,1,'2026-08-09','2026-08-09','2026-08-09');
    INSERT INTO ebd_attendance VALUES(8001,6001,1,1001,'PRESENTE',1,'2026-08-09');`);
}

test("0020 migra matrícula e frequência antigas sem perda", () => {
  const db = fixture({ migrate: false });
  legacyEbd(db);
  apply(db, "0020_ebd_students_secretary");
  const student = db.prepare("SELECT * FROM ebd_students WHERE person_id=1001").get();
  assert.equal(student.full_name, "Pessoa A");
  assert.equal(db.prepare("SELECT enrolled_at FROM ebd_student_enrollments WHERE student_id=?").get(student.id).enrolled_at, "2026-01-01");
  assert.equal(db.prepare("SELECT attendance_status FROM ebd_student_attendance WHERE student_id=?").get(student.id).attendance_status, "PRESENTE");
});

test("aluno independente participa da chamada e pode ser vinculado depois", () => {
  const db = fixture({ migrate: false });
  legacyEbd(db);
  db.exec("INSERT INTO people VALUES(1002,1,'Nova Pessoa',NULL,NULL,NULL,NULL,NULL,NULL)");
  apply(db, "0020_ebd_students_secretary");
  db.exec(`INSERT INTO ebd_students VALUES(9001,1,5001,NULL,'Aluno EBD',NULL,'NAO_INFORMADO',NULL,NULL,NULL,'Responsável','9999',NULL,'ATIVO',1,'2026-08-11','2026-08-11');
    INSERT INTO ebd_student_enrollments VALUES(9002,1,5001,6001,9001,'2026-08-11','ATIVO',NULL,NULL,'2026-08-11','2026-08-11');
    INSERT INTO ebd_student_attendance VALUES(8001,6001,1,9001,'PRESENTE',1,'2026-08-11');
    UPDATE ebd_students SET person_id=1002 WHERE id=9001;`);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM ebd_student_attendance WHERE student_id=9001").get().total, 1);
  assert.equal(db.prepare("SELECT person_id FROM ebd_students WHERE id=9001").get().person_id, 1002);
});

test("estruturas da Secretaria isolam tenant e tornam aprovação idempotente", () => {
  const db = fixture();
  for (const table of ["secretary_requests","church_movements","baptism_events","baptism_candidates","consecrations","secretary_document_templates","secretary_documents","secretary_audit"])
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table), table);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM help_articles WHERE version='29'").get().total, 10);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM membership_permissions WHERE membership_id=1 AND permission LIKE 'SECRETARIA_%'").get().total, 12);
  assert.throws(() => db.exec("INSERT INTO secretary_requests(id,tenant_id,person_id,request_type,status,version,requested_by_user_id,requested_at,updated_at) VALUES(1,1,2001,'TRANSFERENCIA_INTERNA','PENDENTE',1,1,'2026-08-11','2026-08-11')"));
  db.exec("INSERT INTO secretary_requests(id,tenant_id,person_id,request_type,origin_unit_id,destination_unit_id,status,version,requested_by_user_id,requested_at,updated_at) VALUES(2,1,1001,'TRANSFERENCIA_INTERNA',20,30,'APROVADA',1,1,'2026-08-11','2026-08-11')");
  const movement = "INSERT INTO church_movements(id,tenant_id,person_id,unit_id,movement_type,request_id,effective_date,description,metadata_json,status,created_by_user_id,created_at) VALUES(?,1,1001,20,'TRANSFERENCIA_INTERNA',2,'2026-08-11','Transferência','{}','CONCLUIDA',1,'2026-08-11')";
  db.prepare(movement).run(3);
  assert.throws(() => db.prepare(movement).run(4));
});

test("documento emitido preserva snapshot da versão do modelo", () => {
  const db = fixture();
  db.exec(`INSERT INTO secretary_document_templates VALUES(10,1,20,'Carta','CARTA','ATIVO',1,1,'2026-08-11','2026-08-11');
    INSERT INTO secretary_document_template_versions VALUES(10,1,1,'Título original','Texto original',NULL,NULL,'[]','{}',1,'2026-08-11');
    INSERT INTO secretary_documents VALUES(11,1,20,1001,10,1,'CARTA','CARTA-2026-000001','Título original','Texto original',NULL,NULL,'[]',1,'2026-08-11');
    UPDATE secretary_document_templates SET current_version=2 WHERE id=10;
    INSERT INTO secretary_document_template_versions VALUES(10,1,2,'Título novo','Texto novo',NULL,NULL,'[]','{}',1,'2026-08-12');`);
  assert.deepEqual({ ...db.prepare("SELECT title_snapshot,body_snapshot,template_version FROM secretary_documents WHERE id=11").get() }, { title_snapshot: "Título original", body_snapshot: "Texto original", template_version: 1 });
});
