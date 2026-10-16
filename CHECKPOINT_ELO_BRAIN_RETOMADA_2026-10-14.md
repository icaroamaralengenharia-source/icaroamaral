# ELO Premium / Brain — execução — 2026-10-14

**REVISÃO ATUAL — CHECKPOINT 18, 15/10/2026: auditoria final e candidata oficial em andamento.** Retomada explicitamente autorizada. Branch limpa `fix/elo-brain-final-context-listening-music-ux`, baseada em `origin/main` 50452bc. Leia o Checkpoint 18 ao final. Música audível seguida de timeout/pausa e falha de pronome com histórico enviado foram reproduzidas. APK v10 instalado com dados preservados; música e expiração reprovaram a rodada. Fonte v11 preparado, sem nova instalação. Certificação física final pendente. Sem PR, merge ou deploy. O aviso de interrupção do Checkpoint 8 foi sucedido pelas retomadas e pelos Checkpoints 9–16.

## Workspace e preservação

`C:\Users\Wia Engenharia\Documents\ChatGPT\SaaS Inspeção Técnica\ELO-premium-release-20261014`

Branch `codex/elo-premium-release-20261014`; HEAD `edee4b9b4505cfd98afca405ad3db53feb6ae5ab`. Alterações e artefatos anteriores preservados; detalhes no checkpoint inicial desta execução. Desenvolvimento anterior permanece intacto em `ELO-cert-49c840-local`.

## Etapa UX — patch local

Falha reproduzida no controlador anterior: `visualViewport.height` era acompanhado, mas `offsetTop` e o evento `visualViewport.scroll` eram ignorados. No teste de pan do IME, viewport visível começava em 96 px e o cabeçalho permanecia em 4 px. Restaurações de scroll de cada resize também não distinguiam troca de conversa ou interação posterior do leitor. Esta é uma causa comprovada localmente; não substitui a reprodução física da intermitência relatada.

Correção local em `relatorio-qualidade-obras/elo-viewport.js`, `elo.css` e `relatorio-qualidade-obras/elo-media-player.js`: frame móvel limitado à viewport visível, deslocamento acompanhado, eventos agrupados por frame, restauração descartada para outra conversa/interação e player reposicionado após a geometria final do composer. Login e rota de orçamento excluídos do frame autenticado.

Teste novo em `tests/e2e/elo-new-chat-attachment-context-p0.spec.js`: quatro ciclos de teclado/pan, rascunho, resposta durante leitura, fechamento do teclado, replay e Nova conversa pelo menu móvel. Baseline FAIL (cabeçalho 4 < 96); patch PASS LOCAL (1 teste, 9,8 s). Primeiro rerun alcançou os quatro ciclos e falhou no harness ao tentar usar o botão desktop oculto; o teste passou após usar o menu móvel real.

Evidências novas, sem sobrescrever as antigas: `tmp/elo-brain-20261014/ux-baseline-static/` e `tmp/elo-brain-20261014/ux-fixed-cycles/`. O servidor de testes é estático e escuta somente em `127.0.0.1:5547`.

## Gate físico e release

- ANDROID_PHYSICAL_TEST = BLOCKED: `adb devices -l` retornou lista vazia. Nenhum aplicativo ou dado do telefone foi acessado.
- UX_ANDROID_P0 = FAIL — gate físico pendente, conforme a regra de só aprovar no Samsung.
- COMPOSER_AND_MIC / SCROLL = PASS LOCAL nos ciclos geométricos; captura acústica não certificada.
- PR #223 = status remoto atual não confirmado: CLI e leitura pública sem acesso. Draft no checkpoint anterior.
- DEPLOY = NOT_RUN; sem merge, push ou instalação.

## Próxima etapa independente

Com o patch local coberto e o gate físico bloqueado por desconexão, implementar a fundação de voz em foreground integrada ao fluxo oficial, com ativação explícita, estados observáveis, cancelamento, proteção contra eco e encerramento. Preservar integralmente a identidade e o contrato de síntese TTS do PR #208. Registrar separadamente testes de adaptadores simulados e áudio real.

## Fundação de voz implementada e validada localmente

`relatorio-qualidade-obras/elo-voice-session.js` implementa ativação explícita, estados observáveis, captura via adaptador, finalização de turno, pausa, reconexão limitada, interrupção por botão, cancelamento por geração/AbortController e encerramento. O adaptador em `elo-assistente.js` chama o `askElo` oficial e o TTS existente, usando a mesma autenticação, conversa, histórico, memória e ferramentas. Não foi criado outro chatbot nem armazenamento de áudio.

Captura não permanece ativa durante processamento/TTS. Ocultar a página pausa e libera captura; pagehide, troca de conversa e mudança de usuário/instituição/empresa encerram a sessão. Digitar pausa a captura e preserva o rascunho; retomada recusa sobrescrever um rascunho pendente. Música e leitura manual têm proteção contra captura simultânea. Interrupção por fala simultânea não foi implementada; o botão está disponível. Limites e fronteira do adaptador nativo estão documentados em `docs/elo-brain-foreground-voice.md`.

O conflito comprovado da persona foi corrigido nos dois caminhos de `getEloPersonalityPrompt_`: conversa cotidiana proporcional em frases, aprofundamento quando solicitado e despedida sem novo conselho/tarefa/pergunta. Precisão técnica e regra de não inventar consumo permanecem. Não houve nova certificação semântica com provedor real; CONVERSATION_V3 continua PARTIAL.

Seis funções TTS conservam os hashes registrados antes desta execução: endpoint, instruções, requisição neural, reprodução neural, fallback e `speakEloText_`. O harness binário passou a extrair a função real de instruções, sem alterar o motor de síntese. Os sete arquivos de áudio essenciais ausentes na candidata foram copiados somente quando faltavam, do workspace de desenvolvimento preservado, com comparação SHA256; são 39.903.663 bytes, sem download ou alteração de catálogo. Manifesto em `tmp/elo-brain-20261014/restored-offline-assets.json`.

### Resultados intermediários preservados

- 83 testes únicos de unidade/contrato PASS LOCAL; o rerun final de contexto/voz passou 30/30. Não somar reruns.
- Nove E2E focados PASS LOCAL, incluindo dois turnos no núcleo oficial, cancelamento de resposta, novo chat, mudança de usuário/tenant, memória acima de 48, isolamento e reset do PDF/anexos. STT e áudio são doubles; não houve captura acústica nem requisição real ao provedor.
- A regressão detectou uma restauração de viewport sobrescrevendo o replay do histórico (720 → 0). O controlador agora restaura somente quando a geometria muda e não sobrescreve scroll posterior; reteste PASS.
- A revisão visual detectou o botão de retorno ao fim na borda do composer. O patch adicional atualiza seus limites após pan, resize e alteração do composer, e reserva esse espaço ao limitar o player. Reteste final desses controles em andamento no momento desta atualização.
- Cache/URLs da candidata sincronizados em `20261014-elo-brain-v1`, worker `elo-web-offline-v38-20261014-elo-brain-v1` e novo módulo de voz precacheado.

Falhas intermediárias não foram apagadas: Vite ausente/dep-scan restrito foi substituído por servidor estático local de teste; o teste móvel passou após usar o menu real em vez do botão desktop oculto; os primeiros textos de voz acionavam o fast path de capacidades de memória, então o fixture passou a usar uma pergunta científica genérica para demonstrar o caminho online. As falhas antigas de TTS vieram do helper ausente no harness e o pacote offline falhava por arquivos não materializados; ambos foram corrigidos e retestados.

### Android e release

Segunda consulta ADB também retornou lista vazia. Nenhum APK, aplicativo, dado, sessão ou configuração do telefone foi alterado. A fonte Android disponível tem wake/TTS/player, mas não há API delimitada de captura foreground no bridge consultado; a disponibilidade do reconhecedor Web no binário instalado permanece desconhecida. Contrato mínimo de adaptador nativo preparado no documento, sem implementação/ativação no APK.

PR #223: última evidência histórica draft; situação atual não confirmável pela CLI nem leitura pública neste ambiente. Nenhum commit, push, atualização de PR, merge ou deploy foi feito nesta execução. HEAD permanece o informado acima.

## Fechamento desta execução

O reteste final dos controles passou: 5/5 E2E de voz/identidade/viewport/replay após o patch geométrico; player 19/19. A aceitação completa foi 9/9 E2E. A suíte final V2 passou 84/84 testes únicos de unidade/contrato, incluindo a nova regressão de persistência temporária. Reruns não aumentam a contagem de testes únicos. `git diff --check` e verificações de sintaxe passaram. Seis hashes TTS continuam iguais.

A revisão final encontrou que o descarte de callbacks obsoletos também podia impedir a liberação de `suppressRemotePersistence` em três caminhos locais do ELO. Esses caminhos agora usam escopos com liberação idempotente em conclusão, falha e abort. A regressão executa a função real com operações sobrepostas e verifica que um término antigo não altera a operação nova, que uma resposta local concluída restaura a flag e que o estado externo anterior é preservado. Não foram alterados serviços, dados ou contratos do Stock.

O botão de retorno ao fim agora é reposicionado após viewport e tamanho do composer; o player também reserva esse controle, com verificação geométrica de ausência de sobreposição no teste. Atualizações de estado de voz notificam o controlador de layout para manter os limites após mudanças do texto de status.

### Resultado obrigatório

| Campo | Resultado |
|---|---|
| WORKSPACE_RECOVERED | `C:\Users\Wia Engenharia\Documents\ChatGPT\SaaS Inspeção Técnica\ELO-premium-release-20261014` |
| ACTIVE_BRANCH | `codex/elo-premium-release-20261014` |
| ACTIVE_HEAD | `edee4b9b4505cfd98afca405ad3db53feb6ae5ab` |
| PREVIOUS_CHANGES_PRESERVED | YES |
| UX_ROOT_CAUSE | CONFIRMED LOCAL: pan ignorado, restauração antiga sobre o replay e controles flutuantes com geometria desatualizada do composer |
| UX_FIX | IMPLEMENTED / PASS LOCAL |
| UX_ANDROID_P0 | FAIL — aprovação física pendente conforme a instrução do usuário; o patch novo não foi observado no Samsung |
| ANDROID_PHYSICAL_TEST | BLOCKED — duas consultas ADB sem dispositivos |
| COMPOSER_AND_MIC | PASS LOCAL geométrico; reconhecimento e indicador físico do microfone não certificados |
| SCROLL_STATUS | PASS LOCAL: ciclos de teclado/pan, resposta durante leitura, replay e troca de conversa |
| CONTEXT_MEMORY | PASS LOCAL: janela >48, contexto arquivado e isolamento entre conversas/identidades |
| CONVERSATION_V3 | PARTIAL: conflito da persona corrigido; novo reteste com provedor real não executado |
| MUSIC_PLAYER | PASS LOCAL; reprodução acústica/cold-load no aparelho permanece pendente |
| ELO_BRAIN_IMPLEMENTATION | IMPLEMENTED: coordenador de sessão e adaptador para o núcleo oficial, sem segundo histórico/chatbot |
| VOICE_SESSION_STATE_MACHINE | IMPLEMENTED / PASS LOCAL |
| CONTINUOUS_VOICE_STATUS | IMPLEMENTED / PASS LOCAL com doubles de STT/TTS; áudio real Web/Android não certificado |
| CONTINUOUS_VOICE_ANDROID | BLOCKED: capacidade runtime e teste físico pendentes; adaptador nativo não implementado |
| VOICE_INTERRUPTION | IMPLEMENTED por botão; interrupção por fala simultânea NOT IMPLEMENTED |
| VOICE_SESSION_PRIVACY | PASS LOCAL de ciclo de vida e escopo; verificação do indicador físico pendente |
| TTS_FREEZE | PASS: seis funções iguais e contratos de síntese/reprodução aprovados |
| ANDROID_DATA_PRESERVED | YES — nenhum telefone foi acessado além da lista ADB vazia |
| REGRESSION_TESTS | 84/84 unidade/contrato na V2; 9/9 E2E únicos; reruns geométricos/voz 5/5 |
| PR_223_STATUS | BLOCKED / NOT VERIFIED CURRENT; draft no checkpoint anterior |
| DEPLOY_STATUS | NOT RUN THIS EXECUTION |
| COMMIT_STATUS | Sem novo commit; alterações locais preservadas |
| FINAL_GATE | BLOCKED_PHYSICAL_AND_REAL_VOICE |

### Arquivos desta execução

- Layout: `elo.css`, `relatorio-qualidade-obras/elo-viewport.js`, trechos do composer em `elo-assistente.js` e limites/eventos de `elo-media-player.js`.
- Voz: `relatorio-qualidade-obras/elo-voice-session.js`, adaptador/escopos/cancelamento/eventos em `elo-assistente.js`.
- Conversação: somente regras da persona em `backend/src/app.js` e cobertura em `backend/tests/elo-conversational-behavior.test.js`.
- Entrada/cache: `elo.html`, `elo-sw.js`, teste `tests/elo-tts-cache-version.test.js`.
- Testes: novo `backend/tests/elo-voice-session.test.js`, novos casos no E2E existente e correção do harness `tests/elo-tts-binary-contract.test.js`.
- Documentação: `docs/elo-brain-foreground-voice.md`, este checkpoint e o checkpoint inicial.
- Áudios oficiais ausentes: sete cópias locais com hashes iguais; nenhuma alteração de catálogo. Demais modificações anteriores do working tree foram preservadas.

### Evidências finais e preservação

- `tmp/elo-brain-20261014/final-result-v2.json`: matriz atual de gates e referências dos testes.
- `tmp/elo-brain-20261014/source-manifest-v2.json`: caminhos, tamanhos e SHA256 atuais.
- `tmp/elo-brain-20261014/final-local-tests-v2.log`: 84/84; o log anterior 83/83 permanece preservado.
- `tmp/elo-brain-20261014/final-context-voice-tests.log`: 30/30 após os ajustes finais.
- `tmp/elo-brain-20261014/final-player-tests.log`: 19/19 após a reserva dos controles.
- `tmp/elo-brain-20261014/final-scope-acceptance-e2e.json`: 9/9 E2E.
- `tmp/elo-brain-20261014/final-controls-voice-e2e.json`: 5/5 após o último ajuste geométrico.
- `tmp/elo-brain-20261014/final-controls-voice-e2e/elo-new-chat-attachment-co-49734-leitura-ou-cobrir-controles/ime-during-keyboard.png`: viewport de teclado simulada, com player montado sem áudio. Não é screenshot do Samsung.
- `tmp/elo-brain-20261014/tts-freeze-before.json` e `tts-freeze-result.json`: comparação das seis funções oficiais.
- `tmp/elo-brain-20261014/candidate-working-tree-v2.patch`: patch integral atual dos arquivos rastreados modificados, incluindo as mudanças anteriores da candidata.
- `tmp/elo-brain-20261014/preserved-elo-brain-local-20261014-v2.zip`: pacote atual de código novo/modificado, documentação, checkpoints, patch e manifestos. Não duplica os áudios nem artefatos antigos; os originais permanecem nos workspaces. O pacote V1 também foi preservado.
- `tmp/elo-brain-20261014/preservation-package-v2.json`: tamanho e SHA256 do pacote atual.

Artefatos desta frente medidos em aproximadamente 32 MB antes do pacote final; disco C: tinha aproximadamente 3,4 GB livres na leitura final. Nenhum backup, evidência ou projeto foi apagado. Não foi feito build grande ou instalação.

### Próxima ação exata

Conectar o Samsung SM-A042M com o ELO oficial autorizado por ADB. O script novo abaixo já inclui `elo-voice-session.js` e valida pacote, origem e arquivos servidos; sua sintaxe foi validada, mas a execução física NÃO foi realizada:

```powershell
cd 'C:\Users\Wia Engenharia\Documents\ChatGPT\SaaS Inspeção Técnica\ELO-premium-release-20261014'
node tmp/elo-brain-20261014/android-candidate-preview.mjs
```

Com múltiplos aparelhos, informar explicitamente o serial autorizado. O preview usa somente o pacote `br.com.icaroamaral.elo` e a origem oficial, preserva autenticação, não instala APK, não ativa microfone e não registra worker candidato. É substituição temporária de fontes via CDP, não deploy. Ctrl+C encerra a sessão de voz ativa e remove a interceptação; recarregar depois retorna às fontes publicadas.

Identificar a versão efetivamente carregada e executar os ciclos físicos de teclado, resposta, leitura, replay/troca de conversa e player. Se o runtime oferecer STT, ativar a voz pelo controle visível e certificar turnos audíveis, contexto, interrupção por botão, fim da captura e latência acústica. Se não oferecer, implementar o adaptador nativo mínimo descrito no documento, mantendo assinatura e dados antes de qualquer instalação autorizada. Só então fechar UX_ANDROID_P0 e os gates de áudio. Não realizar merge/deploy sem gates aprovados e autorização de publicação.


## Certificação física Samsung — V3 em andamento (2026-10-15T01:36:45.196Z)

Esta seção atualiza o estado físico anterior: Samsung SM-A042M, serial SAMSUNG_DEVICE_01, confirmado como device; ELO oficial 0.4.2 (6), RECORD_AUDIO concedido. APK preservado. Preview temporário ativo em 20261014-elo-brain-v2; bloqueio de registro de worker confirmado em runtime. Backend real continua o publicado; persona local de backend não é substituída pelo preview.

Voz real reconhecida, contexto Aurora confirmado inicialmente e no protocolo controlado com planejamento, áudio confirmado pelo usuário, respostas neurais HTTP 200 audio/mpeg e várias retomadas automáticas observadas. Não usar doubles como evidência acústica. Uma consulta histórica respondeu CADISTA apesar de Aurora no histórico; causa ainda não concluída, conservar a falha separadamente do sucesso controlado posterior.

Falha física comprovada às 01:21:00Z: retomada manual após replay permitiu captura simultânea à fala neural. Correção mínima em ensureEloVoiceSession_: prepareAudio cancela fala manual/pendente; canListen rejeita síntese neural/browser ativa. Seis hashes TTS continuam iguais. Cache da candidata atualizado para v2/worker v39. Reteste local 16/16 (duas regressões novas), cinco E2E afetados 5/5. Resultados originais 84/84 e 9/9 preservados. Reteste físico da correção e encerramento/eco ainda pendentes.

O player nativo muda a origem física do WebView; roteiro foi ajustado para derivar a origem pela viewport atual. Outro erro do roteiro enviava Voltar depois de o Android já fechar o teclado no blur; passou a conferir a viewport atual e a atividade ELO resumida antes de entrada. Recusas de entrada preservadas como falhas de automação; não representam PASS físico. Mensagens temporárias removidas e nós originais preservados em cada finally. Música Für Elise audível confirmada pelo usuário.

Manifesto e hashes: tmp/elo-brain-20261014/android-physical-source-v3-2026-10-15T01-36-45-196Z.json. Gate atual: IN_PROGRESS_PHYSICAL_RETEST. Sem merge, deploy ou instalação.

## Certificação física concluída — candidata V5 / nova regra de ativação

Atualização em 14/10/2026, America/Bahia (evidências UTC de 15/10). Branch e HEAD permanecem os originais. Esta seção substitui os gates físicos anteriores; não remove suas evidências.

### Matriz solicitada

| Campo | Resultado atual |
|---|---|
| ANDROID_ADB | PASS: Samsung SM-A042M, SAMSUNG_DEVICE_01, estado device; ADB `C:\Android\Sdk\platform-tools\adb.exe` |
| CANDIDATE_VERSION_TESTED | `20261014-elo-brain-v5`, cache declarado `elo-web-offline-v42-20261014-elo-brain-v5`; preview de fontes no ELO instalado 0.4.2 (versionCode 6), pacote `br.com.icaroamaral.elo`. Não é APK novo nem deploy. |
| UX_PHYSICAL_TEST | PASS: 12/12 ciclos finais no Samsung, 1.000 linhas temporárias não persistidas, rolagem completa por toque, teclado real aberto/fechado, resposta real durante leitura, retorno ao final e música nativa. |
| COMPOSER_VISIBLE | PASS nos 12 ciclos finais; microfone/anexo/envio atingíveis, botão de retorno acima do composer. |
| MICROPHONE_FUNCTIONAL | PASS REAL: fala humana reconhecida, envio ao chat oficial, resposta neural audível confirmada pelo usuário; captura desligada no encerramento segundo AppOps do próprio ELO. |
| CONTINUOUS_VOICE_REAL | PASS FOREGROUND: vários turnos reais; monitor final registra cinco mensagens humanas, contexto Aurora/planejamento correto e TTS neural real, sem doubles. A sessão inclui pausas/retomadas explícitas e por silêncio, registradas no relatório. Não é escuta indefinida. |
| AUTOMATIC_LISTEN_RESUME | PASS após respostas e interrupção. Limite existente de três ciclos sem fala pausa a escuta e exige retomada explícita; isso ocorreu fisicamente e foi explicado ao usuário. |
| VOICE_INTERRUPTION | PASS por botão físico durante RESPONDENDO_POR_VOZ, com áudio neural já em reprodução, evento INTERROMPIDO e retorno a OUVINDO. Usuário confirmou que a voz parou e voltou a ouvir. Interrupção por fala simultânea continua não implementada. |
| MUSIC_PLAYER_PHYSICAL | PASS para reprodução/pausa e ausência de sobreposição nos ciclos. Usuário confirmou ouvir Für Elise. O player nativo confirmou PLAYING; a fachada Web IDLE não foi usada como prova contrária. Cold-load completo não foi certificado nesta rodada. |
| TTS_FREEZE | PASS: seis hashes oficiais iguais ao baseline do PR #208; provider neural, fallback false e HTTP 200 audio/mpeg nos testes reais. |
| DATA_PRESERVED | YES: APK, autenticação, sessões e histórico preservados. Os fixtures de UX foram removidos, os nós originais e o rascunho restaurados; o usuário depois resolveu seu rascunho no aparelho. Mensagens reais de QA seguem a persistência normal da conversa. |
| FAILURES | Três falhas físicas de áudio/geometria corrigidas e retestadas, detalhadas abaixo. Divergência Aurora/CADISTA histórica ainda sem causa concluída. Erros de roteiro e guardas esperados foram preservados separadamente. |
| FINAL_ANDROID_GATE | PARTIAL: UX e conversa real em foreground aprovadas no escopo acima; divergência histórica de contexto aberta. Ativação exclusiva por palavra “ELO”, inclusive minimizado/tela bloqueada, é requisito novo ainda não implementado/certificado. Sem autorização de release. |

### Causas físicas encontradas e correções mínimas

1. Retomar a captura durante replay manual permitia áudio neural e microfone simultâneos. O adaptador agora cancela saída manual/pendente antes de retomar e rejeita captura enquanto a síntese estiver ativa. O coordenador e as seis funções TTS oficiais permaneceram intactos. Dois casos físicos finais (requisição pendente e áudio neural ativo) passaram sem sobreposição, hipótese da própria fala ou envio indevido.
2. O botão de retorno usava um deslocamento antigo após mudanças do painel/composer. Agora pertence ao próprio form, com posição CSS acima dele; ResizeObserver acompanha form, histórico e painel.
3. Mesmo com o botão corrigido, o composer excedia a janela durante atraso de evento do teclado. O frame móvel usa o menor limite entre a variável de viewport e 100% da janela real. Um novo E2E reproduziu FAIL antes e PASS após o ajuste; a rodada física final passou 12/12.

Os primeiros roteiros tiveram toques com origem do WebView desatualizada e um Voltar enviado após o teclado já fechar. As evidências de falha foram conservadas. O roteiro final deriva a origem física, exige a atividade ELO resumida, consulta geometria imediatamente antes de tocar e confirma clique trusted no controle pretendido. Recusas/erros de roteiro não foram contados como PASS do produto.

### Áudio real e limites da conclusão

No monitor final, o usuário perguntou sobre estrelas, recebeu voz neural real, teve a resposta interrompida por toque no microfone e confirmou a interrupção/retomada. Depois declarou Aurora/planejamento e obteve “O nome do projeto é Aurora e a primeira etapa é planejamento.” A saída terminou e houve nova escuta automática. Os estados e os cliques reais mostram também pausas manuais; não apresentar todos os cinco turnos como totalmente sem toque.

No teste silencioso combinado, dois casos de retomada passaram sem transcrição da própria saída nem mensagem nova. Após a última resposta completa, aproximadamente 15 segundos de retomadas/escuta não produziram transcrição ou mensagem. A hipótese provisória anterior de 23 caracteres não foi enviada; o usuário confirmou que havia fala ambiente naquele intervalo. Esta conclusão vale para as sequências observadas, não para todos os ambientes acústicos possíveis.

Uma consulta anterior respondeu CADISTA apesar de Aurora aparecer na janela de histórico. A inspeção local comprovou que havia ambos os termos, sem concluir a causa no backend publicado. Os protocolos controlados subsequentes responderam corretamente. A falha histórica continua aberta; não foi mascarada com resposta fixa nem alteração de histórico. O preview testa o frontend candidato com o backend publicado: a correção local de persona do backend não foi publicada nem certificada acusticamente.

O usuário confirmou ao final: “Respondeu certo e desligou o microfone.” AppOps do ELO confirmou ausência de RECORD_AUDIO em execução após encerramento.

O preview foi encerrado graciosamente e a página recarregada com as fontes publicadas (`20261014-elo-rdo-cloud-v2`). A primeira amostra foi anterior à restauração assíncrona do histórico; a verificação após o bootstrap confirmou as mesmas 115 mensagens, autenticação válida, conversa selecionada e não marcada como apagada. Microfone e despertador permaneceram desligados. Evidências: `android-preview-shutdown-2026-10-15T02-16-08-505Z.json` e `android-published-preservation-2026-10-15T02-18-29-728Z.json`. A candidata corrigida permanece local, não instalada/publicada.

Na fonte publicada, o helper de histórico retornou 20 itens; na candidata o audit anterior retornou 48. A diferença reforça a necessidade de verificar a versão/limite do backend publicado antes de concluir a causa Aurora/CADISTA; não prova, por si só, qual contexto o provedor recebeu. Não houve mudança especulativa de memória para contornar a divergência.

### Evidências e regressões

Diretório: `tmp/elo-brain-20261014/`.

- `android-preview-2026-10-15T02-01-05-609Z.json`: arquivos realmente servidos e hashes V5, pacote/versão instalados e bloqueio temporário de registro de worker. A autenticação inicialmente false foi apenas a amostra anterior ao bootstrap; os testes seguintes exigiram autenticação validada.
- `android-ux-physical-2026-10-15T02-02-00-179Z.json`: 12 ciclos PASS, restauração e geometria; PNGs com o mesmo timestamp, incluindo `cycle-2-physical-keyboard.png`, mostram o teclado real do Samsung.
- `android-audio-focus-real-2026-10-15T02-06-27-352Z.json`: dois casos reais em silêncio, nenhum eco/transcrição/envio e captura encerrada.
- `android-continuous-final-real-2026-10-15T02-08-05-466Z.json`: cinco turnos humanos observados, áudio neural, interrupção, retomadas, contexto correto e AppOps final.
- `android-real-context-audit-2026-10-15T01-20-23-868Z.json`: divergência histórica ainda aberta; apenas frases de QA e indicadores de presença de contexto.
- `physical-v5-regression-final.log`: 18/18 PASS no rerun final afetado, incluindo quatro novas regressões. Não somar reruns aos 84 originais.
- `physical-v5-e2e-final.json` e `.log`: 6/6 PASS no rerun final afetado, incluindo a nova regressão de atraso da viewport. Doubles desses E2E não são usados como evidência acústica.
- `ime-delayed-event-baseline.json` / `ime-delayed-event-fixed.json`: FAIL antes / PASS após o limite CSS.
- `android-final-source-audit-2026-10-15T02-09-07-232Z.json`: 17 arquivos, seis hashes TTS iguais e hashes de preservação dos logs/ZIP V2. O ZIP V2 continua com SHA256 `7801492548fac5925b8c8773737a3f54c7d3abd166caade52693c4a1092f8600`.

`git diff --check` e sintaxe de `elo-assistente.js`/`elo-sw.js` passaram. Os avisos LF/CRLF do Git não são erros. Nenhuma reinstalação, limpeza de dados, logout, commit, push, merge ou deploy. Nenhum outro aplicativo foi acessado.

### Novo requisito confirmado: despertar por “ELO” com tela bloqueada

Após confirmar o sucesso físico, o usuário pediu entrada no modo contínuo somente após chamar “ELO” e escolheu funcionamento também minimizado e com tela bloqueada. Esse comportamento NÃO está entregue pela candidata V5.

A fonte Android consultada contém `EloWakeService`, `EloWakeController` e parser de despertar. `acknowledgeWakeOnly()` fala uma saudação e entra no fluxo nativo de comando; não entrega uma sessão ao novo coordenador Web. O Brain atual recusa ativação se `isWakeEnabled()` estiver true (`NATIVE_CAPTURE_BUSY`) e pausa quando a página fica oculta. Apenas ligar o toggle existente não integra os fluxos.

Fluxo a implementar: detector da palavra habilitado pelo usuário → detecção de ELO → transferência exclusiva do microfone → sessão oficial contínua → encerramento/silêncio → retorno ao detector. Um comando separado de desativação deve desligar também o detector. Enquanto o detector estiver habilitado, há uso do microfone mesmo fora da conversa; não declarar microfone totalmente desligado nesse estado.

Para tela bloqueada, coordenar captura e ciclo de vida no serviço Android, sem depender da execução do WebView oculto. Preservar identidade, autenticação, conversa e histórico oficiais e o TTS do PR #208. Não criar um segundo chatbot/histórico nativo. A fonte atual usa SpeechRecognizer e pode escolher o reconhecedor padrão remoto se o reconhecedor local não estiver disponível; não declarar detector offline/privado sem trocar/verificar essa implementação.

Referências oficiais consultadas: https://developer.android.com/reference/android/speech/SpeechRecognizer (não indicado para reconhecimento contínuo de espera; pode transmitir áudio) e https://developer.android.com/develop/background-work/services/fgs/service-types#microphone (permissões e restrições do serviço de microfone). A fonte consultada não foi comprovada como reprodução exata do APK instalado; verificar versão, assinatura, possibilidade de atualização preservando dados e correspondência de fonte antes de qualquer instalação.

Próxima implementação precisa de candidata nativa isolada, entrega tipada entre despertador/sessão e novos testes físicos da palavra em espera, silêncio/falsos despertares, tela bloqueada, contexto, música/TTS sem eco e desativação total. A pergunta atual definiu o comportamento; nenhum despertador foi ativado nem APK substituído nesta inspeção.

### Preservação V5

Matriz: `tmp/elo-brain-20261014/android-certification-final-v5.json`. Manifesto: `tmp/elo-brain-20261014/source-manifest-physical-v5.json`. Patch rastreado: `tmp/elo-brain-20261014/candidate-working-tree-physical-v5.patch`. Pacote separado: `tmp/elo-brain-20261014/preserved-elo-brain-physical-v5-20261014.zip`, com tamanho/hash em `preservation-package-physical-v5.json`. Os pacotes anteriores permanecem intactos.

## Implementação nativa — checkpoint 1: arquitetura recuperada

Pedido de implementação recebido pelo anexo `7eb0ee8e-3df0-442c-a3c9-d63cbb2f87de/Texto colado.txt`. Não houve reinício da implementação Web nem repetição da UX física aprovada. Branch/HEAD e alterações V5 preservados.

Samsung autorizado continua conectado; Android API 34. APK instalado: ELO 0.4.2 (6), 245.841.214 bytes, SHA256 `678480c1fd16b3d0f1c487f192daa48b4ee31002c7f939e028ad2f339d346104`. O APK de referência antigo tem hash diferente; não tratá-lo como cópia exata do instalado. Assinatura/correspondência ainda serão verificadas antes de instalar.

A fonte Android 0.4.2 consultada usa EloWakeService/SpeechRecognizer e um fluxo anônimo de comando próprio; isso precisa ser substituído pela coordenação autenticada da conversa canônica. A cópia de trabalho isolada é `android-native-wake-20261014/`; fonte anterior e os 243 MB de assets existentes serão preservados. Manifesto da cópia em `tmp/elo-brain-native-20261014/native-baseline-provenance.json`. Nenhuma escrita na fonte Android anterior.

Decisão: motor Vosk local com gramática restrita `elo`/desconhecido durante espera, licença Apache 2.0, modelo pequeno português 0.3 (~31 MB de download). Sem serviço pago, chave adicional ou envio de áudio de espera à nuvem. Precisão, falsos despertares, CPU/bateria e funcionamento no Samsung ainda não certificados. O coordenador nativo deterá a posse exclusiva da captura; processamento/síntese liberam o microfone, e o reconhecedor de conversa usa o mesmo motor local fora da gramática restrita. Fonte do modelo/licença: https://alphacephei.com/vosk/models; dependências Android oficiais: https://github.com/alphacep/vosk-android-demo.

A transferência Web/nativa deverá validar origem, identidade, conversa e validade da sessão; token apenas na memória privada do processo, sem logs/URL/disco. O serviço usa os endpoints oficiais autenticados, persiste mensagens na conversa canônica e a tela recarrega essa mesma conversa ao voltar. Sem histórico/chatbot paralelo. Falha/expiração exige retorno ao app; não manter captura em loop. Inicialização do serviço somente por ação explícita com Activity visível; não restaurar microfone automaticamente por boot/force-stop.

Restrição real de ambiente: C: tinha cerca de 69 MB livres na primeira medição. Usuário foi avisado para liberar pelo menos 2 GB ou indicar destino; não apagar arquivos existentes. Até haver espaço, avançar nas alterações pequenas e testes que couberem; download do modelo, build e atualização física permanecem condicionados ao espaço e aos gates de assinatura/compatibilidade. Status: IMPLEMENTATION_IN_PROGRESS.

### Checkpoint 2 — coordenador nativo e ligação ao cliente oficial

O usuário liberou espaço no C:. A inspeção por DriveInfo confirmou apenas C:; nenhum volume D:/E: disponível. Não houve exclusão de arquivos pelo agente. Após a limpeza, a leitura chegou a aproximadamente 3,8–4,2 GB; antes da build, conferir novamente e estimar a necessidade real, com margem. A preferência de 5 GB não autoriza limpar nada.

Implementados na cópia nativa isolada: EloVoiceCoordinator, EloVoskAudioEngine, EloCanonicalVoiceClient, EloNativeBrainRegistry, EloNativeBrainWebChannel e integração em EloWakeService/MainActivity. O serviço usa um único trabalhador AudioRecord, gramática local no modo wake, transcrição local no modo conversa, liberação antes de HTTP/TTS e invalidação por geração/lease. Encerrar retorna ao wake; desativar libera captura, saída, tarefas e serviço. Há silêncio configurável (30 s padrão, limites 10–120 s), limite de captura e timeouts; falhas ambíguas de POST não são repetidas.

O contexto chega apenas ao frame principal oficial por WebMessagePort com nonce da navegação. Token permanece em memória, sem refresh token, URL, arquivo ou diagnóstico. A conversa é validada pelo endpoint autenticado antes de armar o detector. O cliente nativo usa /api/elo/chat e persiste na conversa oficial; o retorno à tela busca essa conversa e usa o replay existente, sem POST de duplicação. Expiração de sessão ou troca de identidade impede a continuidade e exige reconfirmação no app. O modo não promete sobreviver a force-stop, boot ou revogação de permissões.

Os primeiros 23 testes de coordenador passaram; com contratos de contexto/identidade/persistência, 33/33 testes leves passaram. Logs: tmp/elo-brain-native-20261014/coordinator-unit-20261015T024915275.log e coordinator-unit-20261015T025359043.log. Compilação JVM real dos arquivos testados; portas/HTTP simulados apenas nos testes locais. Nenhum PASS físico atribuído a esses testes.

Modelo local preparado: vosk-model-small-pt-0.3, arquivo 32.453.112 bytes, SHA256 6e1ce909032e1afa7a88e68a3d628ecafff302bdf195befab308826c395e93b7; expansão 53.552.717 bytes. Manifestos local-wake-model-download.json / local-wake-model-files.json no diretório de evidências nativas. Fonte oficial e licença Apache 2.0 registradas. A existência de “elo” no vocabulário será conferida no carregamento; falta a avaliação acústica/falsos despertares/consumo no Samsung.

Cópia preservada do APK instalado: tmp/elo-brain-native-20261014/installed-elo-0.4.2-v6.apk. SHA256 igual ao arquivo no telefone (678480c1fd16b3d0f1c487f192daa48b4ee31002c7f939e028ad2f339d346104), assinatura verificada: certificado SHA256 8442425d1b3d0c5d5f241276d5efc570b01bcfbd2387103d46c04909f87fba52. Nenhuma atualização foi instalada. A candidata conserva o pacote oficial e propõe versionCode 7; não utiliza sufixo de aplicativo paralelo.

O TTS nativo continua chamando EloTtsClient/endpoint oficial. A nova sessão exige saída neural (sem troca silenciosa para voz Android) e utiliza foco de áudio do coordenador. Instruções/voz do PR #208 e seis funções Web não foram alteradas; repetir o hash antes da entrega. A interface e os contratos recém-integrados ainda precisam de testes e compilação Android completos. Status: IMPLEMENTED_CORE / INTEGRATION_AND_BUILD_IN_PROGRESS.

### Checkpoint 3 — build Android e gates locais concluídos (2026-10-15 UTC)

Implementação continua na cópia android-native-wake-20261014; nenhuma alteração nas fontes Android anteriores. Build Gradle real concluída: native-build-20261015T032149245.log, 37/37 testes Android (26 coordenador + 11 cliente canônico). Canal Web/nativo: 17/17, log native-web-unit-20261015T032032008.log. Permanecem preservados os 84/84 e 9/9 anteriores; não foram repetidos nem substituídos por esses testes.

A compilação exigiu corrigir argumentos PowerShell e aplicar opções Java temporárias à árvore de processos para o fallback de canais locais do JDK. O executor de testes também precisou que os arquivos de argumentos fossem escritos na codificação nativa do Windows (problema Gradle #30304: https://github.com/gradle/gradle/issues/30304). Fontes Java continuam UTF-8. Nenhuma configuração global, firewall ou proteção do sistema foi alterada. Preflight incremental usa outputs próprios já materializados e exige ao menos 1,5 GiB; não houve exclusão de arquivos. C: tinha cerca de 4,0 GB após a limpeza do usuário e cerca de 2,29 GB após a build.

O botão de leitura de mensagem, quando o chamado está habilitado, usa o mesmo coordenador/saída nativa; não inicia um segundo player Web. Término/interrupção da leitura manual retorna ao detector. Logout e troca visível de conversa limpam o contexto nativo. Cada leitura do histórico valida a conversa antes de qualquer escrita. Respostas canônicas não são duplicadas por replay.

TTS_FREEZE: hashes das seis funções Web iguais ao manifesto V5. O payload neural nativo reutiliza as instruções exatas aprovadas no PR #208, a voz configurada do cliente oficial e o endpoint existente, com token somente em memória. Os usos antigos de EloTtsClient mantêm o payload padrão; a nova sessão injeta o perfil aprovado e exige áudio neural real. Biblioteca/modelo e licença Apache 2.0 incluídos no APK. Isso ainda não é PASS acústico.

Candidata imutável: tmp/elo-brain-native-20261014/elo-brain-native-v7-20261015T0324.apk; 320.143.654 bytes; SHA256 c6ac80cc739075bdc53fee96e8e5306497dc9169f1eab5c8aed4a0f9315ae7db. Pacote oficial br.com.icaroamaral.elo, versionCode 7, versionName 0.4.3-brain-native, minSdk 26, target 35. Certificado SHA256 8442425d1b3d0c5d5f241276d5efc570b01bcfbd2387103d46c04909f87fba52, igual ao instalado. Cópia exata do APK 0.4.2 (6) preservada separadamente. Debug local permite inspeção da certificação; não é publicação em produção.

Gate local: apk-safety-20261015T032410494.json. 65/65 assets do APK efetivamente instalado preservados byte a byte; 15 arquivos do modelo conferidos; adapter nativo igual à fonte; baseline original sem mudanças; assinatura e versão compatíveis. Samsung autorizado SAMSUNG_DEVICE_01, API 34, cerca de 3,9 GB disponíveis em /data. Estado anterior à atualização: device-before-update-1792034742588.json — autenticado/validado, 115 mensagens, mesma conversa registrada apenas por hash, rascunho vazio; nenhuma credencial lida.

Próxima etapa autorizada: atualização por adb install -r, sem desinstalar/limpar dados, seguida da comparação de sessão/histórico e certificação acústica real. Não há PASS de wake em segundo plano/tela bloqueada ainda. Divergência histórica Aurora/CADISTA e paridade do backend publicado continuam registradas; testes locais não as encerram. Merge/deploy não executados.

### Checkpoint 4 — primeira prova acústica nativa e falha real de STT

A atualização preservadora para versionCode 7 foi instalada com adb install -r (Success). Após carregar: device-after-update-1792034891660.json confirmou autenticação validada, a mesma conversa por hash, 115 mensagens e rascunho vazio, iguais ao antes. Nenhum dado foi limpo. Preview V5 autenticado/correto ativo com o APK 7; manifesto android-preview-2026-10-15T03-29-06-760Z.json. Fonte e APK anteriores preservados.

Teste real: usuário acionou Ativar chamado ELO e falou a palavra. Telemetria física native-runtime-1792035069589.jsonl observou modelo local carregado, wake → saída neural PLAYING → BRAIN_LISTENING, quatro turnos reais e retorno automático. Pico de trabalhadores = 1; durante PLAYING, activeCaptureWorkers=0 e recording=false. Entretanto, o reconhecimento cortou a frase: primeira mensagem recebida como “esse teste o projeto”, sem Aurora. O usuário confirmou que o ELO responde, mas não transcreve corretamente o que foi falado. Portanto UX de reconhecimento/CONTINUOUS_VOICE_REAL e FINAL_ANDROID_GATE NÃO estão aprovados. Não converter a mecânica funcional em PASS da conversa.

Escuta desativada pelo controle real do ELO às 03:33:39 UTC: EXPLICIT_DISABLE, activeCaptureWorkers=0, recording=false, serviço ausente em seguida e AppOps sem captura em execução. O verificador de toque V5 não recebeu evento porque o novo adaptador usa stopImmediatePropagation no document; a desativação ocorreu de fato. O novo helper native-tap.mjs observa window capture, antes do adaptador; não repetir toque sem ler o estado para evitar reativação acidental. Nenhum APK/dado foi removido.

Correção em preparação para versionCode 8: o retorno acceptWaveForm do Vosk indica um segmento do decodificador, não necessariamente a fala completa. BRAIN usa endpoint de 1,0 s e buffer de continuidade de 650 ms; continuação parcial impede envio prematuro e segmentos são unidos uma vez. WAKE mantém a gramática local original. EloVoiceUtteranceBuffer tem seis testes específicos, incluindo “neste teste o projeto” + “se chama aurora responda só entendido”. Total leve: 43/43, coordinator-unit-20261015T033838134.log. São testes de lógica, não evidência de precisão acústica.

Transcrição parcial/final será mostrada por canal privado apenas na tela ELO visível. Não entra no diagnóstico, não é persistida como áudio/arquivo, não sobrescreve o campo de rascunho e callbacks obsoletos são rejeitados. Novos testes do canal: 19/19, native-web-unit-20261015T033834449.log; seis hashes do TTS e perfil neural permanecem iguais. Referência primária Vosk: https://raw.githubusercontent.com/alphacep/vosk-api/master/java/lib/src/main/java/org/vosk/Recognizer.java. API setEndpointerDelays conferida também no AAR 0.3.75 efetivamente usado.

Estado: correção de STT compilando; próxima etapa é gate de assinatura/versão/assets da versão 8, atualização preservadora e repetição de áudio real. Background/tela bloqueada, dez turnos corretos, consumo e player nesta nova arquitetura continuam pendentes. Nenhum merge/deploy.

### Checkpoint 5 — V8 física, regressão musical e candidata V9

V8 (`0.4.3-brain-native-v8`, versionCode 8) passou o gate de assinatura/pacote/assets e foi atualizada com `adb install -r`, sem limpeza de dados. SHA256: `015aba1cd6341d7d40b593b69a0eb8ca859247c743f028fd10e8f6011db7a1de`. Certificado permanece `8442425d1b3d0c5d5f241276d5efc570b01bcfbd2387103d46c04909f87fba52`. Evidência: `tmp/elo-brain-native-20261014/apk-safety-20261015T034204283.json`. Antes/depois V8: mesma conversa, autenticação validada, 129 mensagens, rascunho vazio. Mensagens de QA seguintes elevaram o histórico normalmente para 133.

Teste A, texto físico `Toque Sultans of Swing`: PASS REAL. Intenção PLAY, catálogo ACTIVE `dire-straits-sultans-of-swing`, vídeo `eqxpQA5etd4`, player PLAYING, posição 256,606828 → 260,052249, sem erro/gesto pendente. Usuário confirmou: “Sim, ouvi a música”. Evidência: `music-text-confirmed-1792036512302.json`. Não foi necessário alterar o catálogo.

Teste B, voz real V8: FAIL. Usuário pronunciou `Toque Sultans of Swing`; transcrição canônica registrada como `toque sutil`, resposta genérica sobre toque e player IDLE. Evidência: `music-voice-before-fix-1792037009427.json`. O buffer da V8 não resolve o vocabulário inglês do modelo pequeno português. Segunda causa comprovada no código: cliente nativo enviava tudo ao chat genérico e não passava pelo roteador/resolver/player musical oficial. Intenção reconhecida e áudio reproduzido continuam gates distintos.

Fonte V9 preparada, ainda SEM APK instalado:

- Vosk restrito à espera local de “ELO”; conversa ativa usa Android SpeechRecognizer por turno explícito, com parciais na tela. Esse reconhecedor pode usar rede; não declarar toda a transcrição offline. Sem arquivo de áudio ou log de fala ambiente.
- Coordenador único aguarda confirmação terminal de liberação do reconhecedor antes de TTS/outro capturador. Timeout de liberação falha fechado. “Ouvindo” só após onReadyForSpeech; callbacks antigos invalidados por geração/lease/revisão. Finalização vazia do reconhecedor não prolonga indefinidamente nem encerra prematuramente o prazo de silêncio da sessão.
- Wake seguido de comando na mesma frase não é tratado como comando preservado: quando há continuação consumida, a confirmação solicita repetir o pedido após a mensagem. Isso precisa de teste C real. Sem alegação de preservação integral do áudio.
- Ferramenta musical privada reutiliza roteador, resolver e player Web existentes, persiste os dois papéis uma vez na conversa oficial e evita chat genérico para ação musical. Só aceita reprodução após PLAYING e posição avançando. Ambiguidade solicita confirmação curta. Cancelamento chega até a resolução e o início tardio do player; nenhum intent para aplicativo externo.
- Durante chamado, player é pausado preservando fila/posição. Música confirmada encerra o turno e retorna ao detector sem sobrepor TTS. Falha de reprodução produz resposta verdadeira. Confirmação musical pendente é limpa ao encerrar a sessão.

Validação local da fonte: 57/57 testes nativos leves (`coordinator-unit-20261015T042109780.log`), 47/47 regressões Web/música/player/cancelamento (`music-native-regression-20261015T0426.log`), seis hashes TTS iguais e perfil neural exato do PR #208. As 51 fontes Kotlin compilaram contra SDK 35 com zero mudanças durante a compilação (`native-light-compile-20261015T042059624.log`, manifesto correspondente). A primeira compilação leve tinha classpath AndroidX incompleto; corrigido no roteiro, sem alteração especulativa de fonte. Compilação leve não gera APK e não constitui PASS acústico.

Build completa V9 foi interrompida antes do empacotamento quando o livre caiu abaixo da margem; log `native-build-20261015T041310897.log`. Somente processo da própria build foi encerrado. Fontes, APKs preservados e testes anteriores permanecem. O APK instalado continua V8; não atribuir à V9 nenhum resultado físico anterior.

Samsung após correções locais/primeira limpeza: `device-storage-preserved-1792038567157.json`, 133 mensagens, mesma conversa por hash, autenticação validada, rascunho vazio, WAKE_DISABLED/owner NONE. AppOps confirmou ausência de captura após desativação pelo botão real. Sem acesso a outro aplicativo ou dados pessoais.

### Checkpoint 6 — diagnóstico estrutural de armazenamento e limpeza limitada autorizada

Usuário autorizou posteriormente limpeza seletiva de caches regeneráveis/dispensáveis, exigindo registro prévio e ausência de consumidores ativos. ZIPs, checkpoints, worktrees, fonte, APKs preservados, logs/evidências, sessões, credenciais e dados do celular seguem proibidos para exclusão. Nenhum pedido adicional de pequena limpeza será repetido.

Inventário de metadados: `storage-audit-1792038231543.json`; agregados em `storage-major-roots-20261015T0438.jsonl`. O inventário detalhado contém uma linha duplicada dos mesmos intermediários (670 MB); não somar essa linha duas vezes. Só C: está disponível.

Maiores diretórios técnicos auditados: AppData/Local 16.839 MB, Documents/ChatGPT 12.199 MB, .codex 7.979 MB, C:/Android 1.484 MB; são agregados que contêm dados protegidos, não candidatos integrais à exclusão. Arquivo de paginação Windows: 8.930.807.808 bytes alocados, uso observado 1.737 MiB; foi preservado. Não há medição anterior que prove quanto de seu crescimento foi causado pela build.

Cache npm `_cacache` estava vazio. Gradle: caches 8.10.2 ~694 MB, modules-2 ~209 MB, distribuição usada ~152 MB. Mantidos por serem insumos da próxima build; apagá-los apenas para recriá-los não resolve capacidade. Runtime Codex ~1.478 MB e backup explícito ~1.379 MB preservados. Temporário `elo-stock-item-lookup-20261008` (553 MB) contém `.git` e fonte: é worktree, não lixo. APK oficial diagnóstico de 246 MB também preservado. Zen/UnrealTrace e armazenamento de outros aplicativos não foram apagados.

Primeira limpeza efetiva: somente `android-build-work/app-build/outputs/apk/debug/app-debug.apk` redundante, 319.958.933 bytes, após SHA256 idêntico à cópia separada `elo-brain-native-v8-20261015T0407.apk`, nenhum compilador/instalador consumidor e abertura exclusiva. Caminho registrado antes da exclusão em `selective-cleanup-20261015T042745654.json`. Livre 860.225.536 → 1.180.180.480 bytes. A cópia V8 preservada foi revalidada após a remoção; V6/V7/V8 e ZIPs permanecem.

Candidatos adicionais verificados: apenas `.udd` no cache DerivedDataCache do Unreal (333.786.473 bytes), documentado pela Epic como recriável a partir dos assets originais; nenhum Unreal/ShaderCompileWorker/ZenServer ativo. Metadados `.dat`, assets/projetos e configurações serão preservados. Extração temporária `C:/Android/cmdline-tools-extract/cmdline-tools`: 141 arquivos/179.901.603 bytes, todos idênticos por SHA256 à instalação `C:/Android/Sdk/cmdline-tools/latest`, sem consumidores/configuração apontando para a extração. Registro/resultado em `development-cache-cleanup-*.json`; conferir conclusão antes de contar recuperação. Referência primária: https://dev.epicgames.com/documentation/en-us/unreal-engine/using-derived-data-cache-in-unreal-engine.

Prevenção de pressão na próxima build: 1 worker, Gradle heap 512 MiB/metaspace 384 MiB, Kotlin dentro do mesmo processo, testes com heap 192 MiB e um fork, modo offline usando dependências já em cache; nenhuma configuração global ou do Windows alterada. Esses limites ainda não foram validados numa build completa V9. O preflight continua bloqueando abaixo da estimativa real. Não foram encontrados 10–15 GB de caches dispensáveis no escopo auditado; não excluir dados protegidos para atingir uma meta numérica.

Limpeza adicional concluída: `development-cache-cleanup-20261015T043807922.json`, manifesto de 15.781 arquivos gravado antes da remoção, 513.688.076 bytes regeneráveis/duplicados removidos. Preservados metadados `.dat`, projetos/arquivos do Unreal, Zen, configuração, SDK instalado e todos os dados pessoais. Nenhum Unreal/compilador/Zen consumidor ativo, extração SDK fora de PATH/ANDROID_HOME e todos os 141 arquivos instalados revalidados. O primeiro helper de preflight deixou de avançar antes de criar manifesto/excluir arquivos; somente esse processo foi encerrado. O helper otimizado usa lista eficiente e progresso explícito; sua conclusão acima é a única limpeza DDC/SDK contada.

Recuperação lógica total verificada: 833.647.009 bytes (319.958.933 + 513.688.076), sem somar duplamente espaço concorrente/cluster. Livre após a conclusão: 1.712.685.056 bytes, contra 860.225.536 antes da primeira remoção. Os agregados de AppData/Local foram medidos antes da segunda limpeza. Manifesto `protected-artifacts-after-storage-audit-20261015.json`: V6, V7, V8, ZIP V2 e ZIP V5 mantêm exatamente os hashes conhecidos. Sessão do Samsung continua validada, 133 mensagens, conversa/rascunho preservados e escuta desativada.

Uma build incremental foi iniciada após o preflight: assets já materializados 296.969.512 bytes, requisito conservador mínimo 1,5 GiB (1.610.612.736 bytes), disco ~1,71 GB. Usa os limites menores/offline descritos acima, com acompanhamento de espaço. Não repetir build se a margem tornar-se insuficiente. Na próxima preservação de APK novo, mover o output para nome único verificado em vez de manter duas cópias idênticas no C:. Essa medida evita a duplicação adicional de ~320 MB por rodada, preservando todas as versões únicas exigidas pelo usuário.

### Checkpoint 7 — build V9 concluída e atualização preservadora no Samsung

Build completa V9: PASS, `native-build-20261015T043944389.log`, 6 min 27 s, 43 tarefas (18 executadas/25 reutilizadas), sem downloads novos. 64/64 testes Gradle PASS: coordenador 34, cliente canônico 13, buffer 6, intenção musical 4, coordenador do player 7. O heap de 512 MiB/um worker e o compilador em processo permitiram concluir mantendo margem; houve aviso de metaspace próximo do limite de 384 MiB, sem erro, e o processo de build terminou. Não houve alteração global de memória/segurança/Windows. Livre ao concluir ~1,39 GB. As 47 regressões Web/música anteriores não foram repetidas sem necessidade.

Gate completo: `apk-safety-20261015T044700232.json`, assinatura igual à V8, permissões exatamente iguais, pacote `br.com.icaroamaral.elo`, versionCode 9, `0.4.3-brain-native-v9`, minSdk 26/targetSdk 35, 65 assets originais intactos, 15 arquivos do modelo iguais, adaptador nativo idêntico à fonte e nenhuma mudança no baseline Android antigo. O APK tem 319.977.153 bytes e SHA256 `b506a7cdeb3002d2008285118955f3d735463f1c6fe1759369184ed46a7fc640`.

APK movido do output para `tmp/elo-brain-native-20261014/elo-brain-native-v9-20261015T0449.apk`, com hash conferido antes/depois, sem criar outra cópia de 320 MB. Manifesto `preserved-apk-v9.json`. V6/V7/V8/ZIPs continuam preservados.

Antes da instalação: `device-final-before-v9-1792039715030.json`, mesma conversa/hash, 133 mensagens, autenticação validada, rascunho vazio, voz desativada; AppOps sem captura em execução. Hash da V8 efetivamente instalada foi conferido no próprio pacote e coincide com a cópia preservada. Atualização V9 por `adb install -r`: Success. Sem desinstalar, limpar dados/sessão ou acessar outros aplicativos. Samsung SM-A042M autorizado, estado device.

Após `am start` do próprio ELO: PID 23540, forward desta execução tcp:9224 para o WebView oficial. O preview V8 foi encerrado antes da atualização. Novo preview V9: `tmp/elo-brain-20261014/android-preview-2026-10-15T04-50-30-113Z.json`, 13 fontes candidatas locais, sem deploy/registro de worker, sessão de processo 90396, parada graciosa pelo arquivo `android-preview-20808-1792039822363.stop`. Não confiar no clique sintético do finally para desligar microfone nativo: usar controle real e verificar estado antes de encerrar preview.

A amostra inicial de bootstrap tinha zero mensagens, sem indicar perda. `device-after-v9-ready-1792039875343.json` confirmou após carregar: autenticação validada, mesma conversa/hash, 133 mensagens, rascunho vazio, voz desativada. Adaptador confirmado `20261015-native-brain-v3`; não é a V8 antiga.

Teste B V9 solicitado ao usuário: ativar chamado, dizer “ELO”, aguardar “Ouvindo. Você pode falar.” e falar “Toque Sultans of Swing”; informar transcrição e áudio. Monitores reais preparados: `voice-music-v9-1792039944644.jsonl` e `native-runtime-1792039951934.jsonl` (180 s), sem ativação automática do microfone nem gravação de áudio. Esses arquivos só comprovam o que efetivamente observarem; início de monitor não é PASS físico.

| Campo | Resultado até este checkpoint |
|---|---|
| SPACE_BEFORE | 860.225.536 bytes antes da primeira limpeza seletiva |
| LARGEST_SPACE_CONSUMERS | Agregados técnicos auditados: AppData/Local 16,84 GB; Documents/ChatGPT 12,20 GB; paginação Windows 8,93 GB; .codex 7,98 GB. Contêm dados protegidos; não foram limpos integralmente. |
| REGENERABLE_CACHE_FOUND | Cópia redundante do output V8 + 333.786.473 bytes de .udd + 179.901.603 bytes de extração SDK idêntica. Gradle/dependências necessários mantidos. |
| SAFE_SPACE_RECOVERED | 833.647.009 bytes lógicos verificados; meta de 10–15 GB indisponível sem tocar itens protegidos |
| SPACE_AFTER | 1.712.685.056 bytes após limpeza; ~1,39 GB após gerar/preservar V9 sem duplicação |
| BACKUPS_PRESERVED | YES: hashes V6/V7/V8/ZIP V2/V5 conferidos; V9 preservada |
| SOURCE_CODE_PRESERVED | YES: limpeza não removeu fonte/worktrees; alterações de desenvolvimento e baseline anterior preservados |
| ANDROID_BUILD | PASS V9, 64/64 testes nativos Gradle; 47/47 Web/música já aprovados |
| ELO_BRAIN_STATUS | V9 instalada, coordenador/ASR/ferramenta musical integrados; certificação física corretiva em andamento |
| NEXT_ACTION | Concluir teste real B, depois C e D, contexto/retomada/interrupção/desativação, minimizado/tela bloqueada e UX com novo adaptador. Sem novo pedido de pequena limpeza. |

Matriz musical atual: MUSIC_STT_TRANSCRIPTION=V8_FAIL (`toque sutil`), V9_PENDING; WAKE_COMMAND_HANDOFF=solicitação de repetição implementada, C físico pendente; MUSIC_INTENT/MUSIC_RESOLVER/PLAYER_DISPATCH=PASS por texto real na V8, integração nativa V9 com testes locais PASS e prova acústica pendente; TEXT_REQUEST_TEST=PASS REAL A; VOICE_REQUEST_TEST=PENDING_V9; SULTANS_OF_SWING_RESULT=TEXT_AUDIBLE_PASS/VOICE_RETEST; ROOT_CAUSE=modelo PT para título inglês + bypass do roteamento musical; FIX_IMPLEMENTED=YES em V9/preview local; ANDROID_PHYSICAL_TEST=IN_PROGRESS; REGRESSION_STATUS=OPEN_UNTIL_REAL_RETEST. TTS_FREEZE=PASS estático, voz neural V9 ainda precisa de prova real. BACKGROUND_WAKE/LOCKED_SCREEN_WAKE/CONTINUOUS_VOICE corretos nesta arquitetura ainda não certificados; não herdar PASS da V5. FINAL_ANDROID_GATE=PARTIAL. Nenhum merge/deploy/release.

Os dois monitores de 180 s terminaram sem interação humana: 108 amostras Web e 158 amostras do serviço, somente WAKE_DISABLED/serviço ausente, player IDLE, histórico 133. Isso confirma espera com microfone desligado, não confirma STT/TTS/música V9. O pedido de teste real B permanece pendente ao usuário. Preview V9 continua ativo para essa resposta; não ativar microfone automaticamente. Resultado consolidado de armazenamento/build/instalação em `tmp/elo-brain-native-20261014/storage-and-v9-status-20261015.json`. Próximo atendimento deve conferir o estado antes de tocar qualquer controle e observar a fala real; não marcar PASS pela existência da build ou dos testes locais.

### Checkpoint 8 — encerramento solicitado pelo usuário; falha física V9 preservada

**Esta seção substitui os estados pendentes/em andamento do Checkpoint 7.** Usuário informou: “NAO DEU CERTO, PRECISO DORMIR, FAÇA UM CHECKPOINT E MOSTRE AQUI E SALVE O QUE FOR PRECISO”. Desenvolvimento e novos testes interrompidos a seu pedido. Nenhuma tentativa de corrigir/recompilar/reinstalar após esse pedido; somente captura mínima de evidência, desativação segura e preservação.

#### Resultado e evidência que importam para a próxima retomada

- APK instalado: `br.com.icaroamaral.elo`, V9 `0.4.3-brain-native-v9`; adaptador `20261015-native-brain-v3`.
- `device-sleep-checkpoint-before-1792040730251.json` e `sleep-checkpoint-evidence-1792040763593.json`, no diretório `tmp/elo-brain-native-20261014/`, registram o estado real posterior à tentativa do usuário. Os monitores anteriores já haviam terminado antes dessa tentativa; não reconstruir uma sequência de eventos que eles não capturaram.
- Antes de desligar: estado `SUSPENDED`, motivo `AUDIO_FOCUS_LOST`, enabled=true, owner=NONE, generation=4, captureLease=14, turn=0. Modelo pronto, pico de captura=1, trabalhadores locais=0/recording=false; reconhecedor Android inactive/not-ready; voiceStage=COMPLETED, musicDecision=NONE, musicPlayed=false, player IDLE.
- A tela exibia “Escuta suspensa. Toque em Retomar chamado.” Histórico continuava com 133 mensagens e transcrição visível vazia. Não houve novo turno canônico processado nem despacho musical nessa evidência. Não há transcrição V9 do título para chamar de correta/incorreta. O relato do usuário estabelece FAIL do teste real B V9, sem esclarecer em qual interação ele percebeu a falha.
- O ponto inicial da próxima investigação é a perda de foco no caminho despertar → confirmação neural → reconhecedor Android. Verificar foco solicitado/liberado pelo próprio TTS, reconhecedor/sinal do sistema, player e callback tardio. Essas são hipóteses de investigação, NÃO causas comprovadas. Não alterar catálogo/player por suposição e não confundir a falha V8 (`toque sutil`) com uma transcrição que não ocorreu na V9.

#### Encerramento seguro confirmado

Foi realizado um único toque físico trusted no botão “Desativar assistente”. Depois: `WAKE_DISABLED`, enabled=false, owner=NONE, serviço ausente. AppOps RECORD_AUDIO não estava em execução; última captura registrada durou 157 ms. O helper confirmou `shutdownVerified=true`. Nenhum áudio pessoal foi gravado.

Preview local V9 encerrado graciosamente pelo stop-file registrado; processo 90396 terminou. Sem reload de página, logout ou limpeza de armazenamento. O APK V9 continua instalado, a página já carregada permanece em memória; um reload futuro usa fontes publicadas até reativar o preview correto. Não presumir que as 13 fontes candidatas continuarão servidas após este encerramento. Não iniciar escuta automaticamente.

Autenticação validada, mesma conversa por hash, 133 mensagens e rascunho vazio preservados antes/depois de desativar. TTS neural do PR #208 e seis funções congeladas não foram alterados. Nenhum merge, deploy, commit, reset ou exclusão de fonte/worktree.

#### Trabalho salvo e retomada sem repetição

- Branch `codex/elo-premium-release-20261014`, HEAD `edee4b9b4505cfd98afca405ad3db53feb6ae5ab`; alterações permanecem no workspace.
- APK V9 preservado: `tmp/elo-brain-native-20261014/elo-brain-native-v9-20261015T0449.apk`; SHA256 revalidado no encerramento: `b506a7cdeb3002d2008285118955f3d735463f1c6fe1759369184ed46a7fc640`. V6/V7/V8 e ZIPs anteriores mantidos.
- Patch rastreado: `tmp/elo-brain-native-20261014/sleep-working-tree-20261015.patch`; status Git: `sleep-git-status-20261015.txt`. O patch sozinho NÃO contém os arquivos novos; estes permanecem na árvore e serão incluídos no pacote de fontes de encerramento.
- Pacote de recuperação: `tmp/elo-brain-native-20261014/preserved-elo-brain-sleep-20261015.zip`, com código alterado, novos arquivos da implementação/testes/helpers, este checkpoint e manifestos necessários. APKs/modelo/áudios/cache grandes são referenciados por caminho/hash, não duplicados dentro do ZIP. Conferir o manifesto de preservação correspondente antes de alegar integridade do pacote.
- Testes locais já aprovados: 64/64 nativos Gradle, 47/47 Web/música; históricos 84/84 e 9/9 E2E preservados. Não repeti-los sem alteração que justifique. Esses resultados NÃO aprovam áudio real V9.
- Recuperação de espaço concluída anteriormente: 833.647.009 bytes regeneráveis/duplicados. Disco no início deste encerramento ~1,34–1,39 GB; nenhuma limpeza adicional agora. Na retomada, medir novamente e respeitar o preflight; não pedir repetidas pequenas limpezas nem iniciar builds sem margem.

#### Gates ao encerrar

| Campo | Estado |
|---|---|
| ANDROID_BUILD | PASS V9, 64/64 |
| ANDROID_PHYSICAL_TEST | FAIL informado pelo usuário; evidência de suspensão por perda de foco |
| VOICE_REQUEST_TEST | FAIL V9; nenhum novo turno/transcrição canônica observado |
| SULTANS_OF_SWING_RESULT | Texto real anterior PASS audível; voz V9 FAIL |
| MUSIC_INTENT / RESOLVER / PLAYER_DISPATCH | V9 não alcançados na evidência da falha; sem diagnóstico especulativo |
| BACKGROUND_WAKE / LOCKED_SCREEN_WAKE | NÃO CERTIFICADOS |
| CONTINUOUS_VOICE_REAL_V9 | NÃO APROVADO |
| MICROPHONE_AT_SHUTDOWN | OFF confirmado; serviço encerrado |
| TTS_FREEZE | PRESERVADO; isso não equivale a aprovação acústica V9 |
| DATA_PRESERVED | YES: autenticação, conversa, 133 mensagens, rascunho, fontes e backups |
| FINAL_ANDROID_GATE | FAIL / NÃO LIBERAR |
| NEXT_ACTION | Somente após retomada: investigar foco com evidência de eventos antes de alterar código; depois repetir teste físico real. |

#### Preservação concluída — 15/10/2026, 02:11 America/Bahia

Pacote `tmp/elo-brain-native-20261014/preserved-elo-brain-sleep-20261015.zip` criado sem substituir arquivos anteriores: 297 entradas, 1.788.201 bytes, SHA256 `c15eba738ebfcf6b34bebfba7a5750b5908c9a2bc91f6cba70ee617dfc78c516`. Todas as entradas foram reabertas e conferidas por tamanho/SHA256 contra os bytes capturados das fontes. Manifesto de arquivos `sleep-source-manifest-20261015.json`; confirmação externa `preservation-sleep-20261015.json`, ambos no mesmo diretório. Inclui fontes novas e alteradas, scripts, testes, patch, evidências e a versão deste checkpoint imediatamente anterior a esta confirmação final. APKs/modelo/caches não foram duplicados; originais permanecem preservados. Disco livre após salvar: 1.294.503.936 bytes (~1,29 GB decimal). Nenhuma nova build, teste ou ativação de microfone após o pedido de encerramento.

### Checkpoint 9 — reteste físico parcial e correções de UX/transcrição — 15/10/2026

#### Evidência física mais recente

- Aparelho: Samsung SM-A042M; pacote `br.com.icaroamaral.elo`; versão instalada durante este teste: V9 `0.4.3-brain-native-v9`, versionCode 9. A sessão usou a correção de foco já instalada (APK Stage2, SHA256 `C79C93F35F480FCBED3CECC79DC23F51009912EF4E5CB52E53F81898127B826C`).
- O usuário confirmou: “Primeiro e segundo turnos passaram”. Registre B (primeira resposta) e C (segundo turno sem repetir ELO) como PASS informado pelo usuário. Os registros técnicos da sessão 59580951 mostravam wake, confirmação neural, reconhecimento pronto, processamento e fala da resposta; não houve evento `AUDIO_FOCUS_LOST`. A conversa contínua D e encerramento F não foram concluídos. O usuário disse que não consegue continuar agora; não presumir resultados de D/F.
- Defeito 1 observado: após tocar “Ativar chamado ELO”, a mudança visual do botão/status demora. Corrigido no fonte JS para exibir de imediato “Ativando chamado ELO…”, marcar `aria-busy` e impedir clique duplicado durante a ativação. Isso corrige o feedback visual; não afirma que o serviço nativo passa a iniciar mais rápido.
- Defeito 2 observado: a frase falada “Qual é a capital da Bahia?” apareceu como “a capital da bahia”. O usuário não soube confirmar se o rótulo temporário também omitia o começo. Fonte Kotlin agora recupera um prefixo interrogativo somente quando uma hipótese parcial/alternativa da mesma fala contém esse prefixo e o resultado final corresponde exatamente ao sufixo; não inventa palavras. A UI conserva o resultado final contra callbacks parciais atrasados. Sem build/reteste, a correção ainda não está validada no aparelho.
- O monitor técnico `ELO_AUDIO_FOCUS` da janela posterior aos testes ficou vazio (0 bytes); não contém transcrições. O processo de monitor já encerrou. Os metadados anteriores também não identificam o pacote externo que possa solicitar foco: o callback Android disponível não informa esse requester.

#### Código e verificação local

- Alterações candidatas estão em `android-native-wake-20261014/app/src/main/assets/elo-native-brain.js` e `android-native-wake-20261014/app/src/main/java/br/com/icaroamaral/elo/EloConversationRecognizer.kt`; novos testes em `android-native-wake-20261014/app/src/test/kotlin/br/com/icaroamaral/elo/EloConversationTranscriptTest.kt`.
- `node --check` e `git diff --check` passaram. Compilação Kotlin manual e JUnit da nova classe passaram: 3/3 (`OK (3 tests)`). Os testes focais anteriores de coordenador (35) e contratos/cache TTS (23) já haviam passado antes desta correção de texto.
- Build Gradle e execução Gradle completa continuam bloqueados porque o daemon não consegue abrir conexão de loopback neste ambiente; tentativas com wrapper, Gradle local e `--no-daemon` falharam inclusive para um projeto probe. Nenhuma build recente foi instalada. Não instalar a candidata Stage3 anterior: ela não contém as correções de botão/transcrição.
- Código de foco já instalado mantém a saída neural como única etapa que requisita foco e o libera antes da captura Android STT. A avaliação mais precisa é: bug de coordenação interno — foco de saída mantido durante/na transição para o reconhecedor — removido no Stage2; gatilho externo original não identificado com o callback disponível. B/C passaram e nenhum evento de perda foi observado nessa sessão, mas D/F e reteste da candidata UX seguem pendentes.

#### Gates atuais

| Campo | Estado |
|---|---|
| BACKUP_INTEGRITY | PASS, ZIP preservado com 297 entradas; SHA256 `c15eba738ebfcf6b34bebfba7a5750b5908c9a2bc91f6cba70ee617dfc78c516` |
| WAKE_TO_BRAIN | PASS informado no fluxo físico que levou à primeira resposta; mudança visual lenta do botão corrigida apenas no fonte |
| ANDROID_RECOGNIZER | B/C processados e aprovados pelo usuário; transcrição omitiu “Qual é” |
| SECOND_TURN | PASS informado pelo usuário |
| CONTINUOUS_CONVERSATION | PENDENTE: D não executado |
| MUSIC_VOICE_REQUEST | PENDENTE: E não executado nesta sessão |
| END / DISABLE | PENDENTE: F não executado nesta sessão; log anterior mostra desativação explícita e serviço encerrado ao fim de B/C |
| BACKGROUND_WAKE / LOCKED_SCREEN_WAKE | NÃO CERTIFICADOS |
| ANDROID_BUILD | Stage2 de foco instalado; build candidata de UX/transcrição bloqueada por loopback do Gradle |
| DATA_PRESERVED | Nenhum clear/uninstall/reset executado. Autenticação e histórico com 133 mensagens estavam validados antes do teste; contagem pós-teste não foi reconsultada. Backups e fontes preservados. |
| FINAL_ANDROID_GATE | PARCIAL / NÃO LIBERAR |

#### Retomada

Ao retornar, não repetir investigação já encerrada nem reinstalar versão antiga. Conferir conexão/estado do Samsung sem interromper o usuário. Viabilizar build assinada da fonte candidata, comparar assinatura/versão e instalar apenas preservando dados; retestar a correção do prefixo e feedback do botão. Depois concluir D, E e F e só então a certificação minimizado/tela bloqueada. Atualizar os gates conforme evidência real. Nenhum merge/deploy/release foi feito.

### Checkpoint 10 — Gradle desbloqueado e APK corretivo pronto — 15/10/2026, America/Bahia

Esta seção substitui o bloqueio de build do Checkpoint 9. O usuário pediu resolver o Gradle e deixar o APK pronto; fará os testes físicos depois. Nenhum comando foi enviado ao Samsung nesta etapa e a candidata ainda não foi instalada.

#### Build e correção do ambiente

- O diagnóstico isolado reproduziu a falha do pipe/selector do JDK. O log anterior mostrava `UnixDomainSockets.connect0: Invalid argument`; a execução restrita também negava a conexão TCP local utilizada pelo fallback. Com `jdk.net.unixdomain.tmpdir` apontando para o diretório longo do build, IPv4 e permissão para loopback fora do sandbox restrito, `Selector.open()` e `Pipe.open()` passaram.
- O helper `android-native-wake-20261014/tools/build-native.ps1` foi executado com o WorkRoot existente `tmp/elo-brain-native-20261014/android-audio-focus-fix-20261015`. As opções do JDK se aplicaram apenas ao processo e seus filhos; nenhuma configuração global de Java, firewall ou rede foi alterada. `GIT_CONFIG_*` temporário permitiu registrar corretamente o HEAD no BuildConfig, sem alterar configuração Git global.
- Gradle 8.10.2 / JDK 17.0.20.101: **BUILD SUCCESSFUL**, 2m53s, 43 tarefas (17 executadas, 26 atualizadas). Log: `tmp/elo-brain-native-20261014/native-build-20261015T235620519.log`.
- Testes Android via Gradle: **68/68 PASS**, incluindo os três casos de preservação do início interrogativo. Testes Web do canal nativo: **27/27 PASS**, incluindo feedback imediato da ativação, rejeição de clique duplicado, recuperação do botão após falha e proteção do resultado final contra parcial atrasado. Os hashes das seis funções TTS congeladas e o perfil neural nativo passaram nesse mesmo arquivo de testes. Sintaxe JS/PowerShell e `git diff --check` passaram.

#### APK pronto para atualização preservadora

- Arquivo: `tmp/elo-brain-native-20261014/elo-brain-v9-button-transcription-20261015.apk`.
- Tamanho: 320.192.105 bytes. SHA256: `292e7318f2e7975b76ea06ed898776d2489b45122ba7040498a18c9f98bbacd7`; sidecar `.apk.sha256` salvo.
- Pacote: `br.com.icaroamaral.elo`; versionCode **9**; versão `0.4.3-brain-native-v9`; adaptador **20261015-native-brain-v5**. BuildConfig contém HEAD `edee4b9b4505`.
- Assinatura verificada pelo apksigner; certificado SHA256 `8442425d1b3d0c5d5f241276d5efc570b01bcfbd2387103d46c04909f87fba52`, igual ao APK Stage2 preservado do aparelho. Mesmo pacote e versionCode, sem downgrade; a futura instalação deve ser atualização preservadora (`adb install -r`), com estado e sessão conferidos no momento.
- O adaptador empacotado coincide por hash com o fonte; contém o feedback “Ativando chamado ELO…” e a proteção da transcrição final. O DEX contém o helper `preserveQuestionOpening` e seu evento técnico. O helper recupera prefixos somente de hipóteses da mesma fala; precisão acústica ainda depende do teste físico.
- **65 entradas preexistentes de catálogo/mídias** e **15 arquivos do modelo** conferidos sem alteração; permissões iguais ao Stage2; fonte baseline sem alteração. Relatório completo: `tmp/elo-brain-native-20261014/apk-safety-20261015T235925977.json`. Manifesto da entrega: `tmp/elo-brain-native-20261014/elo-brain-v9-button-transcription-20261015.json`.
- APK Stage2 e backups anteriores preservados. O output Stage3 anterior também foi copiado antes da build para `tmp/elo-brain-native-20261014/elo-brain-v9-stage3-before-button-transcript.apk`, SHA256 `2811f44db0617152c2accca26df776c1d32d38cee6fe80e5733e468bfa1cef54`.
- Snapshot das fontes, testes, checkpoint e evidências desta candidata: `tmp/elo-brain-native-20261014/elo-brain-v9-button-transcription-sources-20261015.zip`; integridade registrada em `elo-brain-v9-button-transcription-preservation-20261015.json` no mesmo diretório. APK/modelos/mídias não são duplicados no ZIP de fontes.

#### Estado para o próximo teste

`ANDROID_BUILD=PASS`; `APK_READY=YES`; `INSTALLED_ON_SAMSUNG=NO`; `DATA_PRESERVED=YES` (nenhum acesso ou modificação no aparelho nesta etapa); `TTS_FREEZE=PASS` local. B/C anteriores continuam PASS informado pelo usuário. A candidata v5 precisa ser instalada e testada para conferir feedback do botão e frase completa, depois D/E/F e testes minimizado/tela bloqueada. `FINAL_ANDROID_GATE=PARTIAL / PHYSICAL_TEST_PENDING`. Nenhum merge/deploy/release.

### Checkpoint 11 — candidata corrigida instalada no Samsung com sessão e histórico preservados — 15/10/2026

O usuário autorizou expressamente instalar o APK corrigido preservando autenticação e histórico e realizará os testes depois. Esta seção substitui `INSTALLED_ON_SAMSUNG=NO` do Checkpoint 10.

- Atualização no Samsung SM-A042M, serial `SAMSUNG_DEVICE_01`, realizada com `adb install -r --streaming`: **Success**. Nenhuma desinstalação, limpeza de dados ou reset. Android registrou lastUpdateTime **15/10/2026 21:08:26 America/Bahia**.
- APK efetivamente instalado conferido por SHA256 no aparelho: `292e7318f2e7975b76ea06ed898776d2489b45122ba7040498a18c9f98bbacd7`, exatamente igual à candidata verificada. Pacote `br.com.icaroamaral.elo`, versionCode 9, versão `0.4.3-brain-native-v9`; assinatura compatível já conferida. UID **10240**, inode do diretório de dados **601715** e firstInstallTime original permaneceram iguais.
- **Autenticação e validação de sessão confirmadas antes e depois. Histórico: 135 mensagens antes e 135 depois**, mesma conversa por hash, mesmo hash do conteúdo normalizado das mensagens (`25a51a9f39549834cd7ddd5c619dadaee7a8dc0422a646063287bd628948f431`) e mesmo rascunho vazio. Nenhuma credencial ou conteúdo de mensagem foi exportado; somente indicadores e hashes foram registrados.
- Adaptador efetivamente carregado: **20261015-native-brain-v5**. Preview local correto reativado na WebView oficial com os fontes candidatos; autenticação e histórico foram conferidos após esse carregamento. Helper antigo PID 6008 encerrado antes da atualização; novo helper oculto PID **24036**, manifesto `android-preview-2026-10-16T00-09-36-749Z.json`. Stop-request e demais dados de controle estão em `tmp/elo-brain-native-20261014/button-transcription-install-verification.json`.
- **Microfone desligado**: `WAKE_DISABLED`, enabled=false, owner=NONE; serviço `EloWakeService` ausente e AppOps RECORD_AUDIO sem captura em execução. Não houve ativação de voz, fala sintética ou teste físico nesta instalação.
- Evidências no diretório `tmp/elo-brain-native-20261014/`: `button-transcription-install-before.json`, `button-transcription-install-after.json`, `button-transcription-install-preflight.json`, `button-transcription-install-result.log`, `button-transcription-install-package-after.json`, `button-transcription-install-audio-after.json` e `button-transcription-install-verification.json`. Este último consolida todas as comparações PASS. Fontes/APKs/backups anteriores mantidos.

`INSTALLED_ON_SAMSUNG=YES`; `AUTHENTICATION_PRESERVED=PASS`; `HISTORY_PRESERVED=PASS (135/135 + hashes idênticos)`; `DATA_PRESERVED=PASS`; `ADAPTER_LOADED=v5`; `MICROPHONE=OFF`; `PHYSICAL_VOICE_TESTS=PENDING_USER`; `FINAL_ANDROID_GATE=PARTIAL`.

Próximo passo: o usuário testar o feedback do botão e a transcrição completa quando estiver disponível; depois concluir D/E/F, minimizado e tela bloqueada. Antes de uma sessão futura, conferir o adaptador e o preview efetivamente carregados: o preview Web é temporário e deve ser reanexado após eventual reinício da WebView. Não ativar o microfone automaticamente. Nenhum merge/deploy/release.

### Checkpoint 12 — botão, transcrição e três turnos contínuos aprovados no Samsung — 15/10/2026, America/Bahia

Relato físico do usuário nesta conversa: **“o botão mudou na hora, a frase apareceu completa e os três turnos responderam sem repetir ELO.”** Evidência referente à candidata instalada e ao preview conferidos antes do teste: pacote `br.com.icaroamaral.elo`, V9 `0.4.3-brain-native-v9`, adaptador `20261015-native-brain-v5`, APK SHA256 `292e7318f2e7975b76ea06ed898776d2489b45122ba7040498a18c9f98bbacd7`.

| Verificação | Resultado |
|---|---|
| Feedback de “Ativar chamado ELO” | **PASS físico informado pelo usuário**: mudança imediata |
| Transcrição da pergunta completa, incluindo o início | **PASS físico informado pelo usuário** |
| Primeira resposta / wake para Brain | **PASS físico informado pelo usuário** |
| Segundo turno sem repetir ELO | **PASS físico informado pelo usuário** |
| Conversa contínua com app aberto (teste D) | **PASS físico informado pelo usuário: três turnos respondidos sem repetir ELO** |
| Encerramento, retorno ao detector e desativação completa (F) | **PENDENTE**: não confirmado neste relato |
| Música por texto/voz e faixa offline (E) | **PENDENTE** nesta candidata |
| Aplicativo minimizado / tela bloqueada | **NÃO CERTIFICADOS** |

O relato aprova esta amostra real de três turnos com app aberto. Não foi consultado novo trace nesta atualização; ausência de eventos técnicos `AUDIO_FOCUS_LOST`, ausência de duplicações e estado atual do microfone não foram confirmados separadamente. A contagem de 135 mensagens é a referência anterior ao teste; não representa uma nova leitura posterior aos três turnos. Autenticação e histórico haviam sido verificados e preservados na instalação.

Registro estruturado: `tmp/elo-brain-native-20261014/physical-v5-three-turns-result-20261015.json`. `ACTIVATION_FEEDBACK=PASS_REAL_USER`; `TRANSCRIPTION_COMPLETE=PASS_REAL_USER`; `SECOND_TURN=PASS_REAL_USER`; `CONTINUOUS_CONVERSATION=PASS_REAL_USER_3_TURNS_FOREGROUND`; `FINAL_ANDROID_GATE=PARTIAL` até concluir os testes restantes.

Próximo teste: F — encerrar a conversa pelo controle ELO, conferir retorno à espera por ELO, confirmar que uma pergunta sem a palavra de chamada não recebe resposta, despertar novamente com “ELO” e, ao final, desativar completamente. Depois concluir E e só então minimizado/tela bloqueada. Não reiniciar a investigação nem repetir build/reinstalação para os três itens aprovados.

### Checkpoint 13 — encerramento, retorno ao chamado e desativação aprovados — 15/10/2026, America/Bahia

Relato físico do usuário: **“voltou à espera, só respondeu após eu chamar ELO novamente e desativou corretamente.”** O teste F está **PASS físico informado pelo usuário**: fim da conversa, retorno ao detector, ausência de resposta à pergunta sem nova palavra de chamada, novo despertar com resposta e desativação completa.

A conferência técnica posterior também passou: `WAKE_DISABLED`, enabled=false, owner=NONE, motivo `SERVICE_DESTROYED`; `EloWakeService` ausente; AppOps RECORD_AUDIO sem captura em execução (última captura com duração finita). Evidência: `tmp/elo-brain-native-20261014/device-after-v5-end-disable-test-1792110173346.json`. Sessão autenticada e validada, mesma conversa por hash, 157 mensagens visíveis e rascunho vazio nesta leitura; a contagem aumentou com os testes e não substitui a comparação de preservação feita na instalação.

O preflight musical confirmou adaptador `20261015-native-brain-v5`, player `IDLE` e a faixa **Für Elise**, ID `beethoven-fur-elise`, marcada disponível offline e baixada no catálogo carregado. O catálogo contém 50 faixas com essas marcações; esta consulta de metadados não certifica a reprodução. Evidência: `tmp/elo-brain-native-20261014/physical-v5-music-preflight-20261015.json`. Nenhuma música foi iniciada automaticamente.

Registro consolidado de F: `tmp/elo-brain-native-20261014/physical-v5-end-disable-result-20261015.json`. Gates atuais: `RETURN_TO_WAKE=PASS_REAL_USER`; `WAKE_REQUIRED_AFTER_END=PASS_REAL_USER`; `REWAKE_AND_RESPONSE=PASS_REAL_USER`; `EXPLICIT_DISABLE=PASS_REAL_USER_AND_TECHNICAL`; `MICROPHONE_RELEASE=PASS_TECHNICAL`; `TEST_F=PASS`. Botão, transcrição e três turnos contínuos do Checkpoint 12 continuam aprovados.

Próximo teste E: pedir **“Toque Sultans of Swing” por texto**, conferir faixa e reprodução audível com avanço do player; pausar e repetir **por voz**, verificando separadamente a transcrição, a faixa resolvida e a reprodução; depois testar **Für Elise** pelo player com Wi-Fi/dados desligados, sem fechar/recarregar o ELO, e restaurar a conectividade ao terminar. A etapa sem rede verifica reprodução local pelo player; não exige STT/TTS neural offline. `MUSIC_TEXT_V5`, `MUSIC_VOICE_V5` e `OFFLINE_PLAYBACK_V5` permanecem **PENDENTES** até o relato/evidência desse teste. Minimizado e tela bloqueada continuam não certificados. `FINAL_ANDROID_GATE=PARTIAL`.

### Checkpoint 14 — música por texto, por voz e reprodução offline aprovadas — 15/10/2026, America/Bahia

Relato físico do usuário: **“Sultans of Swing tocou por texto e por voz, com transcrição correta, e Für Elise funcionou offline.”** Evidência referente à candidata V9 instalada, adaptador `20261015-native-brain-v5`, APK SHA256 `292e7318f2e7975b76ea06ed898776d2489b45122ba7040498a18c9f98bbacd7`.

| Verificação musical (teste E) | Resultado |
|---|---|
| Sultans of Swing solicitado por texto | **PASS físico informado pelo usuário: reprodução audível** |
| Transcrição de Sultans of Swing por voz | **PASS físico informado pelo usuário: transcrição correta** |
| Sultans of Swing solicitado por voz | **PASS físico informado pelo usuário: reprodução audível** |
| Für Elise sem rede | **PASS físico informado pelo usuário: reprodução offline** |

Esses resultados aprovam o fluxo real de intenção, resolução e reprodução para as solicitações testadas. Não houve nova medição automática da posição do player nesta atualização; a evidência acústica é o relato do usuário. O resultado offline refere-se à reprodução da faixa disponível localmente; não certifica STT/TTS neural sem rede. O teste E e os estados musicais pendentes do Checkpoint 13 ficam substituídos por estes PASS.

Registro estruturado: `tmp/elo-brain-native-20261014/physical-v5-music-result-20261015.json`. `MUSIC_TEXT_V5=PASS_REAL_USER`; `MUSIC_VOICE_V5=PASS_REAL_USER`; `MUSIC_STT_TRANSCRIPTION=PASS_REAL_USER_V9`; `SULTANS_OF_SWING_RESULT=TEXT_AND_VOICE_AUDIBLE_PASS_V9`; `OFFLINE_PLAYBACK_V5=PASS_REAL_USER_FUR_ELISE`; `TEST_E=PASS`. Os testes anteriores de botão, transcrição, conversa contínua e encerramento/desativação permanecem aprovados.

Próximo teste: **wake e conversa com o app minimizado, mantendo a tela acesa**. Restaurar Wi-Fi/dados e parar a música; ativar o chamado com o ELO visível e aguardar a espera; pressionar Home sem encerrar o app; aguardar 30 segundos na tela inicial; chamar ELO e fazer uma pergunta, depois outro turno sem repetir ELO, mantendo o app minimizado. Ao voltar ao ELO, conferir as duas perguntas e encerrar/desativar. Registrar despertar, respostas, transcrição e eventual suspensão separadamente. `BACKGROUND_WAKE=NOT_CERTIFIED`; `BACKGROUND_SECOND_TURN=NOT_CERTIFIED`; `LOCKED_SCREEN_WAKE=NOT_CERTIFIED`; `FINAL_ANDROID_GATE=PARTIAL` até os próximos testes reais. Nenhuma ativação de microfone ou reprodução foi feita automaticamente nesta atualização.

### Checkpoint 15 — despertar e dois turnos com app minimizado aprovados — 15/10/2026, America/Bahia

Relato físico do usuário: **“o ELO despertou e respondeu aos dois turnos com o app minimizado, sem repetir ELO.”** Resultado referente à candidata V9 instalada, adaptador `20261015-native-brain-v5`, APK SHA256 `292e7318f2e7975b76ea06ed898776d2489b45122ba7040498a18c9f98bbacd7`.

- **BACKGROUND_WAKE=PASS físico informado pelo usuário**: o ELO despertou enquanto o app permanecia minimizado.
- **BACKGROUND_SECOND_TURN=PASS físico informado pelo usuário**: os dois turnos receberam resposta, sem repetir ELO entre eles e sem reabrir o app durante a conversa.
- O procedimento orientado mantinha a tela acesa e previa 30 segundos após pressionar Home. Nesta atualização não houve cronometração automática nem inspeção independente do estado da tela. O relato aprova a amostra testada; não certifica inatividade prolongada/Doze nem substitui o teste de tela bloqueada.
- Integridade da transcrição posterior, ausência de duplicações e desativação posterior a este teste não foram afirmadas separadamente pelo usuário nem verificadas por nova leitura técnica nesta atualização. Os PASS anteriores continuam válidos nos seus próprios testes.

Registro estruturado: `tmp/elo-brain-native-20261014/physical-v5-background-result-20261015.json`. `BACKGROUND_WAKE=PASS_REAL_USER`; `BACKGROUND_SECOND_TURN=PASS_REAL_USER`; `BACKGROUND_CONTINUOUS_VOICE=PASS_REAL_USER_2_TURNS`; `LOCKED_SCREEN_WAKE=NOT_CERTIFIED`; `LOCKED_SCREEN_SECOND_TURN=NOT_CERTIFIED`; `FINAL_ANDROID_GATE=PARTIAL`.

Próximo teste: **tela bloqueada**. Com internet ativa e música parada, ativar o chamado enquanto o ELO está visível e aguardar a espera. Ir à tela inicial, bloquear pelo botão lateral e aguardar um minuto. Sem desbloquear, chamar ELO e fazer uma pergunta; após a resposta, fazer um segundo turno sem repetir ELO e mantendo o aparelho bloqueado. Observar se houve despertar, confirmação e respostas audíveis, se a tela acendeu por conta própria ou se foi exigido desbloqueio. Ao final, desbloquear manualmente, conferir as duas mensagens no ELO e encerrar/desativar. Não registrar PASS antes do retorno físico do usuário. Nenhuma interação com o aparelho foi feita nesta atualização.

### Checkpoint 16 — tela bloqueada aprovada e certificação funcional da candidata concluída — 15/10/2026, America/Bahia

Relato físico do usuário: **“o ELO despertou e respondeu aos dois turnos com a tela bloqueada, sem repetir ELO nem desbloquear.”** `LOCKED_SCREEN_WAKE=PASS_REAL_USER` e `LOCKED_SCREEN_SECOND_TURN=PASS_REAL_USER`. O procedimento previa um minuto de espera após bloquear; a duração não foi cronometrada automaticamente. O usuário confirmou que não desbloqueou durante os turnos; não informou separadamente se o display acendeu sozinho. Registro: `tmp/elo-brain-native-20261014/physical-v5-locked-screen-result-20261015.json`.

#### Conferência final e encerramento técnico

- A primeira leitura encontrou a sessão ainda ativa após o teste, com a página oculta. Para encerrar os testes e liberar recursos foi usado exclusivamente o comando oficial `EloNativeBridge.setWakeEnabled(false)`, aceito pelo aplicativo. Nenhum desbloqueio ou ativação de voz foi executado pelo agente.
- Encerramento confirmado por três fontes: `isWakeEnabled()=false` no bridge nativo; `EloWakeService` ausente; AppOps RECORD_AUDIO sem captura em execução. O snapshot JS da página oculta ainda mostrava o último estado `PROCESSING`; ele não foi usado como prova do estado atual dos recursos nativos. Evidências: `certification-v5-final-disable-20261015.json` e `certification-v5-final-audio-20261015.json`, no diretório de artefatos.
- Sessão autenticada e validada, mesma conversa por hash e rascunho vazio. As **135 mensagens originais** foram novamente conferidas como prefixo do histórico: hash `25a51a9f39549834cd7ddd5c619dadaee7a8dc0422a646063287bd628948f431`, idêntico ao anterior à instalação. A página oculta continha 187 mensagens no DOM, uma leitura de UI que não foi tratada como contagem canônica atual dos turnos em background. Nenhuma credencial ou conteúdo de mensagem foi exportado. Evidência: `certification-v5-final-session-20261015.json`.
- Fontes da candidata e os **13 assets Web do preview testado** conferidos sem alterações desde a build/preparação. Mantidos os resultados **68/68 Android** e **27/27 Web**, incluindo congelamento das seis funções TTS e perfil neural nativo; nenhuma repetição de suíte ou nova build foi necessária.
- Integridade revalidada dos dois pacotes preservados: ZIP original de 297 entradas, SHA256 `c15eba738ebfcf6b34bebfba7a5750b5908c9a2bc91f6cba70ee617dfc78c516`; fontes da candidata de 101 entradas, SHA256 `3799792db922bb8ad39f9a1b3b022735b58d9ac7b203134b436cada1de1efa1f`. APKs, fontes e backups anteriores mantidos.

#### Resultado e alcance da aprovação

**A matriz funcional prevista está concluída para a configuração testada neste Samsung: APK V9 corrigido + fontes Web candidatas no preview local.** A–F, feedback do botão, transcrição completa, três turnos com app aberto, música por texto/voz, reprodução offline, dois turnos minimizado e dois turnos bloqueado receberam PASS físico informado pelo usuário. A auditoria final passou em 19 verificações. Relatório consolidado: `tmp/elo-brain-native-20261014/certification-v5-samsung-final-20261015.json`.

`FINAL_ANDROID_GATE=PASS_SCOPED_TO_APK_AND_LOCAL_PREVIEW`. **Não restam testes funcionais pendentes na matriz combinada para essa configuração.** A aprovação não equivale a uma entrega autônoma sem o computador/preview nem a publicação em produção. Para fechar a entrega definitiva, falta integrar os 13 fontes Web candidatos no destino de entrega e validar a mesma configuração sem depender do preview local. Nenhum merge/deploy/publicação foi autorizado ou executado. Inatividade prolongada/Doze e outros aparelhos não foram certificados por esses testes curtos.

Pacote de comprovantes finais (sem duplicar APKs/mídias): `tmp/elo-brain-native-20261014/certification-v5-samsung-evidence-20261015.zip`; integridade e manifesto em `certification-v5-samsung-evidence-preservation-20261015.json` no mesmo diretório.

#### Relatório final da missão

| Campo | Resultado |
|---|---|
| WORKSPACE | `C:\Users\Wia Engenharia\Documents\ChatGPT\SaaS Inspeção Técnica\ELO-premium-release-20261014` |
| BRANCH | `codex/elo-premium-release-20261014` |
| HEAD | `edee4b9b4505cfd98afca405ad3db53feb6ae5ab` |
| CHECKPOINT_RECOVERED | YES |
| BACKUP_INTEGRITY | PASS: pacotes original e candidato revalidados por SHA256 |
| AUDIO_FOCUS_ROOT_CAUSE | Defeito interno de coordenação: foco de saída mantido na transição para captura Android STT; correção já instalada e validada pelos cenários físicos |
| AUDIO_FOCUS_TRIGGER | Solicitante externo original não identificado pelo callback disponível; não foi feita nova auditoria completa de trace nesta atualização |
| FIX_IMPLEMENTED | YES: foco, feedback imediato do botão e preservação da transcrição na candidata instalada |
| WAKE_TO_BRAIN | PASS_REAL_USER |
| ANDROID_RECOGNIZER | PASS_REAL_USER; transcrição completa e turnos processados |
| SECOND_TURN | PASS_REAL_USER em foreground, minimizado e bloqueado |
| CONTINUOUS_CONVERSATION | PASS_REAL_USER: 3 turnos foreground; 2 minimizado; 2 bloqueado |
| MUSIC_VOICE_REQUEST | PASS_REAL_USER: Sultans of Swing, transcrição correta e reprodução audível |
| BACKGROUND_WAKE | PASS_REAL_USER |
| LOCKED_SCREEN_WAKE | PASS_REAL_USER, sem desbloquear |
| TTS_FREEZE | PASS: funções e perfil preservados |
| ANDROID_BUILD | PASS; APK SHA256 `292e7318f2e7975b76ea06ed898776d2489b45122ba7040498a18c9f98bbacd7`, instalado; adaptador v5 |
| ANDROID_PHYSICAL_TEST | PASS para a matriz funcional da candidata no Samsung |
| DATA_PRESERVED | PASS: autenticação, mesma conversa e 135 mensagens originais por hash; microfone e serviço encerrados |
| REGRESSION_TESTS | PASS: 68 Android + 27 Web, fontes testadas sem alteração |
| FINAL_ANDROID_GATE | PASS_SCOPED_TO_APK_AND_LOCAL_PREVIEW |
| CHECKPOINT_UPDATED | YES, seção 16 e comprovantes finais |
| NEXT_ACTION | Preparar a entrega definitiva dos fontes candidatos e validar sem preview local; publicação depende de autorização específica |


## Checkpoint 17 — fechamento final Android — 15/10/2026

- Escopo: contexto, escuta, música bloqueada, controles HTML e interface embutida, preservando autenticação e histórico.
- Checkout de trabalho: ELO-brain-final-20261015. A candidata anterior ELO-premium-release-20261014 permanece preservada.
- Auditoria física de contexto: relação, nome e brincadeira chegaram ao request; “E ela?” pediu identificação apesar das 12 mensagens enviadas. Demais perguntas com nome e grafia próxima funcionaram. Outra conversa desconheceu Likelle. Zero POSTs de memória permanente no teste. A correção do prompt/compação do backend exige revisão e publicação antes de certificação física completa.
- Música: usuário pediu Galinha Pintadinha e ouviu música, depois erro do player e pausa. Callback do roteador levou 28,9 s, além do gateway de 25 s; timeout iniciou TTS e houve perda de foco. Correção observa avanço real em paralelo com resolução; sucesso retorna a aguardar ELO, sem TTS concorrente.
- Escuta: no-match rearmou repetidamente; teste de 60 s foi inconclusivo no relato. Código anterior encerrava após 30 s de silêncio/45 s de captura. Nova política recicla a captura e mantém a conversa até Encerrar/OFF, com geração e lease protegidos. Erros recuperáveis têm backoff limitado.
- Controles confirmados como BUTTON no WebView. Antes: dois botões com 24,4 px. Candidata: 50 px, ícones acessíveis, foco, carregamento imediato e bloqueio de clique duplo.
- Interface canônica embutida no APK, sob a origem oficial HTTPS. Nenhum localhost, servidor de PC ou segundo catálogo/player na arquitetura de produção.
- Preservação antes da instalação: autenticado/validado, conversa original com 212 mensagens; prefixo original de 135 com SHA-256 25a51a9f39549834cd7ddd5c619dadaee7a8dc0422a646063287bd628948f431 idêntico. Conteúdos e credenciais não exportados. Microfone desativado após a auditoria.
- APK instalado antes da rodada: v9, SHA-256 292e7318f2e7975b76ea06ed898776d2489b45122ba7040498a18c9f98bbacd7; package e ceDataInode preservados.
- Regressões iniciais: 51 testes Web/canal/contexto e 72 testes Gradle passaram. Não são evidência acústica. Contrato de cache apontou divergência de identificador, corrigida antes da instalação.
- Gates pendentes: conferir APK final; install -r; fotos portrait/landscape; 15 turnos físicos; música e controles bloqueados; regressões físicas; funcionamento standalone sem USB; revisão do backend. Não criar PR antes do gate físico.
- QA inicial: qa-artifacts/elo-brain-final-android-20261016T010258Z no checkout anterior, com dados técnicos sanitizados; incorporar à branch após fechar a coleta.


## Checkpoint 18 — consolidação, interrupção e renovação de sessão — 15/10/2026

- V10 instalado via atualização, SHA256 c43d4c5e9129d67ad6358c5c434ce59089413def7cf7be70bbe820749ad781ee. Autenticação, 212 mensagens e prefixo original de 135 conferidos depois da instalação; ceDataInode 601715 preservado. Nenhuma nova instalação nesta consolidação.
- Novo relato musical: não começou a tocar; depois anunciou “O player não respondeu, abra o ELO e tente novamente”. Estado observado bloqueado: BUFFERING, posição 0; gateway 75 s. Preservar separadamente a auditoria anterior com áudio iniciado e falso timeout/pausa. Não declarar música resolvida nem impossibilidade absoluta de áudio bloqueado.
- Usuário confirmou conversa com a tela apagada, seguida de parada. Trace: SESSION_EXPIRED às 23:07:56 Bahia, após 12 turnos chegarem ao processamento. Causa de expiração comprovada; não foi encerramento por silêncio. Serviço ausente na conferência final.
- Fonte novo: renovação canônica antecipada pelo canal privado, desafio e validação de mesma conta/tenant/projeto/conversa; recuperação não reativa OFF. Sem exportar refresh token. Falta validar atravessando o vencimento real.
- Espere/calma foi solicitado como interrupção; implementação aceita “espere” e “calma” isolados durante TTS usando Vosk local, lease exclusiva, AEC obrigatório e guarda de eco. Não abre SpeechRecognizer completo durante a fala. Sem AEC/vocabulário ou com ambas as palavras no próprio texto, mantém o botão. Ainda não instalado nem certificado acusticamente.
- “Pare de escutar”, “pare de ouvir”, “desliguei” e “desligue” desativam a escuta de conversa localmente. Primeiro trecho neural de até 160 caracteres para reduzir espera inicial; voz e perfil preservados. Ganho físico de latência pendente.
- Replay canônico restaurado; leitura não pula ao fim ao chegar mensagem; memória vetorial legada sem dono não é importada automaticamente para conta autenticada. Corrigido enquadramento dos controles, com 50 px nos testes locais e status/transcrição longos. Fotos v10 continuam evidência de falha, sem substituir por imagens simuladas.
- Testes: 91/91 nativos; 119/119 unidades/contratos Web; confirmação E2E 23/23 PASS. Reruns não são somados. Falha transitória anterior de viewport preservada; Stock PREEXISTING_VERIFIED na mesma configuração da main, produção intacta.
- Candidata fonte: versionCode 11, Web v2, worker v44 e adaptador v7. Compilação de testes passou; empacotamento/assinatura de novo APK aguarda margem de disco. Não instalar antes de contexto QA e demais gates solicitados.
- Backend QA/URL e liberação de espaço solicitados ao usuário. Sem deploy de produção, merge, push de main ou PR. Ver docs/elo-brain-final-v11-review.md e qa-artifacts/elo-brain-final-android-20261016T010258Z/13-final-report.md.

### Bloqueios confirmados pelo usuário nesta consolidação

O usuário informou que o backend de QA ainda não existe e que não consegue liberar espaço no C: agora. A compilação e os 91 testes nativos passaram; a confirmação Web passou em 23/23, além de 119 contratos/unidades. APK v11 não foi gerado nem instalado. V10 permanece instalado e seus dados preservados. Gates físicos e publicação continuam pendentes. Código e comprovantes foram preparados na branch autorizada; sem PR, push de main ou deploy de produção.
