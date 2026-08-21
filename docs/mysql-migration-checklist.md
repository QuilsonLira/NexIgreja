# Checklist técnico — MySQL

- [x] Branch isolada `mysql-migration`
- [x] Driver `mysql2`
- [x] Pool MySQL usando `DATABASE_URL`
- [x] Ping de conectividade
- [x] Conversor inicial de schema SQLite -> MySQL
- [x] Configuração Drizzle MySQL separada
- [x] CI de validação TypeScript
- [ ] Lockfile atualizado e validado
- [ ] Schema MySQL gerado sem erros
- [ ] DDL MySQL completo de todos os módulos
- [ ] `db/index.ts` usando MySQL na branch
- [ ] Build Next.js validado com MySQL
- [ ] Estrutura aplicada no banco Hostinger vazio
- [ ] Dados D1 exportados
- [ ] Dados importados preservando IDs
- [ ] Contagens e relacionamentos conferidos
- [ ] Login/sessões validados
- [ ] Migração pronta para merge na `main`
