# Manual mestre do ecossistema ativo

Data: 2026-08-09
Base validada: origin/main befba7b73bc04129a8b7a2950cf09984c07fa65f
Escopo: ELO, Stock Full, Stock Obras, Patrimonio/Inventario, ObraReport/RDO, Sentinela, Hunter, Noticias, Seguranca/Perfis, PDFs/Exportacoes e Integracoes.

CADISTA: FORA_DE_ESCOPO. O modulo esta congelado temporariamente e nao foi documentado como sistema operacional ativo neste pacote.

## Como usar este pacote

Use este manual mestre para operacao, treinamento, suporte inicial e decisao de piloto. Para procedimento detalhado, abra o manual especifico do sistema. O ecossistema esta pronto para piloto assistido, nao para ser tratado como producao madura sem suporte, monitoramento e ambiente real prolongado.

## Estado consolidado

| Sistema | Estado de produto | Classificacao | Uso recomendado |
|---|---:|---:|---|
| ELO | Producao assistida | COMPROVADA_COM_RESSALVA | Assistente tecnico e operacional com supervisao profissional. |
| Stock Full | Producao assistida | COMPROVADA | Controle de estoque, almoxarifado, auditoria e PDFs gerenciais. |
| Stock Obras | Producao assistida | COMPROVADA_COM_RESSALVA | Apoio a composicoes, insumos e bases oficiais importadas. |
| Patrimonio/Inventario | Producao assistida | COMPROVADA_COM_RESSALVA | Painel municipal para bens, acervo, historico e offline controlado. |
| ObraReport/RDO | Piloto assistido | COMPROVADA_COM_RESSALVA | RDO, relatorios de obra, fotos, PDF e ponte com ELO. |
| Sentinela | Piloto assistido | COMPROVADA_COM_RESSALVA | Evidencias, pendencias, alertas e validacao humana. |
| Hunter | MVP | PARCIAL | Consulta interna de oportunidades/licitacoes; nao vender como servico autonomo. |
| Noticias | Producao assistida | COMPROVADA_COM_RESSALVA | Noticias, oportunidades e licitacoes com fontes externas e commits automaticos. |
| Seguranca/Perfis | Base operacional | COMPROVADA_COM_RESSALVA | Controle por sessao, perfil, escopo e leitura/escrita. |
| PDFs/Exportacoes | Producao assistida | COMPROVADA_COM_RESSALVA | PDFs e exportacoes validados com ressalvas visuais/ambiente. |

## Evidencias finais

O stress geral foi reexecutado apos os fixes finais do ELO UI e confirmou 0 falhas funcionais e 0 regressoes novas.

Resultado final:

- 270 cenarios ativos.
- 249 PASS.
- 15 PASS_COM_RESSALVA.
- 0 FALHA_FUNCIONAL.
- 0 FALHA_INFRA.
- 5 NAO_CONECTADO.
- 1 INCONCLUSIVO.
- 535 testes automatizados PASS.
- 0 testes automatizados FAIL.
- 1 SKIP.
- 8/8 PDFs validos.
- ELO UI: 7/7 PASS.
- ELO testes formais: 29/29 PASS.
- ELO/Stock fluxo longo: PASS.

Comparacao oficial:

- Antes: 241 PASS, 15 PASS_COM_RESSALVA, 8 FALHA_FUNCIONAL.
- Depois: 249 PASS, 15 PASS_COM_RESSALVA, 0 FALHA_FUNCIONAL.
- Delta: +8 PASS, -8 falhas funcionais, 0 regressoes novas.

## Fluxo recomendado de operacao

1. Entrar pelo gate de acesso e confirmar o perfil ativo.
2. Escolher o modulo pelo mapa de rotas.
3. Operar com dados reais apenas quando houver ambiente configurado e permissao adequada.
4. Gerar PDF/exportacao somente depois de revisar filtros, obra, empresa e periodo.
5. Usar ELO como apoio tecnico, nao como substituto de engenheiro, fiscal ou gestor responsavel.
6. Registrar ressalvas e evidencias quando houver decisao operacional relevante.

## O que nao prometer

Nao prometer CADISTA ativo, decisao autonoma sem validacao humana, normas/precos sempre atualizados, Hunter como produto maduro, seguranca sem vulnerabilidades npm, integracao externa garantida sem chaves/ambiente, nem QA visual integral de todos os PDFs. Essas alegacoes seguem removidas dos manuais como comportamento normal.
