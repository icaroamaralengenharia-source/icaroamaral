import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("ELO Autopilot API prepara, publica uma vez e cancela por servico oficial", async () => {
  const calls = [];
  const app = createApp({
    env: { PORT: "0" },
    eloAutopilotService: {
      async prepare(input) {
        calls.push({ type: "prepare", input });
        return {
          draftId: "draft-api-1",
          topic: input.topic,
          report: { sourcesRead: 2, llm: "PASS", antiCopy: "PASS", antiHallucination: "PASS", image: "PASS", post: "PASS", seo: "PASS", sitemap: "PASS", publication: false, blockers: [] },
          draft: { titulo: "BIM em obras sustentaveis", slug: "bim-obras-sustentaveis", fontes: [{ fonte: "Fonte A" }] }
        };
      },
      async publish(input) {
        calls.push({ type: "publish", input });
        return { draftId: input.draftId, post: { titulo: "BIM em obras sustentaveis", slug: "bim-obras-sustentaveis" }, publication: true };
      },
      async cancel(input) {
        calls.push({ type: "cancel", input });
        return { draftId: input.draftId };
      }
    }
  });

  await withServer(app, async (baseUrl) => {
    const prepare = await fetch(baseUrl + "/api/elo/autopilot/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "BIM" })
    });
    const prepared = await prepare.json();
    assert.equal(prepare.status, 200);
    assert.equal(prepared.ok, true);
    assert.equal(prepared.draftId, "draft-api-1");
    assert.equal(prepared.report.publication, false);

    const publish = await fetch(baseUrl + "/api/elo/autopilot/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: prepared.draftId })
    });
    const published = await publish.json();
    assert.equal(publish.status, 200);
    assert.equal(published.ok, true);
    assert.equal(published.publication, true);

    const cancel = await fetch(baseUrl + "/api/elo/autopilot/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: "draft-api-2" })
    });
    const cancelled = await cancel.json();
    assert.equal(cancel.status, 200);
    assert.equal(cancelled.ok, true);
  });

  assert.deepEqual(calls.map((call) => call.type), ["prepare", "publish", "cancel"]);
  assert.equal(calls[1].input.draftId, "draft-api-1");
});
