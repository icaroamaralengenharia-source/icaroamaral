# Demo Prefeitura — ELO sobre instituição e unidade

Roteiro de até cinco minutos baseado nas capabilities municipais existentes. O módulo municipal não possui o conceito de obra/projeto; `institution_id` é a prefeitura e `unit_id` é a unidade ou almoxarifado.

| Etapa | Comando exato | Resultado esperado | O que explicar | Plano B |
|---|---|---|---|---|
| Login | `entrar` | Sessão autenticada e instituição resolvida | O backend continua sendo a fonte de autorização | Repetir login; não usar fallback local |
| Prefeitura | `abra prefeitura` | Contexto municipal aberto | O ELO separa Prefeitura de Obras | Abrir o painel municipal diretamente |
| Unidades | `mostre as unidades` | Lista apenas unidades da instituição atual | A lista é tenant-scoped | Conferir o painel da Prefeitura |
| Seleção | `abra a unidade Almoxarifado Central` | `currentMunicipalUnit` passa a ser a unidade escolhida | Unidade não é tratada como obra | Selecionar pelo código da unidade |
| Estoque | `qual o estoque desta unidade?` | Dashboard operacional da unidade selecionada | Leitura é direta; escrita continua protegida | Abrir a aba operacional |
| Documentos | `mostre os documentos desta unidade` | Acervo filtrado pela unidade, quando disponível | Documentos continuam no escopo municipal | Abrir Acervo e aplicar unidade |
| Troca | `abra a unidade Unidade Saude` | Contexto muda para B | Nenhum dado de A pode aparecer em B | Recarregar a lista e selecionar pelo código |

Não demonstrar “obras da Prefeitura”: esse vínculo não existe no modelo municipal atual. RDO, Vistoria e Stock de obra continuam no contexto separado `currentWork` do ObraReport.
