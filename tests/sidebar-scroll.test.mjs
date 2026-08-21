import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root=new URL("../",import.meta.url);

test("sidebar mantém topo e rodapé fixos com navegação rolável",async()=>{
  const [shell,css]=await Promise.all([
    readFile(new URL("components/protected-shell.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(shell,/className="sidebar-scroll-region"/);
  assert.match(css,/\.sidebar-scroll-region\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/s);
  assert.match(css,/\.sidebar\s*\{[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/s);
  assert.match(css,/\.sidebar-top\s*\{[^}]*flex:\s*0 0 auto/s);
  assert.match(css,/\.sidebar-security\s*\{[^}]*flex:\s*0 0 auto/s);
});
