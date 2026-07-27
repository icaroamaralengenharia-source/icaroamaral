import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateE2eEnv } from "../../scripts/e2e/validate-e2e-env.mjs";

const statePath = resolve("backend/data/e2e-test-state.json");

test("jornada real ELO usa ambiente E2E isolado configurado", async () => {
  const { env } = loadE2eEnv([], process.env);
  const validation = validateE2eEnv(env);
  test.skip(!validation.ok, "Ambiente E2E real nao configurado com seguranca.");
  test.skip(!existsSync(statePath), "Execute scripts/e2e/setup-e2e-tenant.mjs antes da jornada real.");

  const state = JSON.parse(readFileSync(statePath, "utf8"));
  expect(state.slug).toBe(env.E2E_TENANT_SLUG);
  expect(state.slug).toMatch(/^elo-e2e-/);
  expect(state.ids.authUserId).toBeTruthy();
  expect(state.ids.companyId || state.ids.institutionId).toBeTruthy();
  expect(state.ids.clientId || state.tables.obrareport_clients).toBeTruthy();
  expect(state.ids.projectId || state.tables.obrareport_projects).toBeTruthy();
});
