import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PAGE_PATH = "/relatorio-qualidade-obras/relatorio-qualidade-obras.html";

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
      const requestPath = decodeURIComponent(requestUrl.pathname === "/" ? PAGE_PATH : requestUrl.pathname);
      const filePath = path.resolve(rootDir, `.${requestPath}`);

      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      fs.readFile(filePath, (error, data) => {
        if (error) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        res.writeHead(200, { "content-type": getContentType(filePath) });
        res.end(data);
      });
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

async function submitEloMessage(page, message) {
  const assistantCount = await page.locator(".elo-message.assistant").count();
  await page.evaluate((text) => {
    const input = document.querySelector(".report-elo-chat .elo-input");
    const form = document.querySelector(".report-elo-chat .elo-input-row");
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }, message);
  await page.waitForFunction((countBefore) => {
    const messages = Array.from(document.querySelectorAll(".elo-message.assistant"));
    const last = messages[messages.length - 1];
    return messages.length > countBefore && Boolean(last && last.textContent && !last.textContent.includes("Estou analisando"));
  }, assistantCount, { timeout: 30000 });
}

test("real report UI submits to the residential V2 budget flow", { timeout: 120000 }, async () => {
  const { server, baseUrl } = await startStaticServer(REPO_ROOT);
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];

  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      const now = new Date().toISOString();
      const user = {
        id: "test_user_elo_bridge",
        name: "Teste Elo Bridge",
        email: "elo-bridge@test.local",
        role: "admin",
        createdAt: now,
        updatedAt: now
      };
      localStorage.setItem("obrareport-saas-v1", JSON.stringify({
        version: 1,
        users: [user],
        clients: [],
        projects: [],
        reports: [],
        materials: [],
        materialMovements: [],
        stockSettings: {},
        reportSequence: 0,
        session: {
          userId: user.id,
          localOnly: true,
          signedInAt: now
        },
        local: { updatedAt: now }
      }));
      sessionStorage.setItem("obrareport_local_access_granted_v1", "granted");
    });

    await page.goto(`${baseUrl}${PAGE_PATH}`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      const authState = localStorage.getItem("obrareport-saas-v1");
      localStorage.clear();
      if (authState) localStorage.setItem("obrareport-saas-v1", authState);
      sessionStorage.clear();
      sessionStorage.setItem("obrareport_local_access_granted_v1", "granted");
      if (window.EloAssistente && typeof window.EloAssistente.clearBudgetRecordsForTest === "function") {
        window.EloAssistente.clearBudgetRecordsForTest();
      }
    });

    await page.reload({ waitUntil: "networkidle" });
    await page.evaluate(() => {
      if (window.EloAssistente && typeof window.EloAssistente.clearBudgetRecordsForTest === "function") {
        window.EloAssistente.clearBudgetRecordsForTest();
      }
    });


    if ((await page.locator("body").innerText()).includes("Acesso restrito")) {
      await page.evaluate(() => {
        const input = document.querySelector('#loginForm input[name="userPassword"]');
        const form = document.querySelector("#loginForm");
        input.value = "ObraReport2026";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(500);
    }

    const bridgeState = await page.evaluate(() => ({
      hasPublicBuildResponse: Boolean(window.EloAssistente && typeof window.EloAssistente.buildResponse === "function"),
      formBound: document.querySelector(".report-elo-chat .elo-input-row")?.dataset.eloEngineBound
    }));

    assert.equal(bridgeState.hasPublicBuildResponse, true);
    assert.equal(bridgeState.formBound, "true");

    const messages = [
      "Casa 80 m2 em Vitoria da Conquista BA, padrao medio, 1 pavimento, estrutura convencional, telha ceramica, SINAPI BA 2024-12 nao desonerado.",
      "Use BDI de 25%.",
      "Gerar orçamento.",
      "Gerar PDF profissional."
    ];

    for (const message of messages) {
      await submitEloMessage(page, message);
    }

    const bodyText = await page.$$eval(".elo-message.assistant", (nodes) => nodes.slice(-8).map((node) => node.textContent || "").join("\n---\n"));
    assert.match(bodyText, /Orcamento residencial V2 criado/i);
    assert.match(bodyText, /SINAPI/i);
    assert.match(bodyText, /BA/i);
    assert.doesNotMatch(bodyText, /O resultado [ée] 2012/i);
    assert.doesNotMatch(bodyText, /Como posso te ajudar\?/i);

    const pdfButtons = page.locator('[data-elo-action-type="budget_v2_professional_pdf"]');
    assert.ok(await pdfButtons.count() >= 1);

    await submitEloMessage(page, "Revisar composicoes.");
    const reviewText = await page.$$eval(".elo-message.assistant", (nodes) => nodes.slice(-4).map((node) => node.textContent || "").join("\n---\n"));
    assert.match(reviewText, /reboco/i);
    assert.match(reviewText, /esquadrias_janelas/i);
    assert.match(reviewText, /pontos_iluminacao/i);
    assert.match(reviewText, /limpeza_final/i);

    const pdfButtonState = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[data-elo-action-type="budget_v2_professional_pdf"]'));
      const button = buttons[buttons.length - 1];
      return {
        type: button && button.dataset ? button.dataset.eloActionType : "",
        text: button ? button.textContent || "" : ""
      };
    });

    assert.equal(pdfButtonState.type, "budget_v2_professional_pdf");
    assert.match(pdfButtonState.text, /PDF|orcamento|orçamento/i);

    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
