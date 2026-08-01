# Checklist de Homologacao Demo Real

Data: 2026-08-01

## Objetivo

Preparar a homologacao final da plataforma municipal contra banco e RLS reais em um projeto demo isolado. Este checklist nao cria projeto, nao executa SQL, nao acessa Supabase e nao cria usuarios.

## Destino Permitido

- Ambiente: demo
- Projeto: somente um projeto demo novo e isolado
- Prefixo obrigatorio dos dados: `DEMO_MUNICIPAL_LIVE_52_`

## Destinos Bloqueados

- `mplpzyalcxhhinuvjthx`
- `lidueokjpzxdybtongbk`
- Qualquer projeto de E2E, producao, cliente real ou homologacao antiga

## Variaveis Obrigatorias Antes do Live

- `APP_ENV=demo`
- `MUNICIPAL_DEMO_MODE=true`
- `RUN_DEMO_LIVE_TESTS=true`
- `DEMO_PROJECT_REF=<project_ref_demo>`
- `DEMO_SUPABASE_URL=https://<project_ref_demo>.supabase.co`
- `DEMO_DATABASE_URL=<connection string demo>`
- `DEMO_PANEL_URL=https://<painel-demo>`
- `MUNICIPAL_WHATSAPP_ENABLED=false`
- `MUNICIPAL_EMAIL_ENABLED=false`

## Validacoes de Destino

- Confirmar que `DEMO_PROJECT_REF` bate com o subdominio de `DEMO_SUPABASE_URL`.
- Confirmar HTTPS no Supabase e no painel.
- Rejeitar localhost para teste remoto.
- Rejeitar CORS `*`.
- Rejeitar qualquer credencial exposta ao frontend.
- Rejeitar fallback para outro banco.
- Confirmar que nenhum log imprime URL completa, senha, token, service role ou UUID completo.

## Ordem Manual Futura

1. Criar projeto Supabase demo isolado manualmente.
2. Configurar variaveis locais seguras fora do Git.
3. Criar usuarios ficticios no Auth demo.
4. Aplicar manualmente `backend/src/data/municipal-demo-schema-bundle.sql`.
5. Aplicar manualmente `backend/src/data/municipal-demo-seed.sql` com placeholders substituidos.
6. Rodar manualmente `backend/src/data/municipal-demo-verification.sql`.
7. Rodar manualmente `backend/src/data/municipal-demo-live-verification.sql`.
8. Executar testes live uma unica vez por bloco autorizado.
9. Registrar evidencias e decisao final.

## Preflight Live

Validar antes de qualquer conexao:

- project ref permitido;
- URL e project ref correspondem;
- ambiente e demo;
- worktree limpa;
- hashes de bundle, seed e verificacoes registrados;
- usuarios ficticios informados;
- E2E/producao bloqueados;
- integracoes externas desligadas;
- sem `RUN_DEMO_LIVE_TESTS=true`, testes devem ficar bloqueados/skipped.

## RLS Real

Cenarios preparados:

- platform_admin;
- municipal_admin;
- gestor unidade A;
- gestor unidade B;
- leitura;
- sessao ausente;
- sessao expirada.

Validar no live futuro:

- gestor A nao le unidade B;
- gestor B nao le unidade A;
- leitura nao escreve;
- municipal_admin fica na propria instituicao;
- tenant externo e bloqueado;
- payload nao sobrescreve escopo da sessao;
- `project_id` e rejeitado;
- service role nunca entra no navegador;
- policies de patrimonio, notificacoes, estoque e Acervo funcionam;
- auditoria registra operacoes autorizadas.

## Concorrencia Real

Cenarios preparados:

- 20 entradas simultaneas;
- 20 saidas simultaneas;
- `operation_id` repetido;
- saida maior que saldo;
- tombamento duplicado concorrente;
- `deduplication_key` repetida;
- versoes concorrentes de documento;
- transferencia patrimonial concorrente.

Limites:

- maximo de 20 operacoes concorrentes;
- uma execucao por cenario;
- sem retry automatico;
- timeout controlado;
- abortar no primeiro erro de destino.

## Painel Live

Preparar validacao de:

- login;
- Visao Geral;
- estoque;
- patrimonio;
- Sentinela;
- notificacoes;
- relatorios;
- Acervo;
- ELO;
- offline;
- logout/troca de usuario;
- desktop, tablet e celular;
- falha parcial;
- contador de notificacoes;
- nenhuma exposicao de IDs ou segredos.

## Verificacao SQL Read-Only

Arquivo: `backend/src/data/municipal-demo-live-verification.sql`

Confirmar:

- tabelas;
- RLS;
- policies;
- indices;
- constraints;
- dados `DEMO_MUNICIPAL_LIVE_52_`;
- registros fora do escopo;
- duplicidades;
- saldo negativo;
- tombamento duplicado;
- `operation_id` duplicado;
- `deduplication_key` duplicada;
- historico ausente;
- auditoria ausente;
- notificacoes externas;
- inconsistencias entre instituicao e unidade.

## Cleanup

Nao ha cleanup automatico novo nesta etapa.

Reutilizar somente o cleanup manual existente, com estas regras:

- remover apenas dados `DEMO_MUNICIPAL_LIVE_52_`;
- nao apagar usuarios;
- nao apagar instituicao principal;
- nunca executar automaticamente;
- exigir evidencia e autorizacao manual explicita.

## Evidencias Necessarias

- SHA-256 dos SQLs aplicados/verificados;
- print ou export dos resultados de verificacao;
- resumo dos testes RLS reais;
- resumo dos testes de concorrencia reais;
- resumo do painel live em desktop/tablet/celular;
- confirmacao de WhatsApp/e-mail desligados;
- confirmacao de cleanup nao executado ou evidencia de execucao autorizada.

## Criterio de Aprovacao

A decisao so pode ser `APROVADO` quando banco, RLS real, concorrencia real e painel live passarem no projeto demo isolado. Ate la, a decisao maxima e `PRONTO PARA HOMOLOGACAO LIVE`.

## Assistente Local da Demo Real

Use o wizard somente para preparar arquivos locais e orientar o operador. Ele nao cria projeto, nao acessa Supabase, nao testa conexao, nao executa SQL, nao cria usuario e nao faz deploy.

Comandos seguros:

- `npm --prefix backend run demo:wizard`
- `npm --prefix backend run demo:wizard:example`
- `npm --prefix backend run demo:runbook:dry-run`

Dados permitidos no wizard:

- nome interno ficticio iniciado por `DEMO_MUNICIPAL_`;
- dominio HTTPS planejado;
- project ref demo isolado;
- responsavel tecnico sem e-mail, telefone, CPF ou segredo;
- confirmacoes `SIM` para isolamento, backup e integracoes desligadas;
- UUIDs ficticios dos quatro usuarios.

Dados proibidos:

- senha;
- token;
- JWT;
- service key;
- anon key;
- connection string;
- URL completa de banco;
- dados pessoais reais.

Arquivos gerados pelo wizard:

- `backend/.env.demo.operator.example`;
- `artifacts/municipal-demo-runbook.json`;
- `artifacts/municipal-demo-operator-checklist.md`.

Pare imediatamente e peca autorizacao manual antes de qualquer acao que envolva Supabase, banco, SQL, criacao de usuario, deploy, cleanup ou `RUN_DEMO_LIVE_TESTS=true`.
