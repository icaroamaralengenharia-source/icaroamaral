import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";

let server;
let baseUrl;

before(async () => {
  const app = createApp({
    env: {
      PORT: "0",
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500"
    }
  });

  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  baseUrl = "http://127.0.0.1:" + server.address().port;
});

after(async () => {
  if (!server) {
    return;
  }

  await new Promise((resolve) => server.close(resolve));
});

test("health responde ok", async () => {
  const response = await fetch(baseUrl + "/api/health");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
});

test("bloqueia action inválida", async () => {
  const response = await postAi_({
    action: "invalid",
    text: "teste",
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("valida texto vazio em improve", async () => {
  const response = await postAi_({
    action: "improve",
    text: "",
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("sem chave retorna erro amigável para fallback local", async () => {
  const response = await postAi_({
    action: "review",
    text: "",
    context: {
      report: {
        obra: "Obra teste"
      },
      stats: {
        fotos: 1,
        inconformidades: 0,
        riscosAltos: 0
      }
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.match(data.error, /OPENAI_API_KEY/);
});

test("análise visual exige imagem processada", async () => {
  const response = await postImage_({
    image: {},
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("análise visual sem chave retorna erro amigável", async () => {
  const response = await postImage_({
    image: {
      base64: tinyJpegBase64_(),
      mimeType: "image/jpeg",
      fileName: "teste.jpg",
      width: 1,
      height: 1
    },
    context: {
      report: {
        obra: "Obra teste"
      }
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.match(data.error, /OPENAI_API_KEY/);
});

test("stock demo sincroniza estado remoto em memoria", async () => {
  const key = "prefeitura-sao-joao-secretaria";
  const state = {
    items: [{ id: "item-1", name: "Mascara", environmentId: "env-1" }],
    movements: [],
    approvalRequests: [],
    stockEnvironments: [{ id: "env-1", clientName: "Prefeitura Sao Joao" }],
    activeStockEnvironmentId: "env-1"
  };

  const saveResponse = await postStockDemoState_({ key, state });
  const saveData = await saveResponse.json();
  assert.equal(saveResponse.status, 200);
  assert.equal(saveData.ok, true);
  assert.equal(saveData.revision, 1);

  const getResponse = await fetch(baseUrl + "/api/stock-demo/state?key=" + encodeURIComponent(key));
  const getData = await getResponse.json();
  assert.equal(getResponse.status, 200);
  assert.equal(getData.ok, true);
  assert.equal(getData.state.items[0].name, "Mascara");
});

test("stock demo registra solicitacao de aprovacao", async () => {
  const response = await postStockDemoApproval_({
    key: "prefeitura-sao-joao-aprovacao",
    request: {
      id: "apv-1",
      environmentId: "env-1",
      organizationId: "env-1",
      role: "almoxarife",
      type: "entrada",
      status: "pending",
      payload: {
        product: "Luva",
        quantity: 50,
        unit: "cx"
      }
    },
    state: {
      items: [],
      movements: [],
      approvalRequests: [],
      stockEnvironments: [{ id: "env-1" }],
      activeStockEnvironmentId: "env-1"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.state.approvalRequests.length, 1);
  assert.equal(data.state.approvalRequests[0].status, "pending");
});

function postAi_(body) {
  return fetch(baseUrl + "/api/ai/improve-text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postImage_(body) {
  return fetch(baseUrl + "/api/ai/analyze-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postStockDemoState_(body) {
  return fetch(baseUrl + "/api/stock-demo/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postStockDemoApproval_(body) {
  return fetch(baseUrl + "/api/stock-demo/approval-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function tinyJpegBase64_() {
  return "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAARD/2gAIAQEAAT8QH//Z";
}
