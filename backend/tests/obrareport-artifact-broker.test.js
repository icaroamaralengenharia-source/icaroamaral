import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportArtifactBroker } from "../src/services/obrareport-artifact-broker.js";

const source = readFileSync(fileURLToPath(new URL("../../apps-script-versionado/Code.gs", import.meta.url)), "utf8");
const credential = "fixture-only-artifact-credential-000000000000";
const fileId = "fixture_pdf_id_0001";
const documentId = "doc-rdo-a";
const pdf = Buffer.from("%PDF-1.4\nfixture RDO rdo-a\n%%EOF");
const allowedFolder = source.match(/PDF_FOLDER_ID:\s*"([^"]+)"/)[1];

function provider(overrides = {}) {
  const logs = [];
  let reads = 0;
  let blobReads = 0;
  const context = vm.createContext({
    console: { log: (...args) => logs.push(args.join(" ")), error: (...args) => logs.push(args.join(" ")) },
    Logger: { log: (...args) => logs.push(args.join(" ")) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => overrides.secret ?? credential }) },
    Utilities: {
      getUuid: () => "fixture-request",
      DigestAlgorithm: { SHA_256: "sha256" },
      Charset: { UTF_8: "utf8" },
      computeDigest: (_algorithm, value) => Array.from(createHash("sha256").update(value).digest()),
      base64Encode: bytes => Buffer.from(bytes).toString("base64")
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(text) { return { text, setMimeType() { return this; } }; }
    },
    DriveApp: {
      getFileById(id) {
        reads += 1;
        assert.equal(id, fileId);
        if (overrides.missing) throw new Error("private provider details " + credential);
        let parents = [overrides.folder ?? allowedFolder];
        return {
          isTrashed: () => Boolean(overrides.trashed),
          getParents: () => ({ hasNext: () => parents.length > 0, next: () => ({ getId: () => parents.shift() }) }),
          getMimeType: () => overrides.mime ?? "application/pdf",
          getSize: () => overrides.size ?? pdf.length,
          getName: () => "../../RDO\r\ninjection.pdf",
          getBlob: () => { blobReads += 1; if (overrides.throwBlob) throw new Error(credential); return { getBytes: () => Array.from(overrides.bytes ?? pdf) }; }
        };
      }
    }
  });
  vm.runInContext(source, context);
  return {
    logs,
    reads: () => reads,
    blobReads: () => blobReads,
    runRaw(contents) {
      return JSON.parse(context.doPost({ postData: { contents } }).text);
    },
    run(payload = {}) {
      return JSON.parse(context.doPost({ postData: { contents: JSON.stringify({
        app: "ObraReport", action: "artifact.read", externalFileId: fileId, documentId, secret: credential, ...payload
      }) } }).text);
    }
  };
}

for (const [name, options, payload, code, status] of [
  ["missing credential", { secret: "" }, {}, "artifact_broker_not_configured", 503],
  ["invalid credential", {}, { secret: "incorrect" }, "artifact_access_denied", 403],
  ["missing request credential", {}, { secret: "" }, "artifact_access_denied", 403],
  ["invalid file ID/path", {}, { externalFileId: "../../arbitrary" }, "artifact_invalid_request", 400],
  ["missing artifact", { missing: true }, {}, "document_artifact_not_found", 404],
  ["trashed artifact", { trashed: true }, {}, "document_artifact_not_found", 404],
  ["outside authorized folder", { folder: "another-folder" }, {}, "artifact_access_denied", 403],
  ["non-PDF MIME", { mime: "image/png" }, {}, "artifact_not_pdf", 415],
  ["oversized artifact", { size: 10 * 1024 * 1024 + 1 }, {}, "artifact_too_large", 413],
  ["invalid PDF signature", { bytes: Buffer.alloc(pdf.length) }, {}, "artifact_not_pdf", 415],
  ["unexpected provider error sanitized", { throwBlob: true }, {}, "artifact_read_failed", 502]
]) {
  test("Apps Script artifact.read: " + name, () => {
    const fixture = provider(options);
    const result = fixture.run(payload);
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, code);
    assert.equal(result.status, status);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(credential));
    assert.deepEqual(fixture.logs, []);
    if (name.includes("credential") || name.includes("path")) assert.equal(fixture.reads(), 0);
    if (name === "oversized artifact") assert.equal(fixture.blobReads(), 0);
  });
}

test("Apps Script artifact.read: valid PDF only, no store/lock/log side effects", () => {
  const fixture = provider();
  const result = fixture.run();
  assert.equal(result.ok, true);
  assert.equal(result.documentId, documentId);
  assert.equal(result.fileId, fileId);
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.size, pdf.length);
  assert.deepEqual(Buffer.from(result.base64, "base64"), pdf);
  assert.doesNotMatch(result.fileName, /[\r\n/\\]/);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(credential));
  assert.deepEqual(fixture.logs, []);
});

test("Apps Script artifact.read: wrong app cannot reach legacy generation", () => {
  const fixture = provider();
  assert.equal(fixture.run({ app: "another-app" }).errorCode, "artifact_invalid_request");
  assert.equal(fixture.reads(), 0);
  assert.deepEqual(fixture.logs, []);
});

test("Apps Script: malformed credential-bearing JSON never enters logs", () => {
  const fixture = provider();
  const result = fixture.runRaw('{"secret":"' + credential + '"');
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result) + JSON.stringify(fixture.logs), new RegExp(credential));
});

function broker(fetchImpl, config = {}) {
  return createObraReportArtifactBroker({
    provider: "google_drive_apps_script", brokerUrl: "https://script.example.test/exec",
    brokerSecret: credential, fetchImpl, ...config
  });
}
const open = instance => instance.open({ document: { id: documentId, external_file_id: fileId, rdo_id: "rdo-a" } });
const jsonResponse = body => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

test("backend broker: missing endpoint/secret fails closed before fetch", async () => {
  for (const config of [{ brokerUrl: "" }, { brokerSecret: "" }, { fetchImpl: null }]) {
    await assert.rejects(open(broker(() => assert.fail("must not fetch"), config)), { message: "artifact_broker_not_configured", status: 503 });
  }
});

test("backend broker: protected Apps Script roundtrip decodes the requested artifact", async () => {
  const fixture = provider();
  const instance = broker(async (url, init) => {
    assert.equal(url, "https://script.example.test/exec");
    assert.match(init.headers["Content-Type"], /^text\/plain/);
    assert.equal(init.headers["X-ObraReport-Artifact-Secret"], undefined);
    const request = JSON.parse(init.body);
    assert.equal(request.secret, credential);
    return jsonResponse(fixture.run(request));
  });
  const result = await open(instance);
  assert.deepEqual(result.bytes, pdf);
  assert.equal(result.contentType, "application/pdf");
});

test("backend broker: provider errors preserve only controlled codes", async () => {
  for (const [code, status] of [["artifact_access_denied", 403], ["document_artifact_not_found", 404], ["artifact_too_large", 413], ["artifact_not_pdf", 415]]) {
    await assert.rejects(open(broker(async () => jsonResponse({ ok: false, errorCode: code, error: credential }))), { message: code, status });
  }
  await assert.rejects(open(broker(async () => { throw new Error(credential); })), error => {
    assert.equal(error.message, "artifact_broker_unavailable");
    assert.equal(error.cause, undefined);
    assert.doesNotMatch(JSON.stringify(error), new RegExp(credential));
    return true;
  });
});

test("backend broker: MIME, size, identity, base64 and signature are validated", async () => {
  const valid = provider().run();
  for (const [change, code] of [
    [{ mimeType: "text/html" }, "artifact_not_pdf"],
    [{ fileId: "different" }, "artifact_broker_identity_mismatch"],
    [{ documentId: "another-document" }, "artifact_broker_identity_mismatch"],
    [{ size: 10 * 1024 * 1024 + 1 }, "artifact_too_large"],
    [{ size: 0 }, "artifact_too_large"],
    [{ base64: "!!!!" }, "artifact_broker_invalid_response"],
    [{ base64: Buffer.alloc(pdf.length).toString("base64") }, "artifact_not_pdf"]
  ]) {
    await assert.rejects(open(broker(async () => jsonResponse({ ...valid, ...change }))), { message: code });
  }
  await assert.rejects(open(broker(async () => new Response("not JSON", { headers: { "Content-Type": "application/json" } }))), { message: "artifact_broker_invalid_response" });
  await assert.rejects(open(broker(async () => new Response("large", { headers: { "Content-Type": "application/json", "Content-Length": String(15 * 1024 * 1024) } }))), { message: "artifact_too_large" });
});

test("backend broker: explicit binary provider remains supported", async () => {
  const result = await open(broker(async (_url, init) => {
    assert.equal(init.headers["X-ObraReport-Artifact-Secret"], credential);
    return new Response(pdf, { headers: { "Content-Type": "application/pdf" } });
  }, { provider: "http_pdf" }));
  assert.deepEqual(result.bytes, pdf);
});

test("HTTP PDF: Apps Script URL fallback, RDO linkage, content/file and tenant isolation", async () => {
  const fixture = provider();
  let document;
  let generatorCalls = 0;
  let artifactCalls = 0;
  const rdoRepository = {
    async getById(context, id) {
      if (id !== "rdo-a" || context.institutionId !== "tenant-a") throw Object.assign(new Error("rdo_not_found"), { status: 404 });
      return { id, project_id: "work-a", rdo_date: "2026-10-14", rdo_data_json: { summary: "same existing RDO" } };
    }
  };
  const store = {
    async validateWork(context, id) {
      if (context.institutionId !== "tenant-a" || id !== "work-a") throw Object.assign(new Error("work_not_found"), { status: 404 });
      return { id, name: "Fixture work", institution_id: "tenant-a" };
    },
    async findByIdempotencyKey(context, key) { return document?.institution_id === context.institutionId && document.idempotency_key === key ? document : null; },
    async insert(context, input) {
      document = { id: documentId, institution_id: context.institutionId, work_id: input.workId, rdo_id: input.rdoId,
        source_type: input.sourceType, source_id: input.sourceId, external_file_id: input.externalFileId,
        idempotency_key: input.idempotencyKey, title: "RDO\r\nunsafe/title", provider: input.provider, metadata_json: input.metadata };
      return { document, duplicate: false };
    },
    async getById(context, id) {
      if (!document || id !== document.id || document.institution_id !== context.institutionId) throw Object.assign(new Error("document_not_found"), { status: 404 });
      return document;
    }
  };
  const auth = {
    auth: { async getUser(token) { return { data: { user: { id: token === "b" ? "user-b" : "user-a" } }, error: null }; } },
    from() { return { select() { return { eq(_key, id) { return { async maybeSingle() { return { data: {
      id, auth_user_id: id, institution_id: id === "user-b" ? "tenant-b" : "tenant-a", role: "admin"
    }, error: null }; } }; } }; } }; }
  };
  const app = createApp({
    authContextSupabaseClient: auth, documentRepository: store, rdoRepository,
    obraReportTransactionalService: { getRdo: rdoRepository.getById },
    env: { OBRAREPORT_APPS_SCRIPT_URL: "https://script.example.test/exec", OBRAREPORT_ARTIFACT_BROKER_SECRET: credential },
    reportGeneratorFetch: async () => { generatorCalls += 1; return jsonResponse({ ok: true, pdfFileId: fileId, pdfUrl: "https://drive.google.com/file/d/" + fileId + "/view" }); },
    artifactBrokerFetch: async (_url, init) => { artifactCalls += 1; return jsonResponse(fixture.run(JSON.parse(init.body))); }
  });
  const server = await new Promise(resolve => { const instance = app.listen(0, () => resolve(instance)); });
  const base = "http://127.0.0.1:" + server.address().port;
  const headers = { Authorization: "Bearer a", "Content-Type": "application/json" };
  try {
    const generate = () => fetch(base + "/api/obrareport/rdos/rdo-a/generate-document", { method: "POST", headers, body: "{}" });
    const generated = await generate();
    assert.equal(generated.status, 201);
    const body = await generated.json();
    assert.equal(body.document.rdo_id, "rdo-a");
    assert.equal(body.document.source_id, "rdo-a");
    assert.equal(body.document.work_id, "work-a");
    assert.equal(body.document.provider, "google_drive_apps_script");
    assert.doesNotMatch(JSON.stringify(body), /drive\.google\.com|external_file_id/);
    assert.equal((await generate()).status, 200);
    assert.equal(generatorCalls, 1);
    for (const suffix of ["content", "file"]) {
      const result = await fetch(base + "/api/obrareport/documents/" + documentId + "/" + suffix, { headers });
      assert.equal(result.status, 200);
      assert.match(result.headers.get("content-type"), /^application\/pdf/);
      assert.equal(result.headers.get("cache-control"), "private, no-store");
      assert.doesNotMatch(result.headers.get("content-disposition"), /[\r\n]/);
      assert.deepEqual(Buffer.from(await result.arrayBuffer()), pdf);
    }
    assert.equal((await fetch(base + "/api/obrareport/documents/" + documentId + "/content")).status, 401);
    assert.equal((await fetch(base + "/api/obrareport/documents/" + documentId + "/content", { headers: { Authorization: "Bearer b" } })).status, 404);
    assert.equal(artifactCalls, 2);
    assert.deepEqual(fixture.logs, []);
  } finally {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
});
