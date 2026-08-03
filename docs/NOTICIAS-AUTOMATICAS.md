# Notícias Automáticas

## Arquitetura

A rota `/noticias/` é uma central estática independente com três abas: Dicas de Projeto, Notícias e Trabalho e Oportunidades. O arquivo `scripts/atualizar-noticias.mjs` consulta feeds públicos de notícias, normaliza itens, aplica filtro editorial, remove duplicados e grava somente `noticias/dados/noticias.json`.

O script `scripts/atualizar-conteudo-noticias.mjs` unifica a atualização de notícias e oportunidades. Ele reutiliza o coletor de notícias, tenta coletar oportunidades em fonte pública validada e não publica dicas automaticamente. Dicas ficam em `noticias/dados/dicas.json` e só aparecem quando `revisadoManualmente` é `true`.

O GitHub Actions executa o script uma vez por hora, testa antes da atualização e faz commit apenas quando `noticias/dados/noticias.json` ou `noticias/dados/oportunidades.json` muda.

## Arquivos criados

- `noticias/index.html`
- `noticias/noticias.css`
- `noticias/noticias.js`
- `noticias/dados/noticias.json`
- `noticias/dados/dicas.json`
- `noticias/dados/oportunidades.json`
- `scripts/atualizar-noticias.mjs`
- `scripts/atualizar-conteudo-noticias.mjs`
- `.github/workflows/atualizar-noticias.yml`
- `docs/NOTICIAS-AUTOMATICAS.md`
- `tests/atualizar-noticias.test.mjs`
- `tests/atualizar-conteudo-noticias.test.mjs`

## Execução local

```bash
node --check noticias/noticias.js
node --check scripts/atualizar-noticias.mjs
node --check scripts/atualizar-conteudo-noticias.mjs
node --test tests/atualizar-noticias.test.mjs
node --test tests/atualizar-conteudo-noticias.test.mjs
node scripts/atualizar-conteudo-noticias.mjs --dry-run
node scripts/atualizar-conteudo-noticias.mjs
```

## GitHub Actions

O workflow `Atualizar notícias` pode ser executado manualmente pela aba Actions do GitHub. A execução automática está agendada para `17 * * * *`, uma vez por hora, aproximadamente no minuto 17 em UTC.

## Fontes cadastradas

Notícias:

- CAU/BR: `https://caubr.gov.br/feed/`
- CBIC: `https://cbic.org.br/feed/`
- Agência Brasil: `https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml`

Oportunidades:

- PNCP: fonte pública priorizada pelo script unificador.

Para adicionar ou remover fonte, edite somente as constantes de fontes nos scripts e rode os testes. Use apenas RSS, Atom, JSON ou API pública validada.

## Como desligar

Remova ou desative o arquivo `.github/workflows/atualizar-noticias.yml`. A página estática continuará exibindo os últimos JSON publicados.

## Como reverter

Reverta os arquivos listados nesta documentação. Se houver commits automáticos futuros, reverta apenas as mudanças em `noticias/dados/noticias.json` e `noticias/dados/oportunidades.json`.

## Limitações

O parser XML é mínimo e limitado aos campos usados pela página: título, link, descrição, data e categoria. Fontes indisponíveis são ignoradas sem interromper toda a atualização. Se todas falharem, o JSON anterior é preservado.

As dicas são conteúdo manual conservador. Dicas não revisadas permanecem no JSON como rascunho e não aparecem na página.

## Política de conteúdo

A página não copia matérias completas. Ela mostra título, resumo curto extraído da própria fonte, data, fonte e link para a publicação original. As fontes devem ser revisadas periodicamente para confirmar disponibilidade, qualidade técnica e adequação editorial.
## Hunter Licitacoes

A aba `Hunter Licitacoes` usa somente a API publica de consulta do Portal Nacional de Contratacoes Publicas (PNCP), sem autenticacao e sem chamadas de escrita. O endpoint validado no OpenAPI oficial e:

- Documentacao: `https://pncp.gov.br/pncp-consulta/v3/api-docs`
- Consulta usada: `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao`

O coletor `scripts/atualizar-licitacoes.mjs` consulta publicacoes dos ultimos 7 dias, filtra processos ainda abertos, aplica regras deterministicas para engenharia, arquitetura, laudos, fiscalizacao, infraestrutura, tecnologia e SaaS, remove duplicados e grava somente `noticias/dados/licitacoes.json`.

Comandos locais:

```bash
node --check scripts/atualizar-licitacoes.mjs
node --check noticias/noticias.js
node --test tests/atualizar-licitacoes.test.mjs
node scripts/atualizar-licitacoes.mjs --dry-run
node scripts/atualizar-licitacoes.mjs
```

O workflow `Atualizar Hunter Licitacoes` fica em `.github/workflows/atualizar-licitacoes.yml`, preserva `workflow_dispatch` e roda em `0 11,19 * * *`, equivalente a 08:00 e 16:00 no horario de Brasilia. Ele testa antes da coleta e permite commit automatico apenas de `noticias/dados/licitacoes.json`, com a mensagem `chore: atualiza Hunter Licitacoes`.

Se o PNCP falhar, se o retorno nao for JSON ou se nenhum item compativel for encontrado, o JSON anterior e preservado e o workflow falha sem commitar lista vazia.
