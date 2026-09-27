# Pilot RC — inventário demonstrável

Este inventário descreve somente o que já existe no Pilot RC. Ele não é promessa de produção.

| Capacidade | Estado no local/harness | Limite honesto |
|---|---|---|
| Login/auth | PASS no auth harness, com usuário e tenant resolvidos | Smoke autenticado de produção aguarda liberação do Netlify |
| Obras | Fixture local `Residencial Horizonte` com contexto de obra | Não cria obra live |
| Stock | PASS no Stock demo local com leitura de cimento, aço e bloco | Estado é fixture em memória |
| RDO | PASS para criar/listar/abrir RDO no serviço transacional local | Apps Script/Drive dependem de ambiente externo |
| PDF | Artefato real pré-validado em `C:\elo-step05-proof\03-rdo-report.pdf` | Não afirmar nova geração durante a demonstração local |
| Vistoria | PASS para criar, abrir, atualizar item e registrar não conformidade | Foto real depende da superfície disponível |
| Anexos | PASS para TXT/CSV/MD e ingestão autenticada; picker aceita PDF e imagem | Análise semântica depende do backend/modelo configurado |
| Análise de PDF | Rota/parser existente | Usar fixture e plano B se o modelo externo estiver indisponível |
| Análise de imagem | Picker e rota existentes | Não prometer classificação autônoma; revisão técnica continua necessária |
| CSV/TXT/MD | PASS no Step 07 e no smoke local | Conteúdo deve ser fictício no ensaio |
| Memória | PASS para salvar fato explícito e recuperar por usuário/tenant | Não salvar segredo ou dado pessoal |
| Report from analysis | PASS no smoke local, criando relatório a partir do texto de análise | Documento local controlado não substitui PDF externo |
| Registry | Implementado para o fluxo canônico de documentos | Requer Supabase/Drive/Apps Script no caminho externo |

## O que pode ser demonstrado hoje

O roteiro seguro é: autenticar no harness, abrir a obra fixture, consultar Stock, abrir RDO, abrir o artefato PDF já validado, executar uma vistoria, anexar fixture, salvar uma memória fictícia e gerar um relatório local a partir da análise.

## O que permanece fora deste ensaio

Produção Netlify, banco live, migration live, novo deployment Apps Script, criação de tenant real e qualquer dado pessoal.
