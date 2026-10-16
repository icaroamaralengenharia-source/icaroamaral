# Matriz física — estado honesto

Os PASSs históricos do checkpoint 16, na combinação v9 + preview, continuam preservados e não foram reiniciados. Não certificam automaticamente o v10 ou o fonte v11.

| Gate | Evidência desta rodada | Resultado |
|---|---|---|
| Música bloqueada, auditoria anterior | Galinha Pintadinha audível; callback 28,9 s; erro e pausa depois | FAIL: timeout falso |
| Música bloqueada no v10 | Usuário não ouviu música; erro após 75 s; BUFFERING, posição 0, WebView oculto | FAIL |
| Mesmo pedido ao abrir o app | Usuário passou a testar outra coisa | NOT_TESTED |
| Escuta prolongada v10 | Usuário confirmou continuidade, depois parada; 12 turnos chegaram ao processamento; SESSION_EXPIRED 23:07:56 Bahia | FAIL: expiração |
| Quinze turnos e 60 s de silêncio na nova versão | Fonte/testes locais, sem instalação | NOT_TESTED |
| Espere/calma com voz real e eco | Detector local preparado; não instalado | NOT_TESTED |
| Pare de escutar/desliguei | Fonte preparado; não instalado | NOT_TESTED |
| Latência no aparelho após patch | Primeiro trecho menor e medições preparadas; não instalado | NOT_TESTED |
| Botões do v10 | Fotos preservadas: retrato 57,5 px; paisagem com corte | FAIL: corrigido apenas no fonte |
| Controles do fonte v11 | 50 px, cinco dimensões, status/transcrição longos; teste local PASS | PHYSICAL_PENDING |
| TalkBack, player tocando/pausado e Foto Bridge | Sem novo teste físico completo | NOT_TESTED |
| Für Elise offline bloqueado | PASS antigo em outro escopo; gate bloqueado desta rodada ainda pendente | NOT_TESTED |
| Sem computador/USB | Não concluído nesta rodada | NOT_TESTED |

Não somar turnos livres, simulações ou reruns para declarar certificação de 15 turnos.
