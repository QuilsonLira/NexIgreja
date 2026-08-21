# Arquitetura SaaS multi-tenant do NexIgreja

## Hierarquia e fronteiras

O NexIgreja separa `Platform Owner`, `Tenant/Cliente`, usuário organizacional e vínculo. O Platform Owner é uma identidade global especial e não pertence à hierarquia religiosa. Cada tenant é um cliente SaaS independente e mantém internamente a estrutura `Convenção → Matriz → Filial`.

O código institucional pertence ao tenant, não à Convenção, ao CNPJ, à Matriz ou à Filial. Um cliente pode ter várias Convenções sem alterar sua fronteira de autenticação.

## Acesso organizacional em duas etapas

O login comum começa com um código institucional aleatório e único de sete dígitos. Depois de um código válido, o servidor grava um token opaco, aleatório, com hash persistido em `tenant_access_contexts`; o navegador recebe apenas um cookie `HttpOnly`, `SameSite=Lax`, com validade de 30 dias. O tenant nunca é aceito de um campo livre na etapa de credenciais.

Na segunda etapa, CPF, e-mail ou nome de usuário são consultados obrigatoriamente com `tenant_id` derivado desse contexto pré-login. A senha é comparada somente com o hash da identidade encontrada dentro do tenant. Código inválido, cliente suspenso/cancelado, contexto expirado ou ausente impedem o avanço. Consultas de código possuem limitação de tentativas por IP e impressão criptográfica do código, sem armazenar o código digitado no histórico.

O botão **Trocar instituição** revoga o contexto lembrado. A regeneração do código pelo Platform Owner invalida todos os contextos pré-login anteriores daquele cliente.

## Credenciais pertencem ao tenant

Cada registro organizacional de `auth_users` possui `tenant_id` e é uma identidade independente. CPF, e-mail e nome de usuário são únicos apenas dentro desse tenant por meio dos índices:

- `auth_users_tenant_cpf_unique`;
- `auth_users_tenant_email_unique`;
- `auth_users_tenant_username_unique`.

O mesmo identificador pode existir em tenants distintos. Nome civil nunca é chave única. Hash, bloqueio, foto e troca de senha pertencem à identidade do tenant; alterar a senha em um cliente não modifica qualquer outro. O mecanismo seguro de hash existente continua inalterado.

`tenant_memberships` contém função, escopo, unidade-raiz, status e permissões no mesmo tenant. O backend deriva o tenant da sessão autenticada e revalida o escopo em cada operação.

## Platform Owner

O Platform Owner possui login separado em `/platform/login`, sem código institucional. A conta mantém `tenant_id = NULL`, é reconhecida apenas pela tabela singleton `platform_owners` e não pode ser criada ou delegada pelas permissões comuns.

Sua sessão nasce sem `tenant_id`, `membership_id` ou unidade organizacional. A área **Administração do NexIgreja → Clientes SaaS** permite visualizar, copiar e regenerar o código institucional. A ação **Administrar cliente** escolhe explicitamente um tenant e uma Convenção ativa, grava `platform_context_active = 1` e registra auditoria. Um banner persistente identifica o cliente sendo administrado. A ação de retorno limpa `tenant_id`, vínculo e unidade da sessão novamente.

APIs organizacionais recusam o Platform Owner com `403` enquanto esse contexto explícito não estiver ativo. APIs de plataforma usam autorização própria e continuam disponíveis sem contexto organizacional.

## Cadastro e edição

O cadastro administrativo cria uma identidade e uma senha no tenant da sessão. A busca de duplicidade recusa CPF, e-mail ou usuário já existentes somente naquele cliente. Edição de nome, identificadores, função, escopo, foto e permissões atua somente na identidade e no vínculo desse tenant. Consultas por ID também exigem o tenant e o escopo derivados da sessão, impedindo IDOR entre clientes e Convenções.

## Sessões, auditoria e isolamento

Sessões organizacionais guardam `user_id`, `membership_id` e `tenant_id` coerentes. Sessões gerais do Platform Owner mantêm esses campos organizacionais nulos. Ao entrar em um cliente, troca de contexto, status do tenant, unidade operacional e hierarquia são revalidados no backend.

Tentativas de identificação, logins, regeneração de código, entrada/saída de contexto e operações administrativas são auditados. Impressões de login incluem o namespace do tenant, evitando que falhas em um cliente bloqueiem indevidamente a mesma credencial em outro.

Toda tabela de negócio deve possuir `tenant_id` obrigatório e indexado. Leituras, mutações, relatórios, imagens e auditoria filtram pelo tenant derivado do contexto autenticado. Identificadores de outro tenant retornam negação ou registro inexistente sem revelar dados.

## Migrations

A migration `0012_tenant_owned_credentials.sql` remove índices globais e divide identidades legadas compartilhadas, preservando hashes, fotos, permissões, vínculos e sessões. A migration `0013_institution_access_code.sql` cria os códigos institucionais, contextos pré-login, histórico limitado de tentativas e o estado explícito da sessão do Platform Owner. Ambas possuem rollback estrutural em `database/rollback/`.

## CNPJ e funções

O CNPJ continua opcional e não participa do login. `organizational_units.cnpj` guarda somente o CNPJ próprio; Filial com `uses_parent_cnpj = 1` resolve o valor efetivo pela Matriz. A unicidade do CNPJ próprio é `(tenant_id, cnpj)`.

`organizational_functions` pertence ao tenant. Função não concede permissão: autorizações continuam em `membership_permissions`. Funções inativas permanecem no histórico e deixam de aparecer em novos cadastros.
