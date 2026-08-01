# Checklist De Deploy Municipal

## Regra Geral

Este checklist prepara demonstracao e producao sem tocar em SQL nesta etapa. Qualquer aplicacao de schema, criacao de usuario, carga de dados ou ativacao externa deve ter aprovacao separada.

## Matriz De Ambientes

| Ambiente | Finalidade | Banco | Dominio | Usuarios | Dados Permitidos | Integracoes | Responsavel | Regra De Acesso |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Desenvolvimento | Implementacao local e testes unitarios | Local/mock ou banco descartavel | localhost | Devs autorizados | Dados ficticios | Externas desligadas | Engenharia | Acesso local, sem dados reais |
| E2E/homologacao | Validar fluxos automatizados e homologacao controlada | Projeto E2E autorizado | Dominio/porta de teste | Usuarios E2E reservados | Dados ficticios com prefixo de homologacao | WhatsApp/e-mail desligados | Engenharia/QA | Restrito a equipe tecnica |
| Demonstracao | Apresentar ao cliente sem risco operacional | Banco demo isolado | Subdominio demo | Usuarios demo | Dados ficticios aprovados | Externas desligadas por padrao | Engenharia + Comercial | Acesso temporario e monitorado |
| Producao | Operacao real do cliente | Banco dedicado do cliente | Dominio oficial HTTPS | Usuarios reais administrados | Dados reais autorizados | Ativadas somente apos aceite | Operacao/Cliente | MFA/politica do cliente, menor privilegio |

## Variaveis Obrigatorias

- `SUPABASE_URL`: somente backend.
- `SUPABASE_SERVICE_ROLE_KEY`: somente backend, nunca frontend.
- `SUPABASE_ANON_KEY`: apenas quando explicitamente necessario para cliente publico.
- `AI_ALLOWED_ORIGINS`: lista fechada de dominios autorizados.
- `PORT`: porta do backend.
- `MUNICIPAL_WHATSAPP_ENABLED=false` para demonstracao.
- `MUNICIPAL_EMAIL_ENABLED=false` para demonstracao.
- `MUNICIPAL_WHATSAPP_PROVIDER_TOKEN`: vazio em demonstracao.
- `MUNICIPAL_EMAIL_PROVIDER_TOKEN`: vazio em demonstracao.
- `OBRAREPORT_API_BASE_URL`: URL do backend do ambiente correto.

## Banco E Schemas

- Confirmar banco isolado por ambiente.
- Confirmar schemas municipais aplicados por processo aprovado.
- Confirmar tabelas de administracao, patrimonio, documentos, notificacoes, relatorios e Sentinela.
- Nao usar projeto E2E como fallback operacional.
- Nao executar SQL sem janela, backup e autorizacao.

## RLS

- RLS ativo em tabelas municipais.
- Politicas restringem por `institution_id`, `unit_id` e papel.
- Leitura e escrita testadas por papel.
- Gestor nao acessa unidade externa.
- Tenant externo retorna 403/404.

## Autenticacao

- Login real ou demonstrativo por provedor autorizado.
- Tokens nunca persistidos em docs, logs ou frontend.
- Logout limpa sessao e invalida cache offline do usuario.
- Usuarios demo devem ser temporarios e revogados apos a apresentacao.

## CORS

- `AI_ALLOWED_ORIGINS` deve conter apenas dominios esperados do ambiente.
- Producao nao pode usar wildcard.
- Localhost permitido apenas em desenvolvimento/homologacao.
- Testar preflight antes da apresentacao.

## HTTPS E Dominio

- Certificado valido.
- Redirecionamento HTTPS ativo.
- Dominio de demonstracao separado do dominio de producao.
- `municipal-admin.html` deve apontar para backend correto do ambiente.

## Backup

- Backup do banco antes de qualquer migracao ou carga real.
- Retencao definida com cliente.
- Restauracao testada em ambiente nao produtivo.
- Responsavel e janela documentados.

## Logs E Monitoramento

- Logs sem senhas, tokens, JWT, cookies ou chaves.
- Monitorar `/api/health`.
- Monitorar falhas 401/403/500.
- Alertar indisponibilidade do backend.
- Registrar erro sanitizado para suporte.

## Arquivos Estaticos

- Publicar HTML, CSS e JS do painel no ambiente correto.
- Conferir `assets/elo-public-config.js`.
- Conferir cache de navegador apos nova versao.
- Nao publicar `.env`, mapas privados, backups ou dumps.

## Service Worker E Cache

- Confirmar se ha service worker ativo no dominio.
- Garantir que cache offline nao armazene tokens.
- Cache de patrimonio deve ser escopado por instituicao, unidade e usuario.
- Logout deve invalidar cache do usuario.
- Escrita offline deve permanecer bloqueada.

## Testes De Saude

- `GET /api/health` retorna `ok`.
- Login retorna sessao valida.
- Painel carrega Visao Geral.
- Patrimonio lista dados ficticios.
- Notificacoes in-app aparecem.
- ELO responde dentro do escopo.
- Offline consulta patrimonio sincronizado.

## Rollback

- Registrar versao anterior do frontend.
- Registrar commit anterior do backend.
- Manter procedimento para reverter deploy do backend.
- Manter procedimento para reverter arquivos estaticos.
- Nao reverter banco sem plano aprovado.

## Treinamento

- Treinar gestor em patrimonio, almoxarifado, Sentinela, notificacoes, relatorios, Acervo, ELO e logout.
- Entregar manual rapido.
- Validar duvidas em ambiente demo.
- Reforcar politica de senha e dados.

## Aceite Do Cliente

- Registrar ambiente usado.
- Registrar usuarios demo usados.
- Registrar modulos demonstrados.
- Registrar pendencias.
- Coletar aceite formal antes de producao.

## Bloqueios Para Deploy

- Segredo hardcoded.
- CORS wildcard em producao.
- WhatsApp/e-mail ativados por padrao na demonstracao.
- Projeto E2E usado como fallback operacional.
- Service role key no frontend.
- Falta de backup ou rollback documentado.
- Falta de rota de health.
