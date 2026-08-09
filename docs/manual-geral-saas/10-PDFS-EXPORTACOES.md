# Manual PDFs e Exportacoes

Status: producao assistida com ressalvas.
Classificacao: COMPROVADA_COM_RESSALVA.

## PDFs validados

1. Stock Full PDF gerencial.
2. Stock Full PDF de auditoria.
3. ELO PDF de orcamento.
4. ObraReport/RDO PDF com ressalva de documento controlado.
5. Ponte foto -> PDF.
6. Guards contra NaN e vazamento interno.
7. PDFs extensos do Stock Full sem contador interno exposto.
8. Stock Full mobile PDF com filtros reais.

## Como gerar com seguranca

1. Conferir filtros, empresa, obra, periodo e unidade.
2. Gerar pre-visualizacao quando houver.
3. Conferir conteudo antes de enviar ao cliente.
4. Salvar o arquivo gerado com nome rastreavel.

## Exportacoes

Stock Full possui evidencias de backup/exportacao em stress. Integracoes e APIs podem exportar listas conforme endpoints, mas cada exportacao deve ser tratada por modulo e perfil.

## Ressalvas

Nem todo PDF foi submetido a QA visual integral. Validacao binaria e renderizacao nao substituem conferencia humana de layout, assinatura, rodape, paginas e anexos.
