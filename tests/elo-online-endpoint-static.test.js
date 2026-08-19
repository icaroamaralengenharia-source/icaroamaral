import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const assistant = readFileSync(new URL("../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
const eloPage = readFileSync(new URL("../elo.html", import.meta.url), "utf8");

test("ELO local preserva OBRAREPORT_API_BASE_URL configurado para o chat online", () => {
  assert.match(eloPage, /window\.OBRAREPORT_API_BASE_URL\s*=\s*window\.OBRAREPORT_API_BASE_URL\s*\|\|\s*"https:\/\/obrareport-backend\.onrender\.com"/);
  assert.match(assistant, /chatEndpoint:\s*getEloBackendEndpoint_\("\/api\/elo\/chat"\)/);
  assert.match(assistant, /const configuredBaseUrl = String\(window\.ELO_API_BASE_URL \|\| window\.OBRAREPORT_API_BASE_URL \|\| ""\)\.replace/);
  assert.match(assistant, /const baseUrl = configuredBaseUrl \|\| "http:\/\/localhost:3000";/);
  assert.doesNotMatch(assistant, /isLocalPage[\s\S]{0,240}\?\s*"http:\/\/localhost:3000"/);
});
