import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PRODUCT_NAMES = [
  "Cimento E2E",
  "Areia E2E",
  "Brita E2E",
  "Vergalhao E2E",
  "Tijolo E2E",
  "Cal E2E",
  "Argamassa E2E",
  "Tinta E2E",
  "Eletroduto E2E",
  "Parafuso E2E"
];

async function loginLocal(page) {
  await page.goto("/relatorio-qualidade-obras.html#app/almoxarifado");
  await page.keyboard.press("Control+F5").catch(() => {});
  await page.waitForLoadState("domcontentloaded");

  if (await page.locator("#loginForm").isVisible().catch(() => false)) {
    await page.locator("[name='userPassword']").fill("ObraReport2026");
    await page.locator("#loginForm").locator("button[type='submit']").click();
  }

  await expect(page.locator("#almoxManagerPanel")).toBeVisible();
}

async function goToRoute(page, route) {
  await page.evaluate((nextRoute) => {
    window.location.hash = "#app/" + nextRoute;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, route);
  await page.waitForTimeout(150);
}

async function submitClient(page) {
  await goToRoute(page, "clientes");
  await expect(page.locator("#clientForm")).toBeVisible();
  await page.locator("#clientForm [name='clientName']").fill("Cliente E2E Almoxarifado");
  await page.locator("#clientForm [name='clientDocument']").fill("00.000.000/0001-00");
  await page.locator("#clientForm [name='clientPhone']").fill("(11) 99999-0000");
  await page.locator("#clientForm [name='clientEmail']").fill("cliente.e2e@obrareport.local");
  await page.locator("#clientForm [name='clientNotes']").fill("Cliente criado pelo E2E do Almoxarifado.");
  await page.locator("#clientForm").locator("button[type='submit']").click();
}

async function submitWork(page) {
  await goToRoute(page, "obras");
  await expect(page.locator("#workForm")).toBeVisible();
  const clientSelect = page.locator("#workForm [name='workClientId']");
  await expect.poll(async () => clientSelect.locator("option").count()).toBeGreaterThan(1);
  await clientSelect.selectOption({ index: 1 });
  await page.locator("#workForm [name='workName']").fill("Obra E2E Almoxarifado");
  await page.locator("#workForm [name='workAddress']").fill("Rua do Teste, 100");
  await page.locator("#workForm [name='workType']").selectOption({ index: 1 });
  await page.locator("#workForm [name='workStatus']").selectOption({ index: 1 }).catch(async () => {
    await page.locator("#workForm [name='workStatus']").fill("Em andamento");
  });
  await page.locator("#workForm").locator("button[type='submit']").click();
}

async function openAlmoxModal(page, action) {
  await page.locator(`[data-almox-action="${action}"]`).first().click();
  const form = page.locator("#almoxModal form").first();
  await expect(form).toBeVisible();
  return form;
}

async function submitAlmoxModal(page, form) {
  await form.locator("[data-almox-modal-submit]").click();
  await expect(page.locator("#almoxModal")).toHaveClass(/is-hidden/);
}

async function selectOptionByText(select, text) {
  const value = await select.evaluate((element, expectedText) => {
    const option = Array.from(element.options).find((candidate) => candidate.textContent.trim().startsWith(expectedText));
    return option ? option.value : "";
  }, text);
  expect(value, `option for ${text}`).not.toBe("");
  await select.selectOption(value);
}

async function createProduct(page, index) {
  const form = await openAlmoxModal(page, "item");
  await form.locator("[name='name']").fill(PRODUCT_NAMES[index]);
  await form.locator("[name='category']").fill("E2E");
  await form.locator("[name='unit']").fill(index === 0 ? "saco" : "un");
  await form.locator("[name='initialQuantity']").fill(String(20 + index));
  await form.locator("[name='minimumStock']").fill(index === 0 ? "40" : "5");
  await form.locator("[name='location']").fill("Almoxarifado E2E");
  await submitAlmoxModal(page, form);
}

async function createEntry(page, index) {
  const form = await openAlmoxModal(page, "entry");
  await selectOptionByText(form.locator("[name='itemId']"), PRODUCT_NAMES[index]);
  await form.locator("[name='quantity']").fill(String(10 + index));
  await form.locator("[name='responsible']").fill("Auditor E2E");
  await form.locator("[name='documentNumber']").fill("NF-E2E-" + String(index + 1).padStart(2, "0"));
  await form.locator("[name='notes']").fill("Entrada criada pelo E2E.");
  await submitAlmoxModal(page, form);
}

async function createExit(page, index, quantity) {
  const form = await openAlmoxModal(page, "exit");
  await selectOptionByText(form.locator("[name='itemId']"), PRODUCT_NAMES[index]);
  await form.locator("[name='quantity']").fill(String(quantity));
  await form.locator("[name='recipient']").fill("Mestre E2E");
  await form.locator("[name='sector']").fill("Obra E2E");
  await form.locator("[name='purpose']").fill("Execucao de servico E2E");
  await form.locator("[name='responsible']").fill("Almoxarife E2E");
  await form.locator("[name='notes']").fill("Saida criada pelo E2E.");
  return form;
}

test.describe("Almoxarifado", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/relatorio-qualidade-obras.html");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test("fluxo completo de estoque, auditoria, historico e Elo", async ({ page }) => {
    await loginLocal(page);
    await submitClient(page);
    await submitWork(page);
    await goToRoute(page, "almoxarifado");
    await expect(page.locator("#almoxManagerPanel")).toBeVisible();

    for (let index = 0; index < PRODUCT_NAMES.length; index += 1) {
      await createProduct(page, index);
    }

    await expect(page.locator("#almoxItemsSection")).toContainText(PRODUCT_NAMES[0]);

    for (let index = 0; index < PRODUCT_NAMES.length; index += 1) {
      await createEntry(page, index);
    }

    for (let index = 0; index < PRODUCT_NAMES.length; index += 1) {
      const form = await createExit(page, index, index % 3 === 0 ? 5 : 2);
      await submitAlmoxModal(page, form);
    }

    const blockedForm = await createExit(page, 0, 9999);
    await blockedForm.locator("[data-almox-modal-submit]").click();
    await expect(page.locator("#almoxActionMessage")).toContainText(/Saldo insuficiente/i);
    await page.locator("#almoxModal [data-almox-modal-close]").last().click();
    await expect(page.locator("#almoxModal")).toHaveClass(/is-hidden/);

    await page.locator("#almoxManagerPanel a[href='#almoxHistorySection']").click();
    await expect(page.locator("#almoxHistorySection")).toContainText("Mestre E2E");
    await expect(page.locator("#almoxHistorySection")).toContainText("NF-E2E");

    await page.locator("#almoxSummaryButton").click();
    await expect(page.locator("#almoxGeneratedReport")).not.toHaveClass(/is-hidden/);
    await expect(page.locator("#almoxGeneratedReport")).toContainText(/Resumo|Auditoria|Cimento E2E/i);

    await page.locator("#almoxAuditButton").click();
    await expect(page.locator("#almoxGeneratedReport")).toContainText(/Auditoria|risco|saldo/i);

    await page.locator("[data-almox-elo-action='risk']").click();
    await expect(page.locator("#almoxActionMessage")).toContainText(/Elo|Pergunta enviada/i);

    await page.locator("[data-almox-elo-form] [name='almoxEloQuestion']").fill("Elo, quais itens exigem atencao?");
    await page.locator("[data-almox-elo-form]").evaluate((form) => form.requestSubmit());
    await expect(page.locator("#almoxActionMessage")).toContainText(/Elo|Pergunta enviada/i);

    await expect(page.locator(".almox-elo-card")).toBeVisible();
    await expect(page.locator(".almox-elo-input-row input")).toBeVisible();
    await expect(page.locator("#almoxManagerPanel")).toBeVisible();
  });

  test("Stock Full abre Loja e Gestor reaproveitando o Almoxarifado", async ({ page }) => {
    const stockFullUrl = pathToFileURL(resolve("stock-full.html")).toString();
    await page.goto(stockFullUrl);
    await expect(page.locator("h1")).toHaveText("Stock Full");

    await page.locator("a", { hasText: "Abrir Loja" }).first().click();
    await expect(page).toHaveURL(/produto=stock-full/);
    await expect(page).toHaveURL(/perfil=loja/);
    await expect(page.locator("#almoxManagerPanel")).toBeVisible();
    await expect(page.locator("[data-stock-full-banner]")).toContainText("Modo Stock Full");
    await expect(page.locator("[data-stock-full-text='title']")).toHaveText("Stock Full");
    await expect(page.locator("[data-almox-action='item']").first()).toContainText("Cadastrar produto");
    await expect(page.locator("[data-almox-action='entry']").first()).toBeVisible();
    await expect(page.locator("[data-almox-action='exit']").first()).toBeVisible();

    await page.goto(stockFullUrl);
    await page.locator("a", { hasText: "Abrir Gestor" }).first().click();
    await expect(page).toHaveURL(/produto=stock-full/);
    await expect(page).toHaveURL(/perfil=gestor/);
    await expect(page.locator("#almoxManagerPanel")).toBeVisible();
    await expect(page.locator("[data-stock-full-text='managerTitle']")).toHaveText("Central do Gestor");
    await expect(page.locator("#almoxManagerAuditButton")).toBeVisible();
    await expect(page.locator("#almoxDownloadPdfButton")).toBeVisible();
    await expect(page.locator("#almoxEmailButton")).toBeVisible();
    await expect(page.locator("[data-almox-action='entry']").first()).toBeVisible();
    await expect(page.locator("[data-almox-action='exit']").first()).toBeVisible();
  });
});
