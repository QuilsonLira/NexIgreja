# Seguranca

## Regras aplicadas

- Argon2id com salt individual para senhas.
- Token de sessao aleatorio de 256 bits; somente HMAC no banco.
- Cookie `HttpOnly`, `SameSite=Lax`, `Secure` em producao e sem uso de `localStorage`.
- Validacao de status, sessao, escopo e contexto no backend.
- Protecao de origem para requisicoes que alteram estado.
- Cabecalhos CSP, anti-frame, HSTS, `nosniff` e politica de permissoes.
- SQL parametrizado e consulta de apenas uma coluna de credencial por tentativa.
- HMAC de CPF, IP e identificadores usados em auditoria.
- Bloqueio temporario persistido no MySQL, inclusive para conta desconhecida.
- Mensagem publica generica e motivo interno separado.
- Revogacao de todas as sessoes depois da troca de senha.
- Permissao funcional e escopo organizacional validados no backend em toda rota administrativa.
- Proibicao de delegar permissoes que o administrador nao possui.
- Revogacao de sessoes depois de redefinicao de senha, desativacao ou mudanca de escopo.
- Auditoria das acoes administrativas com identificacao do ator e do alvo.
- IP em texto e HMAC somente no historico protegido, com retencao de 90 dias.

## Segredos

Nunca salve no GitHub:

- `.env` ou `.env.local`;
- senha do MySQL;
- chaves HMAC;
- cookies ou tokens;
- backup real do banco.

Cada ambiente deve ter segredos diferentes. Em producao, mantenha `COOKIE_SECURE=true` e `APP_ORIGIN` exatamente igual ao dominio HTTPS publicado.

## Relato de vulnerabilidade

Nao abra uma issue publica contendo dados reais ou detalhes exploraveis. Registre o problema em canal privado com o proprietario do sistema.
