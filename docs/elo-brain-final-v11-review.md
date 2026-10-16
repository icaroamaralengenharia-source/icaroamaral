# ELO Brain — revisão da candidata v11

A candidata v11 r2 foi instalada no Samsung em 16/10/2026 por atualização, após os gates de build, assinatura, assets e QA. Autenticação, mesma conversa, 236 mensagens e prefixo original de 135 foram preservados por hash. O backend de inferência usa QA; autenticação e histórico usam o serviço canônico. A certificação acústica desta versão permanece pendente.

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

Os controles HTML foram ajustados para retrato, paisagem e teclado, com alvos de 50 px, ícones, foco, aria, feedback imediato e guarda contra clique duplo. A foto do v10 mostrou corte em paisagem; a correção está incorporada no APK v11 r2 e passou nos testes locais; a confirmação física dos controles permanece pendente.

O export de replay do histórico canônico foi restaurado. Mensagens novas e indicador de processamento respeitam a posição de quem está lendo. Registros locais legados sem proprietário autenticado não são enviados automaticamente para memória vetorial; o salvamento explícito existente continua separado.

Interface v4, worker v46 e metadados de empacotamento estão alinhados. A candidata usa versionCode 11; package e certificado permanecem os existentes. Os 14 assets foram conferidos por SHA256 contra manifesto e fontes; catálogo e 52 mídias offline preservados. O runtime confirmou a revisão nova.

## QA e instalação concluídos

QA: [elo-brain-qa-v11-20261016](https://elo-brain-qa-v11-20261016.onrender.com), fonte backend `52eccdb187b0d67a05679fcfd9d7d4d23d82e670`. Inferência autenticada restrita à conta aprovada, sem segredos administrativos do banco e sem rotas de histórico/memória. Quatro cenários fictícios de contexto passaram no serviço real, incluindo “E ela?” e conversa nova isolada. Os tokens da sessão não foram exportados ou salvos pelo diagnóstico.

O endpoint Web de texto é resolvido no momento da requisição para aceitar a configuração nativa posterior ao carregamento da página. Voz e texto seguem ao QA exato; autenticação, histórico e demais rotas mantêm seu destino canônico. Há regressão específica para a ordem de inicialização.

A função Web real foi exercitada localmente com falha de rede e HTTP503: uma chamada ao chat de QA por caso, sem tentativa de inferência em produção. O cliente nativo mantém o destino QA por rota e propaga a falha. Access token somente no diagnóstico; refresh token não enviado ao QA, tokens da sessão não exibidos nem salvos. Não houve nova execução dos fixtures reais após a instrução do usuário.

APK final: `C:\Users\Wia Engenharia\Documents\ChatGPT\SaaS Inspeção Técnica\ELO-premium-release-20261014\tmp\elo-brain-native-20261014\elo-brain-final-v11-qa-20261016-r2.apk`; SHA256 `3b25a82295a47f5023256b208785262fd7bae3adedc27696977042f01e596d15`; fonte `95730100221921d8be5062aa2a833b6af7920c58`. Build final 4m11s, 92 testes nativos; lotes focados de 26 e 28 testes PASS, além dos 43 e 23 E2E da preparação. Reruns não são somados. Atualização e integridade instalada conferidas, ceDataInode 601715 e sessão preservados.

A primeira compilação e o primeiro v11 instalado foram sucedidos pela revisão r2 depois da auditoria do vínculo tardio do endpoint. A falha inicial de deploy, o 503 inicial e a resposta que inventava reação foram preservados com seus retestes. A orientação de pronome agora se limita a fatos explicitamente declarados.

Espaço foi recuperado sem apagar fontes/modelos/APKs únicos. Caches regeneráveis foram removidos, instalações de dependências com ambos os locks iguais foram compartilhadas e APKs antigos arquivados no Samsung por hash. Manifestos no diretório QA do Checkpoint 19; v10 para recuperação permanece no PC.

Mock Stock classificado `PREEXISTING_VERIFIED`: mesmo 15/16 e mesma falha na main 50452bc e candidata antes do ajuste de fixture; bridge de produção idêntico. Comprovante em `13-stock-mock-classification.json`.

O QA gratuito pode levar 50 segundos ou mais para acordar após inatividade. Esse primeiro pedido pode exceder a janela do cliente e exigir nova tentativa; não há medição de ganho físico de latência na candidata.

## Reteste físico e gates restantes

- Interrupção por uma das palavras “espere”/“calma”, nova pergunta sem ELO e “pare de escutar”: **PASS físico informado pelo usuário**, “PERFEITO, DEU TUDO CERTO”. A chamada estava ativa na leitura posterior porque o usuário confirmou que reativou para continuar. Não há medição de latência nem certificação individual das duas palavras.
- Quinze turnos, silêncio, erros recuperáveis e renovação atravessando a expiração real.
- Contexto na conversa pessoal e reabertura do mesmo histórico; isolamento de conversa nova.
- Controles em retrato/paisagem/teclado, TalkBack e áudio sem USB ou preview.
- Resolver o contrato de música em segundo plano e obter relato humano de áudio/progresso/pausa/continue/pare.

Uma captura DOM da configuração no Render expôs a chave OpenAI em saída privada de ferramenta apesar da máscara. Nenhum valor salvo em fontes, evidências ou APK. Usuário informado; rotação pendente de coordenação com o backend atual, sem mudanças de produção nesta etapa.

Nenhum PASS acústico ou certificação final decorre dos testes locais ou dos probes de QA. Sem PR, merge, push de main ou deploy de produção. Ver Checkpoint 19 e `qa-artifacts/elo-brain-v11-install-20261016/`.
