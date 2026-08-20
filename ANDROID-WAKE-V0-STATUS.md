# ELO Android Wake V0 - Status

Marco validado em aparelho real, sem dados sensiveis.

## Dispositivo

- Samsung Galaxy A04

## Resultado do teste real

- APK instalado via ADB: PASS
- App aberto: PASS
- Microfone autorizado: PASS
- Wake com tela ligada: PASS
- Wake com tela bloqueada: PASS
- Foreground service: PASS
- Last Transcription apos wake: "Maria Betânia"

## Evidencia funcional

O usuario falou "ELO, Maria Betânia" com a tela bloqueada. Ao desbloquear, o app mostrou:

```text
Last Transcription: Maria Betânia
```

Conclusao: o servico permaneceu ativo e capturou a continuacao do comando apos o wake.

## APK debug

```text
app\build\outputs\apk\debug\app-debug.apk
```

## Data do teste

- 2026-08-20, America/Bahia
- Hora exata nao informada pelo usuario nesta etapa de congelamento.

## Proxima etapa

Conectar Last Transcription ao EloBridge/fluxo real do ELO.

## Veredito

ELO ANDROID WAKE V0: PASS REAL COM TELA BLOQUEADA.
