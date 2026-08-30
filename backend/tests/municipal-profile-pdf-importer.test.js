import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalProfilePdfImporter, hashMunicipalProfilePdf } from "../src/municipal-profile-pdf-importer.js";
import { createMunicipalProfileService } from "../src/municipal-profile-service.js";
import { extractMunicipalTextContent } from "../src/municipal-pdf-extractor.js";

const FIXTURE_TEXT = `
Prefeitura: Prefeitura Municipal de Teste
Unidade operacional obrigatoria: SIM
Acervo digital ativo: Não
Quantidade minima de estoque: 12
Percentual tolerado de divergencia: 7,5%
Faixa de saldo operacional: 2 - 8
Tipo de documento municipal: relatorio
Documento obrigatorio: talvez
minimo estoque: 20
documento relatorio: ativo
Linha sem mapeamento: dado solto
`;

function ctx(role = "platform_admin", overrides = {}) {
  return {
    ok: true,
    userId: overrides.userId || role + "-user",
    institutionId: "",
    role,
    profile: Object.assign({
      id: role + "-profile",
      auth_user_id: overrides.userId || role + "-user",
      institution_id: "",
      unit_id: null,
      role,
      status: "active",
      email: role + "@example.com"
    }, overrides.profile || {})
  };
}

function setup(text = FIXTURE_TEXT) {
  const store = createMemoryMunicipalAdminStore({
    municipal_profiles: [],
    municipal_profile_versions: [],
    municipal_profile_values: [],
    municipal_profile_imports: [],
    municipal_profile_import_rows: [],
    municipal_admin_audit_log: []
  });
  const importer = createMunicipalProfilePdfImporter({
    store,
    now: () => new Date("2026-03-10T12:00:00.000Z"),
    extractPdf: async () => extractMunicipalTextContent(text)
  });
  return { store, importer };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

function importBody(buffer = Buffer.from("pdf-controlado")) {
  return {
    buffer,
    fileName: "perfil-municipal.pdf",
    municipality: "Vitória da Conquista",
    state: "BA",
    profileType: "official",
    referenceDate: "2026-03-01",
    effectiveDate: "2026-04-01",
    importedBy: "auditor"
  };
}

test("calcula hash SHA-256 deterministico do PDF", () => {
  const buffer = Buffer.from("pdf-controlado");
  assert.equal(hashMunicipalProfilePdf(buffer), "70e7ca58a91d485fb6c783df00804bbd1e442e177ba3898a7c01e4e0fb5d4cbe");
});

test("extrator textual preserva paginas, linhas, tabelas e texto bruto", () => {
  const extracted = extractMunicipalTextContent("A: 1\n--- page 2 ---\nB | 2");
  assert.equal(extracted.pages.length, 2);
  assert.equal(extracted.rows.length, 2);
  assert.equal(extracted.tables.length, 1);
  assert.match(extracted.rawText, /A: 1/);
});

test("importa PDF para draft com rows, matches, normalizacao e fonte preservada", async () => {
  const { importer, store } = setup();
  const result = await importer.importPdfToDraft(ctx(), importBody());

  assert.equal(result.import.status, "draft_review");
  assert.equal(result.import.file_name, "perfil-municipal.pdf");
  assert.equal(result.version.status, "draft");
  assert.equal(result.version.source_hash, hashMunicipalProfilePdf(Buffer.from("pdf-controlado")));
  assert.equal(result.summary.rows, 11);
  assert.ok(result.summary.high >= 6);
  assert.ok(result.summary.medium >= 1);
  assert.ok(result.summary.low >= 1);
  assert.ok(result.summary.unmatched >= 1);
  assert.ok(result.rows.every((row) => row.page === 1));
  assert.ok(result.rows.every((row) => row.raw_text));
  assert.equal(store.tables.municipal_admin_audit_log.at(-1).action, "municipal_profile_import_created");
});

test("bloqueia duplicado na mesma cidade e alerta mesmo hash em cidade diferente", async () => {
  const { importer } = setup();
  const buffer = Buffer.from("mesmo-pdf");
  await importer.importPdfToDraft(ctx(), importBody(buffer));
  await rejectsCode(importer.importPdfToDraft(ctx(), importBody(buffer)), "municipal_profile_import_duplicate");

  const other = await importer.importPdfToDraft(ctx(), Object.assign(importBody(buffer), {
    municipality: "Salvador",
    fileName: "perfil-salvador.pdf"
  }));
  assert.deepEqual(other.warnings, ["same_hash_used_by_other_profile"]);
});

test("popular values somente para HIGH valido e manter MEDIUM/LOW/UNMATCHED em revisao", async () => {
  const { importer, store } = setup();
  const result = await importer.importPdfToDraft(ctx(), importBody());
  const rows = store.tables.municipal_profile_import_rows;
  const values = store.tables.municipal_profile_values;

  assert.ok(rows.some((row) => row.catalog_code_suggested === "MUN_ADM_002" && row.normalized_value_suggested === true && row.requires_review === false));
  assert.ok(rows.some((row) => row.catalog_code_suggested === "MUN_DOC_003" && row.normalized_value_suggested === false && row.requires_review === false));
  assert.ok(rows.some((row) => row.catalog_code_suggested === "MUN_INF_001" && row.normalized_value_suggested === 12));
  assert.ok(rows.some((row) => row.catalog_code_suggested === "MUN_FIS_003" && row.normalized_value_suggested === 7.5));
  assert.ok(rows.some((row) => row.catalog_code_suggested === "MUN_INF_003" && row.normalized_value_suggested.min === 2 && row.normalized_value_suggested.max === 8));
  assert.ok(rows.some((row) => row.catalog_code_suggested === "MUN_DOC_001" && row.normalized_value_suggested === "relatorio"));
  assert.ok(rows.some((row) => row.confidence === "MEDIUM" && row.requires_review === true));
  assert.ok(rows.some((row) => row.confidence === "LOW" && row.requires_review === true));
  assert.ok(rows.some((row) => row.confidence === "UNMATCHED" && row.requires_review === true));
  assert.ok(values.length < result.rows.filter((row) => row.catalog_code_suggested).length);
});

test("valor invalido exige revisao e duplicidade de catalog_code nao escolhe silenciosamente", async () => {
  const duplicateText = `
Unidade operacional obrigatoria: SIM
Unidade operacional obrigatoria: NÃO
Documento obrigatorio: talvez
`;
  const { importer, store } = setup(duplicateText);
  await importer.importPdfToDraft(ctx(), importBody(Buffer.from("pdf-duplicado")));
  const rows = store.tables.municipal_profile_import_rows;

  assert.equal(rows.filter((row) => row.catalog_code_suggested === "MUN_ADM_002" && row.duplicate_candidate).length, 2);
  assert.ok(rows.filter((row) => row.catalog_code_suggested === "MUN_ADM_002").every((row) => row.requires_review));
  assert.ok(rows.some((row) => row.catalog_code_suggested === "MUN_DOC_002" && row.normalized_value_suggested === null && row.requires_review));
  assert.equal(store.tables.municipal_profile_values.length, 0);
});

test("parser SIM/NAO aceita variacoes e deixa X ambiguo para revisao", async () => {
  const text = `
Unidade operacional obrigatoria: Sim
Acervo digital ativo: nao
Relatorio obrigatorio: X
`;
  const { importer, store } = setup(text);
  await importer.importPdfToDraft(ctx(), importBody(Buffer.from("pdf-boolean")));
  const rows = store.tables.municipal_profile_import_rows;

  assert.ok(rows.some((row) => row.catalog_code_suggested === "MUN_ADM_002" && row.normalized_value_suggested === true));
  assert.ok(rows.some((row) => row.catalog_code_suggested === "MUN_DOC_003" && row.normalized_value_suggested === false));
  assert.ok(rows.some((row) => row.catalog_code_suggested === "MUN_DOC_002" && row.normalized_value_suggested === null && row.requires_review));
});

test("import cria draft sem alterar versao active existente", async () => {
  const { importer, store } = setup("Unidade operacional obrigatoria: SIM");
  const profileService = createMunicipalProfileService({ store, now: () => new Date("2026-03-01T00:00:00.000Z") });
  const { profile } = await profileService.createMunicipalProfile(ctx(), {
    municipality: "Vitória da Conquista",
    state: "BA",
    profileType: "official"
  });
  const activeDraft = await profileService.createMunicipalProfileVersion(ctx(), profile.id, { source_hash: "hash-active" });
  await profileService.setMunicipalProfileValue(ctx(), activeDraft.version.id, { catalog_code: "MUN_DOC_002", raw_value: "SIM" });
  await profileService.activateMunicipalProfileVersion(ctx(), activeDraft.version.id);

  await importer.importPdfToDraft(ctx(), importBody(Buffer.from("pdf-novo")));
  const versions = store.tables.municipal_profile_versions;
  assert.equal(versions.filter((version) => version.status === "active").length, 1);
  assert.equal(versions.filter((version) => version.status === "draft").length, 1);
});
