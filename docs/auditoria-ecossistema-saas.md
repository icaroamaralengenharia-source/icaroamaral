# Auditoria do ecossistema SaaS

## Visao geral

Esta auditoria cobre o repositorio `site_repo_icaroamaral` e considera os produtos ELO, CADISTA AI, ObraReport, Stock Obras, Stock Full e Stock Saude Jovem4. A leitura foi feita sem reescrever fluxos existentes e sem conectar novos componentes na interface.

O estado atual mostra um ecossistema com produtos ja publicados ou em piloto, porem ainda com camadas comuns parcialmente duplicadas. O caminho mais seguro e transformar auth, empresa, usuario, permissao, projeto/cliente, documentos, auditoria e billing em plataforma comum, mantendo cada produto como modulo independente.

## Mapa dos produtos

| Produto | Arquivo principal | Backend ou localStorage | Login | Empresa/companyId | Permissoes | Banco | Fallback local | PDF | IA | E-mail | Integrado ao ELO | SaaS hoje | Riscos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ELO | `elo.html`, `relatorio-qualidade-obras/elo-assistente.js` | localStorage e backend parcial para projetos/orcamentos | Nao como produto standalone | Parcial via `companyId` em stores backend | Parcial, por intencao/fluxo | JSON backend e schemas de orcamento | Sim | Sim | Sim | Indireto/assistido | Sim, e tambem e a camada transversal | Vendavel como assistente/piloto, nao SaaS completo isolado | Memoria local, permissao e billing ainda nao centralizados |
| CADISTA AI | `cadista/index.html` e `cadista/*.js` | Predominantemente frontend/local | Existe entrada `cadista-login.html`, mas sem auth central confirmado | Nao consolidado | Nao consolidado | Nao identificado no repo principal | Sim | Sim/planejado | Sim/assistido | Nao identificado | Citado no ELO e home | Vendavel como demonstracao/implantacao assistida | Precisa persistencia, projetos, versoes, exportacao auditavel e login real |
| ObraReport | `relatorio-qualidade-obras/relatorio-qualidade-obras.html`, `.js` | localStorage + backend transacional parcial | Sim, painel de acesso e backend parcial | Sim, `institution_id` em schemas e `company` em integrações | Sim visual/operacional | `obrareport-runtime-schema.sql` e JSON service | Sim | Sim | Sim | Sim via mailto/preparacao | Sim, ELO embarcado | Vendavel em piloto assistido | Segurança final depende de backend/RLS, billing real e isolamento consistente |
| Stock Obras | `stock-ai-obras.html`, `stock-ai-obras-bridge.js` | localStorage, bases CSV/XLSX e ELO | Nao standalone | Vinculo por obra no ObraReport, sem multiempresa proprio | Nao standalone | Nao central identificado | Sim | Parcial via ELO/ObraReport | Sim | Nao principal | Sim, fortemente | Vendavel como recurso do ObraReport, nao SaaS isolado | Regra BR/SINAPI/ORSE, dados locais e risco de mexer em fluxo estavel |
| Stock Full | `stockfull.html`, `stock-full-app.js`, `stock-full-core.js`, `stock-full-sync.js` | Supabase/backend quando configurado + localStorage | Sim | Sim, `companyId`, `institution_id` | Sim, matriz por role | SQL Supabase e sync | Sim | Sim | Sim/recomendacoes | Sim/preparacao | Parcial | Vendavel como piloto SaaS mais maduro | Billing ausente, hardening de auth/RLS e migracao de dados locais |
| Stock Saude Jovem4 | `stock-saude.html`, `stock-saude-app.html`, `stock-saude.js` | Supabase quando autenticado + demo local | Sim via Supabase token | Sim, institution/unit | Sim por perfis | `stock-saude-schema.sql` | Sim demo local | Sim | Sim/posicionamento | Nao principal | Parcial, linka ELO | Vendavel apenas com implantacao controlada | Dados sensiveis, LGPD, regras de saude, auditoria e acesso precisam ser mais rigorosos |

## Pontos fortes

- Produtos ja possuem superficies reais publicadas: home, ELO, ObraReport, Stock Obras, Stock Full, Stock Saude e CADISTA.
- ELO ja funciona como camada de inteligencia transversal e conversa com orcamento, RDO, relatorio, bases tecnicas e Stock Obras.
- ObraReport ja tem entidades naturais para a plataforma: cliente, obra, relatorio, RDO, documentos e Stock IA.
- Stock Full e Stock Saude ja apontam para modelo SaaS com login, company/institution, roles, Supabase e fallback local.
- Ha preocupacao visivel com PDF, auditoria, historico, backup e operacao offline.

## Gargalos SaaS

- Auth/login ainda nao e uma camada unica para todos os produtos.
- Empresa, usuario, permissao e projeto aparecem em formatos diferentes por modulo.
- Billing existe como demonstracao/fluxo assistido, nao como cobranca automatizada central.
- Persistencia mistura localStorage, JSON backend e Supabase; isso e aceitavel para piloto, mas precisa fronteira clara para SaaS.
- ELO ainda carrega memoria local e integracoes por script, sem contrato central de modulos.
- Internacionalizacao nao esta separada das regras locais: Stock Obras depende de bases BR; Saude depende de regras sensiveis locais.

## Riscos por produto

### ELO

Risco principal: virar um monolito de inteligencia com muitas responsabilidades. Deve ser preservado como camada transversal, mas com contratos de modulo e memoria isolada por empresa/projeto.

### CADISTA AI

Risco principal: ficar como prototipo tecnico sem persistencia, versionamento e isolamento de projetos. Precisa entrar na plataforma como modulo de projeto/documento, sem exigir reescrita do motor CAD.

### ObraReport

Risco principal: vender antes de consolidar seguranca server-side, RLS e billing. Ja pode ser piloto comercial com implantacao assistida, desde que o contrato deixe claro o estado da persistencia.

### Stock Obras

Risco principal: quebrar um fluxo estavel ao tentar transformar em SaaS isolado. Melhor manter dentro do ObraReport/ELO e evoluir apenas por contrato de modulo e entidades compartilhadas.

### Stock Full

Risco principal: ter duas verdades entre localStorage e Supabase. E o mais perto de SaaS horizontal, mas precisa migracao/conciliacao e billing.

### Stock Saude Jovem4

Risco principal: dados sensiveis, rastreabilidade e regras de saude. Nao deve herdar regras de estoque comum sem camada especifica de compliance.

## Prioridade de venda no Brasil

1. ObraReport com ELO e Stock Obras como pacote de engenharia: mais aderente ao mercado atual, uso claro e menor risco regulatorio.
2. Stock Full para pequenos comercios: dor ampla, escopo simples e multiempresa ja encaminhado.
3. Stock Saude Jovem4: alto valor, mas exige compliance e implantacao controlada.
4. ELO standalone: bom como porta de entrada e upsell, melhor vendido junto aos modulos.
5. CADISTA AI: forte diferencial, mas depende de maturar persistencia, exportacao e fluxo comercial.

## Prioridade internacional

1. Stock Full: regras menos locais e `countryMode=GLOBAL_READY`.
2. CADISTA AI: motor tecnico pode ser internacional se separar normas, unidades e idioma.
3. ELO: internacional como camada de assistente, desde que prompts/regras locais sejam plugaveis.
4. ObraReport: internacionalizavel, mas precisa adaptar formatos de documento, responsabilidade tecnica e idioma.
5. Stock Obras: depende de bases equivalentes a SINAPI/ORSE por pais.
6. Stock Saude Jovem4: internacional apenas apos separar compliance por jurisdicao.

## Proximos passos tecnicos

1. Adotar `src/platform/module-registry.js` como contrato inicial nao invasivo.
2. Criar Auth/Empresa/Usuario/Permissao como plataforma comum antes de conectar novos fluxos.
3. Definir `projectId`, `clientId`, `companyId` e `documentId` como identificadores compartilhados.
4. Criar camada de billing central sem acoplar aos modulos atuais.
5. Separar regras BR, global e saude sensivel por `countryMode` e `requiresSensitiveData`.
6. Fazer hardening de Stock Full e Stock Saude antes de venda self-service.
7. Manter Stock Obras estavel e evoluir por adaptadores, nao por refatoracao pesada.
