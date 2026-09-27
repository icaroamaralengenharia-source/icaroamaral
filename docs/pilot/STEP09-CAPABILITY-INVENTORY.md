# Step 09 — inventário de capabilities

| Capability municipal real | Existe | ELO controla | Bridge usada |
|---|---:|---:|---|
| Instituição / Prefeitura | Sim | Sim | `municipal.context` |
| Listar unidades | Sim | Sim | `units.list` |
| Selecionar unidade | Sim | Sim | `unit.select` |
| Contexto municipal | Sim | Sim | `currentInstitution` + `currentMunicipalUnit` |
| Trocar unidade | Sim | Sim | `unit.select` |
| Estoque operacional da unidade | Sim | Sim | `unit.stock` → dashboard operacional |
| Movimentações | Sim | Sim | dashboard/serviço operacional existente |
| Documentos / Acervo | Sim | Sim | `archive.documents.list` |
| Relatórios municipais | Sim | Sim | `reports.preview` / `reports.archive` |
| Patrimônio | Sim | Sim | `assets.list` e adapter existente |
| Notificações / Sentinela | Sim | Sim | adapters municipais existentes |
| Prefeitura → Obra / `project_id` | Não | Não | Não implementado por contrato |

O contexto de obra permanece separado no ELO/ObraReport (`currentWork`, RDO, Vistoria, documentos e Stock de obra). Unidade municipal nunca é convertida em obra.
