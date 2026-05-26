# CHECKLIST DE TESTES - ObraReport

Data da validacao: 25/05/2026

Versao validada: SaaS premium inicial com dashboard, relatorios, IA inicial e planos demo.

## Resultado geral

Status: estavel para demonstracao local e continuidade do desenvolvimento.

A versao atual foi validada sem regressao bloqueante nos testes automatizados e nas verificacoes locais possiveis. Os testes que dependem de celular real, camera real ou envio externo pelo Apps Script ficaram marcados como manuais.

## Testes executados

| Item | Resultado | Observacao |
| --- | --- | --- |
| `npm install` frontend | Passou | Dependencias ja estavam atualizadas. |
| `npm run build` frontend | Passou | Build Vite gerado em `dist/relatorio-qualidade-obras`. |
| Avisos do build | Aceitavel | Vite avisou que scripts classicos nao sao empacotados como modulo; comportamento esperado neste projeto. |
| `npm install` backend IA | Passou | Dependencias atualizadas e sem vulnerabilidades reportadas. |
| `npm test` backend IA | Passou | 6 testes passaram. |
| Health backend IA | Passou | Coberto por teste automatizado. |
| Validacao action invalida IA | Passou | Coberto por teste automatizado. |
| Texto vazio IA | Passou | Coberto por teste automatizado. |
| Fallback sem chave de API | Passou | Backend retorna erro amigavel para fallback local. |
| Analise visual sem imagem | Passou | Backend exige imagem processada. |
| Analise visual sem chave | Passou | Backend retorna erro amigavel. |
| Modulos de planos | Passou | Teste isolado em Node validou Gratuito, Profissional e modo demo local. |
| Limite de clientes gratuito | Passou | Bloqueia ao atingir 2 clientes. |
| Limite de obras gratuito | Passou | Bloqueia ao atingir 2 obras. |
| Limite de relatorios gratuito | Passou | Bloqueia ao atingir 5 relatorios no mes. |
| Limite de IA gratuito | Passou | Bloqueia ao atingir limite configurado. |
| Limite de fotos gratuito | Passou | Bloqueia nova foto ao atingir 10 fotos por relatorio. |
| Substituicao de foto no limite | Passou | Permite substituir foto existente. |
| Plano Profissional | Passou | Clientes ilimitados e limite maior de fotos validado. |
| Dashboard local | Passou | Abriu sem erro no navegador. |
| Aba Planos | Passou | Exibe Gratuito, Profissional, Empresa e uso atual. |
| Troca de plano demo | Passou | Alternou para Profissional e voltou para Gratuito. |
| Historico de relatorios | Passou | Relatorio existente apareceu na lista. |
| Abertura de relatorio existente | Passou | Editor abriu via relatorio existente. |
| Superficie de IA texto no editor | Passou | Botao "Melhorar com IA" visivel no editor. |
| Console do navegador | Passou | Sem erros capturados nas telas testadas. |

## Testes nao executados automaticamente

| Item | Motivo | Como testar manualmente |
| --- | --- | --- |
| Upload por camera real no celular | Depende do aparelho fisico e navegador mobile. | Abrir o site no celular, selecionar foto tirada pela camera, conferir preview e salvar. |
| Compressao real em foto pesada de celular | Depende de arquivo real grande. | Selecionar foto grande, confirmar mensagem "Imagem pronta para envio" e preview. |
| PDF real via Apps Script | Envia dados para Google Apps Script/Drive/e-mail. | Criar relatorio com uma foto e clicar em "Gerar relatorio"; confirmar PDF no Drive/e-mail. |
| Imagem aparecer no PDF final | Depende do teste real de PDF. | Abrir PDF gerado e conferir fotos gerais e inconformidades. |
| Dominio publico `www.icaroamaral.com.br` | Depende de publicacao/cache externo. | Publicar arquivos e abrir no celular/notebook fora do localhost. |
| Marca d'agua comercial no PDF gratuito | Ainda nao implementado visualmente no Apps Script. | Fase futura: aplicar marca d'agua quando `billing.pdfWatermark` for true. |
| Checkout real | Fora do escopo atual. | Fase futura com Stripe ou Mercado Pago. |

## Bugs encontrados

Nenhum bug bloqueante encontrado nesta rodada.

## Riscos atuais

- O PDF real depende do Apps Script publicado e das permissoes do Google Drive.
- O upload mobile precisa de teste final em celular real antes de uso em obra.
- A troca de plano e limites estao em modo demo/local, sem pagamento real.
- A marca d'agua do plano gratuito esta preparada na estrutura comercial, mas ainda nao aparece visualmente no PDF.
- O armazenamento local funciona, mas backup em Drive/GitHub deve continuar sendo feito ao fim de cada sessao importante.

## Evidencias

Screenshots salvos:

- `docs/screenshots/versao-estavel-saas-premium-inicial.png`
- `docs/screenshots/versao-estavel-editor-relatorio.png`
- `docs/screenshots/fase-comercial-1-planos.png`

## Proximo passo recomendado

Antes de novas funcionalidades, fazer um teste manual em celular:

1. Abrir o sistema pelo celular.
2. Entrar no SaaS.
3. Abrir um relatorio existente.
4. Tirar/anexar uma foto.
5. Conferir preview.
6. Salvar.
7. Gerar PDF real.
8. Abrir o PDF e confirmar fotos e textos.

Depois disso, a proxima fase recomendada e aplicar as regras comerciais no PDF, com marca d'agua no plano gratuito e sem alterar o fluxo de upload.
