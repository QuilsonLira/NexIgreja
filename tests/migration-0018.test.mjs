import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {DatabaseSync} from "node:sqlite";

function apply(db){for(const sql of readFileSync(new URL("../drizzle/0018_notifications.sql",import.meta.url),"utf8").split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))db.exec(sql);}
function fixture(){
  const db=new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE tenants(id INTEGER PRIMARY KEY);
    CREATE TABLE auth_users(id INTEGER PRIMARY KEY);
    CREATE TABLE organizational_units(id INTEGER PRIMARY KEY);
    CREATE TABLE help_articles(
      id INTEGER PRIMARY KEY,tenant_id INTEGER,slug TEXT NOT NULL,title TEXT NOT NULL,summary TEXT NOT NULL,content TEXT NOT NULL,
      category TEXT NOT NULL,display_order INTEGER NOT NULL,target_profiles TEXT NOT NULL,required_permission TEXT,related_route TEXT,
      published INTEGER NOT NULL,is_new_feature INTEGER NOT NULL,released_at TEXT,version TEXT NOT NULL,created_by_user_id INTEGER,
      published_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(tenant_id,slug)
    );
    CREATE TABLE help_article_reads(user_id INTEGER,article_id INTEGER,viewed_at TEXT,PRIMARY KEY(user_id,article_id));
    INSERT INTO tenants VALUES(1),(2);
    INSERT INTO auth_users VALUES(1),(2),(3);
    INSERT INTO organizational_units VALUES(10),(20);
  `);
  apply(db);
  return db;
}

test("0018 cria a central e publica seu artigo de ajuda",()=>{
  const db=fixture();
  for(const table of ["notifications","notification_recipients"])assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
  const article=db.prepare("SELECT title,related_route,version FROM help_articles WHERE slug='como-funcionam-notificacoes'").get();
  assert.equal(article.title,"Como funcionam as notificações");
  assert.equal(article.related_route,"/painel/notificacoes");
  assert.equal(article.version,"27");
});

test("uma leitura não altera o estado dos outros destinatários",()=>{
  const db=fixture(),created="2026-08-11T10:00:00.000Z";
  db.prepare("INSERT INTO notifications(id,tenant_id,audience,type,title,message,created_at,updated_at) VALUES(1,1,'ORGANIZATIONAL','TESTE','Aviso','Mensagem',?,?)").run(created,created);
  db.prepare("INSERT INTO notification_recipients(notification_id,user_id,created_at) VALUES(1,1,?),(1,2,?)").run(created,created);
  db.prepare("UPDATE notification_recipients SET read_at=? WHERE notification_id=1 AND user_id=1").run(created);
  assert.equal(db.prepare("SELECT read_at FROM notification_recipients WHERE notification_id=1 AND user_id=1").get().read_at,created);
  assert.equal(db.prepare("SELECT read_at FROM notification_recipients WHERE notification_id=1 AND user_id=2").get().read_at,null);
});

test("restrição de audiência impede combinar tenant com anúncio de plataforma",()=>{
  const db=fixture(),created="2026-08-11T10:00:00.000Z";
  assert.throws(()=>db.prepare("INSERT INTO notifications(id,tenant_id,audience,type,title,message,created_at,updated_at) VALUES(1,2,'PLATFORM','TESTE','Aviso','Mensagem',?,?)").run(created,created));
  db.prepare("INSERT INTO notifications(id,tenant_id,audience,type,title,message,created_at,updated_at) VALUES(2,NULL,'PLATFORM','TESTE','Aviso','Mensagem',?,?)").run(created,created);
  assert.equal(db.prepare("SELECT audience FROM notifications WHERE id=2").get().audience,"PLATFORM");
});

test("contagem indexada mantém isolamento com mil destinatários",()=>{
  const db=fixture(),created="2026-08-11T10:00:00.000Z";
  const addNotification=db.prepare("INSERT INTO notifications(id,tenant_id,audience,type,title,message,created_at,updated_at) VALUES(?,1,'ORGANIZATIONAL','TESTE','Aviso','Mensagem',?,?)");
  const addRecipient=db.prepare("INSERT INTO notification_recipients(notification_id,user_id,created_at) VALUES(?,1,?)");
  db.exec("BEGIN");
  for(let id=1;id<=1000;id++){addNotification.run(id,created,created);addRecipient.run(id,created);}
  db.exec("COMMIT");
  const count=db.prepare("SELECT COUNT(*) total FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id WHERE r.user_id=1 AND r.read_at IS NULL AND r.archived_at IS NULL AND n.tenant_id=1").get().total;
  assert.equal(count,1000);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM notification_recipients WHERE user_id=2").get().total,0);
});
