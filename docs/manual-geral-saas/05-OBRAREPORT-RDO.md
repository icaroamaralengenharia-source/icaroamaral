# Manual ObraReport e RDO

Status: piloto assistido.
Classificacao: COMPROVADA_COM_RESSALVA.
Rota principal: /relatorio-qualidade-obras/relatorio-qualidade-obras.html.

## Para que serve

ObraReport registra relatorios de obra, RDO, fotos, campos tecnicos, ocorrencias, materiais, equipes, produtividade e PDF. Ele tambem recebe ponte do ELO quando uma imagem ou solicitacao pede relatorio/PDF.

## Fluxo RDO

1. Informar obra, data, clima e frente de servico.
2. Registrar atividades executadas, equipe, equipamentos e materiais.
3. Registrar ocorrencias e evidencias fotograficas.
4. Revisar campos antes de gerar PDF.
5. Se houver material solicitado pelo RDO, tratar aprovacao/entrega sem duplicar movimentos.

## Comprovado

- Ponte imagem -> ObraReport -> PDF em testes.
- RDO/materialRequests sem duplicacao indevida.
- PDF local de conferencia gerado em E2E.
- Integracao ELO <-> RDO documentada como PASS na auditoria geral.

## Ressalvas

Nem todo PDF teve QA visual completo. O fluxo RDO -> analise tecnica automatica no ELO ainda e parcial quando nao ha pedido tecnico claro.
