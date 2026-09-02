# ELO Photo Bridge

MVP Android nativo e isolado para preparar relatorios SGTO/STELECOM a partir de fotos recentes do aparelho.

## Arquitetura

Fluxo do MVP:

1. comando do usuario;
2. parser local identifica tipo, cidade e data;
3. `MediaStorePhotoRepository` consulta apenas fotos recentes;
4. EXIF/MediaStore definem data e GPS;
5. `AndroidGeocoderCityResolver` converte GPS em cidade quando possivel;
6. `VisitGrouper` agrupa por cidade, data e janela temporal configurada;
7. `SimplePhotoMetadataCache` reaproveita cidade/categoria ja resolvidas;
8. `EloPhotoBridgeAdapter` monta payload SGTO/STELECOM;
9. `MainActivity` abre WebView restrita a `https://www.icaroamaral.com.br/relatorio-stelecom/`;
10. payload selecionado e injetado por evento `elo-photo-bridge-payload` para revisao;
11. `SelectedPhotoJavascriptBridge` permite que a pagina confiavel leia somente as fotos candidatas selecionadas.

O gerador existente em `relatorio-stelecom/` nao foi alterado.

## Permissoes

- Android 13+: `READ_MEDIA_IMAGES`
- Android 10-12: `READ_EXTERNAL_STORAGE`
- Quando necessario para GPS original: `ACCESS_MEDIA_LOCATION`
- WebView: `INTERNET`

O app nao envia a galeria inteira. A busca e filtragem acontecem localmente e somente fotos candidatas entram no payload. A interface JS permite leitura apenas das URIs presentes no payload selecionado.

## Como abrir

Abra `android/elo-photo-bridge/` no Android Studio e sincronize o Gradle.

## Como gerar APK local

No Android Studio:

1. selecione o modulo `app`;
2. use `Build > Build Bundle(s) / APK(s) > Build APK(s)`;
3. instale o APK gerado em um celular Android 10+.

## Como testar o nucleo localmente

Na raiz do repositorio:

```powershell
node --test android/elo-photo-bridge/tests/elo-photo-bridge-core.test.mjs
```

Os testes usam fixtures falsas e nao acessam a galeria real.

## Comandos suportados no MVP

- `monte o sgto de Malhada de Pedras`
- `faca o stelecom de Tremedal`
- `monte o sgto da ultima visita`
- `prepare o relatorio da visita de hoje`

Se faltar GPS, cidade fica `UNKNOWN`. Se a data estiver ambigua, o payload deve ser revisado antes da geracao.

## Modo rapido SGTO_FAST_TIMELINE

O app agora oferece dois caminhos na tela inicial:

- `ORGANIZAR RÁPIDO`: busca a visita, ordena as fotos por horario e permite marcar os inicios de Tomadas, Rack, Mastro/Antena e Caixa Fundo Madeira. Cameras ja comeca na primeira foto.
- `CLASSIFICAR COM IA`: preserva o fluxo visual automatico existente.

No modo rapido, o payload final usa as mesmas secoes consumidas pelo relatorio (`cameras`, `tomadas`, `rack`, `mastroAntena`, `caixaFundoMadeira`, `unknown`) e marca as fotos com `classification.source = SGTO_FAST_TIMELINE`. A classificacao principal nao chama `/api/ai/analyze-image`.

Os cortes persistidos sao: `timelinePhotoIds`, `cameraStartIndex`, `tomadasStartIndex`, `rackStartIndex`, `mastroStartIndex`, `caixaStartIndex` e `timelineManualCategoriesJson`. Ao atualizar, se os IDs das fotos mudarem, a tela avisa para revisar os cortes.

## Janela horaria como autoridade

Correção de estado/cascata de filtros:

- `ALL_MEDIA` fica fora do fluxo de classificação.
- `DATE_PHOTOS` vem de `MediaStorePhotoRepository.photosForDate`.
- `TIME_WINDOW_PHOTOS` é calculado por `UserVisitWindowFilter.filterPhotosByUserWindow` usando timezone local do aparelho.
- Se o usuário informou data + início + fim, a janela vira a visita: `VisitGrouper` é bypassado.
- `FAST_TIMELINE` e `AI_CLASSIFICATION` são modos explícitos e excludentes.
- Ao tocar `ORGANIZAR RÁPIDO`, qualquer job ativo é cancelado e a IA fica bloqueada pelo guard de modo.
- Ao tocar `CLASSIFICAR COM IA`, o app seleciona a visita primeiro e pergunta quantas fotos serão analisadas antes de classificar.

Logs adicionados para auditoria física:

- `MEDIASTORE_TOTAL_MATCHES_DATE`
- `PHOTOS_AFTER_DATE_FILTER`
- `TIME_FILTER_START`
- `TIME_FILTER_END`
- `PHOTOS_AFTER_TIME_FILTER`
- `PHOTOS_AFTER_CITY_HINT`
- `VISITGROUPER_BYPASS`
- `SELECTED_VISIT_PHOTOS`
- `PHOTOS_SENT_TO_TIMELINE`
- `PHOTOS_SENT_TO_AI`
- `AI_SKIPPED_MODE_FAST_TIMELINE`

A causa provável das 180 fotos era reentrada em fluxo de classificação por data/visitas candidatas depois de o usuário informar uma janela mais específica. Agora `findVisitGroups` centraliza a seleção e impede reampliação após o filtro de horário.
