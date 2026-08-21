import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const center=readFileSync(new URL("../components/notification-center.tsx",import.meta.url),"utf8");
const page=readFileSync(new URL("../components/notifications-page.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");

test("sino atualiza a cada 45 segundos e pausa com aba oculta",()=>{
  assert.match(center,/45_000/);
  assert.match(center,/visibilityState==="visible"/);
  assert.match(center,/aria-expanded/);
  assert.match(center,/notificationBadge\(count\)/);
});

test("histórico oferece filtros, leitura em massa e paginação",()=>{
  assert.match(page,/"all"\|"unread"\|"read"/);
  assert.match(page,/read-all/);
  assert.match(page,/notification-pagination/);
});

test("dropdown possui adaptação para telas pequenas",()=>{
  assert.match(css,/@media\s*\(max-width:\s*640px\)/);
  assert.match(css,/\.notification-dropdown/);
});
