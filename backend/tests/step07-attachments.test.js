import assert from "node:assert/strict";
import test from "node:test";
import { createApp, createEloVectorMemoryStore_ } from "../src/app.js";

const ORIGIN = "http://127.0.0.1:5500";

function createAuthSupabase_() {
  const users = new Map([
    ["valid-token-a", { id: "auth_user_a", profile: { id: "profile_a", auth_user_id: "auth_user_a", institution_id: "tenant_a", email: "a@example.test" } }],
    ["valid-token-b", { id: "auth_user_b", profile: { id: "profile_b", auth_user_id: "auth_user_b", institution_id: "tenant_b", email: "b@example.test" } }]
  ]);

  return {
    auth: {
      async getUser(token) {
        const entry = users.get(token);
        return entry
          ? { data: { user: { id: entry.id, email: entry.profile.email } }, error: null }
          : { data: { user: null }, error: { message: "invalid token" } };
      }
    },
    from(table) {
      assert.equal(table, "profiles");
      let authUserId = "";
      return {
        select() { return this; },
        eq(column, value) {
          if (column === "auth_user_id") authUserId = value;
          return this;
        },
        async maybeSingle() {
          for (const entry of users.values()) {
            if (entry.profile.auth_user_id === authUserId) return { data: entry.profile, error: null };
          }
          return { data: null, error: null };
        }
      };
    }
  };
}

async function withServer_(options, callback) {
  const app = createApp(Object.assign({
    env: { ELO_RDO_STORE: "file", AI_ALLOWED_ORIGINS: ORIGIN },
    enableEloTelemetryRetention: false
  }, options));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function makeForm_(files, context = {}) {
  const form = new FormData();
  form.append("message", "Analise os documentos anexados.");
  form.append("context", JSON.stringify(context));
  form.append("history", "[]");
  for (const file of files) {
    form.append("files", new Blob([file.content], { type: file.type }), file.name);
  }
  return form;
}

async function postMultipart_(url, files, options = {}) {
  return fetch(url + "/api/elo/chat", {
    method: "POST",
    headers: Object.assign({ Origin: ORIGIN }, options.authorization ? { Authorization: options.authorization } : {}),
    body: makeForm_(files, options.context || {})
  });
}

test("anexo multipart anônimo é bloqueado antes do parsing", async () => {
  await withServer_({ eloVectorMemoryStore: createEloVectorMemoryStore_({ memoryOnly: true }) }, async (url) => {
    const response = await postMultipart_(url, [{ name: "obra.txt", type: "text/plain", content: "conteudo privado" }]);
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error, "authentication_required");
    assert.match(body.attachmentErrors[0], /Entre no ELO/);
  });
});

test("sessão inválida não pode enviar anexo", async () => {
  await withServer_({
    authContextSupabaseClient: createAuthSupabase_(),
    eloVectorMemoryStore: createEloVectorMemoryStore_({ memoryOnly: true })
  }, async (url) => {
    const response = await postMultipart_(url, [{ name: "obra.txt", type: "text/plain", content: "conteudo privado" }], {
      authorization: "Bearer invalid-token"
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error, "invalid_session");
  });
});

test("anexo autenticado aceita CSV e MD, normaliza caminho e vincula tenant/usuário", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await withServer_({
    authContextSupabaseClient: createAuthSupabase_(),
    eloVectorMemoryStore: store
  }, async (url) => {
    const response = await postMultipart_(url, [
      { name: "..\\private\\obra.csv", type: "text/csv", content: "obra,data\nE2E,2026-09-26" },
      { name: "manual.md", type: "text/markdown", content: "# Procedimento\nRegistrar a vistoria." }
    ], {
      authorization: "Bearer valid-token-a",
      context: {
        deviceId: "elo_dev_spoofed",
        institutionId: "tenant_spoofed",
        userId: "user_spoofed",
        projectId: "project_e2e",
        workId: "work_e2e"
      }
    });
    const body = await response.json();
    const items = store.list();

    assert.equal(response.status, 503);
    assert.equal(body.fallback, true);
    assert.equal(items.length, 2, JSON.stringify({ status: response.status, body, items }));
    assert.deepEqual(new Set(items.map((item) => item.ownerId)), new Set(["elo_dev_auth_tenant_a_auth_user_a"]));
    assert.deepEqual(new Set(items.map((item) => item.metadata.institutionId)), new Set(["tenant_a"]));
    assert.deepEqual(new Set(items.map((item) => item.metadata.userId)), new Set(["auth_user_a"]));
    assert.deepEqual(new Set(items.map((item) => item.metadata.projectId)), new Set(["project_e2e"]));
    assert.deepEqual(new Set(items.map((item) => item.metadata.workId)), new Set(["work_e2e"]));
    assert.deepEqual(new Set(items.map((item) => item.metadata.fileName)), new Set(["obra.csv", "manual.md"]));
  });
});

test("MIME incompatível e extensão desconhecida falham de forma controlada", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await withServer_({
    authContextSupabaseClient: createAuthSupabase_(),
    eloVectorMemoryStore: store
  }, async (url) => {
    const response = await postMultipart_(url, [
      { name: "../../secrets.jpg", type: "text/plain", content: "nao deve indexar" },
      { name: "payload.exe", type: "application/octet-stream", content: "nao deve indexar" }
    ], { authorization: "Bearer valid-token-a" });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.fallback, true);
    assert.equal(store.list().length, 0);
    assert.equal(body.attachmentErrors.length, 2);
    assert.match(body.attachmentErrors.join(" | "), /secrets\.jpg/);
    assert.doesNotMatch(body.attachmentErrors.join(" | "), /\.\.\\|\.\.\//);
    assert.match(body.attachmentErrors.join(" | "), /payload\.exe/);
  });
});

test("memória vetorial não cruza tenants", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await withServer_({
    authContextSupabaseClient: createAuthSupabase_(),
    eloVectorMemoryStore: store
  }, async (url) => {
    await postMultipart_(url, [{ name: "tenant-a.txt", type: "text/plain", content: "informacao exclusiva tenant A" }], { authorization: "Bearer valid-token-a" });
    await postMultipart_(url, [{ name: "tenant-b.txt", type: "text/plain", content: "informacao exclusiva tenant B" }], { authorization: "Bearer valid-token-b" });
    const fromA = await store.search("informacao exclusiva", "elo_dev_auth_tenant_a_auth_user_a");
    const fromB = await store.search("informacao exclusiva tenant A", "elo_dev_auth_tenant_b_auth_user_b");
    assert.ok(fromA.length > 0, JSON.stringify({ items: store.list(), fromA, fromB }));
    assert.ok(fromB.every((item) => item.ownerId === "elo_dev_auth_tenant_b_auth_user_b"));
    assert.ok(fromB.every((item) => item.metadata.institutionId !== "tenant_a"));
    assert.ok(fromB.every((item) => item.metadata.userId !== "auth_user_a"));
  });
});

test("picker do frontend oferece todos os formatos do Step 07", async () => {
  const fs = await import("node:fs/promises");
  const js = await fs.readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  const html = await fs.readFile(new URL("../../relatorio-qualidade-obras/relatorio-qualidade-obras.html", import.meta.url), "utf8");
  for (const value of [".pdf", ".txt", ".md", "text/plain", "text/markdown", "image/*"]) {
    assert.match(js, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
