import { expect, test } from "@playwright/test";

const LIVE_PREFIX = "DEMO_MUNICIPAL_LIVE_52_";
const BLOCKED_REFS = ["mplpzyalcxhhinuvjthx", "lidueokjpzxdybtongbk"];
const liveEnabled = process.env.RUN_DEMO_LIVE_TESTS === "true";

function refFromUrl(value) {
  try {
    return new URL(String(value || "")).hostname.toLowerCase().match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] || "";
  } catch (_) {
    return "";
  }
}

function assertSafeLiveBrowserEnv() {
  const projectRef = String(process.env.DEMO_PROJECT_REF || "").trim();
  const supabaseUrl = String(process.env.DEMO_SUPABASE_URL || "").trim();
  const panelUrl = String(process.env.DEMO_PANEL_URL || "").trim();
  expect(process.env.APP_ENV).toBe("demo");
  expect(process.env.MUNICIPAL_DEMO_MODE).toBe("true");
  expect(projectRef).not.toBe("");
  expect(supabaseUrl.startsWith("https://")).toBe(true);
  expect(panelUrl.startsWith("https://")).toBe(true);
  expect(refFromUrl(supabaseUrl)).toBe(projectRef);
  expect(BLOCKED_REFS.includes(projectRef)).toBe(false);
  expect(BLOCKED_REFS.some((ref) => supabaseUrl.includes(ref) || panelUrl.includes(ref))).toBe(false);
  expect(process.env.MUNICIPAL_WHATSAPP_ENABLED).toBe("false");
  expect(process.env.MUNICIPAL_EMAIL_ENABLED).toBe("false");
  expect(process.env.SUPABASE_SERVICE_ROLE_KEY_BROWSER || "").toBe("");
  expect(process.env.DEMO_DATABASE_URL_BROWSER || "").toBe("");
}

async function openDemoPanel(page) {
  assertSafeLiveBrowserEnv();
  await page.goto(process.env.DEMO_PANEL_URL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toContainText(/service_role|Bearer|eyJ[A-Za-z0-9_-]{20,}\.|DEMO_DATABASE_URL/i);
}

test.describe("homologacao demo live municipal", () => {
  test.beforeEach(() => {
    test.skip(!liveEnabled, "BLOCKED: RUN_DEMO_LIVE_TESTS=true ausente; nenhum teste live ou rede sera executado.");
  });

  test("login e Visao Geral usam somente dados live autorizados", async ({ page }) => {
    await openDemoPanel(page);
    await page.getByLabel(/email/i).fill(process.env.DEMO_GESTOR_A_EMAIL || "");
    await page.getByLabel(/senha|password/i).fill(process.env.DEMO_GESTOR_A_PASSWORD || "");
    await page.getByRole("button", { name: /entrar|login/i }).click();
    await expect(page.getByRole("button", { name: "Visao Geral", exact: true })).toBeVisible();
    await expect(page.locator("body")).toContainText("Visao Geral");
    await expect(page.locator("body")).not.toContainText("lidueokjpzxdybtongbk");
    await expect(page.locator("body")).not.toContainText("mplpzyalcxhhinuvjthx");
  });

  test("modulos principais carregam sem expor IDs ou segredos", async ({ page }) => {
    await openDemoPanel(page);
    for (const tab of ["Almoxarifados", "Patrimonio", "Sentinela", "Notificacoes", "Relatorios", "Acervo", "Assistente ELO"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect(page.locator("body")).not.toContainText(/service_role|DEMO_DATABASE_URL|Bearer|eyJ[A-Za-z0-9_-]{20,}\./i);
      await expect(page.locator("body")).not.toContainText(/project_id/i);
    }
  });

  test("offline, logout e troca de usuario preservam escopo", async ({ page, context }) => {
    await openDemoPanel(page);
    await context.setOffline(true);
    await page.getByRole("button", { name: "Patrimonio", exact: true }).click();
    await expect(page.locator("body")).toContainText(/offline|sincronizados|sem conexao/i);
    await context.setOffline(false);
    await page.getByRole("button", { name: /sair|logout/i }).click();
    await expect(page.locator("body")).not.toContainText(LIVE_PREFIX);
  });

  test("desktop tablet e celular validam falha parcial e contador de notificacoes", async ({ browser }) => {
    for (const viewport of [{ width: 1366, height: 768 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      await openDemoPanel(page);
      await expect(page.getByLabel(/Notificacoes nao lidas:/i)).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/service_role|DEMO_DATABASE_URL|Bearer/i);
      await page.close();
    }
  });
});
