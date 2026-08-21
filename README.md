# NexIgreja — autenticação e administração

> Regra de desenvolvimento: sempre que uma funcionalidade relevante for adicionada ou modificada, verificar e atualizar a Central de Ajuda e a seção Novidades antes de considerar a implementação completa. Consulte `docs/help-and-data-export.md`.

Esta versão reúne a base de autenticação e o Módulo de Administração do
NexIgreja. Ela inclui login, sessão, isolamento SaaS por tenant e entre Convenção, Matriz e Filial,
gestão de unidades, usuários, permissões, histórico, Pessoas/Membros e controle comercial manual do SaaS. Os módulos de Caixa,
Entradas, Saídas, Relatórios, Cartas, Carteiras e Certificados ainda
não fazem parte desta etapa.

## O que está funcionando

- identificação prévia do cliente por código institucional único de 7 dígitos;
- login pelo mesmo campo usando CPF, nome de usuário ou e-mail, sempre dentro do cliente identificado;
- CPF validado pelos dígitos verificadores e armazenado apenas com números;
- e-mail e nome de usuário normalizados em minúsculas e únicos sem distinção de caixa;
- senha protegida com bcrypt (custo 12), nunca salva em texto puro;
- sessão revogável em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em HTTPS;
- expiração absoluta em 8 horas e por inatividade em 30 minutos;
- bloqueio após 5 falhas dentro de 15 minutos por identificador ou endereço IP;
- tratamento uniforme de credencial inexistente, senha incorreta e usuário inativo;
- histórico de sucesso/falha com método, IP, navegador/dispositivo e horário;
- proteção de `/painel` no servidor e nova validação de toda troca de unidade;
- escopos Convenção, Matriz e Filial com hierarquia e vínculos persistentes;
- layout interno protegido com menu, cabeçalho, unidade selecionada e Sair;
- telas de Unidades, Usuários e Histórico de acessos;
- cadastro, edição, ativação e desativação respeitando o escopo da sessão;
- permissões funcionais validadas novamente pelo backend, inclusive controles separados para membros, histórico e observações;
- redefinição de senha com troca obrigatória e encerramento das sessões;
- filtros, pesquisa, paginação, confirmações e mensagens de retorno;
- auditoria das ações administrativas com IP e dispositivo quando disponíveis.
- login separado e gestão exclusiva de clientes SaaS pelo Platform Owner;
- contexto organizacional explícito e auditado para o Platform Owner administrar um cliente;
- isolamento backend por `tenant_id`, inclusive em usuários, unidades, sessões e auditoria.
- planos, assinaturas, teste, cobrança e pagamento manual exclusivos do Platform Owner;
- aviso de vencimento, carência e suspensão efetiva dos módulos no backend;
- tela de assinatura do tenant, cortesia e reativação sem misturar dados com o financeiro da igreja.
- cadastro completo de membros separado de usuários, com foto otimizada, código sequencial por tenant, busca, filtros, ficha e impressão;
- isolamento de membros por Convenção, Matriz e Filial, permissões específicas, histórico e observações restritas;
- preenchimento assistido de endereço pelo ViaCEP, mantendo todos os campos editáveis e permitindo cadastro manual quando o provedor estiver indisponível.
- gestão de Departamentos, Ministérios e Escola Bíblica por unidade, com acessos individuais, agenda, frequência, comunicação, classes, chamada móvel, fechamento, alertas e relatórios.
- alunos da EBD vinculados a Pessoas ou cadastrados somente na EBD, com vínculo posterior sem perda de matrícula ou frequência.
- Secretaria Eclesiástica com transferências, recebimentos, movimentações, batismos, consagrações, documentos versionados, relatórios e auditoria.

## Banco usado pela versão executável

A versão hospedada no ChatGPT Sites usa o banco relacional Cloudflare D1,
declarado como `DB` em `.openai/hosting.json`. O banco é acessado somente no
servidor; senha e token de sessão não são enviados nem armazenados no código do
frontend.

As migrações estão em `drizzle/`:

- `0000_unusual_amphibian.sql`: estrutura legada preservada sem exclusão;
- `0001_bizarre_legion.sql`: fundação atual de autenticação e organização.
- `0002_aromatic_multiple_man.sql`: permissões diretas e auditoria administrativa.
- `0007_peaceful_ogun.sql`: fundação multi-tenant SaaS, backfill e proteções de integridade.
- `0008_parallel_ricochet.sql`: vincula os eventos legados de segurança ao tenant.
- `0009_watery_maddog.sql`: separa identidades globais dos vínculos organizacionais.
- `0010_mysterious_xavin.sql`: adiciona a seleção explícita de organização na sessão.
- `0011_greedy_lady_mastermind.sql`: adiciona CNPJ herdável e funções organizacionais por tenant.
- `0012_tenant_owned_credentials.sql`: torna cada credencial independente e única somente dentro do tenant.
- `0013_institution_access_code.sql`: adiciona código institucional, pré-login e contexto explícito do Platform Owner.
- `0014_manual_billing.sql`: adiciona perfil comercial, planos, assinatura, cobranças, pagamentos, licença e auditoria SaaS.
- `0015_people_members.sql`: adiciona Pessoas/Membros, numeração por tenant, funções, relações familiares, histórico, fotos e proteções de escopo.
- `0019_departments_ebd.sql`: adiciona Departamentos/Ministérios, acessos locais, agenda, frequência e o fluxo completo da Escola Bíblica.
- `0020_ebd_students_secretary.sql`: permite alunos independentes na EBD e adiciona a Secretaria Eclesiástica completa.

A decisão arquitetural e o padrão obrigatório para novos módulos estão descritos em
[`docs/saas-multitenancy.md`](docs/saas-multitenancy.md).
O domínio comercial, seus estados e a política de datas/renovação estão em
[`docs/commercial-billing.md`](docs/commercial-billing.md).
O domínio de Pessoas/Membros, suas permissões e limites estão em
[`docs/people-members.md`](docs/people-members.md).
A arquitetura da Central de Notificações, seus destinatários e regras de evolução estão em
[`docs/notifications.md`](docs/notifications.md).
A arquitetura de Departamentos, Ministérios e EBD, incluindo segurança, integridade e evolução financeira, está em
[`docs/departments-ebd.md`](docs/departments-ebd.md).
A arquitetura da Secretaria Eclesiástica, seus fluxos, segurança e documentos versionados está em
[`docs/secretary.md`](docs/secretary.md).

Uma migração equivalente para MySQL 8 está em `database/mysql/`, pronta para o
ambiente definitivo que usar MySQL. A aplicação publicada nesta etapa continua
usando D1 para poder ser executada e testada diretamente no Sites.

## Executar localmente

Pré-requisitos: Node.js 22.13 ou superior.

```bash
npm ci
npm run dev
```

Para validar código, migrações e a compilação de produção:

```bash
npm test
npm run lint
```

Não coloque credenciais reais em arquivos `.env`, no repositório ou no
frontend. No ambiente hospedado, o recurso `DB` é criado e conectado pela
plataforma.

## Acessos fictícios de teste

O acesso organizacional usa primeiro o código institucional `4837261`. O acesso do
Platform Owner é feito separadamente em `/platform/login`, sem código.

| Acesso | Usuário | E-mail | CPF | Senha temporária de teste |
|---|---|---|---|---|
| Platform Owner | `quilson` | `admin@nexigreja.com.br` | `529.982.247-25` | `NexIgreja@2026` |
| Matriz | `gestor.matriz` | `matriz@nexigreja.com.br` | `168.995.350-09` | `Matriz@Nex2026!` |
| Filial | `gestor.filial` | `filial@nexigreja.com.br` | `111.444.777-35` | `Filial@Nex2026!` |

Essas contas existem exclusivamente para demonstração. As senhas acima não são
segredos de produção: no banco ficam apenas os hashes bcrypt. Antes de cadastrar
dados reais, crie contas administrativas próprias, teste o acesso e inative os
três usuários fictícios.

## Estrutura principal

- `organizational_units`: unidades dos tipos CONVENCAO, MATRIZ e FILIAL;
- `organizational_functions`: catálogo de funções independente por tenant;
- `tenant_memberships.function_id`: função do usuário naquele vínculo organizacional;
- `tenants`: clientes SaaS independentes, acima da hierarquia religiosa;
- `auth_users`: usuários, identificadores únicos, hash, status e escopo;
- `user_unit_links`: vínculos entre usuários e unidades;
- `auth_sessions`: sessões revogáveis e contexto selecionado;
- `tenant_access_contexts`: tokens opacos que lembram a instituição antes do login;
- `institution_lookup_attempts`: limitação e auditoria das consultas de código;
- `login_history`: histórico de tentativas e último acesso anterior.
- `user_permissions`: permissões administrativas concedidas a cada usuário;
- `administration_audit`: alterações administrativas com ator, escopo e origem.
- `commercial_profiles`: dados comerciais do cliente SaaS;
- `saas_plans`: planos manuais do NexIgreja;
- `tenant_subscriptions`: assinatura e estado da licença de cada tenant;
- `saas_charges` e `saas_payments`: cobranças e recebimentos manuais da plataforma;
- `billing_settings`: Pix, conta, instruções e configuração de avisos;
- `commercial_audit`: histórico comercial isolado por tenant.
- `people`: cadastro eclesiástico independente das identidades de acesso;
- `member_sequences`: sequência de código de membro isolada por tenant;
- `person_functions`, `person_relationships` e `person_history`: funções, vínculos e eventos do membro;
- `member_photos`: imagem binária validada e servida por endpoint autenticado.
- `notifications` e `notification_recipients`: eventos e leitura individual da Central de Notificações.
- `departments`, `department_roles`, `department_participants` e `department_access`: áreas ministeriais, funções, pessoas e acessos individuais;
- `department_events`, `department_activities` e `department_attendance`: agenda e frequência geral;
- `ebd_students`, `ebd_student_enrollments`, `ebd_student_attendance`, `ebd_classes`, `ebd_meetings`, `ebd_class_summaries` e `ebd_closures`: alunos vinculados ou independentes, classes, chamada e fechamento auditado da EBD.
- `secretary_requests`, `church_movements`, `baptism_events`, `consecrations`, `secretary_document_templates`, `secretary_documents` e `secretary_audit`: fluxos e histórico da Secretaria Eclesiástica.

Uma Matriz tem como pai uma Convenção. Uma Filial tem como pai uma Matriz. O
backend percorre essa hierarquia para autorizar a unidade solicitada; alterar um
ID no navegador não amplia o acesso.
