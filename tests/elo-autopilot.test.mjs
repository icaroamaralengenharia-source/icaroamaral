import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  antiCopyCheck,
  antiHallucinationCheck,
  assertPublicHttpUrl,
  classifyPauta,
  countIndependentSources,
  buildPostPage,
  buildSitemap,
  collectCandidates,
  enforceFactualGrounding,
  extractArticle,
  generateEditorialImage,
  groupPautas,
  isDuplicatePauta,
  rankPautas,
  prepareEditorialPost,
  publishPreparedEditorialPost,
  runAutopilot,
  safePostSlug,
  runFactualVerifier,
  selectSourcesForPauta,
  slugify,
  validateClaimsAgainstSources,
  validateLlmArticle,
  validateSourcePolicy,
} from "../scripts/elo-autopilot.mjs";

const now = new Date("2026-09-06T12:00:00.000Z");
process.env.OPENAI_API_KEY ||= "test-openai-key";
const config = {
  enabled: true,
  brand: "Amaral Engenharia",
  topics: ["engenharia civil", "arquitetura", "construcao", "BIM"],
  postsPerRun: 1,
  publishDefault: false,
  sources: [
    { name: "Fonte A", url: "https://fonte-a.example/feed.xml", type: "rss", quality: 0.9 },
    { name: "Fonte B", url: "https://fonte-b.example/feed.xml", type: "rss", quality: 0.8 },
  ],
  weights: { recency: 2, sourceCount: 3, topicRelevance: 3, keywordRepetition: 1, sourceQuality: 1, novelty: 2 },
  limits: { maxFeedBytes: 500000, maxHtmlBytes: 500000, maxRedirects: 2, timeoutMs: 5000, maxSourcesPerPost: 5, minSourcesForStrongPauta: 2 },
  llm: { modelEnv: "OPENAI_ELO_AUTOPILOT_MODEL", fallbackModelEnv: "OPENAI_MODEL" },
  image: { provider: "pollinations", width: 640, height: 360, model: "sana" },
  pricing: { inputPerMillion: null, outputPerMillion: null },
};

const feedA = `<?xml version="1.0"?><rss><channel>
<item><title>Construcao industrializada avanca em obras brasileiras</title><link>https://fonte-a.example/a</link><description>Engenharia civil, BIM e construcao industrializada ganham relevancia.</description><pubDate>Sat, 05 Sep 2026 10:00:00 -0300</pubDate></item>
</channel></rss>`;

const feedB = `<?xml version="1.0"?><rss><channel>
<item><title>Construcao industrializada avanca com BIM no Brasil</title><link>https://fonte-b.example/b</link><description>Engenharia civil, BIM e construcao industrializada ajudam equipes tecnicas.</description><pubDate>Sat, 05 Sep 2026 11:00:00 -0300</pubDate></item>
</channel></rss>`;

const articleHtml = `<!doctype html><html><head><title>Materia original</title><link rel="canonical" href="https://fonte-a.example/a"><meta name="author" content="Redacao"><meta property="article:published_time" content="2026-09-05T13:00:00Z"></head><body><main><article><h1>Materia original</h1><p>A construcao industrializada vem recebendo atencao por reduzir improvisos e aproximar projeto, orcamento e execucao.</p><p>Especialistas do setor indicam que BIM, planejamento e coordenacao tecnica ajudam construtoras a reduzir perdas no canteiro.</p><p>O tema interessa a engenheiros e arquitetos porque conecta produtividade, qualidade e controle de prazos em obras de diferentes portes.</p><p>Mesmo assim, fontes destacam que a implantacao exige projeto detalhado, fornecedores preparados e compatibilizacao antes da obra.</p></article></main></body></html>`;

const articleHtmlB = `<!doctype html><html><head><title>Materia complementar</title><link rel="canonical" href="https://fonte-b.example/b"><meta name="author" content="Equipe tecnica"><meta property="article:published_time" content="2026-09-05T14:00:00Z"></head><body><main><article><h1>Materia complementar</h1><p>O BIM apoia o planejamento da construcao industrializada ao organizar informacoes de arquitetura, engenharia e compras.</p><p>Equipes tecnicas usam modelos coordenados para revisar interferencias, prever etapas de execucao e melhorar a comunicacao entre projetistas e obra.</p><p>A fonte tambem destaca que padronizacao, documentacao e fornecedores preparados ajudam a tornar o processo mais consistente.</p><p>O tema segue conectado a produtividade, qualidade e controle tecnico em obras brasileiras.</p></article></main></body></html>`;

function response(body, { status = 200, contentType = "text/html", headers = {} } = {}) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[String(name).toLowerCase()] || (String(name).toLowerCase() === "content-type" ? contentType : null) },
    async arrayBuffer() { return buffer; },
    async json() { return JSON.parse(buffer.toString("utf8")); },
  };
}

const lookup = async () => [{ address: "93.184.216.34", family: 4 }];

test("ranking de tendencias prioriza pauta recente, relevante e multifonte", () => {
  const candidates = [
    { titulo: "Construcao industrializada avanca em obras brasileiras", resumo_feed: "BIM e engenharia civil", fonte: "A", url: "https://a.example/1", data: now.toISOString(), sourceQuality: 0.9 },
    { titulo: "BIM apoia construcao industrializada", resumo_feed: "arquitetura e construcao", fonte: "B", url: "https://b.example/1", data: now.toISOString(), sourceQuality: 0.8 },
    { titulo: "Evento cultural movimenta cidade", resumo_feed: "agenda local", fonte: "C", url: "https://c.example/1", data: now.toISOString(), sourceQuality: 0.7 },
  ];
  const ranked = rankPautas(groupPautas(candidates, config), config, [], now);
  assert.ok(ranked[0].score > ranked.at(-1).score);
});

test("dedupe URL na selecao de fontes", () => {
  const pauta = { items: [
    { fonte: "A", url: "https://a.example/x", sourceQuality: 0.9 },
    { fonte: "A", url: "https://a.example/x", sourceQuality: 0.8 },
  ] };
  assert.equal(selectSourcesForPauta(pauta).length, 1);
});

test("dedupe titulo e assunto contra historico", () => {
  const pauta = { titulo: "Construcao industrializada avanca no Brasil", keywords: ["construcao", "industrializada", "bim"] };
  assert.equal(isDuplicatePauta(pauta, [{ titulo: "Construcao industrializada ganha espaco no Brasil", tags: ["BIM"] }]), true);
});

test("parser RSS entra pelo coletor reaproveitado", async () => {
  const collected = await collectCandidates(config, {
    now,
    lookup,
    fetchImpl: async (url) => response(String(url).includes("fonte-a") ? feedA : feedB, { contentType: "application/rss+xml" }),
  });
  assert.equal(collected.candidates.length, 2);
});

test("validacao URL/SSRF bloqueia protocolos e redes privadas", async () => {
  await assert.rejects(() => assertPublicHttpUrl("file:///etc/passwd", { lookup }), /Protocolo/);
  await assert.rejects(() => assertPublicHttpUrl("http://127.0.0.1/x", { lookup }), /privado/);
  await assert.rejects(() => assertPublicHttpUrl("http://example.test/x", { lookup: async () => [{ address: "10.0.0.2", family: 4 }] }), /DNS privado/);
});

test("extracao de artigo real usa HTML principal", async () => {
  const article = await extractArticle({ url: "https://fonte-a.example/a", titulo: "Original", fonte: "Fonte A" }, {
    config,
    lookup,
    fetchImpl: async () => response(articleHtml),
  });
  assert.match(article.conteudo, /construcao industrializada/i);
  assert.equal(article.autor, "Redacao");
});

test("rejeicao de HTML invalido", async () => {
  await assert.rejects(() => extractArticle({ url: "https://fonte-a.example/a", titulo: "x", fonte: "A" }, {
    config,
    lookup,
    fetchImpl: async () => response("<html><body>curto</body></html>"),
  }), /conteudo principal/);
});

test("schema de resposta LLM", () => {
  const article = validateLlmArticle(fakeArticle());
  assert.equal(article.slug, "construcao-industrializada-e-bim");
});

test("artigo sem fontes = rejeitado", () => {
  const check = antiHallucinationCheck(validateLlmArticle(fakeArticle()), [], { titulo: "BIM", keywords: ["BIM"] });
  assert.equal(check.ok, false);
});

test("anti-copia rejeita frase longa identica", () => {
  const generated = validateLlmArticle(fakeArticle({
    conteudo: [{ subtitulo: "Contexto", paragrafos: ["A construcao industrializada vem recebendo atencao por reduzir improvisos e aproximar projeto orcamento e execucao em todo o setor."] }],
  }));
  const check = antiCopyCheck(generated, [{ conteudo: "A construcao industrializada vem recebendo atencao por reduzir improvisos e aproximar projeto orcamento e execucao em todo o setor." }]);
  assert.equal(check.ok, false);
});

test("slug seguro", () => {
  assert.equal(slugify("Construção Industrializada e BIM!"), "construcao-industrializada-e-bim");
  assert.throws(() => safePostSlug("../x"), /Slug/);
});

test("render do post escapa XSS", () => {
  const html = buildPostPage(postFixture({ titulo: "<script>alert(1)</script>" }));
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test("JSON-LD valido no HTML renderizado", () => {
  const html = buildPostPage(postFixture());
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match);
  const json = JSON.parse(match[1]);
  assert.equal(json["@type"], "Article");
});

test("sitemap inclui post sem duplicar", () => {
  const xml = buildSitemap([postFixture(), postFixture()]);
  assert.equal((xml.match(/construcao-industrializada-e-bim/g) || []).length, 1);
});

test("dry-run nao grava posts.json", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "autopilot-"));
  const configPath = path.join(dir, "config.json");
  await writeFixtureConfig(configPath);
  const report = await runAutopilot({ dryRun: true, configPath, now, lookup, log: () => {}, fetchImpl: fakePipelineFetch });
  assert.equal(report.post, "PASS");
  await assert.rejects(() => stat(path.join(dir, "novidades", "dados", "posts.json")));
  await rm(dir, { recursive: true, force: true });
});

test("publish false nao publica", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "autopilot-"));
  const configPath = path.join(dir, "config.json");
  await writeFixtureConfig(configPath);
  const report = await runAutopilot({ dryRun: false, publish: false, configPath, now, lookup, log: () => {}, fetchImpl: fakePipelineFetch });
  assert.equal(report.post, "PASS");
  assert.equal(report.publication, false);
  await rm(dir, { recursive: true, force: true });
});

test("imagem nao permite path traversal", async () => {
  await assert.rejects(() => generateEditorialImage({
    article: { ...validateLlmArticle(fakeArticle()), slug: "../fora" },
    config,
    fetchImpl: async () => response(Buffer.alloc(2048), { contentType: "image/jpeg" }),
  }), /Slug/);
});

test("fonte externa maliciosa e bloqueada", async () => {
  const bad = { ...config, sources: [{ name: "Bad", url: "http://localhost/feed.xml", type: "rss" }] };
  const collected = await collectCandidates(bad, { lookup, fetchImpl: async () => response(feedA), now });
  assert.equal(collected.candidates.length, 0);
  assert.equal(collected.stats.errors.length, 1);
});

test("artigo duplicado nao publica", () => {
  const ranked = rankPautas(groupPautas([{ titulo: "Construcao industrializada e BIM", resumo_feed: "engenharia civil", fonte: "A", url: "https://a.example/1", data: now.toISOString(), sourceQuality: 0.9 }], config), config, [{ titulo: "Construcao industrializada e BIM", tags: ["engenharia"] }], now);
  assert.equal(ranked[0].scoreParts.novelty, 0);
});


test("redirect seguro valida URL final", async () => {
  let calls = 0;
  const result = await extractArticle({ url: "https://fonte-a.example/redirect", titulo: "Original", fonte: "Fonte A" }, {
    config,
    lookup,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return response("", { status: 302, headers: { location: "https://fonte-a.example/a" } });
      return response(articleHtml);
    },
  });
  assert.equal(result.url, "https://fonte-a.example/a");
});

test("selecao de fontes respeita limite configurado", () => {
  const pauta = { items: Array.from({ length: 6 }, (_, index) => ({ fonte: `F${index}`, url: `https://f${index}.example/a`, sourceQuality: 0.8 })) };
  assert.equal(selectSourcesForPauta(pauta, 3).length, 3);
});

test("sitemap gerado e XML basico valido", () => {
  const xml = buildSitemap([postFixture()]);
  assert.match(xml, /^<\?xml version="1\.0"/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /https:\/\/www\.icaroamaral\.com\.br\/novidades\/posts\/construcao-industrializada-e-bim\//);
});
function fakeArticle(overrides = {}) {
  return {
    titulo: "Construcao industrializada e BIM",
    subtitulo: "Tecnologia e obra",
    resumo: "Uma sintese sobre como BIM e industrializacao aproximam projeto e canteiro.",
    conteudo: [
      { subtitulo: "Por que o tema importa", paragrafos: ["A industrializacao da construcao cresce porque reduz improvisos e exige projeto mais coordenado. O BIM aparece como base tecnica para integrar arquitetura, engenharia, custos e obra sem depender de decisao tardia no canteiro. Essa integracao ajuda equipes a comparar alternativas, revisar interferencias, antecipar compras e tomar decisoes com informacao rastreavel antes da execucao."] },
      { subtitulo: "O que observar", paragrafos: ["Para empresas pequenas, o caminho mais seguro e escolher processos repetitivos, padronizar informacoes e conferir fornecedores antes da execucao. A mudanca depende menos de promessa tecnologica e mais de rotina tecnica consistente. Quando o processo e documentado, a empresa consegue medir ganhos, corrigir gargalos e preservar qualidade sem transformar cada obra em um experimento improvisado."] },
    ],
    seoTitle: "Construcao industrializada e BIM",
    seoDescription: "Entenda como construcao industrializada e BIM podem melhorar planejamento, qualidade e controle tecnico nas obras.",
    slug: "construcao-industrializada-e-bim",
    categoria: "Tecnologia e construcao",
    tags: ["BIM", "engenharia civil", "construcao"],
    imagePrompt: "Ilustracao editorial de canteiro industrializado com modelos digitais BIM",
    claims: [
      { claim: "A construcao industrializada recebe atencao por reduzir improvisos e aproximar projeto, orcamento e execucao.", sourceIds: ["source_1"] },
      { claim: "BIM, planejamento e coordenacao tecnica ajudam construtoras a reduzir perdas no canteiro.", sourceIds: ["source_1"] },
    ],
    ...overrides,
  };
}

function postFixture(overrides = {}) {
  const article = validateLlmArticle(fakeArticle());
  return {
    id: "post-1",
    slug: article.slug,
    titulo: article.titulo,
    resumo: article.resumo,
    conteudo: article.conteudo,
    categoria: article.categoria,
    tags: article.tags,
    imagem: "./assets/posts/construcao-industrializada-e-bim.jpg",
    imagemAlt: "Ilustracao editorial",
    publicadoEm: now.toISOString(),
    criadoEm: now.toISOString(),
    fontes: [{ fonte: "Fonte A", tituloOriginal: "Original", url: "https://fonte-a.example/a" }],
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    ...overrides,
  };
}

async function writeFixtureConfig(configPath) {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config), "utf8");
}

async function fakePipelineFetch(url) {
  const target = String(url);
  if (target.includes("fonte-a.example/feed")) return response(feedA, { contentType: "application/rss+xml" });
  if (target.includes("fonte-b.example/feed")) return response(feedB, { contentType: "application/rss+xml" });
  if (target.includes("fonte-a.example/a")) return response(articleHtml);
  if (target.includes("fonte-b.example/b")) return response(articleHtmlB);
  if (target.includes("api.openai.com")) return response(JSON.stringify({ output_text: JSON.stringify(fakeArticle()), usage: { input_tokens: 1000, output_tokens: 500 } }), { contentType: "application/json" });
  if (target.includes("image.pollinations.ai")) return response(Buffer.alloc(2048, 1), { contentType: "image/jpeg", headers: { "x-model-used": "sana", "x-usage-total-tokens": "1" } });
  throw new Error(`URL inesperada: ${target}`);
}


test("prepare editorial usa dry-run e nao publica antes da confirmacao", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "autopilot-"));
  const configPath = path.join(dir, "config.json");
  await writeFixtureConfig(configPath);
  const draft = await prepareEditorialPost({ topic: "BIM", configPath, now, lookup, log: () => {}, fetchImpl: fakePipelineFetch });
  assert.equal(draft.report.post, "PASS");
  assert.equal(draft.report.publication, false);
  assert.equal(draft.topic, "BIM");
  await assert.rejects(() => stat(path.join(dir, "novidades", "dados", "posts.json")));
  await rm(dir, { recursive: true, force: true });
});

test("publishPreparedEditorialPost consome rascunho preparado e chama persistencia controlada", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "autopilot-publish-"));
  const imagePath = path.join(dir, "construcao-industrializada-e-bim.jpg");
  await writeFile(imagePath, Buffer.alloc(2048));
  const persisted = [];
  const result = await publishPreparedEditorialPost({
    draftId: "draft-1",
    topic: "BIM",
    imageAbsolutePath: imagePath,
    post: postFixture()
  }, {
    now,
    readPostsFn: async () => ({ atualizadoEm: null, posts: [] }),
    persistPostFn: async (post, previous, date) => persisted.push({ post, previous, date }),
    imageDir: path.join(dir, "final-images")
  });
  assert.equal(result.publication, true);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].post.slug, "construcao-industrializada-e-bim");
  await rm(dir, { recursive: true, force: true });
});

const fortalezaSource = {
  sourceId: "source_1",
  fonte: "CBIC",
  tituloOriginal: "CBIC realiza evento sobre sustentabilidade, inovacao e construcao em Fortaleza",
  url: "https://cbic.org.br/evento-fortaleza",
  conteudo: "A CBIC promove em Fortaleza um evento voltado a sustentabilidade, inovacao e construcao. A programacao reune representantes do setor para debater experiencias, iniciativas e a agenda da construcao civil. O texto informa local, realizacao e tema central do encontro.",
};

const workshopSource = {
  sourceId: "source_1",
  fonte: "CBIC",
  tituloOriginal: "Workshop de Negociacoes Coletivas",
  url: "https://cbic.org.br/workshop-negociacoes-coletivas",
  conteudo: "O Workshop de Negociacoes Coletivas sera realizado em Brasilia nos dias 10 e 11 de setembro. A atividade tera carga horaria de 12 horas, vagas limitadas e abordara temas como negociacao coletiva, estrategias sindicais e simulacao pratica.",
};

const leedSource = { sourceId: "source_1", fonte: "GBC", tituloOriginal: "Certificacao LEED", url: "https://gbc.example/leed", conteudo: "A certificacao LEED avalia criterios de sustentabilidade em edificacoes, incluindo energia, agua, materiais e qualidade ambiental interna." };
const aquaSource = { sourceId: "source_2", fonte: "Fundacao Vanzolini", tituloOriginal: "AQUA-HQE", url: "https://vanzolini.example/aqua", conteudo: "A certificacao AQUA-HQE organiza requisitos de desempenho ambiental para edificios, gestao do empreendimento e conforto dos usuarios." };
const sustainableSource = { sourceId: "source_3", fonte: "Agencia Setorial", tituloOriginal: "Construcao sustentavel", url: "https://setor.example/sustentavel", conteudo: "Construcao sustentavel envolve escolhas de projeto, materiais, operacao e gestao para reduzir impactos ao longo do ciclo de vida da edificacao." };

function groundedArticle(overrides = {}) {
  return validateLlmArticle(fakeArticle(overrides));
}

test("claim sem sourceId rejeita", () => {
  const article = groundedArticle({ claims: [{ claim: "O workshop tera carga horaria de 12 horas.", sourceIds: [] }] });
  const result = validateClaimsAgainstSources(article, [workshopSource]);
  assert.equal(result.ok, false);
  assert.equal(result.unsupportedClaims[0].reason, "missing_source_id");
});

test("sourceId inexistente rejeita", () => {
  const article = groundedArticle({ claims: [{ claim: "O workshop tera carga horaria de 12 horas.", sourceIds: ["source_x"] }] });
  const result = validateClaimsAgainstSources(article, [workshopSource]);
  assert.equal(result.ok, false);
  assert.equal(result.unsupportedClaims[0].reason, "invalid_source_id");
});

test("claim nao suportado rejeita conhecimento geral plausivel", () => {
  const article = groundedArticle({ claims: [{ claim: "O evento reduz carbono e economiza recursos nas obras participantes.", sourceIds: ["source_1"] }] });
  const result = validateClaimsAgainstSources(article, [fortalezaSource]);
  assert.equal(result.ok, false);
  assert.equal(result.unsupportedClaims[0].reason, "unsupported_by_text");
});

test("claim suportado passa", () => {
  const article = groundedArticle({ claims: [{ claim: "A CBIC promove em Fortaleza um evento voltado a sustentabilidade, inovacao e construcao.", sourceIds: ["source_1"] }] });
  const result = validateClaimsAgainstSources(article, [fortalezaSource]);
  assert.equal(result.ok, true);
});

test("segunda verificacao detecta extrapolacao", () => {
  const article = groundedArticle({ claims: [{ claim: "O evento coloca Fortaleza na rota global de cidades inteligentes e resilientes.", sourceIds: ["source_1"] }] });
  const result = runFactualVerifier(article, [fortalezaSource]);
  assert.equal(result.supported, false);
  assert.match(result.unsupportedClaims[0].claim, /cidades inteligentes/);
});

test("revisao automatica remove claim nao suportado", () => {
  const article = groundedArticle({
    conteudo: [{ subtitulo: "Fortaleza", paragrafos: ["A CBIC promove em Fortaleza um evento voltado a sustentabilidade, inovacao e construcao. O evento reduz carbono e gera economia de recursos para as cidades."] }],
    claims: [
      { claim: "A CBIC promove em Fortaleza um evento voltado a sustentabilidade, inovacao e construcao.", sourceIds: ["source_1"] },
      { claim: "O evento reduz carbono e gera economia de recursos para as cidades.", sourceIds: ["source_1"] },
    ],
  });
  const result = enforceFactualGrounding(article, [fortalezaSource]);
  assert.equal(result.ok, true);
  assert.equal(result.autoRevision, true);
  assert.doesNotMatch(JSON.stringify(result.article), /carbono|economia de recursos/);
});

test("segunda falha bloqueia publicacao", () => {
  const article = groundedArticle({ claims: [{ claim: "O evento reduz carbono.", sourceIds: ["source_1"] }] });
  const result = enforceFactualGrounding(article, [fortalezaSource], { allowAutoRevision: false });
  assert.equal(result.ok, false);
});

test("pauta event aceita 1 fonte", () => {
  const type = classifyPauta({ titulo: "Workshop de Negociacoes Coletivas", keywords: ["workshop", "vagas"] }, [workshopSource]);
  const policy = validateSourcePolicy(type, [workshopSource]);
  assert.equal(type, "event");
  assert.equal(policy.ok, true);
});

test("pauta trend exige multiplas fontes", () => {
  const type = classifyPauta({ titulo: "Tendencias de construcao verde", keywords: ["tendencias", "sustentabilidade"] }, [fortalezaSource]);
  const policy = validateSourcePolicy(type, [fortalezaSource]);
  assert.equal(type, "trend");
  assert.equal(policy.ok, false);
});

test("fontes duplicadas nao contam como independentes", () => {
  const duplicate = { ...fortalezaSource, sourceId: "source_2", url: "https://cbic.org.br/copia", tituloOriginal: fortalezaSource.tituloOriginal };
  assert.equal(countIndependentSources([fortalezaSource, duplicate]), 1);
  assert.equal(validateSourcePolicy("trend", [fortalezaSource, duplicate]).ok, false);
});

test("multifonte funciona com claims por fonte real", () => {
  const article = groundedArticle({
    claims: [
      { claim: "A certificacao LEED avalia criterios de sustentabilidade em edificacoes, incluindo energia, agua e materiais.", sourceIds: ["source_1"] },
      { claim: "A certificacao AQUA-HQE organiza requisitos de desempenho ambiental para edificios.", sourceIds: ["source_2"] },
      { claim: "Construcao sustentavel envolve escolhas de projeto, materiais, operacao e gestao.", sourceIds: ["source_3"] },
    ],
  });
  const result = validateClaimsAgainstSources(article, [leedSource, aquaSource, sustainableSource]);
  assert.equal(result.ok, true);
  assert.equal(result.supportedClaims.length, 3);
});

test("anti-copia continua funcionando com factual grounding", () => {
  const article = groundedArticle({ claims: [{ claim: "O Workshop de Negociacoes Coletivas tera carga horaria de 12 horas.", sourceIds: ["source_1"] }] });
  assert.equal(validateClaimsAgainstSources(article, [workshopSource]).ok, true);
  const copy = antiCopyCheck(article, [{ conteudo: article.conteudo[0].paragrafos[0] }]);
  assert.equal(copy.ok, false);
});

test("artigo vazio rejeita no schema", () => {
  assert.throws(() => validateLlmArticle(fakeArticle({ conteudo: [] })), /Artigo sem blocos/);
});

test("artigo sem fontes rejeita no factual grounding", () => {
  const result = enforceFactualGrounding(groundedArticle(), []);
  assert.equal(result.ok, false);
});

test("caso Fortaleza bloqueia extrapolacoes antigas", () => {
  const article = groundedArticle({
    claims: [
      { claim: "A CBIC promove em Fortaleza um evento voltado a sustentabilidade, inovacao e construcao.", sourceIds: ["source_1"] },
      { claim: "O evento discutira reducao de carbono, economia de recursos, cidades inteligentes, cidades resilientes e tendencias globais.", sourceIds: ["source_1"] },
    ],
  });
  const result = enforceFactualGrounding(article, [fortalezaSource]);
  assert.equal(result.ok, true);
  const output = JSON.stringify(result.article).toLowerCase();
  assert.doesNotMatch(output, /carbono|economia de recursos|cidades inteligentes|cidades resilientes|tendencias globais/);
});

test("caso Workshop positivo preserva fatos suportados com uma fonte", () => {
  const article = groundedArticle({
    claims: [
      { claim: "O Workshop de Negociacoes Coletivas sera realizado em Brasilia nos dias 10 e 11 de setembro.", sourceIds: ["source_1"] },
      { claim: "A atividade tera carga horaria de 12 horas, vagas limitadas e simulacao pratica.", sourceIds: ["source_1"] },
    ],
  });
  assert.equal(validateSourcePolicy(classifyPauta({ titulo: "Workshop de Negociacoes Coletivas" }, [workshopSource]), [workshopSource]).ok, true);
  assert.equal(enforceFactualGrounding(article, [workshopSource]).ok, true);
});
