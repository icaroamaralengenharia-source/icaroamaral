# ELO Brain — revisão da candidata v11

Esta candidata sucede o v10 instalado. O v10 permanece no Samsung; as mudanças descritas aqui ainda não foram instaladas. A instalação seguinte depende dos gates de QA definidos pelo usuário.

## Parada com a tela apagada

O trace do v10 registrou `SESSION_EXPIRED` às 02:07:56 UTC de 16/10/2026 (23:07:56 de 15/10 em Bahia), após 12 turnos terem chegado ao processamento. O serviço foi destruído em seguida. Isso não demonstra um limite de silêncio.

A candidata solicita renovação três minutos antes do vencimento. A função canônica Web renova a autenticação; somente o access token e o contexto delimitado retornam pelo canal privado. O refresh token continua no fluxo de autenticação existente. A renovação exige desafio de uso único, origem oficial, validação pelo backend e os mesmos usuário, instituição, empresa, projeto e conversa. Não troca o contexto durante um POST em andamento.

Se a conexão impedir a renovação a tempo, o serviço informa reconexão e suspende a captura até validar a sessão. Uma renovação tardia não reativa OFF nem uma suspensão manual e não reabre uma conversa encerrada. Uma sessão de conversa suspensa por expiração retoma a conversa; uma sessão que aguardava ELO retoma apenas o detector. Revogação da conta ou permissão não é tratada como silêncio recuperável.

## Interrupção por voz

Durante reprodução neural, o SpeechRecognizer de conversa continua fechado. O motor Vosk já incluído recebe uma lease exclusiva `INTERRUPT`, com gramática local limitada a “espere”, “calma” e desconhecido. Não cria segundo reconhecedor de conversa, não envia esse áudio e não salva transcrição.

O detector exige vocabulário disponível e AcousticEchoCanceler habilitado. Só aceita palavra isolada, confiança mínima de 0,90 e duração plausível. Uma palavra presente no texto que o ELO está falando é bloqueada como risco de eco; use a outra palavra. Se ambas estiverem no texto, ou o cancelamento de eco não estiver disponível, a interface oferece interrupção pelo botão.

Uma interrupção válida cancela a fala e os callbacks antigos, libera a captura local e abre o próximo turno sem exigir ELO. A proteção por geração e lease permanece em OFF, encerramento e troca de contexto. A eficácia acústica no Samsung ainda precisa ser verificada.

## Desativação explícita

Na escuta de conversa, frases completas como “pare de escutar”, “pare de ouvir”, “desliguei”, “desligue” e “desligue o ELO” desativam wake e captura sem chamar o backend. Os comandos anteriores continuam disponíveis. Encerrar conversa mantém o chamado ELO habilitado e retorna à espera; Desativar assistente entra em OFF.

Essas novas frases não são detector de fala durante TTS: nessa etapa, diga “espere” ou “calma”, aguarde a abertura do microfone e então mande parar de escutar.

## Demora para responder

O primeiro trecho de síntese passou a no máximo 160 caracteres; os seguintes têm no máximo 240. O texto inteiro e a ordem das palavras são preservados. Endpoint, voz, instruções neurais, reprodução e as seis funções Web congeladas permanecem iguais.

O cliente nativo registra tempos de leitura do histórico, gravação do usuário, geração da resposta e gravação do assistente, sem conteúdo ou credenciais. A requisição envia comprimento conhecido. Não encurta timeouts de processamento para produzir falsa sensação de rapidez. O ganho de tempo real precisa de medição na candidata instalada; tempo de modelo/rede continua dependente do backend.

## Música

Há dois resultados distintos, ambos preservados:

- Na auditoria anterior, Galinha Pintadinha foi audível e depois sofreu timeout falso e pausa. O callback levou 28,9 s, ultrapassando a janela de 25 s. A candidata observa estado e avanço real em paralelo ao resolver.
- No v10, o usuário não ouviu música. O gateway chegou ao timeout de 75 s; com a tela bloqueada, o player permaneceu BUFFERING e posição zero. O snapshot Web também ficou atrás do estado nativo. O contraste ao voltar ao app não foi concluído, pois o usuário passou a testar outras funções.

O segundo resultado não permite certificar a correção do primeiro. Não foi demonstrada incapacidade absoluta de tocar com a tela bloqueada, nem foi demonstrada reprodução confiável nesse estado.

A documentação do [player incorporado](https://developers.google.com/youtube/terms/required-minimum-functionality) exige visibilidade para iniciar autoplay; as [políticas do YouTube](https://developers.google.com/youtube/terms/developer-policies) restringem recursos de reprodução por um player em segundo plano. O objetivo de certificar YouTube com a tela apagada permanece bloqueado no contrato atual. Não há extractor, segundo player, Activity forçada ou falsificação de visibilidade nesta candidata.

## Interface, histórico e cache

Os controles HTML foram ajustados para retrato, paisagem e teclado, com alvos de 50 px, ícones, foco, aria, feedback imediato e guarda contra clique duplo. A foto do v10 mostrou corte em paisagem; a correção está apenas no fonte e nos testes locais.

O export de replay do histórico canônico foi restaurado. Mensagens novas e indicador de processamento respeitam a posição de quem está lendo. Registros locais legados sem proprietário autenticado não são enviados automaticamente para memória vetorial; o salvamento explícito existente continua separado.

Interface v2, worker v44 e metadados de empacotamento estão alinhados. A candidata usa versionCode 11; package e certificado permanecem os existentes. Os 14 assets serão conferidos contra o manifesto de hashes depois que houver APK v11.

## Gates restantes

O usuário confirmou que ainda não existe backend de QA e que não consegue liberar espaço no C: agora. Esses dois pré-requisitos impedem a geração/instalação e a certificação seguintes; o v10 permanece no Samsung.

- Disponibilizar e revisar o backend de contexto na superfície de QA usada pelo APK. Produção não foi publicada.
- Recuperar margem de disco suficiente para empacotar e assinar o APK seguinte; a compilação/teste sem empacotamento usa menos espaço.
- Resolver o contrato de música em segundo plano e confirmar áudio, progresso, pausa, continuar e pare por relato humano.
- Validar interrupção acústica, renovação atravessando a expiração, 15 turnos, silêncio, controles, TalkBack e regressões físicas.
- Validar execução com USB desconectado e sem preview.

Nenhum PASS acústico ou certificação final decorre de testes simulados. Sem PR, merge ou deploy de produção nesta etapa.
