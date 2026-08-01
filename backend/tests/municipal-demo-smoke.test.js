import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { validateMunicipalDemoConfig } from "../src/municipal-demo-config.js";

function validEnv(overrides = {}) {
  return Object.assign({
    APP_ENV: "demo",
    NODE_ENV: "production",
    MUNICIPAL_DEMO_MODE: "true",
    DEMO_SUPABASE_URL: "https://demoisoladosemreferencia.supabase.co",
    DEMO_SUPABASE_ANON_KEY: "anon_demo_placeholder_123456",
    SUPABASE_SERVICE_ROLE_KEY: "service_demo_placeholder_123456",
    AI_ALLOWED_ORIGINS: "https://demo.exemplo.com",
    MUNICIPAL_WHATSAPP_ENABLED: "false",
    MUNICIPAL_EMAIL_ENABLED: "false"
  }, overrides);
}

function statusOf(result, id) {
  return result.checks.find((check) => check.id === id)?.status;
}

test("configuracao demo rejeita CORS wildcard, E2E e producao conhecida", () => {
  assert.equal(statusOf(validateMunicipalDemoConfig(validEnv({ AI_ALLOWED_ORIGINS: "*" })), "origins_no_wildcard"), "fail");
  assert.equal(statusOf(validateMunicipalDemoConfig(validEnv({ DEMO_SUPABASE_URL: "https://mplpzyalcxhhinuvjthx.supabase.co" })), "blocked_project_ref"), "fail");
  assert.equal(statusOf(validateMunicipalDemoConfig(validEnv({ DEMO_SUPABASE_URL: "https://lidueokjpzxdybtongbk.supabase.co" })), "blocked_project_ref"), "fail");
});

test("painel/backend municipal inicia sem chave de IA", async () => {
  const result = validateMunicipalDemoConfig(validEnv({ OPENAI_API_KEY: "" }));
  assert.equal(result.ok, true);
  assert.equal(result.config.integrations.ai, "unavailable");

  const app = createApp({
    env: { AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500" },
    eloSentinelSupabaseClient: null
  });
  await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", async () => {
      try {
        const port = server.address().port;
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        const text = await response.text();
        assert.equal(response.status, 200);
        assert.doesNotMatch(text, /OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|Bearer|jwt|token/i);
        server.close(resolve);
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
});

test("falha segura quando banco demo nao esta configurado", () => {
  const result = validateMunicipalDemoConfig(validEnv({ DEMO_SUPABASE_URL: "" }));
  assert.equal(result.ok, false);
  assert.equal(statusOf(result, "required_env"), "fail");
  assert.equal(JSON.stringify(result.config).includes("service_demo_placeholder_123456"), false);
});
