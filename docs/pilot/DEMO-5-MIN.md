# Roteiro comercial de 5 minutos

Ambiente recomendado: harness local do Pilot RC com `tests/fixtures/pilot/`. O comando automatizado é `npm.cmd run pilot-demo-smoke` dentro de `C:\elo-pilot-rc\backend`.

| Tempo | Comando/ação exata | Resultado esperado | O que explicar | Plano B |
|---|---|---|---|---|
| 0:00–0:30 | Entrar com a conta de demo e dizer `Abra a obra Residencial Horizonte` | Auth, usuário, tenant e obra resolvidos | ELO mantém um contexto único de trabalho | Usar o harness local; não usar fallback local silencioso |
| 0:30–1:15 | `Qual o saldo de cimento desta obra?` | Cimento CP-II: 42 sacos na fixture | Consulta conversacional do Stock | Mostrar a tela/fixture de Stock e explicar que é dado de demonstração |
| 1:15–2:00 | `Abra o RDO de hoje` e depois `Resuma o RDO` | RDO de 27/09/2026 com serviços, equipe e materiais | ELO encontra o diário no contexto da obra | Abrir o RDO fixture diretamente |
| 2:00–2:45 | Abrir a vistoria e marcar a vedação da cuba como conforme após revisão | Item atualizado e histórico preservado | A vistoria registra conformidade e pendência, sem apagar evidência | Mostrar a fixture de vistoria |
| 2:45–3:45 | Anexar `analysis.txt`; dizer `Analise este arquivo` | Anexo aceito, tenant preservado e conteúdo disponível | Arquivos entram no mesmo contexto da obra | Usar TXT/CSV/MD local; semanticamente, declarar quando o modelo externo não estiver disponível |
| 3:45–4:30 | `Faça um relatório disso` | Relatório criado a partir da análise anterior | A análise vira documento sem redigitação | Gerar o documento controlado local |
| 4:30–5:00 | `memorize: o responsável da obra demonstrativa é Carlos Demo`; depois `Quem é o responsável da obra demonstrativa?` | Memória explícita salva e recuperável | Memória permanente é separada do anexo/contexto temporário | Conferir no harness e repetir com novo processo |

## PDF

Após o RDO, abrir o artefato já validado `C:\elo-step05-proof\03-rdo-report.pdf`. Dizer claramente: “este PDF foi gerado e validado pelo fluxo real anterior”. Se o arquivo não estiver disponível, não improvisar uma geração: mostrar o registro do RDO e marcar PDF externo como pendente.

## Fechamento

Não prometer automação total, substituição de engenheiro, zero erros, integração ERP ou capacidades que dependem de serviço externo.
