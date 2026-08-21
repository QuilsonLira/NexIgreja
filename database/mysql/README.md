# Configuração MySQL 8

1. Crie um banco vazio usando `utf8mb4`.
2. Execute `001_auth_foundation.sql`.
3. Somente em ambiente de teste, execute `002_test_seed.sql`.
4. Configure a string de conexão como segredo do backend, nunca no frontend.
5. Antes do uso real, crie contas próprias e inative os IDs 1, 2 e 3.

Exemplo de variável apenas para o backend:

```text
DATABASE_URL=mysql://usuario:senha@servidor:3306/nexigreja
```

Esta pasta entrega a estrutura MySQL equivalente. A versão executável hospedada
nesta etapa utiliza D1; a troca do adaptador de banco fica para a publicação no
ambiente MySQL definitivo.
