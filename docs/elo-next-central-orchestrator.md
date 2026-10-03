# ELO NEXT — núcleo central de inteligência

## Estado da implementação

Esta etapa estabelece a camada de coordenação do ELO sem tocar no Stock Full e sem remover os motores legados. O objetivo é permitir uma migração observável e reversível: o novo núcleo já é primário para o primeiro cluster aprovado, enquanto os demais caminhos continuam atrás de adaptadores e fallback mensurável.

Versão do núcleo: `20261003-vnext-1`

Arquivos principais:

- `relatorio-qualidade-obras/elo-central-orchestrator.js`
- `relatorio-qualidade-obras/elo-central-orchestrator.test.cjs`
- `elo.html`
- `relatorio-qualidade-obras/elo-assistente.js`

## Antes

O navegador carregava diversos motores especializados e um `elo-assistente.js` monolítico que acumulava:

1. limpeza e classificação da mensagem;
2. fast paths de data, matemática, memória, música e mídia;
3. roteamento técnico, orçamento, RDO, relatório e estoque;
4. contexto de obra e documento;
5. persistência local/remota;
6. fallback online/offline;
7. renderização da resposta e ações de interface.

`elo-brain-router.js` e `elo-conversation-conductor.js` já forneciam decisões úteis, mas sem um contrato único de estado, ferramenta, verificação e observabilidade para todos os motores.

## Depois

`EloCentralOrchestrator` introduz um contrato comum:

```text
mensagem
  -> estado de conversa seguro
  -> candidatos de intenção + confiança
  -> resolução de entidades/referentes
  -> seleção de ferramenta registrada
  -> execução isolada ou adaptação legada
  -> verificador de saída
  -> atualização de contexto/memória/trace
```

O núcleo mantém:

- `conversationId`, turno e superfície (`web`, `android` ou outra);
- assunto ativo, entidades e ação pendente;
- documento ativo e obra/projeto ativo;
- memória de trabalho, memória explícita e itens recuperados;
- última intenção, rota, resposta e até 50 turnos resumidos;
- pilha de assuntos para retorno seguro a temas anteriores;
- índice local de documentos em chunks com recuperação por relevância e persistência entre instâncias;
- trace sanitizado, limitado a 80 eventos, sem senha, token, cookie, API key ou service role.

## Registro de ferramentas

As ferramentas são registradas por `id`, descrição, capacidades, prioridade, predicado de seleção e executor. O núcleo atual registra:

| Ferramenta | Capacidades | Situação |
| --- | --- | --- |
| `fast.math` | matemática determinística/offline | habilitada no núcleo |
| `fast.date-time` | data/hora pelo relógio do runtime | habilitada no núcleo |
| `memory.explicit` | memória explícita e recall | habilitada no núcleo |
| `context.follow-up` | follow-up e resolução de referentes | habilitada no núcleo |
| `context.document` | documento ativo e texto longo | habilitada no núcleo |
| `domain.engineering` | adaptação para motor técnico legado | adaptador primário Web |
| `domain.report-context` | relatório limitado a evidência anterior | adaptador primário Web |
| `domain.work-context` | obra/projeto ativo | adaptador primário Web |
| `domain.budget` | orçamento/SINAPI/ORSE/quantitativos | adaptador primário Web |
| `domain.writing` | escrita e reformulação | adaptador primário Web |
| `domain.media` | player e mídia visual explícita | adaptador primário Web |
| `conversation.general` | conversa segura/fallback | habilitada no núcleo |

No navegador, os adaptadores `primary.*` envolvem os motores existentes sob o contrato central. Isso promove o roteamento e a verificação sem duplicar a implementação legada. Stock Full não é registrado no núcleo e continua somente como contrato/API externo.

Nenhuma ferramenta Stock Full é registrada pelo núcleo. Stock Full permanece uma frente paralela, com suas próprias rotas e testes.

## Contratos de segurança e qualidade

- A memória só é escrita por comando explícito no núcleo.
- O contexto de documento/obra é retido quando uma operação determinística é planejada.
- Erros de ferramenta viram resposta segura e deixam trace, sem stack trace para o usuário.
- O verificador redige saídas com formato de segredo e marca claims sem evidência.
- O estado persistido passa por clone limitado e filtragem de chaves sensíveis.
- A versão atual é carregada como script clássico, portanto é compatível com a WebView que usa os mesmos assets Web.
- A integração com `elo-assistente.js` é primária para matemática/data, memória explícita, documento ativo, engenharia, relatório por contexto, obra ativa, orçamento, escrita e ferramentas explícitas; anexos novos, mídia, RDO e Stock Full permanecem nos contratos legados.
- A chave atual é `window.ELO_ORCHESTRATOR_VNEXT = { enabled: true, shadow: true, mode: "primary" }`. O shadow continua gerando plano e comparação; qualquer adaptador não tratado volta ao fluxo legado e registra o motivo.
- `compareShadow()` e `promotionGate()` expõem aderência de intenção, rota, falhas e fallback antes de ampliar a promoção.

## Inventário de motores legados

| Família | Módulos observados | Próximo adaptador |
| --- | --- | --- |
| Conversa/conduta | `elo-conversation-conductor.js`, `elo-communication-policy.js` | ferramenta de conversa e política de tom |
| Roteamento cerebral | `elo-brain-router.js`, `elo-assistente.js` | `legacy.conversation`/`legacy.engineering` |
| Obra/documentos | memória de obra, documentos ativos, relatórios e RDO | `context.document`, `work.current`, `document.report` |
| Orçamento | engines residencial, composição, EAP e PDF | adaptador com contrato de evidência |
| Stock | `stock-full-*`, bridges e rotas de estoque | fora do escopo desta migração; não tocar |
| Offline | `elo-offline-core-v2.js`, router e memória offline | adaptador offline compartilhado |
| Android | engines Kotlin de data, matemática, engenharia e mídia | implementar o mesmo contrato de intents/estado em etapa Android |

## Plano de migração

1. Shadow planning e observabilidade — concluído.
2. Fast paths determinísticos — primário no Web; contrato Android segue em validação.
3. Documento longo e follow-up — índice/retrieval primário, validado com canaries, 150 páginas e reload.
4. Memória explícita e restauração — primário no Web; validação por identidade continua aberta.
5. Adaptadores de conversa/engenharia — primeiro cluster primário; anexos e ações seguem por família.
6. Ações de obra/documento — exigir intenção, contexto e confirmação apropriados.
7. Ativação gradual por feature flag; rollback para shadow-only se houver regressão.
8. Paridade Android — transportar o contrato sem misturar estado entre tenants/superfícies.

## Gate desta etapa

O gate focal passa com 20 testes: registro sem Stock Full, 50 variantes documentais, fast paths, memória, documento longo de 150 páginas com recuperação tardia e reload, classificação de report/work/budget/writing/media/conversation, comparação shadow, canary determinístico e promoção reversível.

Isto ainda não é certificação final do produto. Permanecem abertos os gates de 1000+ interações, conversa longa de 50/200 turnos, torture de arquivos/memória, anexos/mídia/RDO, paridade Android, produção Web e as falhas já registradas no ledger de certificação.
