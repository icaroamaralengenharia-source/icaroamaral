import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findMunicipalCatalogCandidates,
  findMunicipalCatalogItemByCode,
  getMunicipalCatalog,
  normalizeMunicipalCatalogValue,
  validateMunicipalCatalog
} from "../src/data/municipal-profile-catalog.js";

test("catalogo municipal serializa itens publicos sem mutar a fonte", () => {
  const catalog = getMunicipalCatalog();
  assert.ok(Array.isArray(catalog));
  assert.ok(catalog.length >= 10);
  assert.deepEqual(Object.keys(catalog[0]), [
    "code",
    "name",
    "description",
    "category",
    "valueType",
    "unit",
    "allowedValues",
    "aliases",
    "required",
    "active"
  ]);
  assert.throws(() => { catalog[0].name = "mutado"; }, TypeError);
});

test("catalogo municipal tem codes unicos, campos obrigatorios e tipos validos", () => {
  const catalog = getMunicipalCatalog();
  const validation = validateMunicipalCatalog(catalog);
  const codes = catalog.map((item) => item.code);

  assert.equal(validation.ok, true, validation.errors.join(", "));
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(catalog.every((item) => /^MUN_[A-Z]{3}_[0-9]{3}$/.test(item.code)));
  assert.ok(catalog.every((item) => item.name && item.description && item.category));
});

test("catalogo municipal rejeita aliases duplicados no mesmo item", () => {
  const catalog = getMunicipalCatalog().map((item) => Object.assign({}, item, {
    aliases: item.aliases.slice(),
    allowedValues: item.allowedValues.slice()
  }));
  catalog[0].aliases.push(catalog[0].aliases[0].toUpperCase());

  const validation = validateMunicipalCatalog(catalog);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.endsWith(".aliases_duplicate")));
});

test("catalogo municipal exige allowedValues para enum e bloqueia allowedValues em tipo comum", () => {
  const catalog = getMunicipalCatalog().map((item) => Object.assign({}, item, {
    aliases: item.aliases.slice(),
    allowedValues: item.allowedValues.slice()
  }));
  const enumItem = catalog.find((item) => item.valueType === "enum");
  enumItem.allowedValues = [];
  const textItem = catalog.find((item) => item.valueType === "text");
  textItem.allowedValues = ["indevido"];

  const validation = validateMunicipalCatalog(catalog);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.endsWith(".allowedValues_required_for_enum")));
  assert.ok(validation.errors.some((error) => error.endsWith(".allowedValues_only_for_enum")));
});

test("busca item municipal por code estavel", () => {
  const item = findMunicipalCatalogItemByCode("mun_doc_001");

  assert.equal(item.code, "MUN_DOC_001");
  assert.equal(item.valueType, "enum");
  assert.ok(item.allowedValues.includes("relatorio"));
});

test("busca candidatos por alias normalizado", () => {
  const candidates = findMunicipalCatalogCandidates("PDF informa relatorio obrigatorio e acervo municipal ativo.");

  assert.ok(candidates.some((item) => item.code === "MUN_DOC_002"));
  assert.ok(candidates.some((item) => item.code === "MUN_DOC_003"));
  assert.ok(candidates[0].matchedAliases.length >= 1);
});

test("normaliza SIM/NAO para boolean somente quando o item e boolean", () => {
  assert.deepEqual(normalizeMunicipalCatalogValue("MUN_DOC_002", "SIM"), {
    ok: true,
    rawValue: "SIM",
    normalizedValue: true,
    valueType: "boolean"
  });
  assert.deepEqual(normalizeMunicipalCatalogValue("MUN_DOC_002", "não"), {
    ok: true,
    rawValue: "não",
    normalizedValue: false,
    valueType: "boolean"
  });
  assert.equal(normalizeMunicipalCatalogValue("MUN_DOC_002", "talvez").ok, false);
  assert.deepEqual(normalizeMunicipalCatalogValue("MUN_ADM_001", "SIM"), {
    ok: true,
    rawValue: "SIM",
    normalizedValue: "SIM",
    valueType: "text"
  });
});
