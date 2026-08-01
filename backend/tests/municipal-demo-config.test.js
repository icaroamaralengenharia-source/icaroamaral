import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { validateMunicipalDemoConfig } from "../src/municipal-demo-config.js";

function validEnv(overrides = {}) {
  return Object.assign({
    APP_ENV: "demo",
    NODE_ENV: "production",
    MUNICIPAL_DEMO_MODE: "true",
    DEMO_SUPABASE_URL: "https://demoisoladoabcdefghijkl.supabase.co",
    DEMO_SUPABASE_ANON_KEY: "anon_demo_placeholder_123456",
    SUPABASE_SERVICE_ROLE_KEY: "service_demo_placeholder_123456",
    AI_ALLOWED_ORIGINS: "https://demo.exemplo.com",
    MUNICIPAL_WHATSAPP_ENABLED: "false",
    MUNICIPAL_EMAIL_ENABLED: "false",
    MUNICIPAL_DEMO_SEED_ENABLED: "false"
  }, overrides);
}

function statuses(result) {
  return Object.fromEntries(result.checks.map((check) => [check.id, check.status]));
}

test("aceita configuracao demo valida e sanitizada", () => {
  const result = validateMunicipalDemoConfig(validEnv());
  assert.equal(result.ok, true);
  assert.equal(result.config.appEnv, "demo");
  assert.equal(result.config.databaseConfigured, true);
  assert.deepEqual(result.config.integrations, { whatsapp: false, email: false, ai: "unavailable" });
});

test("rejeita ausencia de variavel obrigatoria", () => {
  const env = validEnv({ DEMO_SUPABASE_URL: "" });
  const result = validateMunicipalDemoConfig(env);
  assert.equal(result.ok, false);
  assert.equal(statuses(result).required_env, "fail");
});

test("rejeita projeto E2E autorizado como banco demo", () => {
  const result = validateMunicipalDemoConfig(validEnv({
    DEMO_SUPABASE_URL: "https://mplpzyalcxhhinuvjthx.supabase.co"
  }));
  assert.equal(result.ok, false);
  assert.equal(statuses(result).blocked_project_ref, "fail");
});

test("rejeita projeto proibido explicitamente", () => {
  const result = validateMunicipalDemoConfig(validEnv({
    DEMO_SUPABASE_URL: "https://lidueokjpzxdybtongbk.supabase.co"
  }));
  assert.equal(result.ok, false);
  assert.equal(statuses(result).blocked_project_ref, "fail");
});

test("rejeita origem wildcard", () => {
  const result = validateMunicipalDemoConfig(validEnv({ AI_ALLOWED_ORIGINS: "*" }));
  assert.equal(result.ok, false);
  assert.equal(statuses(result).origins_no_wildcard, "fail");
});

test("rejeita HTTP fora de localhost em ambiente demo", () => {
  const result = validateMunicipalDemoConfig(validEnv({ AI_ALLOWED_ORIGINS: "http://demo.exemplo.com" }));
  assert.equal(result.ok, false);
  assert.equal(statuses(result).origins_https, "fail");
});

test("rejeita WhatsApp ativo", () => {
  const result = validateMunicipalDemoConfig(validEnv({ MUNICIPAL_WHATSAPP_ENABLED: "true" }));
  assert.equal(result.ok, false);
  assert.equal(statuses(result).whatsapp_disabled, "fail");
});

test("rejeita e-mail ativo", () => {
  const result = validateMunicipalDemoConfig(validEnv({ MUNICIPAL_EMAIL_ENABLED: "true" }));
  assert.equal(result.ok, false);
  assert.equal(statuses(result).email_disabled, "fail");
});

test("nao expoe segredos no objeto sanitizado", () => {
  const env = validEnv({
    DEMO_SUPABASE_ANON_KEY: "anon_fixture_value_abcdefghijklmnopqrstuvwxyz",
    SUPABASE_SERVICE_ROLE_KEY: "service_fixture_value_abcdefghijklmnopqrstuvwxyz",
    OPENAI_API_KEY: "openai_fixture_value_abcdefghijklmnopqrstuvwxyz"
  });
  const result = validateMunicipalDemoConfig(env);
  const serialized = JSON.stringify(result.config);
  assert.equal(serialized.includes(env.DEMO_SUPABASE_ANON_KEY), false);
  assert.equal(serialized.includes(env.SUPABASE_SERVICE_ROLE_KEY), false);
  assert.equal(serialized.includes(env.OPENAI_API_KEY), false);
});

test("painel/backend municipal pode subir sem chave de IA", async () => {
  const app = createApp({
    env: { AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500" },
    eloSentinelSupabaseClient: null
  });
  await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", async () => {
      try {
        const port = server.address().port;
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        const data = await response.json();
        assert.equal(response.status, 200);
        assert.equal(data.ok, true);
        assert.equal(JSON.stringify(data).includes("OPENAI_API_KEY"), false);
        server.close(resolve);
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
});

test("health nao expoe dados sensiveis", async () => {
  const app = createApp({
    env: {
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
      SUPABASE_SERVICE_ROLE_KEY: "service_fixture_value_abcdefghijklmnopqrstuvwxyz",
      SUPABASE_URL: "https://demoisoladoabcdefghijkl.supabase.co"
    },
    eloSentinelSupabaseClient: null
  });
  await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", async () => {
      try {
        const port = server.address().port;
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        const text = await response.text();
        assert.equal(response.status, 200);
        assert.doesNotMatch(text, /service_fixture_value|supabase\.co|SUPABASE|Bearer|token|jwt/i);
        server.close(resolve);
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
});