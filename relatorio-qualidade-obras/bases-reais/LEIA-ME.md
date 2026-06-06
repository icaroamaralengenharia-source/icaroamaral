# Bases reais pequenas SINAPI/ORSE

Use esta pasta para guardar arquivos JSON pequenos, com 1 a 5 composicoes reais, antes de importar no Stock AI Obras pela interface.

## Onde colocar

Coloque aqui somente arquivos JSON revisados, por exemplo:

- `sinapi-ba-2026-05-alvenaria.json`
- `orse-se-2026-05-alvenaria.json`

O arquivo `sinapi-orse-real-sample.template.json` e apenas um template. Ele nao e base real e nao deve ser usado para calculo executivo.

## Formato esperado

Cada composicao deve seguir o formato aceito pelo motor:

- `source`: `SINAPI` ou `ORSE`
- `sourceRegion`: UF/regiao da fonte oficial
- `sourceDate`: referencia oficial no formato `YYYY-MM`
- `code`: codigo oficial da composicao
- `description`: descricao oficial
- `unit`: unidade da composicao
- `serviceType`: tipo tecnico usado pelo Stock AI, por exemplo `alvenaria`
- `inputs`: insumos oficiais com codigo, nome, unidade e coeficiente
- `metadata.manualReviewRequired`: `true`

## Regra de coeficientes

Os coeficientes devem vir de fonte oficial SINAPI/ORSE ou de documento tecnico auditavel. Nao digite valores "de cabeca", nao estime coeficientes e nao copie dados sem referencia.

Se ainda nao houver arquivo oficial, deixe apenas o template. O Stock AI Obras deve continuar usando a base demonstrativa/editavel.

## Fluxo recomendado

1. Obtenha uma composicao oficial pequena SINAPI/ORSE.
2. Copie somente 1 composicao para JSON.
3. Revise `source`, `sourceRegion`, `sourceDate`, `code`, `description`, `unit`, `serviceType` e `inputs`.
4. Confirme que todos os `coefficient` sao oficiais e maiores que zero.
5. Marque `metadata.manualReviewRequired` como `true`.
6. Importe o JSON em `stock-ai-obras.html`.
7. Pergunte: `Tenho uma parede de 12 m por 3 m`.
8. Verifique se a resposta mostra `Fonte: SINAPI` ou `Fonte: ORSE`.
9. Limpe a base importada para voltar ao fallback demonstrativo.
