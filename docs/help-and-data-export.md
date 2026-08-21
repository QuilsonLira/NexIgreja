# Central de Ajuda e exportação de dados

## Ciclo obrigatório de ajuda

Toda funcionalidade relevante deve ser avaliada antes da conclusão:

- precisa aparecer em Novidades;
- precisa de novo guia ou atualização de artigo;
- precisa de ajuda contextual;
- afeta um perfil ou uma permissão específica.

Artigos oficiais ficam em `help_articles`. O conteúdo é texto simples, sem HTML executável. Artigos globais usam `tenant_id = NULL`; a estrutura admite conteúdo específico por tenant. `help_article_reads` mantém o contador individual de novidades. Somente o Platform Owner administra artigos pela Central de Ajuda.

## Exportação

- XLSX: planilha Office real com cabeçalhos legíveis.
- CSV: UTF-8 com BOM e separador `;`, compatível com Excel brasileiro.
- JSON: nomes estáveis e `export_schema_version`.
- ZIP: pacote de portabilidade com `manifest.json`, dados estruturados, campos personalizados e fotos permitidas.

O schema inicial de portabilidade é `1.0`. IDs de pessoas, unidades e relacionamentos são preservados. A geração é síncrona no backend porque a infraestrutura atual não possui filas; nenhuma promessa de processamento em segundo plano é exibida.

## Segurança

Toda operação revalida sessão, tenant, alcance e as permissões `DADOS_EXPORTAR` ou `DADOS_EXPORTAR_COMPLETO`. Exportações completas exigem alcance de Convenção; pacote técnico exige Platform Owner em contexto explícito do tenant. A auditoria registra somente metadados.

Jamais exportar senha, `password_hash`, sessões, cookies, tokens, chaves de API, segredos ou chaves privadas. Downloads são respostas autenticadas, privadas e não geram URL pública permanente.
