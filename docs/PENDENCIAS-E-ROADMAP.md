# PENDENCIAS E ROADMAP

## Pronto e validado

- Backend Express com `GET /api/health` e rotas reais em `backend/src/app.js`.
- Stock Full como piloto SaaS com rotas `/api/stock-full/*`, schema e E2E real.
- Suite ampla E2E real registrada como 396/396 PASS no contexto operacional recente.
- Ambiente E2E isolado com validacao de seguranca por `validate-e2e-env.mjs`.
- Setup E2E com tenant, usuario, company, profile, obra, cliente, budget, RDO, relatorio e estoque.
- ObraReport transacional local para relatorios, RDOs, versoes, eventos e documentos HTML.
- ELO com roteamento, fallback, memoria local/Supabase e endpoints de conversa.
- Stock Obras em piloto tecnico estavel, sem proposta de alteracao nesta auditoria.

## Pronto com limitacoes

- ELO e ObraReport usam stores JSON locais como fallback/desenvolvimento em alguns fluxos.
- Supabase depende de schemas aplicados corretamente por ambiente.
- `prepareDocumentEmail` prepara email, mas nao envia de fato sem provedor externo.
- Build frontend existe, mas algumas paginas sao HTML/JS sem framework unificado.
- Portao de acesso em `assets/site-access-gate.js` e protecao frontend, nao substitui autenticacao server-side.

## Experimental

- CADISTA dentro deste repositorio em `cadista/` e `cadista-login.html` e registrado como `prototype`.
- Projeto CADISTA principal deve ser tratado em `cadista_ia`.
- Stock Saude e modulo funcional controlado, mas exige cautela por dados sensiveis.
- ELO como hub comercial/transversal ainda nao deve ser vendido isoladamente como produto principal conforme `segment-router.js`.

## Pendente

- Billing real nao implementado nos modulos listados pelo registry.
- Checkout real com Stripe/Mercado Pago nao aparece implementado no estado atual.
- Compliance LGPD formal para modulos sensiveis ainda precisa documentacao/processo dedicado.
- Envio real de email/documentos depende de provedor.
- Hardening de autenticacao server-side para todas as superficies publicas ainda precisa ser revisado por ambiente.

## Riscos tecnicos

- Mistura de paginas estaticas, scripts globais e backend aumenta risco de regressao visual e de contratos informais.
- Fallback local JSON nao substitui persistencia transacional em producao.
- E2E real depende de variaveis e projeto Supabase isolado; uso acidental de producao e proibido.
- Arquivos gerados, logs e caches podem poluir auditorias se nao forem filtrados.
- Alguns textos existentes apresentam codificacao historica inconsistente.

## Divida tecnica

- Consolidar matriz de rotas e contratos em OpenAPI ou documento equivalente.
- Separar claramente frontend publico, app operacional e modulos experimentais.
- Formalizar migracoes por ambiente.
- Manter inventario de tabelas por schema.
- Padronizar tratamento de erros HTTP.

## Proximos passos recomendados

1. Congelar Stock Obras como modulo estavel ate nova auditoria.
2. Usar este pacote documental como base de onboarding tecnico.
3. Validar documentacao com uma rodada de leitura por modulo.
4. Gerar uma matriz de responsabilidades por ambiente antes de novo deploy.
5. Tratar CADISTA somente no repositorio `cadista_ia`.

## Nao alterar sem nova auditoria

- Stock Obras (`stock-ai-obras.html`, `stock-ai-obras-bridge.js` e docs `stock-ai-*`).
- Scripts E2E reais (`scripts/e2e/*`) sem revisar impacto em Supabase.
- Schemas SQL compartilhados.
- `auth-context.js` e fronteiras de tenant.
- ELO memory stores e bloqueios de dado sensivel.
