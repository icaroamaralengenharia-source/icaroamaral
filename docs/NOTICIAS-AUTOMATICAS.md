# Notícias Automáticas

## Arquitetura

A rota `/noticias/` é uma página estática independente. O arquivo `scripts/atualizar-noticias.mjs` consulta feeds públicos, normaliza itens, aplica filtro editorial, remove duplicados e grava somente `noticias/dados/noticias.json`.

O GitHub Actions executa diariamente o script, testa antes da atualização e faz commit apenas quando o JSON muda.

## Arquivos criados

- `noticias/index.html`
- `noticias/noticias.css`
- `noticias/noticias.js`
- `noticias/dados/noticias.json`
- `scripts/atualizar-noticias.mjs`
- `.github/workflows/atualizar-noticias.yml`
- `docs/NOTICIAS-AUTOMATICAS.md`
- `tests/atualizar-noticias.test.mjs`

## Execução local

```bash
node --check scripts/atualizar-noticias.mjs
node --test tests/atualizar-noticias.test.mjs
node scripts/atualizar-noticias.mjs --dry-run
node scripts/atualizar-noticias.mjs
```

## GitHub Actions

O workflow `Atualizar notícias` pode ser executado manualmente pela aba Actions do GitHub. A execução automática está agendada para `12:00 UTC`, equivalente a aproximadamente `09:00` em Brasília/Bahia.

## Fontes cadastradas

- CAU/BR: `https://caubr.gov.br/feed/`
- CBIC: `https://cbic.org.br/feed/`
- Agência Brasil: `https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml`

Para adicionar ou remover fonte, edite somente a constante `FONTES` no script e rode os testes. Use apenas RSS, Atom ou JSON público validado.

## Como desligar

Remova ou desative o arquivo `.github/workflows/atualizar-noticias.yml`. A página estática continuará exibindo o último JSON publicado.

## Como reverter

Reverta os arquivos listados nesta documentação. Se houver commits automáticos futuros, reverta apenas as mudanças em `noticias/dados/noticias.json`.

## Limitações

O parser XML é mínimo e limitado aos campos usados pela página: título, link, descrição, data e categoria. Fontes indisponíveis são ignoradas sem interromper toda a atualização. Se todas falharem, o JSON anterior é preservado.

## Política de conteúdo

A página não copia matérias completas. Ela mostra título, resumo curto extraído da própria fonte, data, fonte e link para a publicação original. As fontes devem ser revisadas periodicamente para confirmar disponibilidade, qualidade técnica e adequação editorial.
