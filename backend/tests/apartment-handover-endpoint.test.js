import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..", "..");
const fixturePath = join(repoRoot, "tests", "fixtures", "apartment-handover-inspection-144-corrected.json");
const tempDir = join(repoRoot, "tmp", "apartment-handover-endpoint");

function readFixture() {
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function withServer(app, callback) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function postPdf(baseUrl, payload) {
  return fetch(`${baseUrl}/api/apartment-handover/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

function tempNames() {
  if (!existsSync(tempDir)) return [];
  return readdirSync(tempDir).filter((name) => name.endsWith(".pdf"));
}

async function expectPdfResponse(response) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /^application\/pdf\b/);
  const disposition = response.headers.get("content-disposition") || "";
  assert.match(disposition, /^attachment; filename="Laudo-Vistoria-[A-Za-z0-9.-]+\.pdf"$/);
  assert.doesNotMatch(disposition, /[\\/:*?<>|]/);
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.subarray(0, 4).toString("utf8"), "%PDF");
  assert.ok(buffer.length > 30_000, "endpoint deve retornar PDF real");
  return buffer;
}

test("POST /api/apartment-handover/pdf gera rascunho mesmo com blocker", async () => {
  mkdirSync(tempDir, { recursive: true });
  const before = tempNames();
  const payload = readFixture();
  payload.mode = "draft";
  payload.report.inspection.items[0].descricaoTecnica = "";

  await withServer(createApp(), async (baseUrl) => {
    const response = await postPdf(baseUrl, payload);
    const pdf = await expectPdfResponse(response);
    const smokePath = join(repoRoot, "tmp", "apartment-handover-endpoint-draft-test.pdf");
    writeFileSync(smokePath, pdf);
  });

  assert.deepEqual(tempNames(), before);
});

test("POST /api/apartment-handover/pdf gera laudo final valido", async () => {
  const payload = readFixture();
  payload.mode = "final";

  await withServer(createApp(), async (baseUrl) => {
    const response = await postPdf(baseUrl, payload);
    await expectPdfResponse(response);
  });
});

test("POST /api/apartment-handover/pdf bloqueia final quando preflight reprova", async () => {
  const payload = readFixture();
  payload.mode = "final";
  payload.report.inspection.items[0].descricaoTecnica = "";

  await withServer(createApp(), async (baseUrl) => {
    const response = await postPdf(baseUrl, payload);
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "INSPECTION_PREFLIGHT_BLOCKED");
    assert.equal(body.review.canGenerateFinal, false);
    assert.ok(body.review.blockers.length >= 1);
  });
});

test("POST /api/apartment-handover/pdf valida tipo e payload", async () => {
  await withServer(createApp(), async (baseUrl) => {
    const invalidPayload = await postPdf(baseUrl, {});
    assert.equal(invalidPayload.status, 400);
    assert.equal((await invalidPayload.json()).code, "INVALID_APARTMENT_HANDOVER_PAYLOAD");

    const invalidTypePayload = readFixture();
    invalidTypePayload.mode = "draft";
    invalidTypePayload.report.type = "old_report";
    const invalidType = await postPdf(baseUrl, invalidTypePayload);
    assert.equal(invalidType.status, 400);
    assert.equal((await invalidType.json()).code, "INVALID_APARTMENT_HANDOVER_TYPE");
  });
});

test("POST /api/apartment-handover/pdf trata falha interna sem stack", async () => {
  const payload = readFixture();
  payload.mode = "draft";
  const app = createApp({ apartmentHandoverPdfGenerator: async () => { throw new Error("forced_private_stack_marker"); } });

  await withServer(app, async (baseUrl) => {
    const response = await postPdf(baseUrl, payload);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "APARTMENT_HANDOVER_PDF_FAILED");
    assert.doesNotMatch(JSON.stringify(body), /forced_private_stack_marker/);
  });
});
test("CORS libera somente a origem temporaria exata", async () => {
  await withServer(createApp({ env: { ...process.env, AI_ALLOWED_ORIGINS: "https://www.icaroamaral.com.br" } }), async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "https://ipod-politics-abraham-prices.trycloudflare.com" }
    });
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://ipod-politics-abraham-prices.trycloudflare.com");

    const blocked = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "https://origem-nao-autorizada.example" }
    });
    assert.notEqual(blocked.headers.get("access-control-allow-origin"), "https://origem-nao-autorizada.example");
    assert.notEqual(blocked.headers.get("access-control-allow-origin"), "*");

    const preflight = await fetch(`${baseUrl}/api/apartment-handover/pdf`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://ipod-politics-abraham-prices.trycloudflare.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
      }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://ipod-politics-abraham-prices.trycloudflare.com");
  });
});
