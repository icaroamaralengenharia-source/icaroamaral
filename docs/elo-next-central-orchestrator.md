# ELO NEXT — núcleo central de inteligência

## Estado da implementação

Esta etapa estabelece a camada de coordenação do ELO sem tocar no Stock Full e sem remover os motores legados. O objetivo é permitir uma migração observável e reversível: o novo núcleo já planeja cada turno em modo shadow, enquanto o fluxo atual continua responsável pela resposta visível até que cada família de ferramentas tenha seu gate próprio.

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
| `domain.engineering` | adaptação para motor técnico legado | shadow/delegação |
| `conversation.general` | conversa segura/fallback | habilitada no núcleo |

Nenhuma ferramenta Stock Full é registrada pelo núcleo. Stock Full permanece uma frente paralela, com suas próprias rotas e testes.

## Contratos de segurança e qualidade

- A memória só é escrita por comando explícito no núcleo.
- O contexto de documento/obra é retido quando uma operação determinística é planejada.
- Erros de ferramenta viram resposta segura e deixam trace, sem stack trace para o usuário.
- O verificador redige saídas com formato de segredo e marca claims sem evidência.
- O estado persistido passa por clone limitado e filtragem de chaves sensíveis.
- A versão atual é carregada como script clássico, portanto é compatível com a WebView que usa os mesmos assets Web.
- A integração com `elo-assistente.js` é shadow-only nesta fase: cada envio gera um plano central sanitizado; a resposta continua no fluxo existente até os gates de migração.
- A chave `window.ELO_ORCHESTRATOR_VNEXT` deixa `enabled: false` e `shadow: true` no primeiro rollout; isso permite medir planos sem dar autoridade de resposta ao núcleo novo.

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

1. Shadow planning e observabilidade — concluído nesta etapa.
2. Fast paths determinísticos — executar pelo núcleo após gate Web/Android.
3. Documento longo e follow-up — validar com canaries, 30/80/150 páginas e reload.
4. Memória explícita e restauração — validar por identidade, sessão e limpeza.
5. Adaptadores de conversa/engenharia — migrar por família, com fallback legado.
6. Ações de obra/documento — exigir intenção, contexto e confirmação apropriados.
7. Ativação gradual por feature flag; rollback para shadow-only se houver regressão.
8. Paridade Android — transportar o contrato sem misturar estado entre tenants/superfícies.

## Gate desta etapa

Os seis testes do núcleo passam: registro sem Stock Full, follow-up com documento/obra, retenção de documento através de fast path, precedência de memória explícita, falha segura de ferramenta e redaction do verificador.

Isto é uma fundação arquitetural, não uma certificação final do produto. Permanecem abertos os gates de 1000+ interações, conversa longa de 50/200 turnos, torture de arquivos/memória, migração dos motores legados, paridade Android, produção Web e as falhas já registradas no ledger de certificação.
