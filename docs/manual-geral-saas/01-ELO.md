# Manual ELO

Status: producao assistida.
Classificacao: COMPROVADA_COM_RESSALVA.
Rota principal: /elo.html.

## Para que serve

O ELO e o assistente tecnico-operacional do ecossistema. Ele ajuda em conversas de engenharia, triagem de patologias, fiscalizacao, RDO, orcamentos, documentos, PDFs, imagens e consultas atuais quando o backend de busca esta disponivel.

## Estado apos stress final

- /elo.html estavel no stress final.
- 7/7 cenarios ELO UI PASS.
- 29/29 testes formais PASS.
- Continuidade de orcamento validada, incluindo contexto de 56 m2.
- Botao Pesquise validado, preservando a pergunta original.
- Historico mobile validado em viewport 390x844.
- Fluxo longo ELO/Stock passou sem timeout.
- 0 falhas funcionais novas e 0 regressoes novas relacionadas ao ELO na rodada final.

## Acesso e uso basico

1. Abrir /elo.html com sessao valida.
2. Digitar a pergunta no campo do ELO.
3. Conferir se a resposta traz pedido de dados adicionais, fonte, ressalva ou encaminhamento para ferramenta.
4. Em celular, usar o historico mobile para revisar mensagens anteriores.
5. Em modo read-only, consultar historico e respostas sem executar acoes de escrita.

## Capacidades comprovadas

- Conversa contextual e tecnica.
- Triagem de fissura, trinca, rachadura, infiltracao, destacamento e manifestacoes patologicas.
- Fiscalizacao tecnica, notificacao prudente e nao conformidade.
- CBUQ/pavimento e cenario ancora preservado.
- Orcamento e quantitativos quando ha premissas suficientes.
- Leitura/uso de documento anexado quando o conteudo esta disponivel.
- Gatilho de PDF quando o fluxo validado permite.
- Botao Pesquise para busca atual.
- Roteamento protegido contra conflitos CADISTA, orcamento, composicao, RDO e patologia.

## Como pedir melhor

Para patologia: informe local, tipo de manifestacao, dimensoes, evolucao, umidade, fotos e risco aparente.

Para orcamento: informe servico, area/quantidade, unidade, localidade, padrao, BDI quando houver e fonte de preco.

Para documento/RDO: informe data, obra, atividade, ocorrencia, equipe, equipamento, material, fotos e objetivo do registro.

## Ressalvas mantidas

- RDO -> analise tecnica composta automatica ainda e MELHORIA FUTURA quando nao houver pedido tecnico explicito.
- O ELO nao substitui responsavel tecnico.
- Normas, leis, precos e prazos dependem de fonte disponivel; se a fonte nao existir, a resposta deve declarar a ausencia.
- Integracoes dependem de backend, sessao, permissao e ambiente.
- Producao madura ainda exige monitoramento, metricas reais e suporte operacional.
