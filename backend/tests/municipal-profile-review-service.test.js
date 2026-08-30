import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalProfilePdfImporter } from "../src/municipal-profile-pdf-importer.js";
import { createMunicipalProfileReviewService, validateMunicipalImportReview } from "../src/municipal-profile-review-service.js";
import { createMunicipalProfileService } from "../src/municipal-profile-service.js";
import { extractMunicipalTextContent } from "../src/municipal-pdf-extractor.js";

const IMPORT_TEXT = `
Unidade operacional obrigatoria: SIM
Acervo digital ativo: NÃO
Quantidade minima de estoque: 12
Documento obrigatorio: talvez
Linha sem mapeamento: dado solto
`;

function ctx(role = "platform_admin") {
  return {
    ok: true,
    userId: role + "-user",
    role,
    profile: {
      id: role + "-profile",
      auth_user_id: role + "-user",
      role,
      status: "active",
      institution_id: "",
      unit_id: null,
      email: role + "@example.com"
    }
  };
}

function setup(text = IMPORT_TEXT) {
  const store = createMemoryMunicipalAdminStore({
    municipal_profiles: [],
    municipal_profile_versions: [],
    municipal_profile_values: [],
    municipal_profile_imports: [],
    municipal_profile_import_rows: [],
    municipal_admin_audit_log: []
  });
  const now = () => new Date("2026-04-10T12:00:00.000Z");
  const importer = createMunicipalProfilePdfImporter({
    store,
    now,
    extractPdf: async () => extractMunicipalTextContent(text)
  });
  const review = createMunicipalProfileReviewService({ store, now });
  return { store, importer, review };
}

async function importDraft(env, buffer = "pdf-review") {
  return await env.importer.importPdfToDraft(ctx(), {
    buffer: Buffer.from(buffer),
    fileName: "perfil-review.pdf",
    municipality: "Vitória da Conquista",
    state: "BA",
    profileType: "official",
    importedBy: "auditor"
  });
}

function decisionsFor(rows) {
  return rows.map((row) => {
    if (row.confidence === "UNMATCHED") return { rowId: row.id, reviewStatus: "ignored", reviewNote: "fora do perfil" };
    if (row.catalog_code_suggested === "MUN_DOC_002") {
      return { rowId: row.id, reviewStatus: "corrected", catalogCodeConfirmed: "MUN_DOC_002", normalizedValueConfirmed: "SIM", reviewNote: "valor revisado" };
    }
    return { rowId: row.id, reviewStatus: row.requires_review ? "corrected" : "confirmed", catalogCodeConfirmed: row.catalog_code_suggested, normalizedValueConfirmed: row.normalized_value_suggested };
  });
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("salva confirmacao e completa revisao atualizando draft", async () => {
  const env = setup();
  const draft = await importDraft(env);
  const result = await env.review.saveMunicipalImportReview(ctx(), draft.import.id, { decisions: decisionsFor(draft.rows) });

  assert.equal(result.import.status, "review_completed");
  assert.equal(result.version.status, "draft");
  assert.equal(result.summary.pending, 0);
  assert.ok(env.store.tables.municipal_profile_values.some((value) => value.catalog_code === "MUN_ADM_002" && value.normalized_value === true));
  assert.ok(env.store.tables.municipal_admin_audit_log.some((row) => row.action === "municipal_import_row_confirmed"));
  assert.ok(env.store.tables.municipal_admin_audit_log.some((row) => row.action === "municipal_import_review_completed"));
});

test("corrige item e corrige valor respeitando catalogo", async () => {
  const env = setup("Documento obrigatorio: talvez\nLinha sem mapeamento: dado solto");
  const draft = await importDraft(env, "pdf-correct");
  const unmatched = draft.rows.find((row) => row.confidence === "UNMATCHED");
  const invalid = draft.rows.find((row) => row.catalog_code_suggested === "MUN_DOC_002");
  const result = await env.review.saveMunicipalImportReview(ctx(), draft.import.id, {
    decisions: [
      { rowId: invalid.id, reviewStatus: "corrected", catalogCodeConfirmed: "MUN_DOC_002", normalizedValueConfirmed: "NÃO", reviewNote: "corrigido" },
      { rowId: unmatched.id, reviewStatus: "corrected", catalogCodeConfirmed: "MUN_ADM_001", normalizedValueConfirmed: "Prefeitura Municipal", reviewNote: "item corrigido" }
    ]
  });

  assert.equal(result.summary.pending, 0);
  assert.ok(env.store.tables.municipal_profile_values.some((value) => value.catalog_code === "MUN_DOC_002" && value.normalized_value === false));
  assert.ok(env.store.tables.municipal_profile_values.some((value) => value.catalog_code === "MUN_ADM_001" && value.normalized_value === "Prefeitura Municipal"));
  assert.ok(env.store.tables.municipal_admin_audit_log.some((row) => row.action === "municipal_import_row_corrected"));
});

test("ignora linha mantendo texto original e nota de revisao", async () => {
  const env = setup("Linha sem mapeamento: dado solto");
  const draft = await importDraft(env, "pdf-ignore");
  await env.review.saveMunicipalImportReview(ctx(), draft.import.id, {
    decisions: [{ rowId: draft.rows[0].id, reviewStatus: "ignored", reviewNote: "nao aplicavel" }]
  });
  const row = env.store.tables.municipal_profile_import_rows[0];
  assert.equal(row.review_status, "ignored");
  assert.equal(row.review_note, "nao aplicavel");
  assert.match(row.raw_text, /Linha sem mapeamento/);
});

test("bloqueia valor invalido e catalog code invalido", async () => {
  const env = setup("Quantidade minima de estoque: 12\nLinha sem mapeamento: dado solto");
  const draft = await importDraft(env, "pdf-invalid");
  const number = draft.rows.find((row) => row.catalog_code_suggested === "MUN_INF_001");
  const unmatched = draft.rows.find((row) => row.confidence === "UNMATCHED");

  await rejectsCode(env.review.saveMunicipalImportReview(ctx(), draft.import.id, {
    decisions: [
      { rowId: number.id, reviewStatus: "corrected", catalogCodeConfirmed: "MUN_INF_001", normalizedValueConfirmed: "doze" },
      { rowId: unmatched.id, reviewStatus: "ignored", reviewNote: "fora" }
    ]
  }), "municipal_import_review_value_invalid");
  await rejectsCode(env.review.saveMunicipalImportReview(ctx(), draft.import.id, {
    decisions: [
      { rowId: number.id, reviewStatus: "corrected", catalogCodeConfirmed: "MUN_X_999", normalizedValueConfirmed: "12" },
      { rowId: unmatched.id, reviewStatus: "ignored", reviewNote: "fora" }
    ]
  }), "municipal_import_review_catalog_invalid");
});

test("bloqueia duplicidade nao resolvida e revisao incompleta", async () => {
  const env = setup("Quantidade minima de estoque: 12\nminimo estoque: 20");
  const draft = await importDraft(env, "pdf-duplicate");
  await rejectsCode(env.review.saveMunicipalImportReview(ctx(), draft.import.id, {
    decisions: draft.rows.map((row) => ({ rowId: row.id, reviewStatus: "confirmed", catalogCodeConfirmed: "MUN_INF_001", normalizedValueConfirmed: row.normalized_value_suggested }))
  }), "municipal_import_review_incomplete");

  const validation = validateMunicipalImportReview(env.store.tables.municipal_profile_import_rows);
  assert.equal(validation.ok, false);
});

test("active nao e alterada por revisao de novo draft", async () => {
  const env = setup("Unidade operacional obrigatoria: NÃO");
  const profileService = createMunicipalProfileService({ store: env.store, now: () => new Date("2026-04-01T00:00:00.000Z") });
  const { profile } = await profileService.createMunicipalProfile(ctx(), { municipality: "Vitória da Conquista", state: "BA", profileType: "official" });
  const active = await profileService.createMunicipalProfileVersion(ctx(), profile.id, { source_hash: "hash-active" });
  await profileService.setMunicipalProfileValue(ctx(), active.version.id, { catalog_code: "MUN_ADM_002", raw_value: "SIM" });
  await profileService.activateMunicipalProfileVersion(ctx(), active.version.id);

  const draft = await importDraft(env, "pdf-new-review");
  await env.review.saveMunicipalImportReview(ctx(), draft.import.id, { decisions: decisionsFor(draft.rows) });
  const versions = env.store.tables.municipal_profile_versions;
  assert.equal(versions.filter((version) => version.status === "active").length, 1);
  assert.equal(versions.filter((version) => version.status === "draft").length, 1);
});

test("get import retorna cabecalho, rows e contadores para UI", async () => {
  const env = setup();
  const draft = await importDraft(env, "pdf-get");
  const result = await env.review.getMunicipalProfileImport(ctx("leitura"), draft.import.id);

  assert.equal(result.profile.municipality_name, "Vitória da Conquista");
  assert.equal(result.import.file_name, "perfil-review.pdf");
  assert.equal(result.version.status, "draft");
  assert.equal(result.summary.total, 5);
  assert.ok(result.rows.some((row) => row.confidence === "UNMATCHED"));
});
