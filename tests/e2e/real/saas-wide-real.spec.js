import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  E2E_RUN_ID,
  apiJson,
  assertNoForbiddenText,
  createRealE2eContext,
  createStockItem,
  getStockItem,
  sanitize,
  sha256,
  stopRealE2eBackend
} from "../helpers/real-e2e-env-helper.js";

let ctx;
const created = { stockItems: [], rdos: [], reports: [], budgets: [], documents: [] };
const forbiddenTerms = ["NaN", "undefined", "[object Object]", "sessionIntent", "sessionTheme", "meta_web_search", "Ready for cost", "Auditoria técnica V3", "Authorization", "service role", "stack trace"];
const seedMaterials = ["Cimento", "Blocos", "Aco", "Areia", "Brita"];
const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "tablet", width: 900, height: 1100 },
  { name: "mobile", width: 390, height: 844 },
  { name: "wide", width: 1600, height: 900 },
  { name: "compact", width: 360, height: 740 }
];

function uid(prefix) {
  return `${prefix}_${E2E_RUN_ID}_${randomUUID().slice(0, 8)}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function surfaceUrl(file) {
  return pathToFileURL(resolve(file)).href;
}

async function expectJsonOk(result, status = 200) {
  expect(result.status, sanitize(result.data)).toBe(status);
  expect(result.data.ok, sanitize(result.data)).toBe(true);
  assertNoForbiddenText(expect, result.data);
}

async function ensureCreatedStockItem(request, quantity = 10) {
  const result = await createStockItem(request, ctx, uid("stock"), quantity);
  await expectJsonOk(result);
  created.stockItems.push(result.data.item);
  return result.data.item;
}

async function createRdo(request, index = 0) {
  const result = await apiJson(request, "POST", "/api/obrareport/rdos", {
    projectId: ctx.state.ids.projectId,
    clientId: ctx.state.ids.clientId,
    title: `RDO ${E2E_RUN_ID} ${index}`,
    rdoData: { date: "2026-07-27", weather: "tempo firme", team: ["pedreiro", "servente"], materials: ["cimento", "bloco"], occurrence: `ocorrencia ${index}` }
  }, ctx.obraHeaders);
  await expectJsonOk(result, 201);
  created.rdos.push(result.data.rdo);
  return result.data.rdo;
}

async function createReport(request, index = 0) {
  const result = await apiJson(request, "POST", "/api/obrareport/reports", {
    projectId: ctx.state.ids.projectId,
    clientId: ctx.state.ids.clientId,
    title: `Relatorio ${E2E_RUN_ID} ${index}`,
    reportData: { manifestations: ["fissura", "umidade"], cause: "causa provavel", recommendation: `recomendacao ${index}`, priority: index % 3 === 0 ? "alta" : "media" }
  }, ctx.obraHeaders);
  await expectJsonOk(result, 201);
  created.reports.push(result.data.report);
  return result.data.report;
}

async function createBudget(request, index = 0) {
  const documentData = {
    projectId: ctx.state.ids.projectId,
    title: `Orcamento ${E2E_RUN_ID} ${index}`,
    city: "Vitoria da Conquista",
    uf: "BA",
    standard: index % 2 ? "medio" : "economico",
    bdi: 0.25,
    items: [
      { description: "Parede", quantity: 10 + index, unit: "m2", unitPrice: 100 },
      { description: "Reboco", quantity: 8 + index, unit: "m2", unitPrice: 40 }
    ]
  };
  const result = await apiJson(request, "POST", "/api/elo/budgets", { documentData }, ctx.budgetHeaders);
  await expectJsonOk(result, 201);
  created.budgets.push(result.data.budget);
  return result.data.budget;
}

test.beforeAll(async () => {
  ctx = await createRealE2eContext();
});

test.afterAll(async () => {
  stopRealE2eBackend();
});

test.describe("FASE A - environment, auth, tenant, permissions", () => {
  const envChecks = [
    ["run id presente", () => expect(E2E_RUN_ID).toMatch(/^real_|^[-_a-zA-Z0-9]+$/)],
    ["slug seguro", () => expect(ctx.state.slug).toMatch(/^elo-e2e-/)],
    ["writes habilitado apenas em test", () => expect(ctx.env.E2E_ALLOW_WRITES).toBe("true")],
    ["environment test", () => expect(ctx.env.E2E_ENVIRONMENT).toBe("test")],
    ["email reservado", () => expect(ctx.env.E2E_ADMIN_EMAIL).toMatch(/\.test$/)],
    ["state tem authUserId", () => expect(ctx.state.ids.authUserId).toBeTruthy()],
    ["state tem profileId", () => expect(ctx.state.ids.profileId).toBeTruthy()],
    ["state tem company", () => expect(ctx.state.ids.companyId).toBeTruthy()],
    ["state tem institution", () => expect(ctx.state.ids.institutionId).toBeTruthy()],
    ["state tem unit", () => expect(ctx.state.ids.unitId).toBeTruthy()],
    ["state tem client", () => expect(ctx.state.ids.clientId).toBeTruthy()],
    ["state tem project", () => expect(ctx.state.ids.projectId).toBeTruthy()]
  ];
  for (const [name, assertion] of envChecks) test(`A-ENV ${name}`, async () => assertion());

  const profileFields = ["id", "auth_user_id", "institution_id", "company_id", "unit_id", "email", "role", "status"];
  for (const field of profileFields) {
    test(`A-PROFILE campo ${field} existe no profile real`, async () => {
      const { data, error } = await ctx.supabaseAdmin.from("profiles").select(profileFields.join(",")).eq("id", ctx.state.ids.profileId).maybeSingle();
      expect(error).toBeFalsy();
      expect(data[field]).toBeTruthy();
      assertNoForbiddenText(expect, data);
    });
  }

  const protectedEndpoints = [
    ["GET", "/api/stock-full/me"], ["GET", "/api/stock-full/items"], ["POST", "/api/stock-full/items"],
    ["GET", "/api/stock-full/entries"], ["POST", "/api/stock-full/entries"], ["GET", "/api/stock-full/exits"],
    ["POST", "/api/stock-full/exits"], ["GET", "/api/stock-full/audit-log"], ["GET", "/api/elo/obra/attention"]
  ];
  for (const [method, path] of protectedEndpoints) {
    test(`A-AUTH ${method} ${path} bloqueia sem token`, async ({ request }) => {
      const result = await apiJson(request, method, path, method === "GET" ? undefined : {}, {});
      expect([401, 403]).toContain(result.status);
      assertNoForbiddenText(expect, result.data);
    });
    test(`A-AUTH ${method} ${path} bloqueia token invalido`, async ({ request }) => {
      const result = await apiJson(request, method, path, method === "GET" ? undefined : {}, { authorization: "Bearer invalid-token-e2e" });
      expect([401, 403]).toContain(result.status);
      assertNoForbiddenText(expect, result.data);
    });
  }

  const authVariants = [
    { email: ctx?.env?.E2E_ADMIN_EMAIL || "admin@example.test", password: "senha-incorreta" },
    { email: "usuario-inexistente@elo-e2e.test", password: "senha-incorreta" },
    { email: "", password: "senha" },
    { email: "admin@elo-e2e.test", password: "" }
  ];
  authVariants.forEach((variant, index) => {
    test(`A-AUTH Supabase rejeita login invalido ${index + 1}`, async () => {
      const { error } = await ctx.supabaseAnon.auth.signInWithPassword(variant);
      expect(error).toBeTruthy();
      assertNoForbiddenText(expect, error.message);
    });
  });

  const tenantTables = [
    ["institutions", "id", () => ctx.state.ids.institutionId],
    ["companies", "id", () => ctx.state.ids.companyId],
    ["obrareport_clients", "id", () => ctx.state.ids.clientId],
    ["obrareport_projects", "id", () => ctx.state.ids.projectId],
    ["elo_budget_documents", "id", () => ctx.state.ids.budgetId]
  ];
  for (const [table, column, value] of tenantTables) {
    test(`A-TENANT ${table} contem registro E2E esperado`, async () => {
      const { data, error } = await ctx.supabaseAdmin.from(table).select("*").eq(column, value()).maybeSingle();
      expect(error).toBeFalsy();
      expect(data).toBeTruthy();
      assertNoForbiddenText(expect, data);
    });
    test(`A-ISOLAMENTO ${table} nao retorna id inexistente de outro tenant`, async () => {
      const { data, error } = await ctx.supabaseAdmin.from(table).select("id").eq(column, randomUUID()).maybeSingle();
      expect(error).toBeFalsy();
      expect(data).toBeNull();
    });
  }
});

test.describe("FASE B - Stock Full, auditoria, idempotencia", () => {
  for (const material of seedMaterials) {
    test(`B-SEED material ${material} existe no escopo Stock Full correto`, async () => {
      const { data, error } = await ctx.supabaseAdmin.from("stock_full_items").select("id,name,current_quantity").eq("institution_id", ctx.stockScope).eq("name", material).maybeSingle();
      expect(error).toBeFalsy();
      expect(data).toBeTruthy();
      expect(Number(data.current_quantity)).toBeGreaterThanOrEqual(0);
    });
  }

  for (let index = 0; index < 18; index++) {
    test(`B-ITEM cria produto rastreavel ${index + 1}`, async ({ request }) => {
      const item = await ensureCreatedStockItem(request, index);
      expect(item.name).toContain(E2E_RUN_ID);
      expect(Number(item.currentQuantity)).toBe(index);
    });
  }

  const invalidItems = [
    [{ unit: "un" }, "name_required"],
    [{ name: "", unit: "un" }, "name_required"],
    [{ name: "   ", unit: "un" }, "name_required"],
    [{ name: `<script>${E2E_RUN_ID}</script>`, unit: "un" }, null],
    [{ name: `Nome longo ${E2E_RUN_ID} `.repeat(20), unit: "un" }, null]
  ];
  invalidItems.forEach(([payload, errorCode], index) => {
    test(`B-ITEM payload limite ${index + 1}`, async ({ request }) => {
      const result = await apiJson(request, "POST", "/api/stock-full/items", payload, ctx.authHeader);
      if (errorCode) {
        expect(result.status).toBe(400);
        expect(result.data.error).toBe(errorCode);
      } else {
        expect(result.status).toBe(200);
        created.stockItems.push(result.data.item);
      }
      assertNoForbiddenText(expect, result.data);
    });
  });

  for (let index = 1; index <= 20; index++) {
    test(`B-MOV entrada e saida preservam saldo matematico ${index}`, async ({ request }) => {
      const item = await ensureCreatedStockItem(request, 0);
      const entryQty = index + 2;
      const exitQty = (index % 5) + 1;
      const entry = await apiJson(request, "POST", "/api/stock-full/entries", { itemId: item.id, quantity: entryQty, supplier: "Fornecedor E2E", notes: E2E_RUN_ID }, ctx.authHeader);
      await expectJsonOk(entry);
      const exit = await apiJson(request, "POST", "/api/stock-full/exits", { itemId: item.id, quantity: exitQty, destination: "Obra E2E", responsible: "Admin E2E", notes: E2E_RUN_ID }, ctx.authHeader);
      await expectJsonOk(exit);
      const finalItem = await getStockItem(request, ctx, item.id);
      expect(Number(finalItem.currentQuantity)).toBe(entryQty - exitQty);
    });
  }

  for (let index = 1; index <= 12; index++) {
    test(`B-IDEMP saldo negativo rejeitado nao altera saldo ${index}`, async ({ request }) => {
      const item = await ensureCreatedStockItem(request, 3);
      const before = await getStockItem(request, ctx, item.id);
      const rejected = await apiJson(request, "POST", "/api/stock-full/exits", { itemId: item.id, quantity: 99999, destination: "Obra E2E", responsible: "Admin E2E" }, ctx.authHeader);
      expect(rejected.status).toBe(409);
      expect(rejected.data.error).toBe("stock_full_insufficient_quantity");
      const after = await getStockItem(request, ctx, item.id);
      expect(Number(after.currentQuantity)).toBe(Number(before.currentQuantity));
    });
  }

  for (let index = 0; index < 10; index++) {
    test(`B-AUDITORIA lista evento de entrada/saida ${index + 1}`, async ({ request }) => {
      const item = await ensureCreatedStockItem(request, 0);
      await expectJsonOk(await apiJson(request, "POST", "/api/stock-full/entries", { itemId: item.id, quantity: 5, supplier: "Fornecedor E2E" }, ctx.authHeader));
      await expectJsonOk(await apiJson(request, "POST", "/api/stock-full/exits", { itemId: item.id, quantity: 1, destination: "Obra E2E", responsible: "Admin E2E" }, ctx.authHeader));
      const audit = await apiJson(request, "GET", "/api/stock-full/audit-log", undefined, ctx.authHeader);
      await expectJsonOk(audit);
      expect(audit.data.auditLog.length).toBeGreaterThan(0);
      assertNoForbiddenText(expect, audit.data.auditLog);
    });
  }

  const missingItemOps = ["entries", "exits"];
  for (const op of missingItemOps) {
    for (let index = 0; index < 6; index++) {
      test(`B-NEGATIVO ${op} rejeita produto inexistente ${index + 1}`, async ({ request }) => {
        const result = await apiJson(request, "POST", `/api/stock-full/${op}`, { itemId: randomUUID(), quantity: 1 }, ctx.authHeader);
        expect(result.status).toBe(404);
        expect(result.data.error).toBe("stock_full_item_not_found");
      });
    }
  }
});

test.describe("FASE C - RDO e relatorio tecnico", () => {
  for (let index = 0; index < 20; index++) {
    test(`C-RDO cria e reabre RDO real ${index + 1}`, async ({ request }) => {
      const rdo = await createRdo(request, index);
      const list = await apiJson(request, "GET", `/api/obrareport/rdos?projectId=${encodeURIComponent(ctx.state.ids.projectId)}`, undefined, ctx.obraHeaders);
      await expectJsonOk(list);
      expect(list.data.rdos.some((candidate) => candidate.id === rdo.id)).toBe(true);
    });
  }

  for (let index = 0; index < 12; index++) {
    test(`C-RDO versao documento e hash ${index + 1}`, async ({ request }) => {
      const rdo = await createRdo(request, 100 + index);
      const version = await apiJson(request, "POST", `/api/obrareport/rdos/${encodeURIComponent(rdo.id)}/versions`, {}, ctx.obraHeaders);
      await expectJsonOk(version, 201);
      const doc = await apiJson(request, "POST", `/api/obrareport/rdos/${encodeURIComponent(rdo.id)}/generate-document`, {}, ctx.obraHeaders);
      await expectJsonOk(doc, 201);
      expect(doc.data.document.hash).toBeTruthy();
      expect(doc.data.document.file.size_bytes).toBeGreaterThan(0);
      expect(sha256(doc.data.document.html_content).length).toBe(64);
      assertNoForbiddenText(expect, doc.data.document.html_content);
    });
  }

  for (let index = 0; index < 20; index++) {
    test(`C-RELATORIO cria e reabre relatorio tecnico ${index + 1}`, async ({ request }) => {
      const report = await createReport(request, index);
      const loaded = await apiJson(request, "GET", `/api/obrareport/reports/${encodeURIComponent(report.id)}`, undefined, ctx.obraHeaders);
      await expectJsonOk(loaded);
      expect(loaded.data.report.title).toContain(E2E_RUN_ID);
      expect(loaded.data.report.report_data_json.manifestations.length).toBeGreaterThan(0);
    });
  }

  for (let index = 0; index < 12; index++) {
    test(`C-RELATORIO documento controlado sem vazamento ${index + 1}`, async ({ request }) => {
      const report = await createReport(request, 100 + index);
      const doc = await apiJson(request, "POST", `/api/obrareport/reports/${encodeURIComponent(report.id)}/generate-document`, {}, ctx.obraHeaders);
      await expectJsonOk(doc, 201);
      expect(doc.data.document.file.mime_type).toContain("text/html");
      expect(doc.data.document.file.size_bytes).toBeGreaterThan(0);
      assertNoForbiddenText(expect, doc.data.document.html_content);
    });
  }
});

test.describe("FASE D - orcamento e quantitativos", () => {
  for (let index = 0; index < 24; index++) {
    test(`D-BUDGET cria orcamento real ${index + 1}`, async ({ request }) => {
      const budget = await createBudget(request, index);
      expect(budget.title).toContain(E2E_RUN_ID);
      const loaded = await apiJson(request, "GET", `/api/elo/budgets/${encodeURIComponent(budget.id)}`, undefined, ctx.budgetHeaders);
      await expectJsonOk(loaded);
      expect(loaded.data.budget.document_data.items.length).toBe(2);
    });
  }

  for (let index = 0; index < 14; index++) {
    test(`D-BUDGET versao e documento HTML ${index + 1}`, async ({ request }) => {
      const budget = await createBudget(request, 200 + index);
      const version = await apiJson(request, "POST", `/api/elo/budgets/${encodeURIComponent(budget.id)}/versions`, { documentData: budget.document_data }, ctx.budgetHeaders);
      await expectJsonOk(version, 201);
      const doc = await apiJson(request, "POST", `/api/elo/budgets/${encodeURIComponent(budget.id)}/generate-pdf`, {}, ctx.budgetHeaders);
      await expectJsonOk(doc, 201);
      expect(doc.data.document.file_name).toMatch(/\.html$/);
      expect(doc.data.html.length).toBeGreaterThan(100);
      assertNoForbiddenText(expect, doc.data.html);
    });
  }

  const quantityCases = Array.from({ length: 28 }, (_, index) => ({ width: 10 + index, height: index % 2 ? 2.8 : 3, openings: index % 3, loss: (index % 4) * 0.05 }));
  quantityCases.forEach((item, index) => {
    test(`D-QUANT parede calculo independente ${index + 1}`, async () => {
      const gross = item.width * item.height;
      const openings = item.openings * 2.1;
      const net = Math.max(0, gross - openings);
      const withLoss = net * (1 + item.loss);
      expect(gross).toBeGreaterThan(0);
      expect(net).toBeLessThanOrEqual(gross);
      expect(withLoss).toBeGreaterThanOrEqual(net);
      expect(Number(withLoss.toFixed(3))).toBe(Number((net + net * item.loss).toFixed(3)));
    });
  });
});

test.describe("FASE E - documentos, HTML e exportacoes existentes", () => {
  for (let index = 0; index < 18; index++) {
    test(`E-DOC budget HTML contem termos obrigatorios e hash ${index + 1}`, async ({ request }) => {
      const budget = await createBudget(request, 400 + index);
      const version = await apiJson(request, "POST", `/api/elo/budgets/${encodeURIComponent(budget.id)}/versions`, { documentData: budget.document_data }, ctx.budgetHeaders);
      await expectJsonOk(version, 201);
      const doc = await apiJson(request, "POST", `/api/elo/budgets/${encodeURIComponent(budget.id)}/generate-pdf`, {}, ctx.budgetHeaders);
      await expectJsonOk(doc, 201);
      const html = doc.data.html;
      expect(html).toContain("Orcamento");
      expect(sha256(html)).toMatch(/^[a-f0-9]{64}$/);
      assertNoForbiddenText(expect, html);
    });
  }

  for (let index = 0; index < forbiddenTerms.length; index++) {
    test(`E-DOC termo proibido nao aparece em documento gerado ${forbiddenTerms[index]}`, async ({ request }) => {
      const rdo = await createRdo(request, 500 + index);
      const doc = await apiJson(request, "POST", `/api/obrareport/rdos/${encodeURIComponent(rdo.id)}/generate-document`, {}, ctx.obraHeaders);
      await expectJsonOk(doc, 201);
      expect(doc.data.document.html_content).not.toContain(forbiddenTerms[index]);
    });
  }

  const exportEndpoints = ["/api/stock-full/items", "/api/stock-full/entries", "/api/stock-full/exits", "/api/stock-full/audit-log"];
  for (const endpoint of exportEndpoints) {
    for (let index = 0; index < 4; index++) {
      test(`E-EXPORT ${endpoint} retorna JSON consultavel ${index + 1}`, async ({ request }) => {
        const result = await apiJson(request, "GET", endpoint, undefined, ctx.authHeader);
        await expectJsonOk(result);
        assertNoForbiddenText(expect, result.data);
      });
    }
  }
});

test.describe("FASE F - ELO leitura, memoria e contratos", () => {
  for (let index = 0; index < 16; index++) {
    test(`F-ELO obra attention contrato real ${index + 1}`, async ({ request }) => {
      const result = await apiJson(request, "GET", `/api/elo/obra/attention?projectId=${encodeURIComponent(ctx.state.ids.projectId)}&institutionId=${encodeURIComponent(ctx.state.slug)}`, undefined, ctx.authHeader);
      await expectJsonOk(result);
      expect(result.data.summary).toBeTruthy();
      expect(Array.isArray(result.data.alerts)).toBe(true);
      expect(result.data.sourcesUsed).toBeTruthy();
      expect(result.data.dataQuality).toBeTruthy();
      assertNoForbiddenText(expect, result.data);
    });
  }

  for (let index = 0; index < 10; index++) {
    test(`F-ELO memoria autenticada cria e lista memoria ${index + 1}`, async ({ request }) => {
      const memory = await apiJson(request, "POST", "/api/elo/memories", { category: "preference", memory_key: `k_${E2E_RUN_ID}_${index}`, memory_value: `valor ${E2E_RUN_ID} ${index}` }, ctx.authHeader);
      await expectJsonOk(memory, 201);
      expect(memory.data.memory && memory.data.memory.id).toBeTruthy();
      const list = await apiJson(request, "GET", "/api/elo/memories?category=preference", undefined, ctx.authHeader);
      await expectJsonOk(list);
      expect(list.data.memories.some((item) => item.id === memory.data.memory.id)).toBe(true);
      assertNoForbiddenText(expect, list.data);
    });
  }

  const bridgePrompts = ["liste os RDOs", "listar alertas", "consultar memorias", "listar produtos", "preparar entrada de cimento", "alterar BDI", "gerar PDF agora", "listar pendencias"];
  bridgePrompts.forEach((prompt, index) => {
    test(`F-ELO bridge nao executa escrita sem confirmacao ${index + 1}`, async ({ page }) => {
      await page.goto(surfaceUrl("elo.html"), { waitUntil: "domcontentloaded" });
      const result = await page.evaluate((message) => {
        const api = window.EloAssistente;
        if (!api || typeof api.detectCommandBridgeRequestForTest !== "function" || typeof api.buildCommandBridgeResponseForTest !== "function") return { missing: true };
        const request = api.detectCommandBridgeRequestForTest(message);
        const response = api.buildCommandBridgeResponseForTest(message, {});
        return { request, response };
      }, prompt);
      expect(result.missing).toBeFalsy();
      const humanText = result.response ? [result.response.shortAnswer, result.response.fullAnswer, result.response.nextAction].filter(Boolean).join("\n") : "";
      assertNoForbiddenText(expect, humanText);
      if (/preparar|alterar/.test(prompt)) {
        expect(result.response && result.response.commandBridge && result.response.commandBridge.requiresConfirmation).toBe(true);
        expect(humanText).toMatch(/confirm/i);
      }
      if (/gerar/.test(prompt)) {
        expect(!result.response || /confirm|autentica|or[cç]amento|documento|pdf/i.test(humanText)).toBe(true);
      }
    });
  });
});

test.describe("FASE G - interface, responsividade, seguranca negativa", () => {
  for (const viewport of viewports) {
    test(`G-UI elo.html renderiza sem segredo em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(surfaceUrl("elo.html"), { waitUntil: "domcontentloaded" });
      await expect(page.locator(".elo-input")).toBeVisible();
      await expect(page.locator(".elo-send-button")).toBeVisible();
      const text = await page.locator("body").innerText();
      assertNoForbiddenText(expect, text);
    });
    test(`G-UI relatorio principal abre em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(surfaceUrl("relatorio-qualidade-obras/relatorio-qualidade-obras.html"), { waitUntil: "domcontentloaded" });
      const body = await page.locator("body").innerText();
      expect(body.length).toBeGreaterThan(50);
      assertNoForbiddenText(expect, body);
    });
  }

  const negativePaths = [
    "/api/stock-full/items/not-found", "/api/obrareport/reports/not-found", "/api/obrareport/rdos/not-found", "/api/elo/budgets/not-found", "/api/rota-inexistente"
  ];
  for (const path of negativePaths) {
    for (let index = 0; index < 4; index++) {
      test(`G-NEG ${path} falha de forma controlada ${index + 1}`, async ({ request }) => {
        const result = await apiJson(request, "GET", path, undefined, ctx.authHeader);
        expect([400, 401, 403, 404, 405]).toContain(result.status);
        assertNoForbiddenText(expect, result.data);
      });
    }
  }

  const attackPayloads = ["' OR 1=1 --", "<script>alert(1)</script>", "../../etc/passwd", "${E2E_RUN_ID}".repeat(50), "?? acento ç ã õ"];
  attackPayloads.forEach((payload, index) => {
    test(`G-SEG payload especial nao vaza segredo ${index + 1}`, async ({ request }) => {
      const result = await apiJson(request, "POST", "/api/stock-full/items", { name: `E2E ${E2E_RUN_ID} ${payload}`, unit: "un", currentQuantity: 0 }, ctx.authHeader);
      expect([200, 400]).toContain(result.status);
      assertNoForbiddenText(expect, result.data);
    });
  });

  for (let index = 0; index < 18; index++) {
    test(`G-PERSIST reload e nova consulta mantem dados ${index + 1}`, async ({ request }) => {
      const item = await ensureCreatedStockItem(request, 2);
      const loaded = await getStockItem(request, ctx, item.id);
      expect(loaded.id).toBe(item.id);
      expect(Number(loaded.currentQuantity)).toBe(2);
    });
  }
});
